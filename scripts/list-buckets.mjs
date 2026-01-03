/**
 * Script pour lister tous les buckets (actifs et supprimés)
 * Usage: node scripts/list-buckets.mjs
 */

import https from 'https';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Obtient le token d'authentification
 */
function getAccessToken() {
  // Variable d'environnement
  if (process.env.GOOGLE_CLOUD_TOKEN) {
    return process.env.GOOGLE_CLOUD_TOKEN;
  }

  // Fichier .google-cloud-token
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
 * Liste tous les buckets
 */
async function listAllBuckets(accessToken) {
  return new Promise((resolve, reject) => {
    const url = 'https://storage.googleapis.com/storage/v1/b?project=jsaas-dd2f7&maxResults=1000';
    
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
            resolve(response.items || []);
          } catch (e) {
            reject(new Error('Réponse invalide: ' + data.substring(0, 200)));
          }
        } else {
          reject(new Error(`Erreur ${res.statusCode}: ${data}`));
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
    console.log('🔍 Récupération de la liste des buckets...\n');
    
    const accessToken = getAccessToken();
    console.log('✅ Token d\'authentification obtenu\n');
    
    const buckets = await listAllBuckets(accessToken);
    
    console.log(`📦 Total de buckets trouvés: ${buckets.length}\n`);
    
    if (buckets.length === 0) {
      console.log('⚠️  Aucun bucket trouvé');
      console.log('   Cela peut signifier:');
      console.log('   - Aucun bucket n\'existe dans ce projet');
      console.log('   - Vous n\'avez pas les permissions pour lister les buckets');
      console.log('   - Le projet est incorrect');
      return;
    }
    
    // Séparer les buckets actifs et supprimés
    const activeBuckets = buckets.filter(b => 
      !b.lifecycleState || 
      b.lifecycleState === 'LIVE' || 
      b.lifecycleState === 'ACTIVE'
    );
    
    const deletedBuckets = buckets.filter(b => 
      b.lifecycleState === 'DELETE_REQUESTED' || 
      b.lifecycleState === 'DELETED'
    );
    
    console.log('✅ Buckets actifs:');
    if (activeBuckets.length > 0) {
      activeBuckets.forEach(bucket => {
        console.log(`   - ${bucket.name}`);
        console.log(`     Location: ${bucket.location || 'N/A'}`);
        console.log(`     Created: ${bucket.timeCreated || 'N/A'}`);
        console.log('');
      });
    } else {
      console.log('   (Aucun bucket actif)');
      console.log('');
    }
    
    console.log('🗑️  Buckets supprimés:');
    if (deletedBuckets.length > 0) {
      deletedBuckets.forEach(bucket => {
        console.log(`   - ${bucket.name}`);
        console.log(`     Location: ${bucket.location || 'N/A'}`);
        console.log(`     État: ${bucket.lifecycleState}`);
        console.log(`     Génération: ${bucket.generation || bucket.metadata?.generation || 'N/A'}`);
        console.log(`     Supprimé: ${bucket.timeDeleted || bucket.softDeleteTime || 'N/A'}`);
        console.log('');
      });
      
      // Chercher spécifiquement le bucket sur EUROPE-WEST3
      const europeWest3Bucket = deletedBuckets.find(b => 
        b.location === 'EUROPE-WEST3' || 
        b.location === 'EUROPE-WEST3' ||
        (b.name === 'jsaas-dd2f7.firebasestorage.app' && (b.location?.includes('EUROPE') || b.location?.includes('WEST3')))
      );
      
      if (europeWest3Bucket) {
        console.log('🎯 Bucket trouvé sur EUROPE-WEST3:');
        console.log(`   Nom: ${europeWest3Bucket.name}`);
        console.log(`   Location: ${europeWest3Bucket.location}`);
        console.log(`   Génération: ${europeWest3Bucket.generation || europeWest3Bucket.metadata?.generation}`);
        console.log(`   Supprimé: ${europeWest3Bucket.timeDeleted || europeWest3Bucket.softDeleteTime}`);
        console.log('');
        console.log('💡 Pour restaurer ce bucket:');
        console.log(`   node scripts/restore-bucket.mjs ${europeWest3Bucket.name} ${europeWest3Bucket.generation || europeWest3Bucket.metadata?.generation}`);
      }
      
      console.log('💡 Pour restaurer un bucket supprimé:');
      console.log(`   node scripts/restore-bucket.mjs <bucket-name> <generation>`);
    } else {
      console.log('   (Aucun bucket supprimé trouvé dans la liste)');
      console.log('');
      console.log('💡 Si vous cherchez un bucket supprimé:');
      console.log('   - Il peut avoir été définitivement supprimé (après 7 jours)');
      console.log('   - Les buckets supprimés peuvent ne pas apparaître dans la liste standard');
      console.log('   - Vérifiez dans Google Cloud Console:');
      console.log('     https://console.cloud.google.com/storage/browser?project=jsaas-dd2f7');
      console.log('   - Ou essayez de restaurer directement avec la génération si vous la connaissez');
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    if (error.message.includes('Token')) {
      console.error('\n💡 Pour obtenir un token:');
      console.error('   1. Allez sur: https://developers.google.com/oauthplayground/');
      console.error('   2. Sélectionnez "Cloud Storage API v1"');
      console.error('   3. Cochez: https://www.googleapis.com/auth/cloud-platform');
      console.error('   4. Autorisez et copiez le token');
      console.error('   5. Créez: echo "TOKEN" > .google-cloud-token');
    }
    process.exit(1);
  }
}

main();

