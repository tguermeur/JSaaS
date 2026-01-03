/**
 * Script pour télécharger les fichiers d'un bucket actif
 * 
 * Usage: node scripts/download-bucket-files.mjs <bucket-name> [--output-dir <dir>]
 */

import https from 'https';
import { createWriteStream, mkdirSync, existsSync } from 'fs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BUCKET_NAME = process.argv[2];
const OUTPUT_DIR = process.argv.includes('--output-dir') 
  ? process.argv[process.argv.indexOf('--output-dir') + 1] 
  : join(__dirname, '..', 'downloaded-files', BUCKET_NAME);

if (!BUCKET_NAME) {
  console.error('❌ Erreur: Nom du bucket requis');
  console.log('\nUsage: node scripts/download-bucket-files.mjs <bucket-name> [--output-dir <dir>]');
  console.log('\nExemple:');
  console.log('  node scripts/download-bucket-files.mjs jsaas-dd2f7.firebasestorage.app');
  console.log('  node scripts/download-bucket-files.mjs jsaas-dd2f7.firebasestorage.app --output-dir ./backup');
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
    console.log('📥 Téléchargement des fichiers du bucket...\n');
    console.log(`📋 Bucket: ${BUCKET_NAME}`);
    console.log(`📁 Répertoire de sortie: ${OUTPUT_DIR}\n`);

    const accessToken = getAccessToken();
    console.log('✅ Token d\'authentification obtenu\n');

    // Créer le répertoire de sortie
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
      console.log(`✅ Répertoire de sortie créé: ${OUTPUT_DIR}\n`);
    }

    // Lister tous les objets
    console.log('📋 Liste des objets dans le bucket...');
    const objects = await listAllObjects(BUCKET_NAME, accessToken);
    console.log(`   ${objects.length} objet(s) trouvé(s)\n`);

    if (objects.length === 0) {
      console.log('⚠️  Le bucket est vide');
      console.log('   Aucun fichier à télécharger\n');
      return;
    }

    // Télécharger tous les objets
    console.log('📥 Téléchargement des objets...');
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

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

main();






