/**
 * Script pour vérifier tous les buckets supprimés et leurs objets
 * 
 * Usage: node scripts/check-all-deleted-buckets.mjs
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
 * Liste tous les buckets supprimés
 */
async function listDeletedBuckets(accessToken) {
  return new Promise((resolve, reject) => {
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
            resolve(response.items || []);
          } catch (e) {
            reject(new Error('Réponse invalide'));
          }
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
 * Liste tous les objets dans un bucket (même supprimé)
 */
async function listObjects(bucketName, generation, accessToken) {
  return new Promise((resolve, reject) => {
    const url = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o?maxResults=1000${generation ? `&generation=${generation}` : ''}`;
    
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
        } else if (res.statusCode === 404) {
          resolve([]);
        } else {
          resolve([]);
        }
      });
    });

    req.on('error', (error) => {
      resolve([]);
    });

    req.end();
  });
}

/**
 * Fonction principale
 */
async function main() {
  try {
    console.log('🔍 Vérification de tous les buckets supprimés...\n');

    const accessToken = getAccessToken();
    console.log('✅ Token d\'authentification obtenu\n');

    // Lister tous les buckets supprimés
    console.log('📋 Liste des buckets supprimés...');
    const deletedBuckets = await listDeletedBuckets(accessToken);
    console.log(`   ${deletedBuckets.length} bucket(s) supprimé(s) trouvé(s)\n`);

    if (deletedBuckets.length === 0) {
      console.log('⚠️  Aucun bucket supprimé trouvé');
      console.log('   Cela peut signifier:');
      console.log('   - Tous les buckets ont été définitivement supprimés (après 7 jours)');
      console.log('   - Aucun bucket n\'est en état de suppression');
      return;
    }

    // Pour chaque bucket supprimé, vérifier les objets
    for (const bucket of deletedBuckets) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📦 Bucket: ${bucket.name}`);
      console.log(`   Location: ${bucket.location || 'N/A'}`);
      console.log(`   Génération: ${bucket.generation || 'N/A'}`);
      console.log(`   Soft Delete Time: ${bucket.softDeleteTime || 'N/A'}`);
      console.log(`   État: ${bucket.lifecycleState || 'N/A'}`);
      console.log('');

      // Essayer de lister les objets dans ce bucket
      console.log('   🔍 Recherche des objets...');
      try {
        // D'abord, essayer de restaurer temporairement le bucket
        // Mais on ne peut pas le faire automatiquement car il peut y avoir des conflits
        
        // Essayer de lister les objets directement (peut ne pas fonctionner pour les buckets supprimés)
        const objects = await listObjects(bucket.name, bucket.generation, accessToken);
        
        if (objects.length > 0) {
          console.log(`   ✅ ${objects.length} objet(s) trouvé(s):\n`);
          objects.slice(0, 10).forEach(obj => {
            console.log(`      - ${obj.name} (${(parseInt(obj.size || 0) / 1024).toFixed(2)} KB)`);
          });
          if (objects.length > 10) {
            console.log(`      ... et ${objects.length - 10} autre(s) objet(s)`);
          }
          console.log('');
          console.log('   💡 Pour télécharger ces objets:');
          console.log(`      node scripts/download-deleted-bucket-files.mjs ${bucket.name} ${bucket.generation}`);
        } else {
          console.log('   ⚠️  Aucun objet trouvé ou objets non accessibles');
          console.log('   💡 Les objets peuvent avoir été définitivement supprimés');
          console.log('   💡 Ou le bucket doit être restauré pour accéder aux objets');
          console.log('');
          console.log('   💡 Pour restaurer ce bucket:');
          console.log(`      node scripts/restore-bucket.mjs ${bucket.name} ${bucket.generation}`);
        }
      } catch (error) {
        console.log(`   ❌ Erreur lors de la recherche: ${error.message}`);
        console.log('   💡 Le bucket doit être restauré pour accéder aux objets');
      }
      console.log('');
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('💡 Résumé:');
    console.log(`   - ${deletedBuckets.length} bucket(s) supprimé(s) trouvé(s)`);
    console.log('   - Les objets ne sont accessibles qu\'après restauration du bucket');
    console.log('   - Utilisez les commandes indiquées ci-dessus pour restaurer et télécharger');
    console.log('');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

main();






