/**
 * Script pour restaurer un bucket Firebase Storage supprimé
 * 
 * Usage: node scripts/restore-bucket.mjs <bucket-name> [generation]
 * 
 * Exemple: 
 *   node scripts/restore-bucket.mjs jsaas-dd2f7.firebasestorage.app
 *   node scripts/restore-bucket.mjs jsaas-dd2f7.firebasestorage.app 1234567890
 * 
 * Prérequis:
 *   - Token d'authentification Google Cloud (voir options ci-dessous)
 *   - Permission: storage.buckets.restore
 * 
 * Options d'authentification:
 *   1. Via gcloud CLI: gcloud auth login (puis le script utilisera gcloud auth print-access-token)
 *   2. Via variable d'environnement: export GOOGLE_CLOUD_TOKEN="your-token"
 *   3. Via fichier: créer un fichier .google-cloud-token avec le token
 * 
 * Référence: https://cloud.google.com/storage/docs/json_api/v1/buckets/restore
 */

import https from 'https';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const BUCKET_NAME = process.argv[2];
const GENERATION = process.argv[3]; // Optionnel, si non fourni, on essaiera de le trouver

if (!BUCKET_NAME) {
  console.error('❌ Erreur: Nom du bucket requis');
  console.log('\nUsage: node scripts/restore-bucket.mjs <bucket-name> [generation]');
  console.log('\nExemple:');
  console.log('  node scripts/restore-bucket.mjs jsaas-dd2f7.firebasestorage.app');
  console.log('  node scripts/restore-bucket.mjs jsaas-dd2f7.firebasestorage.app 1234567890');
  console.log('\n💡 Si vous ne connaissez pas la génération, le script essaiera de la trouver automatiquement.');
  process.exit(1);
}

/**
 * Obtient le token d'authentification Google Cloud
 */
function getAccessToken() {
  // Option 1: Variable d'environnement
  if (process.env.GOOGLE_CLOUD_TOKEN) {
    console.log('✅ Token trouvé dans la variable d\'environnement GOOGLE_CLOUD_TOKEN');
    return process.env.GOOGLE_CLOUD_TOKEN;
  }

  // Option 2: Fichier .google-cloud-token
  try {
    const tokenFile = join(__dirname, '..', '.google-cloud-token');
    const token = readFileSync(tokenFile, 'utf-8').trim();
    if (token) {
      console.log('✅ Token trouvé dans le fichier .google-cloud-token');
      return token;
    }
  } catch (error) {
    // Fichier n'existe pas, continuer
  }

  // Option 3: gcloud CLI
  try {
    const token = execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
    if (token) {
      console.log('✅ Token obtenu via gcloud CLI');
      return token;
    }
  } catch (error) {
    console.warn('⚠️  gcloud CLI non disponible ou non authentifié');
  }

  // Aucun token trouvé
  console.error('❌ Erreur: Impossible d\'obtenir le token d\'authentification');
  console.error('\n💡 Options pour obtenir un token:');
  console.error('   1. Installer gcloud CLI et exécuter: gcloud auth login');
  console.error('   2. Définir la variable d\'environnement: export GOOGLE_CLOUD_TOKEN="your-token"');
  console.error('   3. Créer un fichier .google-cloud-token à la racine du projet avec le token');
  console.error('\n📚 Pour obtenir un token manuellement:');
  console.error('   - Allez sur: https://console.cloud.google.com/apis/credentials');
  console.error('   - Créez une clé de compte de service');
  console.error('   - Ou utilisez: gcloud auth application-default login');
  throw new Error('Token d\'authentification manquant');
}

/**
 * Liste les buckets supprimés via l'API REST
 */
async function listDeletedBuckets(accessToken) {
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
            // Filtrer les buckets supprimés
            const deletedBuckets = (response.items || []).filter(bucket => 
              bucket.lifecycleState === 'DELETE_REQUESTED' || bucket.lifecycleState === 'DELETED'
            );
            resolve(deletedBuckets);
          } catch (e) {
            resolve([]);
          }
        } else {
          console.warn(`⚠️  Impossible de lister les buckets supprimés (${res.statusCode})`);
          resolve([]);
        }
      });
    });

    req.on('error', (error) => {
      console.warn('⚠️  Erreur lors de la liste des buckets:', error.message);
      resolve([]);
    });

    req.end();
  });
}

/**
 * Restaure un bucket via l'API REST Google Cloud Storage
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

    console.log(`🔄 Tentative de restauration du bucket: ${bucketName}`);
    console.log(`   Génération: ${generation}`);
    console.log(`   URL: ${url.replace(accessToken, '***TOKEN***')}`);

    const req = https.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Bucket restauré avec succès!');
          try {
            const bucket = JSON.parse(data);
            console.log(`\n📦 Informations du bucket restauré:`);
            console.log(`   Nom: ${bucket.name}`);
            console.log(`   Location: ${bucket.location || 'N/A'}`);
            console.log(`   Storage Class: ${bucket.storageClass || 'N/A'}`);
            console.log(`   Created: ${bucket.timeCreated || 'N/A'}`);
            resolve(bucket);
          } catch (e) {
            console.log('✅ Bucket restauré (réponse non-JSON reçue)');
            resolve(data);
          }
        } else {
          console.error(`❌ Erreur ${res.statusCode}: ${res.statusMessage}`);
          
          try {
            const errorData = JSON.parse(data);
            console.error(`   Message: ${errorData.error?.message || data}`);
          } catch (e) {
            console.error(`   Réponse: ${data.substring(0, 200)}`);
          }
          
          if (res.statusCode === 404) {
            console.error('\n💡 Suggestions:');
            console.error('   - Vérifiez que le bucket existe et est en état de suppression');
            console.error('   - Vérifiez que la génération est correcte');
            console.error('   - Les buckets sont définitivement supprimés après 7 jours');
            console.error('   - Le bucket peut avoir été supprimé il y a plus de 7 jours');
          } else if (res.statusCode === 403) {
            console.error('\n💡 Suggestions:');
            console.error('   - Vérifiez vos permissions: storage.buckets.restore');
            console.error('   - Assurez-vous d\'être connecté avec le bon compte');
            console.error('   - Vérifiez les rôles IAM dans Google Cloud Console');
          } else if (res.statusCode === 400) {
            console.error('\n💡 Suggestions:');
            console.error('   - Vérifiez que la génération est correcte');
            console.error('   - Le bucket peut ne pas être en état de suppression');
          }
          
          reject(new Error(`Erreur ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erreur de requête:', error.message);
      reject(error);
    });

    req.end();
  });
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🔍 Recherche du bucket supprimé...\n');
  console.log(`📋 Nom du bucket: ${BUCKET_NAME}\n`);

  try {
    // Obtenir le token d'authentification
    const accessToken = getAccessToken();
    console.log('✅ Token d\'authentification obtenu\n');

    // Si la génération n'est pas fournie, essayer de la trouver
    let generation = GENERATION;
    
    if (!generation) {
      console.log('📋 Recherche de la génération du bucket supprimé...');
      const deletedBuckets = await listDeletedBuckets(accessToken);
      
      if (deletedBuckets.length === 0) {
        console.warn('⚠️  Aucun bucket supprimé trouvé dans la liste');
        console.warn('   Cela peut être normal si aucun bucket n\'est en état de suppression');
        console.warn('   Ou si vous n\'avez pas les permissions pour lister les buckets');
      } else {
        console.log(`✅ ${deletedBuckets.length} bucket(s) supprimé(s) trouvé(s)`);
      }
      
      const matchingBucket = deletedBuckets.find(b => b.name === BUCKET_NAME);
      if (matchingBucket) {
        console.log(`✅ Bucket trouvé: ${matchingBucket.name}`);
        if (matchingBucket.metadata && matchingBucket.metadata.generation) {
          generation = matchingBucket.metadata.generation;
          console.log(`   Génération trouvée: ${generation}`);
        } else if (matchingBucket.generation) {
          generation = matchingBucket.generation;
          console.log(`   Génération trouvée: ${generation}`);
        } else {
          console.error('❌ Impossible de trouver la génération du bucket');
          console.error('   Veuillez fournir la génération manuellement');
          console.error('   Vous pouvez la trouver dans la console Google Cloud');
          console.error('\n💡 Pour trouver la génération:');
          console.error('   1. Allez sur Google Cloud Console → Storage → Buckets');
          console.error('   2. Cliquez sur "Buckets supprimés"');
          console.error('   3. Trouvez votre bucket et notez la génération');
          process.exit(1);
        }
      } else {
        console.error('❌ Bucket supprimé non trouvé dans la liste');
        console.error('   Le bucket peut être définitivement supprimé (après 7 jours)');
        console.error('   Ou il n\'existe pas avec ce nom');
        console.error('\n💡 Options:');
        console.error('   1. Fournir la génération manuellement:');
        console.error(`      node scripts/restore-bucket.mjs ${BUCKET_NAME} <generation>`);
        console.error('   2. Vérifier dans Google Cloud Console:');
        console.error('      https://console.cloud.google.com/storage/browser');
        console.error('   3. Vérifier que le bucket a été supprimé il y a moins de 7 jours');
        process.exit(1);
      }
    }

    // Restaurer le bucket
    console.log('');
    await restoreBucket(BUCKET_NAME, generation, accessToken);
    console.log('\n✅ Restauration terminée avec succès!');
    
  } catch (error) {
    console.error('\n❌ Échec de la restauration:', error.message);
    if (error.message.includes('Token')) {
      console.error('\n💡 Pour obtenir un token d\'authentification:');
      console.error('   1. Installer gcloud: https://cloud.google.com/sdk/docs/install');
      console.error('   2. Exécuter: gcloud auth login');
      console.error('   3. Ou définir: export GOOGLE_CLOUD_TOKEN="your-token"');
    }
    process.exit(1);
  }
}

main();






