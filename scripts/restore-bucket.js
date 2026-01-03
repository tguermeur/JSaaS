/**
 * Script pour restaurer un bucket Firebase Storage supprimé
 * 
 * Usage: node scripts/restore-bucket.js <bucket-name> [generation]
 * 
 * Exemple: 
 *   node scripts/restore-bucket.js jsaas-dd2f7.firebasestorage.app
 *   node scripts/restore-bucket.js jsaas-dd2f7.firebasestorage.app 1234567890
 * 
 * Prérequis:
 *   - gcloud CLI installé et configuré
 *   - Authentifié avec: gcloud auth login
 *   - Permission: storage.buckets.restore
 * 
 * Référence: https://cloud.google.com/storage/docs/json_api/v1/buckets/restore
 */

import https from 'https';
import { execSync } from 'child_process';

// Configuration
const BUCKET_NAME = process.argv[2];
const GENERATION = process.argv[3]; // Optionnel, si non fourni, on essaiera de le trouver

if (!BUCKET_NAME) {
  console.error('❌ Erreur: Nom du bucket requis');
  console.log('\nUsage: node scripts/restore-bucket.js <bucket-name> [generation]');
  console.log('\nExemple:');
  console.log('  node scripts/restore-bucket.js jsaas-dd2f7.firebasestorage.app');
  console.log('  node scripts/restore-bucket.js jsaas-dd2f7.firebasestorage.app 1234567890');
  process.exit(1);
}

/**
 * Liste les buckets supprimés pour trouver la génération
 */
async function listDeletedBuckets() {
  return new Promise((resolve, reject) => {
    try {
      // Utiliser gcloud pour lister les buckets supprimés
      const command = `gcloud storage buckets list --filter="lifecycleState:DELETE_REQUESTED" --format="json"`;
      const output = execSync(command, { encoding: 'utf-8' });
      const buckets = JSON.parse(output);
      resolve(buckets);
    } catch (error) {
      console.warn('⚠️  Impossible d\'utiliser gcloud, essayons l\'API REST...');
      resolve([]);
    }
  });
}

/**
 * Restaure un bucket via l'API REST Google Cloud Storage
 */
async function restoreBucket(bucketName, generation) {
  return new Promise((resolve, reject) => {
    // Obtenir le token d'authentification
    let accessToken;
    try {
      accessToken = execSync('gcloud auth print-access-token', { encoding: 'utf-8' }).trim();
    } catch (error) {
      console.error('❌ Erreur: Impossible d\'obtenir le token d\'authentification');
      console.error('   Assurez-vous d\'être connecté avec: gcloud auth login');
      reject(new Error('Token d\'authentification manquant'));
      return;
    }

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
    console.log(`   URL: ${url}`);

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
            console.log(`   Location: ${bucket.location}`);
            console.log(`   Storage Class: ${bucket.storageClass}`);
            resolve(bucket);
          } catch (e) {
            resolve(data);
          }
        } else {
          console.error(`❌ Erreur ${res.statusCode}: ${res.statusMessage}`);
          console.error(`   Réponse: ${data}`);
          
          if (res.statusCode === 404) {
            console.error('\n💡 Suggestions:');
            console.error('   - Vérifiez que le bucket existe et est en état de suppression');
            console.error('   - Vérifiez que la génération est correcte');
            console.error('   - Les buckets sont définitivement supprimés après 7 jours');
          } else if (res.statusCode === 403) {
            console.error('\n💡 Suggestions:');
            console.error('   - Vérifiez vos permissions: storage.buckets.restore');
            console.error('   - Assurez-vous d\'être connecté avec le bon compte');
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

  // Si la génération n'est pas fournie, essayer de la trouver
  let generation = GENERATION;
  
  if (!generation) {
    console.log('📋 Liste des buckets supprimés...');
    const deletedBuckets = await listDeletedBuckets();
    
    const matchingBucket = deletedBuckets.find(b => b.name === BUCKET_NAME);
    if (matchingBucket) {
      console.log(`✅ Bucket trouvé: ${matchingBucket.name}`);
      if (matchingBucket.metadata && matchingBucket.metadata.generation) {
        generation = matchingBucket.metadata.generation;
        console.log(`   Génération trouvée: ${generation}`);
      } else {
        console.error('❌ Impossible de trouver la génération du bucket');
        console.error('   Veuillez fournir la génération manuellement');
        console.error('   Vous pouvez la trouver dans la console Google Cloud');
        process.exit(1);
      }
    } else {
      console.error('❌ Bucket supprimé non trouvé dans la liste');
      console.error('   Le bucket peut être définitivement supprimé (après 7 jours)');
      console.error('   Ou il n\'existe pas avec ce nom');
      console.error('\n💡 Essayez de fournir la génération manuellement:');
      console.error(`   node scripts/restore-bucket.js ${BUCKET_NAME} <generation>`);
      process.exit(1);
    }
  }

  try {
    await restoreBucket(BUCKET_NAME, generation);
  } catch (error) {
    console.error('\n❌ Échec de la restauration:', error.message);
    process.exit(1);
  }
}

main();

