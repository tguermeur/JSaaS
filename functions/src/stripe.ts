import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import * as functions from 'firebase-functions';
import { StripeProduct } from './types';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Charger les variables d'environnement depuis le fichier .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Configuration des fonctions
const functionConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 300,
  cors: true, // Permettre toutes les origines
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 10,
  concurrency: 80,
  allowUnauthenticated: false, // Changer à false car nous vérifions l'auth
};

// Initialiser Stripe avec la clé secrète depuis les variables d'environnement ou la configuration Firebase
console.log('Variables d\'environnement chargées:', {
  STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY ? 'DÉFINIE' : 'NON DÉFINIE',
  FRONTEND_URL: process.env.FRONTEND_URL
});
console.log('Chemin du fichier .env:', path.resolve(__dirname, '../.env'));

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || functions.config().stripe?.secret_key;
if (!stripeSecretKey) {
  throw new Error('STRIPE_SECRET_KEY n\'est pas configurée');
}

// Vérifier si nous sommes en mode test
const isTestMode = stripeSecretKey.startsWith('sk_test_');
console.log('Mode Stripe:', isTestMode ? 'TEST' : 'PRODUCTION');
console.log('Clé Stripe (début):', stripeSecretKey.substring(0, 10) + '...');

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: '2023-10-16',
});

// Configuration des URLs
const FRONTEND_URL = process.env.FRONTEND_URL || functions.config().app?.frontend_url || 'http://localhost:5173';
const SUCCESS_URL = `${FRONTEND_URL}/settings/billing?success=true`;
const CANCEL_URL = `${FRONTEND_URL}/settings/billing?canceled=true`;

interface CreateCheckoutSessionData {
  priceId: string;
  userId: string;
  structureId: string;
}

interface CancelSubscriptionData {
  subscriptionId: string;
  userId: string;
}

// Fonction pour récupérer les produits Stripe
export const getStripeProducts = onCall(functionConfig, async (request) => {
  try {
    console.log('getStripeProducts - Début de la fonction');
    
    // Récupérer tous les produits actifs avec leurs prix récurrents
    const products = await stripe.products.list({
      active: true,
      expand: ['data.default_price'],
    });
    console.log('getStripeProducts - Nombre de produits récupérés:', products.data.length);
    console.log('getStripeProducts - Premier produit brut:', JSON.stringify(products.data[0], null, 2));

    // Récupérer tous les prix récurrents
    const prices = await stripe.prices.list({
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
      throw new Error('Vous devez être connecté pour accéder à cette fonction.');
    }

    const { priceId, userId, structureId } = request.data as CreateCheckoutSessionData;

    if (!priceId) {
      throw new Error('L\'ID du prix est requis.');
    }

    if (!userId) {
      throw new Error('L\'ID de l\'utilisateur est requis.');
    }

    if (!structureId) {
      throw new Error('L\'ID de la structure est requis.');
    }

    // Vérifier que l'utilisateur est admin de la structure
    const userDoc = await admin.firestore().collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData || userData.status !== 'admin' || userData.structureId !== structureId) {
      throw new Error('Vous n\'avez pas les permissions nécessaires pour gérer les abonnements de cette structure.');
    }

    // Créer ou récupérer le client Stripe pour la structure
    const structureDoc = await admin.firestore().collection('stripeCustomers').doc(structureId);
    const structureData = await structureDoc.get();

    let customerId = structureData.exists ? structureData.data()?.customerId : null;

    if (!customerId) {
      const customer = await stripe.customers.create({
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

    // Créer une session de paiement
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: SUCCESS_URL,
      cancel_url: CANCEL_URL,
      client_reference_id: structureId,
      metadata: {
        userId: userId,
        structureId: structureId,
      },
    });

    return { sessionId: session.id };
  } catch (error) {
    console.error('Erreur lors de la création de la session de paiement:', error);
    throw new Error(`Erreur lors de la création de la session de paiement: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
});

// Fonction pour annuler un abonnement
export const cancelSubscription = onCall(functionConfig, async (request) => {
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
    await stripe.subscriptions.cancel(subscriptionId);

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

export const createSubscription = functions.https.onCall(async (request) => {
  console.log('Stripe Functions - Début de createSubscription');
  
  if (!request.auth) {
    console.log('Stripe Functions - Erreur: utilisateur non authentifié');
    throw new functions.https.HttpsError(
      'unauthenticated',
      'Vous devez être connecté pour créer un abonnement'
    );
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
      const customer = await stripe.customers.create({
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

    // Créer la session de paiement
    console.log('Stripe Functions - Création de la session de paiement');
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.FRONTEND_URL}/settings/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/settings/billing?canceled=true`,
      metadata: {
        userId: userId
      }
    });
    console.log('Stripe Functions - Session créée:', session.id);

    return { sessionId: session.id };
  } catch (error) {
    console.error('Stripe Functions - Erreur lors de la création de l\'abonnement:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Une erreur est survenue lors de la création de l\'abonnement'
    );
  }
});

export const handleStripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];
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
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    console.log('Stripe Functions - Événement Stripe reçu:', event.type);
  } catch (err: any) {
    console.error('Stripe Functions - Erreur de signature webhook:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Gérer les événements Stripe
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      const subscription = event.data.object as Stripe.Subscription;
      const structureId = subscription.metadata.structureId;
      
      // Récupérer l'email du client depuis les métadonnées
      const customerEmail = subscription.metadata.customerEmail;
      console.log('Stripe Functions - Mise à jour de l\'abonnement:', { 
        structureId, 
        status: subscription.status,
        customerEmail 
      });

      // Mettre à jour le statut de l'abonnement dans Firestore
      await admin.firestore().collection('subscriptions').doc(structureId).set({
        structureId: structureId,
        subscriptionId: subscription.id,
        status: subscription.status,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        planId: subscription.items.data[0].price.id,
        customerEmail: customerEmail,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Mettre à jour le statut de la structure
      await admin.firestore().collection('structures').doc(structureId).update({
        subscriptionStatus: subscription.status,
        subscriptionId: subscription.id,
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
        subscriptionEmail: customerEmail
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
export const getStripeCustomers = onCall(functionConfig, async (request) => {
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
    const subscriptions = await stripe.subscriptions.list({
      limit: 100,
      status: 'all'
    });
    
    console.log('Nombre d\'abonnements récupérés:', subscriptions.data.length);

    // Récupérer les clients associés
    const customers = await Promise.all(
      subscriptions.data.map(async (subscription) => {
        const customerResponse = await stripe.customers.retrieve(subscription.customer as string);
        const customer = customerResponse as Stripe.Customer;
        const price = await stripe.prices.retrieve(subscription.items.data[0].price.id);
        const product = await stripe.products.retrieve(price.product as string);

        return {
          id: customer.id,
          email: customer.email,
          name: customer.name || 'Non renseigné',
          subscriptionStatus: subscription.status,
          subscriptionTitle: price.nickname || product.name,
          productName: product.name,
          currentPeriodEnd: subscription.current_period_end * 1000,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
          environment: isTestMode ? 'test' : 'production'
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
    const customers = await stripe.customers.list({ email });
    const customer = customers.data[0];

    if (!customer) {
      throw new functions.https.HttpsError(
        'not-found',
        'Structure non trouvée dans Stripe'
      );
    }

    console.log('Client Stripe trouvé:', customer.id);

    // Récupérer les abonnements du client
    const subscriptions = await stripe.subscriptions.list({
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
    const canceledSubscription = await stripe.subscriptions.update(subscription.id, {
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
export const fetchPaymentHistory = onCall(functionConfig, async (request) => {
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
    const customers = await stripe.customers.list({ email });
    console.log('fetchPaymentHistory - Nombre de clients trouvés:', customers.data.length);
    
    const customer = customers.data[0];

    if (!customer) {
      console.log('fetchPaymentHistory - Aucun client trouvé pour l\'email:', email);
      return [];
    }

    console.log('fetchPaymentHistory - Client Stripe trouvé:', customer.id);

    // Récupérer les charges (qui contiennent les reçus)
    console.log('fetchPaymentHistory - Récupération des charges...');
    const charges = await stripe.charges.list({
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
export const createCotisationSession = onCall(functionConfig, async (request) => {
  try {
    // Vérifier l'authentification
    if (!request.auth) {
      throw new Error('Vous devez être connecté pour accéder à cette fonction.');
    }

    const { userId, structureId, amount, duration } = request.data as CreateCotisationSessionData;

    if (!userId || !structureId || !amount || !duration) {
      throw new Error('Tous les paramètres sont requis (userId, structureId, amount, duration).');
    }

    // Récupérer les données de la structure pour obtenir les clés Stripe
    const structureDoc = await admin.firestore().collection('structures').doc(structureId).get();
    if (!structureDoc.exists) {
      throw new Error('Structure non trouvée.');
    }

    const structureData = structureDoc.data();
    if (!structureData?.stripeSecretKey) {
      throw new Error('Les clés Stripe ne sont pas configurées pour cette structure.');
    }

    // Initialiser Stripe avec les clés de la structure
    const structureStripe = new Stripe(structureData.stripeSecretKey, {
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

// Webhook pour gérer les événements de paiement de cotisations
export const handleCotisationWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !endpointSecret) {
    console.error('Signature ou secret webhook manquant');
    res.status(400).send('Webhook Error');
    return;
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
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
        }
        break;

      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment Intent réussi:', paymentIntent.id);
        break;

      case 'payment_intent.payment_failed':
        const failedPaymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Payment Intent échoué:', failedPaymentIntent.id);
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