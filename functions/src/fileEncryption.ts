/**
 * Fonctions pour le chiffrement des fichiers dans Firebase Storage
 */

import { onCall, onRequest } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { getStorage } from 'firebase-admin/storage';
import { 
  encryptBuffer, 
  decryptBuffer, 
  formatEncryptionMetadata, 
  parseEncryptionMetadata,
  EncryptionMetadata 
} from './encryption';
import { verifyTwoFactorCodeForAccess } from './twoFactor';
import { logEncryptedDataAccess } from './accessLogging';
import { assertUserCanAccessStoragePath } from './storageAccess';
import { setRestrictedCorsHeaders } from './corsUtils';
import { userHasRHReadAccess } from './authHelpers';

const functionConfig = {
  memory: '256MiB' as const,
  timeoutSeconds: 540,
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 8,
  concurrency: 20,
  allowUnauthenticated: false,
  cors: true,
  secrets: ['ENCRYPTION_KEY'],
};

const storage = getStorage();

function applyCors(res: any, req: { headers: { origin?: string } }): boolean {
  return setRestrictedCorsHeaders(res, req.headers.origin);
}

/** Extrait missionId du chemin Storage missions/{missionId}/documents/... */
function extractMissionIdFromPath(filePath: string): string | null {
  const m = /^missions\/([^/]+)\/documents\//.exec(filePath);
  return m ? m[1] : null;
}

/** Extrait l'userId propriétaire pour cvs/, documents/, profilePictures/. */
function extractPersonalFileOwnerId(filePath: string): string | null {
  const m = /^(?:cvs|documents|profilePictures)\/([^/]+)/.exec(filePath);
  return m ? m[1] : null;
}

/** Vérifie si l'utilisateur a accès à la mission (exemption 2FA pour docs mission). */
async function userHasMissionAccess(uid: string, missionId: string): Promise<boolean> {
  try {
    const [missionSnap, userSnap] = await Promise.all([
      admin.firestore().collection('missions').doc(missionId).get(),
      admin.firestore().collection('users').doc(uid).get(),
    ]);
    if (!missionSnap.exists || !userSnap.exists) return false;
    const mission = missionSnap.data();
    const user = userSnap.data();
    if (!mission?.structureId || !user) return false;
    if (user.status === 'superadmin') return true;
    if (mission.chargeId === uid) return true;
    if (user.structureId === mission.structureId) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Chiffre un fichier déjà uploadé dans Storage
 * Endpoint HTTP: POST /encrypt-file
 */
export const encryptFile = onRequest(functionConfig, async (req, res) => {
  if (!applyCors(res, req)) {
    res.status(403).send('Origin not allowed');
    return;
  }

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Vérifier l'authentification pour les autres méthodes
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    applyCors(res, req);
    res.status(401).json({ error: 'Non autorisé' });
    return;
  }

  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    if (!decodedToken.uid) {
      applyCors(res, req);
      res.status(401).json({ error: 'Token invalide' });
      return;
    }

    const { filePath } = req.body;

    if (!filePath) {
      applyCors(res, req);
      res.status(400).json({ error: 'filePath requis' });
      return;
    }

    try {
      await assertUserCanAccessStoragePath(decodedToken.uid, filePath);
    } catch {
      applyCors(res, req);
      res.status(403).json({ error: 'Accès refusé à ce fichier' });
      return;
    }

    // Récupérer le fichier depuis Storage
    const bucket = storage.bucket();
    const file = bucket.file(filePath);

    // Vérifier que le fichier existe
    const [exists] = await file.exists();
    if (!exists) {
      applyCors(res, req);
      res.status(404).json({ error: 'Fichier non trouvé' });
      return;
    }

    // Lire le fichier
    const [fileBuffer] = await file.download();
    
    // Chiffrer le buffer
    const { encrypted, iv, tag } = await encryptBuffer(fileBuffer);

    // Sauvegarder le fichier chiffré (remplacer l'original)
    const encryptionMetadata: EncryptionMetadata = {
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      algorithm: 'aes-256-gcm',
      encrypted: true,
    };

    // Récupérer les métadonnées existantes pour préserver le contentType
    const [existingMetadata] = await file.getMetadata();

    // Sauvegarder le fichier chiffré avec les métadonnées de base
    await file.save(encrypted, {
      metadata: {
        contentType: existingMetadata.contentType || 'application/pdf',
      },
    });

    // Attendre un court instant pour que le fichier soit bien sauvegardé
    await new Promise(resolve => setTimeout(resolve, 500));

    // Mettre à jour les métadonnées personnalisées séparément
    // Firebase Storage stocke les métadonnées personnalisées dans metadata.metadata
    // Utiliser setMetadata pour forcer la mise à jour
    console.log('[encryptFile] Définition des métadonnées personnalisées:', formatEncryptionMetadata(encryptionMetadata));
    await file.setMetadata({
      metadata: formatEncryptionMetadata(encryptionMetadata),
    });
    console.log('[encryptFile] Métadonnées personnalisées définies');

    // Vérifier que les métadonnées sont bien sauvegardées (avec retry)
    // Augmenter le nombre de retries et le temps d'attente pour la propagation Firebase Storage
    let retries = 10; // Augmenté de 3 à 10
    let metadataVerified = false;
    while (retries > 0 && !metadataVerified) {
      try {
        const [savedMetadata] = await file.getMetadata();
        console.log('[encryptFile] Métadonnées lues:', {
          hasMetadata: !!savedMetadata.metadata,
          metadataKeys: savedMetadata.metadata ? Object.keys(savedMetadata.metadata) : [],
          allKeys: Object.keys(savedMetadata),
          fullMetadata: savedMetadata.metadata
        });
        
        // Vérifier d'abord dans metadata.metadata, puis au niveau supérieur
        let savedEncryptionMetadata = parseEncryptionMetadata(savedMetadata.metadata || {});
        
        // Si pas trouvé dans metadata.metadata, vérifier au niveau supérieur (parfois Firebase stocke directement)
        if (!savedEncryptionMetadata) {
          // Vérifier si les clés sont directement dans savedMetadata
          const directMetadata: Record<string, string> = {};
          Object.keys(savedMetadata).forEach(key => {
            if (key.startsWith('x-encryption-') || key === 'x-encrypted') {
              directMetadata[key] = String(savedMetadata[key as keyof typeof savedMetadata] || '');
            }
          });
          if (Object.keys(directMetadata).length > 0) {
            savedEncryptionMetadata = parseEncryptionMetadata(directMetadata);
            console.log('[encryptFile] Métadonnées trouvées au niveau supérieur');
          }
        }
        
        if (savedEncryptionMetadata && savedEncryptionMetadata.encrypted) {
          metadataVerified = true;
          console.log('[encryptFile] Métadonnées de chiffrement vérifiées avec succès');
        } else {
          retries--;
          if (retries > 0) {
            console.log(`[encryptFile] Métadonnées pas encore disponibles (encryptionMetadata=${!!savedEncryptionMetadata}, encrypted=${savedEncryptionMetadata?.encrypted}), ${retries} tentatives restantes...`);
            await new Promise(resolve => setTimeout(resolve, 1000)); // Attendre 1 seconde avant de réessayer (augmenté de 500ms)
          }
        }
      } catch (error) {
        console.warn('[encryptFile] Erreur lors de la vérification des métadonnées:', error);
        retries--;
        if (retries > 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    if (!metadataVerified) {
      console.warn('[encryptFile] Les métadonnées ne sont pas encore propagées après tous les retries');
    }

    res.json({ 
      success: true, 
      message: 'Fichier chiffré avec succès',
      filePath,
      metadataVerified,
    });
  } catch (error: any) {
    console.error('Erreur lors du chiffrement du fichier:', error);
    // S'assurer que les en-têtes CORS sont présents même en cas d'erreur
    applyCors(res, req);
    res.status(500).json({ error: error.message || 'Erreur lors du chiffrement du fichier' });
  }
});

/**
 * Déchiffre et télécharge un fichier chiffré.
 * - GET ?filePath=... : pas de 2FA (fichier non chiffré, propriétaire, ou doc mission).
 * - POST ?filePath=... + body { twoFactorCode } : 2FA requise (fichier chiffré, non propriétaire, hors missions).
 */
export const decryptFile = onRequest(functionConfig, async (req, res) => {
  if (!applyCors(res, req)) {
    res.status(403).send('Origin not allowed');
    return;
  }

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    applyCors(res, req);
    res.status(401).json({ error: 'Non autorisé' });
    return;
  }

  try {
    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    if (!decodedToken.uid) {
      applyCors(res, req);
      res.status(401).json({ error: 'Token invalide' });
      return;
    }

    const filePath = (req.query?.filePath as string) || (req as any).query?.filePath;
    if (!filePath || typeof filePath !== 'string') {
      applyCors(res, req);
      res.status(400).json({ error: 'filePath requis' });
      return;
    }

    let twoFactorCode: string | undefined;
    if (req.method === 'POST' && req.body) {
      try {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        twoFactorCode = typeof body?.twoFactorCode === 'string' ? body.twoFactorCode : undefined;
      } catch {
        // ignore
      }
    }

    const requestingUserId = decodedToken.uid;

    try {
      await assertUserCanAccessStoragePath(requestingUserId, filePath);
    } catch {
      applyCors(res, req);
      res.status(403).json({ error: 'Accès refusé à ce fichier' });
      return;
    }

    // Récupérer le fichier depuis Storage
    const bucket = storage.bucket();
    const file = bucket.file(filePath);

    // Vérifier que le fichier existe
    const [exists] = await file.exists();
    if (!exists) {
      applyCors(res, req);
      res.status(404).json({ error: 'Fichier non trouvé' });
      return;
    }

    // Récupérer les métadonnées
    const [metadata] = await file.getMetadata();
    const encryptionMetadata = parseEncryptionMetadata(metadata.metadata || {});
    
    console.log('[decryptFile] Métadonnées récupérées:', {
      hasEncryptionMetadata: encryptionMetadata !== null,
      contentType: metadata.contentType,
      customMetadataKeys: Object.keys(metadata.metadata || {})
    });

    // Télécharger le fichier pour vérifier s'il est chiffré
    const [fileBuffer] = await file.download();
    console.log('[decryptFile] Fichier téléchargé, taille:', fileBuffer.length, 'bytes');
    
    // Vérifier si le fichier est chiffré en regardant les premiers bytes
    // Un PDF non chiffré commence par %PDF (37 80 68 70 en hex)
    // Un fichier chiffré avec AES-GCM aura des bytes aléatoires
    const firstBytes = fileBuffer.slice(0, 4);
    const isPDFHeader = firstBytes[0] === 0x25 && firstBytes[1] === 0x50 && firstBytes[2] === 0x44 && firstBytes[3] === 0x46; // %PDF
    
    // Si le fichier a un header PDF valide, il n'est probablement pas chiffré
    // Même si les métadonnées indiquent le contraire, on privilégie le header
    if (isPDFHeader && metadata.contentType === 'application/pdf') {
      // Le fichier a un header PDF valide, le retourner tel quel (pas besoin de 2FA)
      console.log('[decryptFile] Fichier PDF détecté avec header valide, retour sans déchiffrement');
      applyCors(res, req);
      res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filePath.split('/').pop()}"`);
      res.send(fileBuffer);
      return;
    }
    
    // Si les métadonnées indiquent que le fichier est chiffré, on doit le déchiffrer
    // Si les métadonnées ne sont pas présentes mais que le fichier n'a pas de header PDF valide,
    // on considère qu'il pourrait être chiffré
    const isLikelyEncrypted = encryptionMetadata !== null || 
                               (metadata.contentType === 'application/pdf' && !isPDFHeader);

    if (!isLikelyEncrypted) {
      // Le fichier n'est pas chiffré, le retourner tel quel (pas besoin de 2FA)
      console.log('[decryptFile] Fichier non chiffré détecté, retour direct');
      applyCors(res, req);
      res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filePath.split('/').pop()}"`);
      res.send(fileBuffer);
      return;
    }
    
    // Si on arrive ici, le fichier est probablement chiffré mais les métadonnées ne sont pas présentes
    // On ne peut pas le déchiffrer sans les métadonnées (IV, tag)
    if (!encryptionMetadata) {
      console.log('[decryptFile] Fichier semble chiffré mais métadonnées manquantes, tentatives de récupération...');
      // Les métadonnées ne sont pas présentes mais le fichier semble chiffré
      // Attendre un peu et réessayer de récupérer les métadonnées (propagation Storage)
      // Augmenter le nombre de retries et le temps d'attente pour la propagation Firebase Storage
      let retries = 15; // Augmenté de 3 à 15 pour laisser plus de temps à la propagation
      let metadataFound = false;
      while (retries > 0 && !metadataFound) {
        await new Promise(resolve => setTimeout(resolve, 1500)); // Attendre 1.5 secondes (augmenté de 1 seconde)
        try {
          const [retryMetadata] = await file.getMetadata();
          const retryEncryptionMetadata = parseEncryptionMetadata(retryMetadata.metadata || {});
          if (retryEncryptionMetadata) {
            console.log('[decryptFile] Métadonnées trouvées après', 15 - retries, 'tentatives');
            metadataFound = true;
            // Utiliser les métadonnées récupérées
            const iv = Buffer.from(retryEncryptionMetadata.iv, 'hex');
            const tag = Buffer.from(retryEncryptionMetadata.tag, 'hex');
            const decrypted = await decryptBuffer(fileBuffer, iv, tag);
            applyCors(res, req);
            res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
            res.setHeader('Content-Disposition', `attachment; filename="${filePath.split('/').pop()}"`);
            res.send(decrypted);
            return;
          } else {
            retries--;
            if (retries > 0) {
              console.log(`[decryptFile] Métadonnées pas encore disponibles, ${retries} tentatives restantes...`);
            }
          }
        } catch (retryError) {
          console.warn('[decryptFile] Erreur lors de la récupération des métadonnées:', retryError);
          retries--;
        }
      }
      
      // Si après les retries, les métadonnées ne sont toujours pas disponibles
      // Vérifier une dernière fois si le fichier a un header PDF valide
      // Si c'est le cas, le fichier n'est probablement pas chiffré malgré l'apparence
      const finalFirstBytes = fileBuffer.slice(0, 4);
      const finalIsPDFHeader = finalFirstBytes[0] === 0x25 && finalFirstBytes[1] === 0x50 && 
                               finalFirstBytes[2] === 0x44 && finalFirstBytes[3] === 0x46;
      
      if (finalIsPDFHeader && metadata.contentType === 'application/pdf') {
        // Le fichier a un header PDF valide, il n'est probablement pas chiffré
        console.log('[decryptFile] Métadonnées manquantes mais header PDF valide détecté, retour du fichier tel quel');
        applyCors(res, req);
        res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filePath.split('/').pop()}"`);
        res.send(fileBuffer);
        return;
      }
      
      // Si vraiment aucune métadonnée et pas de header PDF valide, retourner une erreur
      console.error('[decryptFile] Fichier semble chiffré mais métadonnées non disponibles après retries');
      applyCors(res, req);
      res.status(400).json({ 
        error: 'Le fichier semble chiffré mais les métadonnées de chiffrement ne sont pas encore disponibles. Veuillez réessayer dans quelques instants.' 
      });
      return;
    }

    const isOwner = filePath.includes(`/${requestingUserId}/`) || filePath.startsWith(`${requestingUserId}/`);
    const missionId = extractMissionIdFromPath(filePath);
    const isMissionExempt = missionId != null && (await userHasMissionAccess(requestingUserId, missionId));
    const personalOwnerId = extractPersonalFileOwnerId(filePath);
    const isRHExempt =
      personalOwnerId != null &&
      personalOwnerId !== requestingUserId &&
      (await userHasRHReadAccess(requestingUserId, personalOwnerId));

    if (isOwner) {
      console.log('[decryptFile] Utilisateur propriétaire du fichier, déchiffrement sans 2FA');
      const [encryptedBuffer] = await file.download();
      const iv = Buffer.from(encryptionMetadata.iv, 'hex');
      const tag = Buffer.from(encryptionMetadata.tag, 'hex');
      const decrypted = await decryptBuffer(encryptedBuffer, iv, tag);
      try {
        await logEncryptedDataAccess(requestingUserId, 'decrypt_file', filePath, true, { ip: req.ip, userAgent: req.headers['user-agent'] });
      } catch (logError) {
        console.error('Erreur lors du logging:', logError);
      }
      applyCors(res, req);
      res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filePath.split('/').pop()}"`);
      res.send(decrypted);
      return;
    }

    if (isMissionExempt) {
      console.log('[decryptFile] Document mission, exemption 2FA (accès mission vérifié)');
      const [encryptedBuffer] = await file.download();
      const iv = Buffer.from(encryptionMetadata.iv, 'hex');
      const tag = Buffer.from(encryptionMetadata.tag, 'hex');
      const decrypted = await decryptBuffer(encryptedBuffer, iv, tag);
      try {
        await logEncryptedDataAccess(requestingUserId, 'decrypt_file', filePath, true, { ip: req.ip, userAgent: req.headers['user-agent'] });
      } catch (logError) {
        console.error('Erreur lors du logging:', logError);
      }
      applyCors(res, req);
      res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filePath.split('/').pop()}"`);
      res.send(decrypted);
      return;
    }

    if (isRHExempt) {
      console.log('[decryptFile] Accès RH, exemption 2FA (permission lecture RH)');
      const [encryptedBuffer] = await file.download();
      const iv = Buffer.from(encryptionMetadata.iv, 'hex');
      const tag = Buffer.from(encryptionMetadata.tag, 'hex');
      const decrypted = await decryptBuffer(encryptedBuffer, iv, tag);
      try {
        await logEncryptedDataAccess(requestingUserId, 'decrypt_file', filePath, true, { ip: req.ip, userAgent: req.headers['user-agent'] });
      } catch (logError) {
        console.error('Erreur lors du logging:', logError);
      }
      applyCors(res, req);
      res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${filePath.split('/').pop()}"`);
      res.send(decrypted);
      return;
    }

    const requestingUserDoc = await admin.firestore().collection('users').doc(requestingUserId).get();
    const requestingUser = requestingUserDoc.data();

    if (!requestingUser?.twoFactorEnabled) {
      applyCors(res, req);
      res.status(403).json({ error: 'Vous devez activer l\'authentification à deux facteurs (2FA) pour accéder aux données cryptées' });
      return;
    }

    if (!twoFactorCode || typeof twoFactorCode !== 'string' || twoFactorCode.length !== 6) {
      applyCors(res, req);
      res.status(403).json({ error: 'Validation 2FA requise pour accéder aux données cryptées. Veuillez fournir un code 2FA valide.' });
      return;
    }

    const twoFactorVerified = await verifyTwoFactorCodeForAccess(requestingUserId, twoFactorCode);
    if (!twoFactorVerified) {
      try {
        await logEncryptedDataAccess(requestingUserId, 'decrypt_file', filePath, false, { ip: req.ip, userAgent: req.headers['user-agent'] });
      } catch {
        /* ignore */
      }
      applyCors(res, req);
      res.status(403).json({ error: 'Code 2FA invalide. Veuillez réessayer.' });
      return;
    }

    const [encryptedBuffer] = await file.download();
    const iv = Buffer.from(encryptionMetadata.iv, 'hex');
    const tag = Buffer.from(encryptionMetadata.tag, 'hex');
    const decrypted = await decryptBuffer(encryptedBuffer, iv, tag);
    try {
      await logEncryptedDataAccess(requestingUserId, 'decrypt_file', filePath, true, { ip: req.ip, userAgent: req.headers['user-agent'] });
    } catch (logError) {
      console.error('Erreur lors du logging:', logError);
    }
    applyCors(res, req);
    res.setHeader('Content-Type', metadata.contentType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filePath.split('/').pop()}"`);
    res.send(decrypted);
  } catch (error: any) {
    console.error('Erreur lors du déchiffrement du fichier:', error);
    applyCors(res, req);
    res.status(500).json({ error: error.message || 'Erreur lors du déchiffrement du fichier' });
  }
});

/**
 * Vérifie si un fichier est chiffré
 */
export const isFileEncrypted = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  try {
    const { filePath } = request.data;

    if (!filePath) {
      throw new Error('filePath requis');
    }

    const bucket = storage.bucket();
    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    if (!exists) {
      throw new Error('Fichier non trouvé');
    }

    const [metadata] = await file.getMetadata();
    const encryptionMetadata = parseEncryptionMetadata(metadata.metadata || {});

    return {
      success: true,
      encrypted: encryptionMetadata !== null,
    };
  } catch (error: any) {
    console.error('Erreur lors de la vérification du chiffrement:', error);
    throw new Error(error.message || 'Erreur lors de la vérification');
  }
});
