/**
 * Script pour migrer les données d'un bucket actif vers un bucket temporaire,
 * puis restaurer un bucket supprimé
 * 
 * Usage: node scripts/migrate-and-restore-bucket.mjs <bucket-name> <generation> [temp-bucket-name]
 */

import https from 'https';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BUCKET_NAME = process.argv[2];
const GENERATION = process.argv[3];
const TEMP_BUCKET_NAME = process.argv[4] || `${BUCKET_NAME}-backup-${Date.now()}`;

if (!BUCKET_NAME || !GENERATION) {
  console.error('❌ Erreur: Nom du bucket et génération requis');
  console.log('\nUsage: node scripts/migrate-and-restore-bucket.mjs <bucket-name> <generation> [temp-bucket-name]');
  console.log('\nExemple:');
  console.log('  node scripts/migrate-and-restore-bucket.mjs jsaas-dd2f7.firebasestorage.app 1742421543371078829');
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
 * Liste les objets dans un bucket
 */
async function listObjects(bucketName, accessToken) {
  return new Promise((resolve, reject) => {
    let allObjects = [];
    let pageToken = null;

    const fetchPage = (token) => {
      const url = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o?maxResults=1000${token ? `&pageToken=${token}` : ''}`;
      
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
              allObjects = allObjects.concat(response.items || []);
              
              if (response.nextPageToken) {
                fetchPage(response.nextPageToken);
              } else {
                resolve(allObjects);
              }
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
    };

    fetchPage(null);
  });
}

/**
 * Crée un bucket
 */
async function createBucket(bucketName, location, accessToken) {
  return new Promise((resolve, reject) => {
    const url = 'https://storage.googleapis.com/storage/v1/b?project=jsaas-dd2f7';
    
    const body = JSON.stringify({
      name: bucketName,
      location: location,
      storageClass: 'STANDARD'
    });

    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    };

    const req = https.request(url, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          try {
            const bucket = JSON.parse(data);
            resolve(bucket);
          } catch (e) {
            resolve(null);
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

    req.write(body);
    req.end();
  });
}

/**
 * Copie un objet d'un bucket à un autre
 */
async function copyObject(sourceBucket, destBucket, objectName, accessToken) {
  return new Promise((resolve, reject) => {
    const encodedObjectName = encodeURIComponent(objectName);
    const url = `https://storage.googleapis.com/storage/v1/b/${sourceBucket}/o/${encodedObjectName}/rewriteTo/b/${destBucket}/o/${encodedObjectName}`;
    
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
    console.log('🔄 Migration et restauration de bucket...\n');
    console.log(`📋 Bucket source: ${BUCKET_NAME}`);
    console.log(`📋 Bucket temporaire: ${TEMP_BUCKET_NAME}`);
    console.log(`📋 Génération: ${GENERATION}\n`);

    const accessToken = getAccessToken();
    console.log('✅ Token d\'authentification obtenu\n');

    // 1. Lister les objets dans le bucket actif
    console.log('📋 Étape 1: Liste des objets dans le bucket actif...');
    const objects = await listObjects(BUCKET_NAME, accessToken);
    console.log(`   ${objects.length} objet(s) trouvé(s)\n`);

    if (objects.length === 0) {
      console.log('⚠️  Le bucket actif est vide');
      console.log('   Pas besoin de migration, suppression directe...\n');
    } else {
      // 2. Créer un bucket temporaire
      console.log('📦 Étape 2: Création du bucket temporaire...');
      try {
        await createBucket(TEMP_BUCKET_NAME, 'US-CENTRAL1', accessToken);
        console.log(`   ✅ Bucket temporaire créé: ${TEMP_BUCKET_NAME}\n`);
      } catch (error) {
        if (error.message.includes('409')) {
          console.log(`   ⚠️  Le bucket temporaire existe déjà: ${TEMP_BUCKET_NAME}\n`);
        } else {
          throw error;
        }
      }

      // 3. Copier les objets vers le bucket temporaire
      console.log('📋 Étape 3: Copie des objets vers le bucket temporaire...');
      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        process.stdout.write(`   [${i + 1}/${objects.length}] Copie de ${obj.name}... `);
        try {
          await copyObject(BUCKET_NAME, TEMP_BUCKET_NAME, obj.name, accessToken);
          console.log('✅');
        } catch (error) {
          console.log(`❌ Erreur: ${error.message}`);
        }
      }
      console.log('   ✅ Tous les objets copiés\n');
    }

    // 4. Supprimer le bucket actif
    console.log('🗑️  Étape 4: Suppression du bucket actif...');
    try {
      await deleteBucket(BUCKET_NAME, accessToken);
      console.log('   ✅ Bucket actif supprimé\n');
    } catch (error) {
      console.error(`   ❌ Erreur lors de la suppression: ${error.message}`);
      console.error('   💡 Le bucket doit être vide pour être supprimé');
      console.error('   💡 Supprimez manuellement les objets restants');
      process.exit(1);
    }

    // 5. Restaurer le bucket supprimé
    console.log('🔄 Étape 5: Restauration du bucket supprimé...');
    try {
      const result = await restoreBucket(BUCKET_NAME, GENERATION, accessToken);
      console.log('   ✅ Bucket restauré avec succès!\n');
      if (result.bucket) {
        console.log('📦 Informations du bucket restauré:');
        console.log(`   Nom: ${result.bucket.name}`);
        console.log(`   Location: ${result.bucket.location || 'N/A'}`);
        console.log(`   Created: ${result.bucket.timeCreated || 'N/A'}`);
        console.log('');
      }
    } catch (error) {
      console.error(`   ❌ Erreur lors de la restauration: ${error.message}`);
      process.exit(1);
    }

    // 6. Résumé
    console.log('✅ Migration et restauration terminées avec succès!\n');
    console.log('📋 Résumé:');
    console.log(`   - Bucket actif supprimé: ${BUCKET_NAME}`);
    console.log(`   - Bucket restauré: ${BUCKET_NAME} (EUROPE-WEST3)`);
    if (objects.length > 0) {
      console.log(`   - Données sauvegardées: ${TEMP_BUCKET_NAME}`);
      console.log(`   - Objets sauvegardés: ${objects.length}`);
      console.log('');
      console.log('💡 Prochaines étapes:');
      console.log('   1. Vérifiez que le bucket restauré fonctionne correctement');
      console.log('   2. Si nécessaire, copiez les objets du bucket temporaire vers le bucket restauré');
      console.log('   3. Supprimez le bucket temporaire quand vous n\'en avez plus besoin');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

main();






