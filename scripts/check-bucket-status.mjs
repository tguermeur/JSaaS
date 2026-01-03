/**
 * Script pour vérifier le statut détaillé d'un bucket spécifique
 * Usage: node scripts/check-bucket-status.mjs <bucket-name>
 */

import https from 'https';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BUCKET_NAME = process.argv[2] || 'jsaas-dd2f7.firebasestorage.app';

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
 * Récupère les informations détaillées d'un bucket
 */
async function getBucketInfo(bucketName, accessToken) {
  return new Promise((resolve, reject) => {
    const url = `https://storage.googleapis.com/storage/v1/b/${bucketName}`;
    
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
            const bucket = JSON.parse(data);
            resolve(bucket);
          } catch (e) {
            reject(new Error('Réponse invalide'));
          }
        } else if (res.statusCode === 404) {
          resolve(null); // Bucket n'existe pas
        } else {
          reject(new Error(`Erreur ${res.statusCode}: ${data.substring(0, 200)}`));
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
    console.log(`🔍 Vérification du statut du bucket: ${BUCKET_NAME}\n`);
    
    const accessToken = getAccessToken();
    const bucket = await getBucketInfo(BUCKET_NAME, accessToken);
    
    if (!bucket) {
      console.log('❌ Bucket non trouvé');
      console.log('   Le bucket n\'existe pas ou a été définitivement supprimé');
      console.log('   (Les buckets sont définitivement supprimés après 7 jours)');
      return;
    }
    
    console.log('✅ Bucket trouvé!\n');
    console.log('📦 Informations du bucket:');
    console.log(`   Nom: ${bucket.name}`);
    console.log(`   État: ${bucket.lifecycleState || 'LIVE'}`);
    console.log(`   Location: ${bucket.location || 'N/A'}`);
    console.log(`   Storage Class: ${bucket.storageClass || 'STANDARD'}`);
    console.log(`   Créé: ${bucket.timeCreated || 'N/A'}`);
    console.log(`   Modifié: ${bucket.updated || 'N/A'}`);
    console.log(`   Génération: ${bucket.generation || 'N/A'}`);
    
    if (bucket.softDeleteTime) {
      console.log(`   ⚠️  Supprimé (soft): ${bucket.softDeleteTime}`);
      console.log(`   💡 Ce bucket peut être restauré!`);
    }
    
    if (bucket.lifecycleState === 'DELETE_REQUESTED' || bucket.lifecycleState === 'DELETED') {
      console.log(`\n🗑️  Bucket en état de suppression`);
      console.log(`   Génération pour restauration: ${bucket.generation || bucket.metadata?.generation}`);
      console.log(`\n💡 Pour restaurer ce bucket:`);
      console.log(`   node scripts/restore-bucket.mjs ${BUCKET_NAME} ${bucket.generation || bucket.metadata?.generation}`);
    } else {
      console.log(`\n✅ Bucket actif et opérationnel`);
      console.log(`   Aucune action nécessaire`);
    }
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

main();






