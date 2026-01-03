/**
 * Script pour restaurer un bucket supprimé en gérant les conflits
 * 
 * Ce script gère le cas où un bucket actif existe déjà avec le même nom
 * et propose des options pour résoudre le conflit.
 * 
 * Usage: node scripts/restore-bucket-with-conflict-resolution.mjs <bucket-name> <generation> [--force-delete-active]
 */

import https from 'https';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BUCKET_NAME = process.argv[2];
const GENERATION = process.argv[3];
const FORCE_DELETE = process.argv.includes('--force-delete-active');

if (!BUCKET_NAME || !GENERATION) {
  console.error('❌ Erreur: Nom du bucket et génération requis');
  console.log('\nUsage: node scripts/restore-bucket-with-conflict-resolution.mjs <bucket-name> <generation> [--force-delete-active]');
  console.log('\nExemple:');
  console.log('  node scripts/restore-bucket-with-conflict-resolution.mjs jsaas-dd2f7.firebasestorage.app 1742421543371078829');
  console.log('\n⚠️  ATTENTION: Utiliser --force-delete-active supprimera définitivement le bucket actif!');
  process.exit(1);
}

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
 * Vérifie l'état d'un bucket
 */
async function getBucketStatus(bucketName, accessToken) {
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
            resolve({ exists: true, bucket, statusCode: 200 });
          } catch (e) {
            resolve({ exists: true, bucket: null, statusCode: 200, raw: data });
          }
        } else if (res.statusCode === 404) {
          resolve({ exists: false, bucket: null, statusCode: 404 });
        } else {
          resolve({ exists: null, bucket: null, statusCode: res.statusCode, error: data.substring(0, 200) });
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
 * Liste les objets dans un bucket
 */
async function listObjects(bucketName, accessToken) {
  return new Promise((resolve, reject) => {
    const url = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o?maxResults=1000`;
    
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
            resolve([]);
          }
        } else {
          resolve([]);
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
 * Supprime un bucket (vide uniquement)
 */
async function deleteBucket(bucketName, accessToken) {
  return new Promise((resolve, reject) => {
    const url = `https://storage.googleapis.com/storage/v1/b/${bucketName}`;
    
    const options = {
      method: 'DELETE',
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
        if (res.statusCode === 204 || res.statusCode === 200) {
          resolve({ success: true });
        } else {
          try {
            const errorData = JSON.parse(data);
            reject(new Error(`Erreur ${res.statusCode}: ${errorData.error?.message || data}`));
          } catch (e) {
            reject(new Error(`Erreur ${res.statusCode}: ${data.substring(0, 200)}`));
          }
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
 * Restaure un bucket
 */
async function restoreBucket(bucketName, generation, accessToken) {
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
          try {
            const bucket = JSON.parse(data);
            resolve({ success: true, bucket });
          } catch (e) {
            resolve({ success: true, bucket: null, raw: data });
          }
        } else {
          try {
            const errorData = JSON.parse(data);
            reject(new Error(`Erreur ${res.statusCode}: ${errorData.error?.message || data}`));
          } catch (e) {
            reject(new Error(`Erreur ${res.statusCode}: ${data.substring(0, 200)}`));
          }
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
    console.log('🔍 Vérification du conflit de bucket...\n');
    console.log(`📋 Nom du bucket: ${BUCKET_NAME}`);
    console.log(`📋 Génération: ${GENERATION}\n`);

    const accessToken = getAccessToken();
    console.log('✅ Token d\'authentification obtenu\n');

    // Vérifier l'état du bucket actif
    console.log('🔍 Vérification de l\'existence d\'un bucket actif...');
    const activeBucketStatus = await getBucketStatus(BUCKET_NAME, accessToken);

    if (activeBucketStatus.exists) {
      const activeBucket = activeBucketStatus.bucket;
      console.log('⚠️  Un bucket actif existe déjà!\n');
      console.log('📦 Informations du bucket actif:');
      console.log(`   Nom: ${activeBucket?.name || BUCKET_NAME}`);
      console.log(`   Location: ${activeBucket?.location || 'N/A'}`);
      console.log(`   Created: ${activeBucket?.timeCreated || 'N/A'}`);
      console.log(`   Storage Class: ${activeBucket?.storageClass || 'N/A'}`);
      console.log('');

      // Vérifier les objets dans le bucket actif
      console.log('🔍 Vérification des objets dans le bucket actif...');
      const objects = await listObjects(BUCKET_NAME, accessToken);
      console.log(`   ${objects.length} objet(s) trouvé(s)\n`);

      if (objects.length > 0) {
        console.log('⚠️  ATTENTION: Le bucket actif contient des objets!');
        console.log('   Les objets suivants seront perdus si le bucket est supprimé:\n');
        objects.slice(0, 10).forEach(obj => {
          console.log(`   - ${obj.name} (${obj.size || 0} bytes)`);
        });
        if (objects.length > 10) {
          console.log(`   ... et ${objects.length - 10} autre(s) objet(s)`);
        }
        console.log('');
      }

      // Proposer des options
      if (!FORCE_DELETE) {
        console.log('💡 Options disponibles:\n');
        console.log('1️⃣  Supprimer le bucket actif et restaurer celui supprimé:');
        console.log('   ⚠️  ATTENTION: Toutes les données du bucket actif seront perdues!');
        console.log(`   node scripts/restore-bucket-with-conflict-resolution.mjs ${BUCKET_NAME} ${GENERATION} --force-delete-active`);
        console.log('');
        console.log('2️⃣  Migrer les données du bucket actif vers un autre bucket:');
        console.log('   - Créez un nouveau bucket');
        console.log('   - Copiez les objets du bucket actif vers le nouveau');
        console.log('   - Puis supprimez le bucket actif');
        console.log('   - Enfin, restaurez le bucket supprimé');
        console.log('');
        console.log('3️⃣  Garder le bucket actif (sur US-CENTRAL1):');
        console.log('   - Le bucket actif reste utilisé');
        console.log('   - Le bucket supprimé sur EUROPE-WEST3 ne sera pas restauré');
        console.log('');
        console.log('4️⃣  Vérifier les différences:');
        console.log('   - Le bucket actif est sur US-CENTRAL1');
        console.log('   - Le bucket supprimé était sur EUROPE-WEST3');
        console.log('   - Ils ont le même nom mais des régions différentes');
        console.log('');
        process.exit(0);
      } else {
        // Supprimer le bucket actif
        console.log('🗑️  Suppression du bucket actif...');
        
        if (objects.length > 0) {
          console.error('❌ Impossible de supprimer un bucket non vide via l\'API REST');
          console.error('   Vous devez d\'abord supprimer tous les objets du bucket');
          console.error('');
          console.error('💡 Options:');
          console.error('   1. Vider le bucket via Google Cloud Console:');
          console.error('      https://console.cloud.google.com/storage/browser');
          console.error('   2. Utiliser gcloud CLI:');
          console.error(`      gcloud storage rm -r gs://${BUCKET_NAME}/*`);
          console.error('   3. Supprimer les objets un par un via l\'API REST');
          process.exit(1);
        }

        try {
          await deleteBucket(BUCKET_NAME, accessToken);
          console.log('✅ Bucket actif supprimé avec succès\n');
        } catch (error) {
          console.error(`❌ Erreur lors de la suppression du bucket actif: ${error.message}`);
          process.exit(1);
        }
      }
    } else {
      console.log('✅ Aucun bucket actif trouvé\n');
    }

    // Restaurer le bucket supprimé
    console.log('🔄 Restauration du bucket supprimé...');
    try {
      const result = await restoreBucket(BUCKET_NAME, GENERATION, accessToken);
      console.log('✅ Bucket restauré avec succès!\n');
      console.log('📦 Informations du bucket restauré:');
      if (result.bucket) {
        console.log(`   Nom: ${result.bucket.name}`);
        console.log(`   Location: ${result.bucket.location || 'N/A'}`);
        console.log(`   Created: ${result.bucket.timeCreated || 'N/A'}`);
        console.log(`   Storage Class: ${result.bucket.storageClass || 'N/A'}`);
      }
      console.log('');
      console.log('✅ Restauration terminée avec succès!');
    } catch (error) {
      console.error(`❌ Erreur lors de la restauration: ${error.message}`);
      if (error.message.includes('409')) {
        console.error('');
        console.error('💡 Le bucket actif existe toujours');
        console.error('   Utilisez --force-delete-active pour le supprimer automatiquement');
      }
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

main();






