/**
 * @deprecated Endpoint legacy non exporté — utiliser les callables sécurisées ou Firestore direct.
 * Conservé pour référence uniquement ; ne pas ré-exporter depuis index.ts.
 */
import * as functions from 'firebase-functions';

export const addProspect = functions.https.onRequest((_req, res) => {
  res.status(410).json({ error: 'Endpoint désactivé. Utilisez l’application JS Connect.' });
});
