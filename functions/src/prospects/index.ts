import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialiser Firebase Admin si ce n'est pas déjà fait
if (!admin.apps.length) {
  admin.initializeApp();
}

export const addProspect = functions.https.onRequest(async (req, res) => {
  // Activer CORS
  res.set('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).send('');
    return;
  }

  // Vérifier la méthode HTTP
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  try {
    const prospectData = req.body;
    
    // Validation des données
    if (!prospectData.nom || !prospectData.entreprise) {
      res.status(400).send('Données manquantes');
      return;
    }

    // Ajouter le prospect à Firestore
    const db = admin.firestore();
    const prospectsRef = db.collection('prospects');
    
    const newProspect = {
      ...prospectData,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await prospectsRef.add(newProspect);

    res.status(200).json({ message: 'Prospect ajouté avec succès' });
  } catch (error) {
    console.error('Erreur lors de l\'ajout du prospect:', error);
    res.status(500).send('Erreur serveur');
  }
}); 