/**
 * Script de migration pour chiffrer toutes les données existantes
 * Exécute la migration de manière sécurisée avec pagination et batch processing
 */

import { onCall } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { 
  encryptSensitiveFields, 
  SENSITIVE_FIELDS 
} from './encryption';

const functionConfig = {
  memory: '256MiB' as const, // Réduit pour économiser le quota CPU
  timeoutSeconds: 540, // 9 minutes
  region: 'us-central1',
  minInstances: 0,
  maxInstances: 1, // Une seule instance pour éviter les conflits
  concurrency: 1,
  allowUnauthenticated: false,
  secrets: ['ENCRYPTION_KEY'],
};

interface MigrationStats {
  total: number;
  encrypted: number;
  skipped: number;
  errors: number;
  collections: Record<string, {
    total: number;
    encrypted: number;
    skipped: number;
    errors: number;
  }>;
}

/**
 * Migre une collection spécifique
 */
async function migrateCollection(
  collectionName: string,
  sensitiveFields: readonly string[],
  batchSize: number = 100
): Promise<{ total: number; encrypted: number; skipped: number; errors: number }> {
  const db = admin.firestore();
  const collectionRef = db.collection(collectionName);
  
  let stats = {
    total: 0,
    encrypted: 0,
    skipped: 0,
    errors: 0,
  };

  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  let hasMore = true;

  while (hasMore) {
    // Pagination
    let query = collectionRef.orderBy(admin.firestore.FieldPath.documentId()).limit(batchSize);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    // Traiter par batch (Firestore limite à 500 opérations par batch)
    const MAX_BATCH_SIZE = 500;
    let batch = db.batch();
    let batchCount = 0;

    for (const doc of snapshot.docs) {
      stats.total++;
      const data = doc.data();

      // Vérifier quels champs spécifiques doivent être chiffrés (pas seulement si au moins un doit l'être)
      const fieldsToEncrypt: string[] = [];
      
      for (const field of sensitiveFields) {
        const value = data[field];
        if (!value) continue;
        
        // Pour birthDate, accepter Date/Timestamp ET les strings (format YYYY-MM-DD ou autres)
        if (field === 'birthDate') {
          // Si c'est une Date ou Timestamp Firestore
          if (value instanceof Date || (value && typeof value.toDate === 'function')) {
            console.log(`[Migration] Document ${doc.id}: birthDate détectée comme Date/Timestamp, sera chiffrée`);
            fieldsToEncrypt.push(field);
            continue;
          }
          // Si c'est une string non chiffrée (format date ISO ou autre)
          if (typeof value === 'string' && value.trim() !== '' && !value.startsWith('ENC:')) {
            console.log(`[Migration] Document ${doc.id}: birthDate détectée comme string (${value}), sera chiffrée`);
            fieldsToEncrypt.push(field);
            continue;
          }
        } else {
          // Pour les autres champs, seulement les strings non chiffrées
          if (typeof value === 'string' && value.trim() !== '' && !value.startsWith('ENC:')) {
            fieldsToEncrypt.push(field);
          }
        }
      }

      // Si aucun champ ne nécessite de chiffrement, passer au suivant
      if (fieldsToEncrypt.length === 0) {
        stats.skipped++;
        continue;
      }

      try {
        // Chiffrer les champs sensibles (utiliser tous les champs pour ne pas perdre les valeurs déjà chiffrées)
        const encrypted = await encryptSensitiveFields(data, sensitiveFields);
        
        // Préparer les mises à jour (seulement les champs qui ont changé ET qui doivent être chiffrés)
        const updates: Record<string, any> = {};
        let hasChanges = false;

        // Vérifier seulement les champs qui doivent être chiffrés
        for (const field of fieldsToEncrypt) {
          const originalValue = data[field];
          const encryptedValue = encrypted[field];
          
          // Comparaison stricte : si la valeur a changé, c'est qu'elle a été chiffrée
          if (originalValue !== encryptedValue) {
            if (field === 'birthDate' && originalValue) {
              console.log(`[Migration] Document ${doc.id}: birthDate changera de "${originalValue}" à "${encryptedValue?.substring(0, 30)}..."`);
            }
            updates[field] = encryptedValue;
            hasChanges = true;
          } else {
            // Log d'avertissement si un champ qui devrait être chiffré n'a pas changé
            console.warn(`[Migration] Document ${doc.id}: Le champ ${field} n'a pas été chiffré (valeur originale: ${originalValue})`);
          }
        }

        if (hasChanges) {
          batch.update(doc.ref, updates);
          batchCount++;
          stats.encrypted++;

          // Commiter le batch si on atteint la limite
          if (batchCount >= MAX_BATCH_SIZE) {
            await batch.commit();
            batch = db.batch(); // Nouveau batch
            batchCount = 0;
          }
        } else {
          stats.skipped++;
        }
      } catch (error) {
        console.error(`Erreur lors du chiffrement du document ${doc.id} dans ${collectionName}:`, error);
        stats.errors++;
      }
    }

    // Commiter le dernier batch s'il y a des opérations
    if (batchCount > 0) {
      await batch.commit();
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    hasMore = snapshot.docs.length === batchSize; // Continue si on a eu une page complète
  }

  return stats;
}

/**
 * Cloud Function pour lancer la migration de toutes les données
 * 
 * Usage: Appeler cette fonction depuis le frontend avec les collections à migrer
 */
export const migrateAllEncryption = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  // Vérifier que c'est un superadmin
  const userDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
  const user = userDoc.data();
  
  if (user?.status !== 'superadmin') {
    throw new Error('Seuls les superadmins peuvent lancer la migration');
  }

  const { collections } = request.data || {};
  
  // Collections par défaut à migrer
  const collectionsToMigrate = collections || [
    { name: 'users', fields: SENSITIVE_FIELDS.USER },
    { name: 'companies', fields: SENSITIVE_FIELDS.COMPANY },
    { name: 'contacts', fields: SENSITIVE_FIELDS.CONTACT },
    { name: 'prospects', fields: SENSITIVE_FIELDS.PROSPECT },
  ];

  const stats: MigrationStats = {
    total: 0,
    encrypted: 0,
    skipped: 0,
    errors: 0,
    collections: {},
  };

  console.log('🚀 Démarrage de la migration du chiffrement...');

  for (const collectionConfig of collectionsToMigrate) {
    console.log(`📦 Migration de la collection: ${collectionConfig.name}`);
    
    try {
      const collectionStats = await migrateCollection(
        collectionConfig.name,
        collectionConfig.fields
      );
      
      stats.collections[collectionConfig.name] = collectionStats;
      stats.total += collectionStats.total;
      stats.encrypted += collectionStats.encrypted;
      stats.skipped += collectionStats.skipped;
      stats.errors += collectionStats.errors;

      console.log(`✅ ${collectionConfig.name}: ${collectionStats.encrypted} documents chiffrés, ${collectionStats.skipped} ignorés, ${collectionStats.errors} erreurs`);
    } catch (error: any) {
      console.error(`❌ Erreur lors de la migration de ${collectionConfig.name}:`, error);
      stats.collections[collectionConfig.name] = {
        total: 0,
        encrypted: 0,
        skipped: 0,
        errors: 1,
      };
      stats.errors++;
    }
  }

  console.log('✅ Migration terminée');
  console.log(`📊 Total: ${stats.total} documents, ${stats.encrypted} chiffrés, ${stats.skipped} ignorés, ${stats.errors} erreurs`);

  return {
    success: true,
    stats,
    message: `Migration terminée: ${stats.encrypted} documents chiffrés sur ${stats.total} traités`,
  };
});

/**
 * Cloud Function pour vérifier le statut de la migration
 * Compte combien de documents sont chiffrés vs non chiffrés
 */
export const checkMigrationStatus = onCall(functionConfig, async (request) => {
  if (!request.auth) {
    throw new Error('Non autorisé');
  }

  const userDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
  const user = userDoc.data();
  
  if (user?.status !== 'superadmin') {
    throw new Error('Seuls les superadmins peuvent vérifier le statut');
  }

  const { collectionName } = request.data || {};
  
  if (!collectionName) {
    throw new Error('collectionName requis');
  }

  const db = admin.firestore();
  const collectionRef = db.collection(collectionName);
  
  const sensitiveFields = 
    collectionName === 'users' ? SENSITIVE_FIELDS.USER :
    collectionName === 'companies' ? SENSITIVE_FIELDS.COMPANY :
    collectionName === 'contacts' ? SENSITIVE_FIELDS.CONTACT :
    collectionName === 'prospects' ? SENSITIVE_FIELDS.PROSPECT :
    SENSITIVE_FIELDS.USER; // Par défaut

  let total = 0;
  let encrypted = 0;
  let notEncrypted = 0;
  let hasSensitiveFields = 0;

  // Parcourir tous les documents avec pagination
  let lastDoc: admin.firestore.QueryDocumentSnapshot | null = null;
  let hasMore = true;
  const pageSize = 500;

  while (hasMore) {
    let query = collectionRef.orderBy(admin.firestore.FieldPath.documentId()).limit(pageSize);
    if (lastDoc) {
      query = query.startAfter(lastDoc);
    }

    const snapshot = await query.get();

    if (snapshot.empty) {
      hasMore = false;
      break;
    }

    for (const doc of snapshot.docs) {
      total++;
      const data = doc.data();
      
      const hasSensitive = sensitiveFields.some(field => data[field] && typeof data[field] === 'string');
      if (hasSensitive) {
        hasSensitiveFields++;
        
        // Vérifier si au moins un champ sensible est chiffré
        const anyEncrypted = sensitiveFields.some(
          field => data[field] && typeof data[field] === 'string' && data[field].startsWith('ENC:')
        );
        
        // Vérifier si au moins un champ sensible n'est pas chiffré
        const anyNotEncrypted = sensitiveFields.some(
          field => data[field] && 
                   typeof data[field] === 'string' && 
                   data[field].trim() !== '' &&
                   !data[field].startsWith('ENC:')
        );
        
        if (anyEncrypted && !anyNotEncrypted) {
          encrypted++;
        } else if (anyNotEncrypted) {
          notEncrypted++;
        }
      }
    }

    lastDoc = snapshot.docs[snapshot.docs.length - 1];
    hasMore = snapshot.docs.length === pageSize;
  }

  return {
    success: true,
    collection: collectionName,
    stats: {
      total,
      hasSensitiveFields,
      encrypted,
      notEncrypted,
      percentageEncrypted: hasSensitiveFields > 0 ? (encrypted / hasSensitiveFields * 100).toFixed(2) : '0',
      percentageNotEncrypted: hasSensitiveFields > 0 ? (notEncrypted / hasSensitiveFields * 100).toFixed(2) : '0',
    },
  };
});
