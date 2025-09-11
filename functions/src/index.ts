import { onCall, onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { createCheckoutSession, cancelSubscription, createSubscription, handleStripeWebhook, getStripeProducts, getStripeCustomers, cancelStripeSubscription, fetchPaymentHistory, createCotisationSession, getStructureCotisations, handleCotisationWebhook } from './stripe';
import * as cors from 'cors';
import * as express from 'express';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Charger les variables d'environnement
dotenv.config({ path: path.resolve(__dirname, '../.env') });

console.log('Mode Stripe:', process.env.STRIPE_MODE);
console.log('Chemin du fichier .env:', path.resolve(__dirname, '../.env'));

// Initialiser Firebase Admin
admin.initializeApp();

// Configuration CORS plus permissive
const corsHandler = cors({ 
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400
});

// Configuration des fonctions avec CORS explicite
const functionConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 300,
  cors: true,
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 10,
  concurrency: 80,
  allowUnauthenticated: true
};

// Créer l'application Express
const app = express();

// Middleware CORS
app.use(corsHandler);

// Middleware pour gérer les requêtes OPTIONS (preflight)
app.options('*', corsHandler);

// Route de test
app.get('/', (req, res) => {
  res.json({ message: "Les fonctions Cloud sont accessibles!" });
});

// Exporter l'application Express
export const api = onRequest(functionConfig, app);

// Types pour les données des fonctions
interface CreateUserData {
  email: string;
  password: string;
  displayName: string;
}

interface UpdateUserProfileData {
  displayName: string;
  photoURL?: string;
}

// Fonction pour créer un nouvel utilisateur
export const createUser = onCall(functionConfig, async (request) => {
  try {
    // Vérifier l'authentification
    if (!request.auth) {
      throw new Error('Vous devez être connecté pour accéder à cette fonction.');
    }

    const { email, password, displayName } = request.data as CreateUserData;

    // Créer l'utilisateur dans Firebase Auth
    const userRecord = await admin.auth().createUser({
      email,
      password,
      displayName,
    });

    // Créer le document utilisateur dans Firestore
    await admin.firestore().collection('users').doc(userRecord.uid).set({
      email,
      displayName,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { uid: userRecord.uid };
  } catch (error) {
    console.error('Erreur lors de la création de l\'utilisateur:', error);
    throw new Error('Une erreur est survenue lors de la création de l\'utilisateur.');
  }
});

// Fonction pour mettre à jour le profil utilisateur
export const updateUserProfile = onCall(functionConfig, async (request) => {
  try {
    // Vérifier l'authentification
    if (!request.auth) {
      throw new Error('Vous devez être connecté pour accéder à cette fonction.');
    }

    const { displayName, photoURL } = request.data as UpdateUserProfileData;
    const uid = request.auth.uid;

    // Mettre à jour le profil dans Firebase Auth
    await admin.auth().updateUser(uid, {
      displayName,
      photoURL,
    });

    // Mettre à jour le document dans Firestore
    await admin.firestore().collection('users').doc(uid).update({
      displayName,
      photoURL,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la mise à jour du profil:', error);
    throw new Error('Une erreur est survenue lors de la mise à jour du profil.');
  }
});

// Exporter les autres fonctions
export { 
  getStripeProducts,
  createCheckoutSession,
  cancelSubscription,
  createSubscription,
  handleStripeWebhook,
  getStripeCustomers,
  cancelStripeSubscription,
  fetchPaymentHistory,
  createCotisationSession,
  getStructureCotisations,
  handleCotisationWebhook
}; 