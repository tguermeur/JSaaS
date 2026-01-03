/**
 * Script pour télécharger les fichiers d'un bucket supprimé
 * 
 * Ce script:
 * 1. Sauvegarde le bucket actif (si existe)
 * 2. Restaure le bucket supprimé temporairement
 * 3. Télécharge tous les fichiers du bucket restauré
 * 4. Restaure le bucket actif (ou le supprime selon les préférences)
 * 
 * Usage: node scripts/download-deleted-bucket-files.mjs <bucket-name> <generation> [--output-dir] [--keep-restored]
 */

import https from 'https';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BUCKET_NAME = process.argv[2];
const GENERATION = process.argv[3];
const OUTPUT_DIR = process.argv.includes('--output-dir') 
  ? process.argv[process.argv.indexOf('--output-dir') + 1] 
  : join(__dirname, '..', 'downloaded-files', BUCKET_NAME);
const KEEP_RESTORED = process.argv.includes('--keep-restored');
// Les buckets Google Cloud Storage ne peuvent pas contenir de points (sauf pour Firebase Storage)
// On utilise un nom sans point pour le bucket temporaire
const TEMP_BUCKET_NAME = `jsaas-dd2f7-backup-${Date.now()}`;

if (!BUCKET_NAME || !GENERATION) {
  console.error('❌ Erreur: Nom du bucket et génération requis');
  console.log('\nUsage: node scripts/download-deleted-bucket-files.mjs <bucket-name> <generation> [--output-dir <dir>] [--keep-restored]');
  console.log('\nExemple:');
  console.log('  node scripts/download-deleted-bucket-files.mjs jsaas-dd2f7.firebasestorage.app 1742421543371078829');
  console.log('  node scripts/download-deleted-bucket-files.mjs jsaas-dd2f7.firebasestorage.app 1742421543371078829 --output-dir ./backup --keep-restored');
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
 * Vérifie si un bucket existe
 */
async function bucketExists(bucketName, accessToken) {
  return new Promise((resolve) => {
    const url = `https://storage.googleapis.com/storage/v1/b/${bucketName}`;
    
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(url, options, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.end();
  });
}

/**
 * Liste tous les objets dans un bucket
 */
async function listAllObjects(bucketName, accessToken) {
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
          resolve({ success: true });
        } else {
          try {
            const errorData = JSON.parse(data);
            if (errorData.error?.code === 409) {
              resolve({ success: true, exists: true });
            } else {
              reject(new Error(`Erreur ${res.statusCode}: ${errorData.error?.message || data}`));
            }
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
 * Supprime un objet d'un bucket
 */
async function deleteObject(bucketName, objectName, accessToken) {
  return new Promise((resolve, reject) => {
    const encodedObjectName = encodeURIComponent(objectName);
    const url = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o/${encodedObjectName}`;
    
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
 * Supprime tous les objets d'un bucket
 */
async function deleteAllObjects(bucketName, accessToken) {
  const objects = await listAllObjects(bucketName, accessToken);
  
  if (objects.length === 0) {
    return { deleted: 0 };
  }

  console.log(`   Suppression de ${objects.length} objet(s)...`);
  let deletedCount = 0;

  for (let i = 0; i < objects.length; i++) {
    const obj = objects[i];
    try {
      await deleteObject(bucketName, obj.name, accessToken);
      deletedCount++;
      process.stdout.write(`   [${i + 1}/${objects.length}] Suppression de ${obj.name}... ✅\r`);
    } catch (error) {
      process.stdout.write(`   [${i + 1}/${objects.length}] Suppression de ${obj.name}... ❌ Erreur: ${error.message}\n`);
    }
  }
  console.log(''); // Nouvelle ligne après la dernière suppression

  return { deleted: deletedCount, total: objects.length };
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
 * Télécharge un objet depuis un bucket
 */
async function downloadObject(bucketName, objectName, outputPath, accessToken) {
  return new Promise((resolve, reject) => {
    const encodedObjectName = encodeURIComponent(objectName);
    const url = `https://storage.googleapis.com/storage/v1/b/${bucketName}/o/${encodedObjectName}?alt=media`;
    
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    };

    const req = https.request(url, options, (res) => {
      if (res.statusCode === 200) {
        const fileStream = createWriteStream(outputPath);
        res.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve({ success: true, size: res.headers['content-length'] });
        });
        fileStream.on('error', (error) => {
          reject(error);
        });
      } else {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          reject(new Error(`Erreur ${res.statusCode}: ${data.substring(0, 200)}`));
        });
      }
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
    console.log('📥 Téléchargement des fichiers du bucket supprimé...\n');
    console.log(`📋 Bucket: ${BUCKET_NAME}`);
    console.log(`📋 Génération: ${GENERATION}`);
    console.log(`📁 Répertoire de sortie: ${OUTPUT_DIR}\n`);

    const accessToken = getAccessToken();
    console.log('✅ Token d\'authentification obtenu\n');

    // Créer le répertoire de sortie
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`✅ Répertoire de sortie créé: ${OUTPUT_DIR}\n`);
    }

    // Étape 1: Vérifier si le bucket actif existe
    console.log('🔍 Étape 1: Vérification du bucket actif...');
    const activeBucketExists = await bucketExists(BUCKET_NAME, accessToken);
    
    if (activeBucketExists) {
      console.log('⚠️  Un bucket actif existe déjà!\n');
      console.log('📦 Étape 1.1: Sauvegarde du bucket actif...');
      
      // Lister les objets du bucket actif
      const activeObjects = await listAllObjects(BUCKET_NAME, accessToken);
      console.log(`   ${activeObjects.length} objet(s) trouvé(s) dans le bucket actif\n`);

      if (activeObjects.length > 0) {
        // Créer un bucket temporaire pour sauvegarder les objets
        console.log(`📦 Création du bucket temporaire: ${TEMP_BUCKET_NAME}...`);
        try {
          await createBucket(TEMP_BUCKET_NAME, 'US-CENTRAL1', accessToken);
          console.log(`   ✅ Bucket temporaire créé\n`);
        } catch (error) {
          if (error.message.includes('409')) {
            console.log(`   ⚠️  Le bucket temporaire existe déjà\n`);
          } else {
            throw error;
          }
        }

        // Copier les objets vers le bucket temporaire
        console.log('📋 Copie des objets vers le bucket temporaire...');
        for (let i = 0; i < activeObjects.length; i++) {
          const obj = activeObjects[i];
          process.stdout.write(`   [${i + 1}/${activeObjects.length}] Copie de ${obj.name}... `);
          try {
            await copyObject(BUCKET_NAME, TEMP_BUCKET_NAME, obj.name, accessToken);
            console.log('✅');
          } catch (error) {
            console.log(`❌ Erreur: ${error.message}`);
          }
        }
        console.log('   ✅ Tous les objets copiés\n');
      }

      // Supprimer tous les objets du bucket actif
      console.log('🗑️  Suppression des objets du bucket actif...');
      try {
        const deleteResult = await deleteAllObjects(BUCKET_NAME, accessToken);
        console.log(`   ✅ ${deleteResult.deleted}/${deleteResult.total} objet(s) supprimé(s)\n`);
      } catch (error) {
        console.error(`   ❌ Erreur lors de la suppression des objets: ${error.message}`);
        process.exit(1);
      }

      // Supprimer le bucket actif (maintenant vide)
      console.log('🗑️  Suppression du bucket actif (vide)...');
      try {
        await deleteBucket(BUCKET_NAME, accessToken);
        console.log('   ✅ Bucket actif supprimé\n');
      } catch (error) {
        console.error(`   ❌ Erreur lors de la suppression: ${error.message}`);
        console.error('   💡 Le bucket doit être vide pour être supprimé');
        console.error('   💡 Vérifiez qu\'il n\'y a plus d\'objets dans le bucket');
        process.exit(1);
      }
    } else {
      console.log('✅ Aucun bucket actif trouvé\n');
    }

    // Étape 2: Restaurer le bucket supprimé
    console.log('🔄 Étape 2: Restauration du bucket supprimé...');
    try {
      const restoreResult = await restoreBucket(BUCKET_NAME, GENERATION, accessToken);
      console.log('   ✅ Bucket restauré avec succès!\n');
      if (restoreResult.bucket) {
        console.log('📦 Informations du bucket restauré:');
        console.log(`   Nom: ${restoreResult.bucket.name}`);
        console.log(`   Location: ${restoreResult.bucket.location || 'N/A'}`);
        console.log(`   Created: ${restoreResult.bucket.timeCreated || 'N/A'}`);
        console.log('');
      }
    } catch (error) {
      console.error(`   ❌ Erreur lors de la restauration: ${error.message}`);
      process.exit(1);
    }

    // Attendre un peu pour que le bucket soit complètement disponible
    console.log('⏳ Attente de la disponibilité du bucket (5 secondes)...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    console.log('   ✅ Attente terminée\n');

    // Vérifier que le bucket existe
    console.log('🔍 Vérification de l\'existence du bucket restauré...');
    const bucketExistsNow = await bucketExists(BUCKET_NAME, accessToken);
    if (!bucketExistsNow) {
      console.error('   ❌ Le bucket restauré n\'existe pas ou n\'est pas encore disponible');
      console.error('   💡 Attendez quelques minutes et réessayez');
      console.error('   💡 Ou vérifiez dans Google Cloud Console');
      process.exit(1);
    }
    console.log('   ✅ Bucket restauré disponible\n');

    // Étape 3: Lister tous les objets du bucket restauré
    console.log('📋 Étape 3: Liste des objets dans le bucket restauré...');
    let objects = [];
    try {
      objects = await listAllObjects(BUCKET_NAME, accessToken);
      console.log(`   ${objects.length} objet(s) trouvé(s)\n`);
    } catch (error) {
      if (error.message.includes('404')) {
        console.log('   ⚠️  Le bucket est vide ou les objets ne sont pas accessibles');
        console.log('   💡 Le bucket restauré peut être vide');
        console.log('   💡 Ou les objets peuvent avoir été définitivement supprimés\n');
      } else {
        console.error(`   ❌ Erreur lors de la liste des objets: ${error.message}`);
        process.exit(1);
      }
    }

    if (objects.length === 0) {
      console.log('⚠️  Le bucket restauré est vide');
      console.log('   Aucun fichier à télécharger\n');
    } else {
      // Étape 4: Télécharger tous les objets
      console.log('📥 Étape 4: Téléchargement des objets...');
      let downloadedCount = 0;
      let totalSize = 0;

      for (let i = 0; i < objects.length; i++) {
        const obj = objects[i];
        const objectPath = join(OUTPUT_DIR, obj.name);
        const objectDir = dirname(objectPath);

        // Créer le répertoire si nécessaire
        if (!existsSync(objectDir)) {
          mkdirSync(objectDir, { recursive: true });
        }

        process.stdout.write(`   [${i + 1}/${objects.length}] Téléchargement de ${obj.name}... `);
        try {
          await downloadObject(BUCKET_NAME, obj.name, objectPath, accessToken);
          downloadedCount++;
          totalSize += parseInt(obj.size || 0);
          const sizeMB = (parseInt(obj.size || 0) / (1024 * 1024)).toFixed(2);
          console.log(`✅ (${sizeMB} MB)`);
        } catch (error) {
          console.log(`❌ Erreur: ${error.message}`);
        }
      }

      console.log('');
      console.log(`✅ ${downloadedCount}/${objects.length} fichier(s) téléchargé(s)`);
      console.log(`   Taille totale: ${(totalSize / (1024 * 1024)).toFixed(2)} MB`);
      console.log(`   Répertoire: ${OUTPUT_DIR}\n`);
    }

    // Étape 5: Gérer le bucket restauré
    if (!KEEP_RESTORED) {
      console.log('🗑️  Étape 5: Suppression du bucket restauré...');
      console.log('   ⚠️  Le bucket restauré sera supprimé');
      console.log('   💡 Utilisez --keep-restored pour le garder\n');
      
      // Ne pas supprimer automatiquement - laisser l'utilisateur décider
      console.log('💡 Pour supprimer le bucket restauré:');
      console.log('   node scripts/delete-bucket.mjs ' + BUCKET_NAME);
      console.log('');
    } else {
      console.log('✅ Étape 5: Le bucket restauré est conservé\n');
    }

    // Résumé
    console.log('✅ Téléchargement terminé avec succès!\n');
    console.log('📋 Résumé:');
    console.log(`   - Fichiers téléchargés: ${objects.length}`);
    console.log(`   - Répertoire: ${OUTPUT_DIR}`);
    if (activeBucketExists && activeObjects.length > 0) {
      console.log(`   - Bucket actif sauvegardé: ${TEMP_BUCKET_NAME}`);
      console.log(`   - Objets sauvegardés: ${activeObjects.length}`);
      console.log('');
      console.log('💡 Prochaines étapes:');
      console.log('   1. Vérifiez les fichiers téléchargés dans: ' + OUTPUT_DIR);
      if (activeObjects.length > 0) {
        console.log('   2. Si nécessaire, restaurez le bucket actif depuis: ' + TEMP_BUCKET_NAME);
      }
      console.log('   3. Supprimez le bucket temporaire quand vous n\'en avez plus besoin');
    }

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

main();

