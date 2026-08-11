import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import * as functions from 'firebase-functions';
import { StripeProduct } from './types';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as express from 'express';

// Charger les variables d'environnement depuis le fichier .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Configuration des fonctions
// SÉCURITÉ: cors: true permet toutes les origines au niveau Firebase v2
// Le CORS est géré par le middleware Express dans index.ts avec une whitelist stricte
const functionConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 300,
  cors: true, // Nécessaire pour Firebase v2, mais CORS réellement géré par Express avec whitelist
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 1,
  concurrency: 20,
  allowUnauthenticated: false, // Changer à false car nous vérifions l'auth
};

// Configuration avec moins d'instances pour économiser le quota CPU
const lowResourceConfig = {
  ...functionConfig,
  maxInstances: 1,
  concurrency: 20,
};

// Inscription Junior : session Stripe sans compte Firebase (création du compte après paiement)
const signupConfig = {
  ...functionConfig,
  allowUnauthenticated: true,
};

// Configuration pour les webhooks (peuvent avoir besoin de plus de ressources mais on réduit quand même)
const webhookConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 300,
  cors: true,
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 1, // Réduit pour quota CPU
  concurrency: 10, // Réduit pour webhooks
  allowUnauthenticated: true, // Les webhooks Stripe n'ont pas d'auth Firebase
};

// Pages configurables dans Réglages > Accès (aligné avec le frontend)
const DEFAULT_JE_PERMISSION_PAGE_IDS = [
  'dashboard', 'organization', 'mission', 'entreprises', 'documents', 'commercial', 'audit',
  'tresorerie', 'rh', 'ambassadors', 'users', 'permissions', 'encrypted-data',
];

/** Crée les permissions par défaut pour une structure Junior Entreprise (admin_structure = plein accès). */
async function createDefaultStructurePermissions(structureId: string): Promise<void> {
  const batch = admin.firestore().batch();
  const rolesWrite: string[] = ['admin_structure', 'admin'];
  const rolesRead: string[] = ['admin_structure', 'admin', 'membre'];
  for (const pageId of DEFAULT_JE_PERMISSION_PAGE_IDS) {
    const writeRef = admin.firestore().collection('structures').doc(structureId).collection('permissions').doc(pageId);
    batch.set(writeRef, { allowedRoles: rolesWrite, allowedPoles: [], allowedMembers: [] });
    const readRef = admin.firestore().collection('structures').doc(structureId).collection('permissions').doc(`${pageId}_read`);
    batch.set(readRef, { allowedRoles: rolesRead, allowedPoles: [], allowedMembers: [] });
  }
  await batch.commit();
  console.log('Stripe Functions - Permissions par défaut créées pour structure:', structureId);
}

/** Extrait le domaine email au format @domaine.com (minuscules). */
function getEmailDomain(email: string): string {
  const trimmed = (email || '').trim().toLowerCase();
  if (!trimmed.includes('@')) return '@' + trimmed;
  return '@' + trimmed.split('@')[1];
}

/** Vérifie si un domaine email est déjà utilisé par une structure. */
async function isEmailDomainAlreadyUsed(emailDomain: string): Promise<boolean> {
  const normalized = emailDomain.startsWith('@') ? emailDomain.toLowerCase() : '@' + emailDomain.toLowerCase();
  const snap = await admin.firestore()
    .collection('structures')
    .where('emailDomains', 'array-contains', normalized)
    .limit(1)
    .get();
  return !snap.empty;
}

// Helper pour les logs de debug (sécurisé pour Cloud Run)
// SÉCURITÉ: Désactivé en production pour éviter l'exposition d'informations sensibles
function debugLog(location: string, message: string, data: any, hypothesisId: string) {
  // Ne pas logger en production ou si l'émulateur n'est pas actif
  // Vérifier explicitement que l'émulateur est actif
  const isEmulator = process.env.FUNCTIONS_EMULATOR === 'true' || 
                      process.env.FIREBASE_FUNCTIONS_EMULATOR === 'true' ||
                      process.env.GCLOUD_PROJECT?.includes('demo');
  
  // Ne rien faire si on n'est pas dans l'émulateur
  if (!isEmulator || process.env.NODE_ENV === 'production') {
    return;
  }
  
  // Ne rien faire si fetch n'est pas disponible (Cloud Run)
  if (typeof fetch === 'undefined') {
    return;
  }
  
  // Ne rien faire si window est défini (navigateur)
  if (typeof window !== 'undefined') {
    return;
  }
  
  // Seulement en développement local avec émulateur actif
  try {
    fetch('http://127.0.0.1:7243/ingest/510b90a4-d51b-412b-a016-9c30453a7b93', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location, message, data, timestamp: Date.now(), sessionId: 'debug-session', runId: 'run1', hypothesisId })
    }).catch(() => {
      // Ignorer silencieusement les erreurs de connexion
    });
  } catch (e) {
    // Ignorer toutes les erreurs de fetch dans Cloud Run
  }
}

// #region agent log
debugLog('stripe.ts:24', 'Before Stripe key check', { hasEnvKey: !!process.env.STRIPE_SECRET_KEY }, 'A');
// #endregion
// Initialiser Stripe avec la clé secrète depuis les variables d'environnement ou la configuration Firebase
console.log('Variables d\'environnement chargées:', {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'DÉFINIE' : 'NON DÉFINIE',
  FRONTEND_URL: process.env.FRONTEND_URL
});
console.log('Chemin du fichier .env:', path.resolve(__dirname, '../.env'));

// #region agent log
debugLog('stripe.ts:34', 'Before getting Stripe key', { hasEnvKey: !!process.env.STRIPE_SECRET_KEY }, 'A');
// #endregion
// Récupérer la clé Stripe de manière robuste (ne pas lancer d'erreur au chargement du module)
// Dans Cloud Run v2, functions.config() n'est pas disponible au chargement du module
// On utilise uniquement process.env au chargement
let stripeSecretKey: string | undefined = process.env.STRIPE_SECRET_KEY;
// #region agent log
debugLog('stripe.ts:42', 'Stripe key check result', { hasStripeKey: !!stripeSecretKey, fromEnv: !!process.env.STRIPE_SECRET_KEY }, 'A');
// #endregion

/** Récupère la clé Stripe depuis toutes les sources possibles (env, config Firebase, variantes de noms). */
function resolveStripeSecretKey(): string | undefined {
  // 1) process.env (Cloud Run / .env local) — principal en Gen 2
  let key = process.env.STRIPE_SECRET_KEY || process.env.stripe_secret_key;
  if (key) return key;
  // 2) Firebase config (legacy / 1st gen) — peut ne pas exister en Gen 2
  try {
    const config = functions.config();
    key = config?.stripe?.secret_key || (config?.stripe as Record<string, string> | undefined)?.secret_key;
    if (key) return key;
  } catch {
    // functions.config() déprécié / indisponible en Gen 2
  }
  return undefined;
}

// Fonction helper pour obtenir l'instance Stripe (lazy initialization)
function getStripeInstance(): Stripe {
  if (!stripeSecretKey) {
    stripeSecretKey = resolveStripeSecretKey();
    if (!stripeSecretKey) {
      throw new Error(
        'STRIPE_SECRET_KEY n\'est pas configurée. ' +
        'En local : définissez STRIPE_SECRET_KEY dans functions/.env. ' +
        'En production (Gen 2) : Console Google Cloud → Cloud Run → service de la fonction → Modifier → Variables et secrets → STRIPE_SECRET_KEY = sk_... ' +
        'Ou (1re gen) : firebase functions:config:set stripe.secret_key="sk_..." puis redéploiement.'
      );
    }
  }
  return new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
  });
}

// Logs initiaux si la clé est disponible
if (stripeSecretKey) {
  const isTestMode = stripeSecretKey.startsWith('sk_test_');
  console.log('Mode Stripe:', isTestMode ? 'TEST' : 'PRODUCTION');
} else {
  console.warn('STRIPE_SECRET_KEY non configurée au chargement du module. Elle sera vérifiée lors de l\'utilisation.');
}

// Configuration des URLs
// Dans Cloud Run v2, utiliser uniquement process.env au chargement
let FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
// Essayer functions.config() seulement si process.env n'a pas fonctionné (dans la fonction si nécessaire)
try {
  if (!process.env.FRONTEND_URL) {
    const config = functions.config();
    FRONTEND_URL = config?.app?.frontend_url || FRONTEND_URL;
  }
} catch (error) {
  // functions.config() n'est pas disponible, utiliser la valeur par défaut
}
const SUCCESS_URL = `${FRONTEND_URL}/settings/billing?success=true`;
const CANCEL_URL = `${FRONTEND_URL}/settings/billing?canceled=true`;

interface CreateCheckoutSessionData {
  priceId: string;
  userId: string;
  structureId: string;
  success_url?: string;
  cancel_url?: string;
}

interface CancelSubscriptionData {
  subscriptionId: string;
  userId: string;
}

interface CreateCheckoutSessionForSignupData {
  priceId: string;
  email: string;
  structureName: string;
  structureSchool: string;
  success_url: string;
  cancel_url: string;
}

// Fonction pour récupérer les produits Stripe
export const getStripeProducts = onCall(functionConfig, async (request) => {
  try {
    console.log('getStripeProducts - Début de la fonction');
    const stripeInstance = getStripeInstance();
    
    // Récupérer tous les produits actifs avec leurs prix récurrents
    const products = await stripeInstance.products.list({
      active: true,
      expand: ['data.default_price'],
    });
    console.log('getStripeProducts - Nombre de produits récupérés:', products.data.length);
    console.log('getStripeProducts - Premier produit brut:', JSON.stringify(products.data[0], null, 2));

    // Récupérer tous les prix récurrents
    const prices = await getStripeInstance().prices.list({
      active: true,
      type: 'recurring',
      expand: ['data.product'],
    });
    console.log('getStripeProducts - Nombre de prix récupérés:', prices.data.length);
    if (prices.data.length > 0) {
      console.log('getStripeProducts - Premier prix brut:', JSON.stringify(prices.data[0], null, 2));
    }

    // Transformer les données pour notre application
    const formattedProducts: StripeProduct[] = products.data.map((product: Stripe.Product) => {
      // Trouver le prix récurrent associé à ce produit
      const price = prices.data.find((p: Stripe.Price) => p.product === product.id);
      console.log(`getStripeProducts - Pour le produit ${product.id}:`);
      console.log('- Nom:', product.name);
      console.log('- Prix par défaut:', product.default_price);
      console.log('- Prix trouvé:', price ? JSON.stringify(price, null, 2) : 'Aucun prix trouvé');
      
      const formattedProduct = {
        id: product.id,
        name: product.name,
        description: product.description || undefined,
        features: (product.features?.map(f => f.name) || []).filter((feature): feature is string => feature !== undefined),
        price: price ? {
          id: price.id,
          amount: price.unit_amount ? price.unit_amount / 100 : 0,
          currency: price.currency,
          interval: price.recurring?.interval || 'month',
        } : null,
        images: product.images || [],
        metadata: product.metadata || {},
      };

      console.log('getStripeProducts - Produit formaté:', JSON.stringify(formattedProduct, null, 2));
      return formattedProduct;
    });

    console.log('getStripeProducts - Nombre total de produits formatés:', formattedProducts.length);
    return { products: formattedProducts };
  } catch (error) {
    console.error('Erreur lors de la récupération des produits Stripe:', error);
    throw new Error(`Une erreur est survenue lors de la récupération des produits Stripe: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
});

// Fonction pour créer une session de paiement
export const createCheckoutSession = onCall(functionConfig, async (request) => {
  try {
    // Vérifier l'authentification
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Vous devez être connecté pour accéder à cette fonction.');
    }

    const { priceId, userId, structureId } = request.data as CreateCheckoutSessionData;

    if (!priceId) {
      throw new HttpsError('invalid-argument', 'L\'ID du prix est requis.');
    }

    if (!userId) {
      throw new HttpsError('invalid-argument', 'L\'ID de l\'utilisateur est requis.');
    }

    if (!structureId) {
      throw new HttpsError('invalid-argument', 'L\'ID de la structure est requis.');
    }

    // Vérifier que l'utilisateur est admin de la structure (ou qu'il vient de la créer à l'inscription)
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();
    const structureSnapshot = await admin.firestore().collection('structures').doc(structureId).get();
    const structureData = structureSnapshot.data();

    const isAdminOrAdminStructure = (userData?.status === 'admin' || userData?.status === 'admin_structure') && userData?.structureId === structureId;
    const isCreatorJustSignedUp = request.auth.uid === userId && structureData?.createdBy === userId;

    if ((!userData || !isAdminOrAdminStructure) && !isCreatorJustSignedUp) {
      throw new HttpsError('permission-denied', 'Vous n\'avez pas les permissions nécessaires pour gérer les abonnements de cette structure.');
    }

    // Créer ou récupérer le client Stripe pour la structure
    const structureDoc = admin.firestore().collection('stripeCustomers').doc(structureId);
    const stripeCustomerSnapshot = await structureDoc.get();

    let customerId = stripeCustomerSnapshot.exists ? stripeCustomerSnapshot.data()?.customerId : null;

    if (!customerId) {
      const customer = await getStripeInstance().customers.create({
        metadata: {
          structureId: structureId,
          firebaseUID: userId
        }
      });
      customerId = customer.id;

      // Sauvegarder l'ID du client Stripe
      await structureDoc.set({
        customerId: customerId,
        structureId: structureId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    const customerEmail = request.auth?.token?.email as string | undefined;
    const { success_url: customSuccessUrl, cancel_url: customCancelUrl } = request.data as CreateCheckoutSessionData;
    
    // Préparer les données de l'abonnement
    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {
      metadata: {
        userId,
        structureId,
        customerEmail: customerEmail || '',
      },
    };
    
    // Créer une session de paiement
    const session = await getStripeInstance().checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      subscription_data: subscriptionData,
      success_url: customSuccessUrl || SUCCESS_URL,
      cancel_url: customCancelUrl || CANCEL_URL,
      client_reference_id: structureId,
      metadata: {
        userId,
        structureId,
        customerEmail: customerEmail || '',
      },
    });

    return { sessionId: session.id };
  } catch (error: unknown) {
    const err = error as { message?: string; code?: string; type?: string };
    const message = err?.message ?? (typeof error === 'string' ? error : 'Erreur inconnue');
    console.error('createCheckoutSession - Erreur:', message, error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError('internal', `Session de paiement : ${message}`);
  }
});

/** Inscription Junior : crée une session Stripe sans compte Firebase. Le compte est créé après paiement (page /register/complete). */
export const createCheckoutSessionForSignup = onCall(signupConfig, async (request) => {
  try {
    const { priceId, email, structureName, structureSchool, success_url, cancel_url } = request.data as CreateCheckoutSessionForSignupData;
    if (!priceId || !email || !structureName || !structureSchool || !success_url || !cancel_url) {
      throw new HttpsError('invalid-argument', 'Tous les champs (priceId, email, structureName, structureSchool, success_url, cancel_url) sont requis.');
    }
    const emailDomain = getEmailDomain(email);
    if (await isEmailDomainAlreadyUsed(emailDomain)) {
      throw new HttpsError('already-exists', 'Ce domaine email est déjà utilisé par une autre structure. Utilisez une adresse avec un domaine professionnel ou d\'établissement non encore enregistré.');
    }
    const stripe = getStripeInstance();
    const customer = await stripe.customers.create({
      email: email.trim(),
      metadata: { signupFlow: 'structure', structureName, structureSchool },
    });
    const session = await stripe.checkout.sessions.create({
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      subscription_data: {
        metadata: {
          signupEmail: email.trim(),
          structureName: structureName.trim(),
          structureSchool: structureSchool.trim(),
        },
      },
      success_url,
      cancel_url,
      metadata: {
        signupEmail: email.trim(),
        structureName: structureName.trim(),
        structureSchool: structureSchool.trim(),
      },
    });
    return { sessionId: session.id };
  } catch (error: unknown) {
    const err = error as { message?: string };
    const message = err?.message ?? (typeof error === 'string' ? error : 'Erreur inconnue');
    console.error('createCheckoutSessionForSignup:', message, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError('internal', `Session d'inscription : ${message}`);
  }
});

/** Récupère les données pour compléter l’inscription après paiement (email, structureId, structureName). */
/** Vérifie si le domaine d'un email est déjà utilisé par une structure (inscription sans Stripe). */
export const checkEmailDomainAvailable = onCall(signupConfig, async (request) => {
  const { email } = request.data as { email?: string };
  if (!email || typeof email !== 'string' || !email.trim()) {
    throw new HttpsError('invalid-argument', 'Email requis.');
  }
  const emailDomain = getEmailDomain(email);
  const used = await isEmailDomainAlreadyUsed(emailDomain);
  return { available: !used };
});

export const getSignupCompletionData = onCall(signupConfig, async (request) => {
  try {
    const { sessionId } = request.data as { sessionId: string };
    if (!sessionId) throw new HttpsError('invalid-argument', 'sessionId requis.');
    const stripe = getStripeInstance();
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });
    if (session.status !== 'complete' || !session.subscription) {
      throw new HttpsError('failed-precondition', 'Paiement non finalisé ou abonnement absent.');
    }
    const subscription = typeof session.subscription === 'object' ? session.subscription : await stripe.subscriptions.retrieve(session.subscription as string);
    const subId = subscription.id;
    const meta = subscription.metadata || {};
    const snap = await admin.firestore().collection('signupCompletion').doc(subId).get();
    if (!snap.exists && meta.signupEmail) {
      const signupEmail = (meta.signupEmail as string).trim();
      const structureName = (meta.structureName as string) || 'Structure';
      const structureSchool = (meta.structureSchool as string) || '';
      const emailDomain = getEmailDomain(signupEmail);
      if (await isEmailDomainAlreadyUsed(emailDomain)) {
        throw new HttpsError('already-exists', 'Ce domaine email est déjà utilisé par une autre structure. Utilisez une adresse avec un domaine professionnel ou d\'établissement non encore enregistré.');
      }
      const structureRef = admin.firestore().collection('structures').doc();
      const structureId = structureRef.id;
      await structureRef.set({
        id: structureId,
        name: structureName,
        nom: structureName,
        ecole: structureSchool,
        email: signupEmail,
        emailDomains: [emailDomain],
        domaines: [emailDomain],
        structureType: 'junior',
        onboardingStatus: 'pending',
        createdAt: new Date().toISOString(),
      });
      await createDefaultStructurePermissions(structureId);
      await admin.firestore().collection('signupCompletion').doc(subId).set({
        structureId,
        email: signupEmail,
        structureName,
      });
      console.log('Stripe Functions - getSignupCompletionData: structure + signupCompletion créés (webhook en retard)');
      return { email: signupEmail, structureId, structureName };
    }
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Données de complétion pas encore disponibles. Réessayez dans quelques secondes.');
    }
    const data = snap.data()!;
    return { email: data.email, structureId: data.structureId, structureName: data.structureName };
  } catch (error: unknown) {
    if (error instanceof HttpsError) throw error;
    const err = error as { message?: string };
    throw new HttpsError('internal', err?.message ?? 'Erreur inconnue');
  }
});

/** Initialise les permissions par défaut d'une structure (appelé après création côté client, ex. inscription sans Stripe). */
export const initStructurePermissions = onCall(functionConfig, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError('unauthenticated', 'Authentification requise.');
  }
  const { structureId } = request.data as { structureId: string };
  if (!structureId) throw new HttpsError('invalid-argument', 'structureId requis.');
  const uid = request.auth.uid;
  const structureSnap = await admin.firestore().collection('structures').doc(structureId).get();
  if (!structureSnap.exists) throw new HttpsError('not-found', 'Structure introuvable.');
  const createdBy = structureSnap.data()?.createdBy;
  const userSnap = await admin.firestore().collection('users').doc(uid).get();
  const userStatus = userSnap.data()?.status;
  const userStructureId = userSnap.data()?.structureId;
  const isCreator = createdBy === uid;
  const isAdminStructure = userStatus === 'admin_structure' && userStructureId === structureId;
  if (!isCreator && !isAdminStructure) {
    throw new HttpsError('permission-denied', 'Seul le créateur ou l’admin de la structure peut initialiser les permissions.');
  }
  await createDefaultStructurePermissions(structureId);
  return { ok: true };
});

/** Crée le compte Firebase (Auth + user doc + structure createdBy) après paiement réussi. */
export const completeSignupAfterPayment = onCall(signupConfig, async (request) => {
  try {
    const { sessionId, password } = request.data as { sessionId: string; password: string };
    if (!sessionId || !password) throw new HttpsError('invalid-argument', 'sessionId et password requis.');
    const stripe = getStripeInstance();
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ['subscription'] });
    if (session.status !== 'complete' || !session.subscription) {
      throw new HttpsError('failed-precondition', 'Paiement non finalisé.');
    }
    const subId = typeof session.subscription === 'object' ? session.subscription.id : session.subscription;
    const snap = await admin.firestore().collection('signupCompletion').doc(subId).get();
    if (!snap.exists) throw new HttpsError('not-found', 'Données de complétion introuvables.');
    const data = snap.data()!;
    const { email, structureId, structureName } = data as { email: string; structureId: string; structureName: string };
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName: structureName,
    });
    const uid = userRecord.uid;
    await admin.firestore().collection('users').doc(uid).set({
      displayName: structureName,
      email,
      firstName: structureName,
      lastName: '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'admin',
      structureId,
      structureName,
      trialStartDate: new Date(),
      trialEndDate: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      hasActiveTrial: true,
    });
    await admin.firestore().collection('structures').doc(structureId).update({
      createdBy: uid,
    });
    await admin.firestore().collection('signupCompletion').doc(subId).delete();
    return { uid, email };
  } catch (error: unknown) {
    if (error instanceof HttpsError) throw error;
    const err = error as { message?: string; code?: string };
    if (err?.code === 'auth/email-already-in-use') {
      throw new HttpsError('already-exists', 'Cette adresse email est déjà utilisée. Connectez-vous ou réinitialisez le mot de passe.');
    }
    throw new HttpsError('internal', err?.message ?? 'Erreur lors de la création du compte.');
  }
});

// Fonction pour annuler un abonnement
// Utilise lowResourceConfig pour éviter le quota CPU
export const cancelSubscription = onCall(lowResourceConfig, async (request) => {
  try {
    // Vérifier l'authentification
    if (!request.auth) {
      throw new Error('Vous devez être connecté pour accéder à cette fonction.');
    }

    const { subscriptionId, userId } = request.data as CancelSubscriptionData;

    if (!subscriptionId) {
      throw new Error('L\'ID de l\'abonnement est requis.');
    }

    // Annuler l'abonnement
    await getStripeInstance().subscriptions.cancel(subscriptionId);

    // Mettre à jour le statut dans Firestore
    const db = admin.firestore();
    await db.collection('users').doc(userId).update({
      'subscription.status': 'canceled',
      'subscription.canceledAt': admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Erreur lors de l\'annulation de l\'abonnement:', error);
    throw new Error('Une erreur est survenue lors de l\'annulation de l\'abonnement.');
  }
});

interface SubscriptionData {
  priceId: string;
}

// Converti en v2 avec lowResourceConfig pour économiser le quota CPU
export const createSubscription = onCall(lowResourceConfig, async (request) => {
  console.log('Stripe Functions - Début de createSubscription');
  
  if (!request.auth) {
    console.log('Stripe Functions - Erreur: utilisateur non authentifié');
    throw new Error('Vous devez être connecté pour créer un abonnement');
  }

  try {
    const { priceId } = request.data as SubscriptionData;
    const userId = request.auth.uid;
    console.log('Stripe Functions - Création d\'abonnement pour:', { userId, priceId });

    // Créer ou récupérer le client Stripe
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();
    console.log('Stripe Functions - Données utilisateur:', userData);

    let customerId = userData?.stripeCustomerId;

    if (!customerId) {
      console.log('Stripe Functions - Création d\'un nouveau client Stripe');
      const customer = await getStripeInstance().customers.create({
        email: request.auth.token.email,
        metadata: {
          firebaseUID: userId
        }
      });
      customerId = customer.id;
      console.log('Stripe Functions - Nouveau client créé:', customerId);

      // Sauvegarder l'ID du client Stripe
      await admin.firestore().collection('users').doc(userId).update({
        stripeCustomerId: customerId
      });
      console.log('Stripe Functions - ID client sauvegardé dans Firestore');
    }

    // Préparer les données de l'abonnement
    const subscriptionData: Stripe.Checkout.SessionCreateParams.SubscriptionData = {};
    
    // Créer la session de paiement
    console.log('Stripe Functions - Création de la session de paiement');
    const session = await getStripeInstance().checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      subscription_data: subscriptionData,
      success_url: `${process.env.FRONTEND_URL}/settings/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/settings/billing?canceled=true`,
      metadata: {
        userId: userId
      }
    });
    console.log('Stripe Functions - Session créée:', session.id);

    return { sessionId: session.id };
  } catch (error: any) {
    console.error('Stripe Functions - Erreur lors de la création de l\'abonnement:', error);
    throw new Error(error.message || 'Une erreur est survenue lors de la création de l\'abonnement');
  }
});

// Configuration webhook avec application Express séparée pour le body brut
const webhookConfigWithRaw = {
  ...webhookConfig,
  // Pas besoin de cors pour les webhooks Stripe (ils viennent de Stripe directement)
};

// Application Express pour webhook Stripe (body brut)
const stripeWebhookApp = express();
stripeWebhookApp.use(express.raw({ type: 'application/json', limit: '10mb' }));

// Converti en v2 avec application Express pour gérer le body brut
export const handleStripeWebhook = onRequest(webhookConfigWithRaw, stripeWebhookApp);

// Route handler pour le webhook Stripe
stripeWebhookApp.post('*', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string | undefined;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!endpointSecret) {
    console.error('STRIPE_WEBHOOK_SECRET n\'est pas configurée');
    res.status(500).send('Configuration du webhook manquante');
    return;
  }

  if (!sig) {
    console.error('Signature Stripe manquante');
    res.status(400).send('Signature Stripe manquante');
    return;
  }

  let event;

  try {
    // Avec express.raw(), req.body est un Buffer
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ''), 'utf8');
    event = getStripeInstance().webhooks.constructEvent(body, sig, endpointSecret);
    console.log('Stripe Functions - Événement Stripe reçu:', event.type);
  } catch (err: any) {
    console.error('Stripe Functions - Erreur de signature webhook:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Gérer les événements Stripe
  switch (event.type) {
    case 'invoice.payment_failed': {
      const failedInvoice = event.data.object as Stripe.Invoice;
      const failedStructureId =
        (failedInvoice as any).subscription_details?.metadata?.structureId ||
        (typeof failedInvoice.subscription === 'string' ? null : null);
      // Resolve structure via customer subscription metadata when possible
      let structureIdFromInvoice: string | undefined =
        (failedInvoice.metadata?.structureId as string) || undefined;
      if (!structureIdFromInvoice && failedInvoice.subscription) {
        try {
          const subId =
            typeof failedInvoice.subscription === 'string'
              ? failedInvoice.subscription
              : failedInvoice.subscription.id;
          const sub = await getStripeInstance().subscriptions.retrieve(subId);
          structureIdFromInvoice = sub.metadata?.structureId;
        } catch (e) {
          console.warn('invoice.payment_failed: unable to resolve structureId', e);
        }
      }
      if (structureIdFromInvoice) {
        const { notifyPaymentFailed } = await import('./notifications/billingNotifications');
        await notifyPaymentFailed(structureIdFromInvoice).catch((err) =>
          console.error('notifyPaymentFailed', err)
        );
      } else {
        console.warn('invoice.payment_failed: no structureId', failedStructureId);
      }
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      const subscription = event.data.object as Stripe.Subscription;
      const meta = subscription.metadata || {};
      const customerEmail = meta.customerEmail || meta.signupEmail;
      let structureId = meta.structureId as string | undefined;

      if (!structureId && meta.signupEmail) {
        const existingCompletion = await admin.firestore().collection('signupCompletion').doc(subscription.id).get();
        if (existingCompletion.exists) {
          structureId = existingCompletion.data()?.structureId;
          console.log('Stripe Functions - signupCompletion déjà créé (par getSignupCompletionData), structureId:', structureId);
        } else {
          const signupEmail = (meta.signupEmail as string).trim();
          const structureName = (meta.structureName as string) || 'Structure';
          const structureSchool = (meta.structureSchool as string) || '';
          const emailDomain = getEmailDomain(signupEmail);
          const domainUsed = await isEmailDomainAlreadyUsed(emailDomain);
          if (domainUsed) {
            console.warn('Stripe Functions - Domaine déjà utilisé (webhook), structure non créée:', emailDomain);
          } else {
          const structureRef = admin.firestore().collection('structures').doc();
          structureId = structureRef.id;
          await structureRef.set({
            id: structureId,
            name: structureName,
            nom: structureName,
            ecole: structureSchool,
            email: signupEmail,
            emailDomains: [emailDomain],
            domaines: [emailDomain],
            structureType: 'junior',
            onboardingStatus: 'pending',
            createdAt: new Date().toISOString(),
          });
          await createDefaultStructurePermissions(structureId);
          await admin.firestore().collection('signupCompletion').doc(subscription.id).set({
            structureId,
            email: signupEmail,
            structureName,
          });
          console.log('Stripe Functions - Structure créée (signup):', { structureId, signupEmail });
          }
        }
      }

      if (!structureId) {
        console.warn('Stripe Functions - Abonnement sans structureId ni signupEmail, ignoré');
        break;
      }

      console.log('Stripe Functions - Mise à jour de l\'abonnement:', { structureId, status: subscription.status, customerEmail });

      await admin.firestore().collection('subscriptions').doc(structureId).set({
        structureId,
        subscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        trial_end: subscription.trial_end || null,
        planId: subscription.items.data[0].price.id,
        customerEmail: customerEmail ?? null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      await admin.firestore().collection('structures').doc(structureId).update({
        subscriptionStatus: subscription.status,
        subscriptionId: subscription.id,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        subscriptionEmail: customerEmail ?? null
      });
      console.log('Stripe Functions - Statut de l\'abonnement mis à jour dans Firestore');
      break;

    case 'customer.subscription.deleted':
      const deletedSubscription = event.data.object as Stripe.Subscription;
      const deletedStructureId = deletedSubscription.metadata.structureId;
      console.log('Stripe Functions - Annulation de l\'abonnement:', deletedStructureId);

      // Mettre à jour le statut de l'abonnement dans Firestore
      await admin.firestore().collection('subscriptions').doc(deletedStructureId).set({
        structureId: deletedStructureId,
        status: 'canceled',
        subscriptionId: null,
        currentPeriodEnd: null,
        customerEmail: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Mettre à jour le statut de la structure
      await admin.firestore().collection('structures').doc(deletedStructureId).update({
        subscriptionStatus: 'canceled',
        subscriptionId: null,
        currentPeriodEnd: null,
        subscriptionEmail: null
      });
      console.log('Stripe Functions - Statut d\'annulation enregistré dans Firestore');
      break;
  }

  res.json({ received: true });
});


// Fonction pour récupérer la liste des clients Stripe
export const getStripeCustomers = onCall(lowResourceConfig, async (request) => {
  // Vérification de l'authentification
  if (!request.auth?.uid) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Vous devez être connecté pour accéder à cette fonction'
    );
  }

  try {
    console.log('Début de getStripeCustomers');
    
    // Récupérer les abonnements sans expansion
    const subscriptions = await getStripeInstance().subscriptions.list({
      limit: 100,
      status: 'all'
    });
    
    console.log('Nombre d\'abonnements récupérés:', subscriptions.data.length);

    // Récupérer les clients associés
    const customers = await Promise.all(
      subscriptions.data.map(async (subscription) => {
        const customerResponse = await getStripeInstance().customers.retrieve(subscription.customer as string);
        const customer = customerResponse as Stripe.Customer;
        const price = await getStripeInstance().prices.retrieve(subscription.items.data[0].price.id);
        const product = await getStripeInstance().products.retrieve(price.product as string);

        return {
          id: customer.id,
          email: customer.email,
          name: customer.name || 'Non renseigné',
          subscriptionStatus: subscription.status,
          subscriptionTitle: price.nickname || product.name,
          productName: product.name,
          currentPeriodEnd: subscription.current_period_end * 1000,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          environment: (stripeSecretKey?.startsWith('sk_test_') || false) ? 'test' : 'production'
        };
      })
    );

    return customers;
  } catch (error) {
    console.error('Erreur détaillée lors de la récupération des abonnements Stripe:', error);
    if (error instanceof Error) {
      console.error('Message d\'erreur:', error.message);
      console.error('Stack trace:', error.stack);
    }
    throw new functions.https.HttpsError(
      'internal',
      'Erreur lors de la récupération des abonnements Stripe: ' + (error instanceof Error ? error.message : 'Erreur inconnue')
    );
  }
});

export const cancelStripeSubscription = onCall(functionConfig, async (request) => {
  try {
    // Vérifier l'authentification
    if (!request.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Vous devez être connecté pour accéder à cette fonction.'
      );
    }

    // Récupérer l'email de la structure
    const { email } = request.data;
    
    if (!email) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Email requis pour annuler l\'abonnement'
      );
    }

    console.log('Annulation d\'abonnement pour la structure avec email:', email);

    // Rechercher le client par email
    const customers = await getStripeInstance().customers.list({ email });
    const customer = customers.data[0];

    if (!customer) {
      throw new functions.https.HttpsError(
        'not-found',
        'Structure non trouvée dans Stripe'
      );
    }

    console.log('Client Stripe trouvé:', customer.id);

    // Récupérer les abonnements du client
    const subscriptions = await getStripeInstance().subscriptions.list({
      customer: customer.id,
      limit: 1,
      status: 'all', // Rechercher tous les statuts d'abonnement
    });

    // Filtrer pour trouver un abonnement actif ou en période d'essai
    const subscription = subscriptions.data.find(sub => 
      sub.status === 'active' || sub.status === 'trialing'
    );

    if (!subscription) {
      throw new functions.https.HttpsError(
        'not-found',
        'Aucun abonnement actif ou en période d\'essai trouvé pour cette structure'
      );
    }

    console.log('Abonnement trouvé:', subscription.id);

    // Annuler l'abonnement à la fin de la période
    const canceledSubscription = await getStripeInstance().subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });

    console.log('Abonnement annulé avec succès');

    // Mettre à jour le statut dans Firestore
    const structuresRef = admin.firestore().collection('structures');
    const structureQuery = await structuresRef.where('email', '==', email).limit(1).get();
    
    if (!structureQuery.empty) {
      const structureDoc = structureQuery.docs[0];
      await structureDoc.ref.update({
        subscriptionCancelAtPeriodEnd: true,
        subscriptionUpdateTime: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return {
      success: true,
      message: 'Abonnement programmé pour être annulé à la fin de la période',
      cancelAtPeriodEnd: canceledSubscription.cancel_at_period_end,
      currentPeriodEnd: canceledSubscription.current_period_end
    };
  } catch (error: any) {
    console.error('Erreur lors de l\'annulation de l\'abonnement:', error);
    throw new functions.https.HttpsError(
      'internal',
      error.message || 'Erreur lors de l\'annulation de l\'abonnement'
    );
  }
});

// Fonction pour récupérer l'historique des paiements Stripe (nouvelle version)
// Utilise lowResourceConfig pour éviter le quota CPU
export const fetchPaymentHistory = onCall(lowResourceConfig, async (request) => {
  try {
    console.log('fetchPaymentHistory - Début de la fonction');
    console.log('fetchPaymentHistory - Utilisateur authentifié:', request.auth?.uid);
    
    // Vérifier l'authentification
    if (!request.auth) {
      console.log('fetchPaymentHistory - Erreur: Utilisateur non authentifié');
      throw new functions.https.HttpsError(
        'unauthenticated',
        'Vous devez être connecté pour accéder à cette fonction.'
      );
    }

    // Récupérer l'email de la structure
    const { email } = request.data;
    console.log('fetchPaymentHistory - Email reçu:', email);
    
    if (!email) {
      console.log('fetchPaymentHistory - Erreur: Email manquant');
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Email requis pour récupérer les paiements'
      );
    }

    console.log('fetchPaymentHistory - Recherche du client Stripe pour l\'email:', email);

    // Rechercher le client par email
    const customers = await getStripeInstance().customers.list({ email });
    console.log('fetchPaymentHistory - Nombre de clients trouvés:', customers.data.length);
    
    const customer = customers.data[0];

    if (!customer) {
      console.log('fetchPaymentHistory - Aucun client trouvé pour l\'email:', email);
      return [];
    }

    console.log('fetchPaymentHistory - Client Stripe trouvé:', customer.id);

    // Récupérer les charges (qui contiennent les reçus)
    console.log('fetchPaymentHistory - Récupération des charges...');
    const charges = await getStripeInstance().charges.list({
      customer: customer.id,
      limit: 50, // Augmenter à 50 pour plus d'historique
    });

    console.log('fetchPaymentHistory - Nombre de charges trouvées:', charges.data.length);

    // Transformer les charges en format de paiement
    const formattedPayments = charges.data.map(charge => ({
      id: charge.id,
      amount: charge.amount,
      currency: charge.currency,
      status: charge.status,
      created: charge.created,
      receipt_url: charge.receipt_url,
      description: charge.description || `Paiement ${charge.id}`,
      payment_intent: charge.payment_intent
    }));

    // Trier par date de création (plus récent en premier)
    formattedPayments.sort((a, b) => b.created - a.created);

    console.log('fetchPaymentHistory - Nombre total de paiements formatés:', formattedPayments.length);
    if (formattedPayments.length > 0) {
      console.log('fetchPaymentHistory - Premier paiement:', {
        id: formattedPayments[0].id,
        amount: formattedPayments[0].amount,
        status: formattedPayments[0].status,
        receipt_url: formattedPayments[0].receipt_url
      });
    }

    return formattedPayments;
  } catch (error: any) {
    console.error('fetchPaymentHistory - Erreur détaillée:', error);
    console.error('fetchPaymentHistory - Type d\'erreur:', typeof error);
    console.error('fetchPaymentHistory - Message d\'erreur:', error.message);
    console.error('fetchPaymentHistory - Stack trace:', error.stack);
    
    // Retourner une erreur plus spécifique
    if (error.type === 'StripeError') {
      throw new functions.https.HttpsError(
        'internal',
        `Erreur Stripe: ${error.message}`
      );
    }
    
    throw new functions.https.HttpsError(
      'internal',
      error.message || 'Erreur lors de la récupération des paiements'
    );
  }
});


// Interface pour les données de création de session de cotisation
interface CreateCotisationSessionData {
  userId: string;
  structureId: string;
  amount: number;
  duration: string;
}

// Fonction pour créer une session de paiement de cotisation
// Utilise lowResourceConfig pour éviter le quota CPU
export const createCotisationSession = onCall(lowResourceConfig, async (request) => {
  try {
    // Vérifier l'authentification
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Vous devez être connecté pour accéder à cette fonction.');
    }

    const { userId, structureId, amount, duration } = request.data as CreateCotisationSessionData;

    if (!userId || !structureId || !amount || !duration) {
      throw new HttpsError('invalid-argument', 'Tous les paramètres sont requis (userId, structureId, amount, duration).');
    }

    if (userId !== request.auth.uid) {
      throw new HttpsError('permission-denied', 'Vous ne pouvez créer une cotisation que pour votre propre compte.');
    }

    const callerDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
    const callerData = callerDoc.data();
    if (!callerData || callerData.structureId !== structureId) {
      throw new HttpsError('permission-denied', 'Structure non autorisée.');
    }

    // Récupérer les données de la structure pour obtenir les clés Stripe
    const structureDoc = await admin.firestore().collection('structures').doc(structureId).get();
    if (!structureDoc.exists) {
      throw new HttpsError('not-found', 'Structure non trouvée.');
    }

    const structureData = structureDoc.data()!;
    const { getStructureStripeSecretKey } = await import('./structureStripeSecrets');
    const stripeSecret = await getStructureStripeSecretKey(structureId);
    if (!stripeSecret) {
      throw new HttpsError('failed-precondition', 'Les clés Stripe ne sont pas configurées pour cette structure.');
    }

    // Initialiser Stripe avec les clés de la structure
    const structureStripe = new Stripe(stripeSecret, {
      apiVersion: '2023-10-16',
    });

    // Récupérer les données de l'utilisateur
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    if (!userDoc.exists) {
      throw new Error('Utilisateur non trouvé.');
    }

    const userData = userDoc.data();

    // Créer ou récupérer le client Stripe pour l'utilisateur
    let customerId = userData?.stripeCustomerId;

    if (!customerId) {
      const customer = await structureStripe.customers.create({
        email: userData?.email,
        metadata: {
          firebaseUID: userId,
          structureId: structureId
        }
      });
      customerId = customer.id;

      // Sauvegarder l'ID du client Stripe
      await admin.firestore().collection('users').doc(userId).update({
        stripeCustomerId: customerId
      });
    }

    // Créer un produit temporaire pour la cotisation
    const product = await structureStripe.products.create({
      name: `Cotisation - ${structureData.name || structureData.nom}`,
      description: `Cotisation pour ${duration}`,
    });

    // Créer un prix pour la cotisation
    const price = await structureStripe.prices.create({
      product: product.id,
      unit_amount: Math.round(amount * 100), // Convertir en centimes
      currency: 'eur',
    });

    // Créer une session de paiement
    const session = await structureStripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: price.id,
          quantity: 1,
        },
      ],
      mode: 'payment', // Mode paiement unique (pas d'abonnement)
      success_url: `${FRONTEND_URL}/cotisation/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${FRONTEND_URL}/cotisation/cancel`,
      client_reference_id: structureId,
      metadata: {
        userId: userId,
        structureId: structureId,
        cotisationDuration: duration,
        cotisationAmount: amount.toString(),
      },
    });

    return { 
      sessionId: session.id,
      sessionUrl: session.url 
    };
  } catch (error) {
    console.error('Erreur lors de la création de la session de cotisation:', error);
    throw new Error(`Erreur lors de la création de la session de cotisation: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}); 

// Interface pour les données de récupération des cotisations
interface GetStructureCotisationsData {
  structureId: string;
}

// Fonction pour récupérer toutes les cotisations d'une structure
export const getStructureCotisations = onCall(functionConfig, async (request) => {
  try {
    // Vérifier l'authentification
    if (!request.auth) {
      throw new Error('Vous devez être connecté pour accéder à cette fonction.');
    }

    const { structureId } = request.data as GetStructureCotisationsData;

    if (!structureId) {
      throw new Error('L\'ID de la structure est requis.');
    }

    // Vérifier que l'utilisateur a les permissions pour accéder à la structure
    const userDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
    const userData = userDoc.data();

    if (!userData) {
      throw new Error('Utilisateur non trouvé.');
    }

    // Permettre l'accès aux admins, superadmins et membres de la structure
    const allowedStatuses = ['admin', 'superadmin', 'membre'];
    const hasValidStatus = allowedStatuses.includes(userData.status);
    const belongsToStructure = userData.structureId === structureId;

    if (!hasValidStatus || !belongsToStructure) {
      console.log('Permissions insuffisantes:', {
        userId: request.auth.uid,
        userStatus: userData.status,
        userStructureId: userData.structureId,
        requestedStructureId: structureId,
        hasValidStatus,
        belongsToStructure
      });
      throw new Error('Vous n\'avez pas les permissions nécessaires pour accéder aux cotisations de cette structure.');
    }

    // Récupérer toutes les cotisations de la structure
    const subscriptionsRef = admin.firestore().collection('subscriptions');
    const q = subscriptionsRef.where('structureId', '==', structureId);
    const querySnapshot = await q.get();

    const cotisations = [];
    
    for (const doc of querySnapshot.docs) {
      const cotisationData = doc.data();
      
      // Récupérer les données de l'utilisateur
      const userDoc = await admin.firestore().collection('users').doc(cotisationData.userId).get();
      const userData = userDoc.exists ? userDoc.data() : null;

      cotisations.push({
        id: doc.id,
        ...cotisationData,
        userData: userData ? {
          firstName: userData.firstName,
          lastName: userData.lastName,
          email: userData.email
        } : null
      });
    }

    return { cotisations };
  } catch (error) {
    console.error('Erreur lors de la récupération des cotisations:', error);
    throw new Error(`Erreur lors de la récupération des cotisations: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
}); 

// Application Express pour webhook cotisation (body brut)
const cotisationWebhookApp = express();
cotisationWebhookApp.use(express.raw({ type: 'application/json', limit: '10mb' }));

// Webhook pour gérer les événements de paiement de cotisations
// Converti en v2 avec application Express pour gérer le body brut
export const handleCotisationWebhook = onRequest(webhookConfigWithRaw, cotisationWebhookApp);

// Route handler pour le webhook de cotisation
cotisationWebhookApp.post('*', async (req, res) => {
  const sig = req.headers['stripe-signature'] as string | undefined;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !endpointSecret) {
    console.error('Signature ou secret webhook manquant');
    res.status(400).send('Webhook Error');
    return;
  }

  let event: Stripe.Event;

  try {
    // Avec express.raw(), req.body est un Buffer
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body || ''), 'utf8');
    event = getStripeInstance().webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error('Erreur de signature webhook:', err);
    res.status(400).send(`Webhook Error: ${err instanceof Error ? err.message : 'Erreur inconnue'}`);
    return;
  }

  console.log('Webhook reçu:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.mode === 'payment' && session.metadata?.structureId) {
          console.log('Paiement de cotisation complété:', session.id);
          
          // Récupérer les métadonnées
          const userId = session.metadata.userId;
          const structureId = session.metadata.structureId;
          const cotisationDuration = session.metadata.cotisationDuration;
          const cotisationAmount = parseFloat(session.metadata.cotisationAmount || '0');
          
          // Calculer la date d'expiration
          const calculateExpiryDate = () => {
            const now = new Date();
            switch (cotisationDuration) {
              case 'end_of_school':
                return new Date(now.getFullYear() + 10, now.getMonth(), now.getDate());
              case '1_year':
                return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
              case '2_years':
                return new Date(now.getFullYear() + 2, now.getMonth(), now.getDate());
              case '3_years':
                return new Date(now.getFullYear() + 3, now.getMonth(), now.getDate());
              default:
                return new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
            }
          };

          const expiryDate = calculateExpiryDate();
          const paidAt = new Date();

          // Créer la cotisation dans Firestore
          const cotisationData = {
            userId: userId,
            status: 'active',
            paidAt: paidAt,
            expiresAt: expiryDate,
            stripeSessionId: session.id,
            amount: cotisationAmount,
            structureId: structureId,
            cotisationDuration: cotisationDuration,
            createdAt: new Date()
          };

          // Ajouter la cotisation à la collection subscriptions
          const subscriptionRef = await admin.firestore().collection('subscriptions').add(cotisationData);

          // Mettre à jour le document utilisateur
          await admin.firestore().collection('users').doc(userId).update({
            hasActiveSubscription: true,
            subscriptionId: subscriptionRef.id,
            subscriptionStatus: 'active',
            subscriptionPaidAt: paidAt,
            subscriptionExpiresAt: expiryDate,
            lastSubscriptionUpdate: new Date()
          });

          console.log('Cotisation créée avec succès:', subscriptionRef.id);
          try {
            const { notifyCotisationPaid } = await import('./notifications/billingNotifications');
            await notifyCotisationPaid({
              userId,
              amount: `${cotisationAmount.toFixed(2)} €`,
              structureId,
            });
          } catch (notifErr) {
            console.error('notifyCotisationPaid', notifErr);
          }
        }
        break;

      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment Intent réussi:', paymentIntent.id);
        break;

      case 'payment_intent.payment_failed':
        const failedPaymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment Intent échoué:', failedPaymentIntent.id);
        try {
          const uid = failedPaymentIntent.metadata?.userId;
          const sid = failedPaymentIntent.metadata?.structureId;
          if (uid) {
            const { notifyCotisationFailed } = await import('./notifications/billingNotifications');
            await notifyCotisationFailed({
              userId: uid,
              structureId: sid,
              amount: failedPaymentIntent.amount
                ? `${(failedPaymentIntent.amount / 100).toFixed(2)} €`
                : undefined,
            });
          } else if (sid) {
            const { notifyPaymentFailed } = await import('./notifications/billingNotifications');
            await notifyPaymentFailed(sid);
          }
        } catch (notifErr) {
          console.error('payment_failed notif', notifErr);
        }
        break;

      default:
        console.log(`Événement non géré: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Erreur lors du traitement du webhook:', error);
    res.status(500).send('Erreur interne du serveur');
  }
}); 