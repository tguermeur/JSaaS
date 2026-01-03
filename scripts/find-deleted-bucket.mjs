/**
 * Script pour trouver et restaurer un bucket supprimé sur EUROPE-WEST3
 * Usage: node scripts/find-deleted-bucket.mjs
 */

import https from 'https';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BUCKET_NAME = 'jsaas-dd2f7.firebasestorage.app';
const TARGET_LOCATION = 'EUROPE-WEST3';
const DELETE_DATE = '2025-11-11'; // Date approximative de suppression

/**
 * Obtient le token d'authentification
 */
function getAccessToken() {
  if (process.env.GOOGLE_CLOUD_TOKEN) {
    return process.env.GOOGLE_CLOUD_TOKEN;
  }

  try {
    const tokenFile = join(__dirname, '..', '.google-cloud-token');
    const token = readFileSync(tokenFile, 'utf-8').trim();
    if (token) {
      return token;
    }
  } catch (error) {
    // Fichier n'existe pas
  }

  throw new Error('Token d\'authentification manquant');
}

/**
 * Essaie de restaurer un bucket avec différentes méthodes
 */
async function tryRestoreBucket(bucketName, generation, accessToken) {
  return new Promise((resolve, reject) => {
    const url = `https://storage.googleapis.com/storage/v1/b/${bucketName}/restore?generation=${generation}`;
    
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve({ success: true, data: JSON.parse(data) });
        } else {
          resolve({ success: false, statusCode: res.statusCode, data: data.substring(0, 200) });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

/**
 * Fonction principale
 */
async function main() {
  try {
    console.log('🔍 Recherche du bucket supprimé sur EUROPE-WEST3...\n');
    console.log(`📋 Nom du bucket: ${BUCKET_NAME}`);
    console.log(`📍 Location: ${TARGET_LOCATION}`);
    console.log(`📅 Date de suppression: ${DELETE_DATE}\n`);
    
    const accessToken = getAccessToken();
    console.log('✅ Token d\'authentification obtenu\n');
    
    console.log('💡 Les buckets supprimés ne sont pas visibles dans la liste standard de l\'API REST.');
    console.log('   Pour restaurer un bucket supprimé, vous avez besoin de la génération.\n');
    
    console.log('📚 Options pour trouver la génération:');
    console.log('');
    console.log('1️⃣  Via Google Cloud Console (Recommandé):');
    console.log('   a. Allez sur: https://console.cloud.google.com/storage/browser?project=jsaas-dd2f7');
    console.log('   b. Cliquez sur "Buckets supprimés" ou "Deleted buckets"');
    console.log('   c. Trouvez le bucket sur EUROPE-WEST3');
    console.log('   d. Notez la génération (un nombre long)');
    console.log('   e. Exécutez: node scripts/restore-bucket.mjs jsaas-dd2f7.firebasestorage.app <generation>');
    console.log('');
    console.log('2️⃣  Via gcloud CLI (si installé):');
    console.log('   gcloud storage buckets list --filter="lifecycleState:DELETE_REQUESTED" --format="json" | jq \'.[] | select(.location=="EUROPE-WEST3") | {name: .name, generation: .generation}\'');
    console.log('');
    console.log('3️⃣  Via l\'API REST directement (avec curl):');
    console.log('   curl -H "Authorization: Bearer YOUR_TOKEN" \\');
    console.log('     "https://storage.googleapis.com/storage/v1/b?project=jsaas-dd2f7&softDeleted=true" | jq');
    console.log('');
    
    // Essayer de lister les buckets avec softDeleted=true
    console.log('🔍 Tentative de liste des buckets supprimés (softDeleted=true)...\n');
    
    const url = 'https://storage.googleapis.com/storage/v1/b?project=jsaas-dd2f7&softDeleted=true&maxResults=1000';
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };
    
    const req = https.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const response = JSON.parse(data);
            const deletedBuckets = response.items || [];
            
            if (deletedBuckets.length > 0) {
              console.log(`✅ ${deletedBuckets.length} bucket(s) supprimé(s) trouvé(s):\n`);
              
              deletedBuckets.forEach(bucket => {
                console.log(`   - ${bucket.name}`);
                console.log(`     Location: ${bucket.location || 'N/A'}`);
                console.log(`     Génération: ${bucket.generation || 'N/A'}`);
                console.log(`     Soft Delete Time: ${bucket.softDeleteTime || 'N/A'}`);
                console.log('');
              });
              
              // Chercher le bucket sur EUROPE-WEST3
              const europeWest3Bucket = deletedBuckets.find(b => 
                b.location === TARGET_LOCATION || 
                b.location === 'EUROPE-WEST3' ||
                (b.name === BUCKET_NAME && b.location?.includes('EUROPE'))
              );
              
              if (europeWest3Bucket) {
                console.log('🎯 Bucket trouvé sur EUROPE-WEST3!\n');
                console.log(`   Nom: ${europeWest3Bucket.name}`);
                console.log(`   Location: ${europeWest3Bucket.location}`);
                console.log(`   Génération: ${europeWest3Bucket.generation}`);
                console.log(`   Soft Delete Time: ${europeWest3Bucket.softDeleteTime}`);
                console.log('');
                console.log('💡 Pour restaurer ce bucket:');
                console.log(`   node scripts/restore-bucket.mjs ${europeWest3Bucket.name} ${europeWest3Bucket.generation}`);
                console.log('');
                console.log('🚀 Voulez-vous restaurer maintenant? (exécutez la commande ci-dessus)');
              } else {
                console.log('⚠️  Aucun bucket trouvé sur EUROPE-WEST3');
                console.log('   Vérifiez que le bucket a été supprimé il y a moins de 7 jours');
                console.log('   Ou vérifiez dans Google Cloud Console');
              }
            } else {
              console.log('⚠️  Aucun bucket supprimé trouvé avec softDeleted=true');
              console.log('   Cela peut signifier:');
              console.log('   - Le bucket a été définitivement supprimé (après 7 jours)');
              console.log('   - Le bucket n\'existe pas dans cette région');
              console.log('   - Le paramètre softDeleted=true n\'est pas supporté par cette API');
              console.log('');
              console.log('💡 Vérifiez dans Google Cloud Console:');
              console.log('   https://console.cloud.google.com/storage/browser?project=jsaas-dd2f7');
            }
          } catch (e) {
            console.error('❌ Erreur lors du parsing de la réponse:', e.message);
            console.log('Réponse brute:', data.substring(0, 500));
          }
        } else {
          console.log(`⚠️  Erreur ${res.statusCode}: ${data.substring(0, 200)}`);
          console.log('');
          console.log('💡 Le paramètre softDeleted=true peut ne pas être supporté.');
          console.log('   Utilisez Google Cloud Console pour trouver la génération:');
          console.log('   https://console.cloud.google.com/storage/browser?project=jsaas-dd2f7');
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erreur de requête:', error.message);
    });

    req.end();
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

main();






