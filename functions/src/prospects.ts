import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

export const api = functions.https.onRequest(async (req, res) => {
  console.log('Requête reçue:', {
    method: req.method,
    headers: req.headers,
    body: req.body,
    path: req.path
  });

  // Autoriser CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Gérer la requête OPTIONS
  if (req.method === 'OPTIONS') {
    console.log('Réponse OPTIONS');
    res.status(204).send('');
    return;
  }

  // Gérer la requête POST
  if (req.method === 'POST') {
    try {
      const { linkedinUrl } = req.body;
      console.log('Données reçues:', req.body);

      if (!linkedinUrl) {
        console.log('URL LinkedIn manquante');
        res.status(400).json({ error: 'URL LinkedIn requise' });
        return;
      }

      // Ajouter le prospect à la base de données
      const db = admin.firestore();
      const prospectRef = await db.collection('prospects').add({
        linkedinUrl,
        source: 'linkedin',
        dateAjout: new Date().toISOString(),
        statut: 'nouveau',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log('Prospect ajouté avec succès:', prospectRef.id);
      res.status(200).json({ 
        success: true, 
        id: prospectRef.id 
      });
    } catch (error) {
      console.error('Erreur:', error);
      res.status(500).json({ error: 'Erreur serveur' });
    }
  } else {
    res.status(405).json({ error: 'Méthode non autorisée' });
  }
}); 