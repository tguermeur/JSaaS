import { collection, query, where, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase/config';

export const fetchStripePaymentIntents = async (structureId: string, userId: string) => {
  try {
    const fn = httpsCallable<{ structureId: string }, {
      success: boolean;
      paymentIntents: unknown[];
      has_more?: boolean;
      total_count?: number;
    }>(getFunctions(), 'fetchUserStripePaymentIntents');

    const { data } = await fn({ structureId });
    return {
      success: data.success,
      paymentIntents: data.paymentIntents ?? [],
      has_more: data.has_more ?? false,
      total_count: data.total_count ?? data.paymentIntents?.length ?? 0,
    };
  } catch (error) {
    console.error('Erreur lors de la récupération des Payment Intents:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
      paymentIntents: [] as unknown[],
    };
  }
};

export const checkPaymentIntentExists = async (paymentIntentId: string) => {
  try {
    const subscriptionsRef = collection(db, 'subscriptions');
    const q = query(subscriptionsRef, where('stripeSessionId', '==', paymentIntentId));
    const querySnapshot = await getDocs(q);
    return !querySnapshot.empty;
  } catch (error) {
    console.error('Erreur lors de la vérification du Payment Intent:', error);
    return false;
  }
};

export const syncRefundsWithSubscriptions = async (structureId: string, userId: string) => {
  try {
    const stripeResult = await fetchStripePaymentIntents(structureId, userId);
    if (!stripeResult.success) {
      return 0;
    }

    const subscriptionsRef = collection(db, 'subscriptions');
    const q = query(subscriptionsRef, where('userId', '==', userId));
    const querySnapshot = await getDocs(q);

    let updatedCount = 0;
    const payments = stripeResult.paymentIntents as Array<{
      id: string;
      refunded?: boolean;
      refundedAt?: Date | null;
      refundAmount?: number;
      refundStatus?: string | null;
      refundCount?: number;
    }>;

    for (const docSnapshot of querySnapshot.docs) {
      const subscription = docSnapshot.data();
      const stripePayment = payments.find((p) => p.id === subscription.stripeSessionId);

      if (stripePayment?.refunded && !subscription.refunded) {
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(docSnapshot.ref, {
          refunded: true,
          refundedAt: stripePayment.refundedAt,
          refundAmount: stripePayment.refundAmount,
          refundStatus: stripePayment.refundStatus,
          refundCount: stripePayment.refundCount || 1,
          status: 'refunded',
        });
        updatedCount++;
      } else if (stripePayment && !stripePayment.refunded && subscription.refunded) {
        const { updateDoc } = await import('firebase/firestore');
        await updateDoc(docSnapshot.ref, {
          refunded: false,
          refundedAt: null,
          refundAmount: 0,
          refundStatus: null,
          refundCount: 0,
          status: 'active',
        });
        updatedCount++;
      }
    }

    return updatedCount;
  } catch (error) {
    console.error('Erreur lors de la synchronisation des remboursements:', error);
    throw error;
  }
};
