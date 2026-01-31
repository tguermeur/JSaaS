#!/usr/bin/env node

/**
 * Script pour géocoder les événements ambassadeurs existants
 * qui n'ont pas encore de coordonnées GPS
 */

const admin = require('firebase-admin');
const https = require('https');

// Configuration Firebase
const serviceAccount = require('../mon-saas-firebase/serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: 'https://mon-saas-firebase-default-rtdb.firebaseio.com'
});

const db = admin.firestore();

// Clé API Google Maps
const GOOGLE_MAPS_API_KEY = process.env.VITE_GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  console.error('❌ VITE_GOOGLE_MAPS_API_KEY n\'est pas défini dans les variables d\'environnement');
  process.exit(1);
}

/**
 * Fonction pour géocoder une adresse avec Google Maps API
 */
function geocodeAddress(address) {
  return new Promise((resolve, reject) => {
    const encodedAddress = encodeURIComponent(address);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodedAddress}&key=${GOOGLE_MAPS_API_KEY}&language=fr`;

    https.get(url, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);

          if (response.status === 'OK' && response.results && response.results[0]) {
            const location = response.results[0].geometry.location;
            resolve({
              lat: location.lat,
              lng: location.lng
            });
          } else {
            reject(new Error(`Géocodage échoué: ${response.status}`));
          }
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Fonction principale
 */
async function geocodeExistingEvents() {
  try {
    console.log('🔍 Recherche des événements ambassadeurs sans coordonnées...');

    // Récupérer tous les événements ambassadeurs
    const eventsRef = db.collection('missions');
    const snapshot = await eventsRef.where('type', '==', 'ambassadeur_event').get();

    if (snapshot.empty) {
      console.log('ℹ️ Aucun événement ambassadeur trouvé');
      return;
    }

    const events = [];
    snapshot.forEach(doc => {
      events.push({ id: doc.id, ...doc.data() });
    });

    console.log(`📋 ${events.length} événement(s) trouvé(s)`);

    // Filtrer les événements sans coordonnées
    const eventsToGeocode = events.filter(event =>
      !event.locationCoordinates && event.location
    );

    if (eventsToGeocode.length === 0) {
      console.log('✅ Tous les événements ont déjà des coordonnées !');
      return;
    }

    console.log(`🎯 ${eventsToGeocode.length} événement(s) à géocoder`);

    let successCount = 0;
    let errorCount = 0;

    // Géocoder chaque événement
    for (const event of eventsToGeocode) {
      try {
        console.log(`📍 Géocodage de "${event.title || event.description}"...`);
        console.log(`   Adresse: ${event.location}`);

        const coordinates = await geocodeAddress(event.location);

        // Mettre à jour l'événement dans Firestore
        await eventsRef.doc(event.id).update({
          locationCoordinates: coordinates
        });

        console.log(`   ✅ Coordonnées: ${coordinates.lat}, ${coordinates.lng}`);
        successCount++;

        // Petite pause pour respecter les limites de l'API
        await new Promise(resolve => setTimeout(resolve, 200));

      } catch (error) {
        console.error(`   ❌ Erreur pour "${event.title || event.description}": ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n📊 Résumé:');
    console.log(`   ✅ Réussis: ${successCount}`);
    console.log(`   ❌ Échoués: ${errorCount}`);
    console.log(`   📍 Total géocodé: ${successCount + errorCount}`);

    if (successCount > 0) {
      console.log('\n🎉 Géocodage terminé ! Les événements devraient maintenant apparaître sur la carte.');
    }

  } catch (error) {
    console.error('❌ Erreur lors du géocodage:', error);
    process.exit(1);
  }
}

// Exécuter le script
geocodeExistingEvents()
  .then(() => {
    console.log('\n✨ Script terminé');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Erreur fatale:', error);
    process.exit(1);
  });