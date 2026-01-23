import { doc, getDoc, setDoc, updateDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { db } from '../firebase/config';

export interface StructureTokens {
  structureId: string;
  tokensRemaining: number;
  tokensTotal: number;
  lastResetDate: string; // Format: YYYY-MM
  createdAt?: any;
  updatedAt?: any;
}

const TOKENS_PER_MONTH = 100;
const TOKEN_COST_PER_PROSPECT = 1;

/**
 * Obtient ou crée le document de tokens pour une structure
 */
export const getStructureTokens = async (structureId: string): Promise<StructureTokens> => {
  if (!structureId) {
    throw new Error('Structure ID requis');
  }

  console.log(`[getStructureTokens] Récupération des tokens pour structure ${structureId}`);
  const tokensRef = doc(db, 'structureTokens', structureId);
  const tokensDoc = await getDoc(tokensRef);

  if (tokensDoc.exists()) {
    const data = tokensDoc.data() as StructureTokens;
    console.log(`[getStructureTokens] Document existant trouvé:`, data);
    
    // Vérifier si on doit réinitialiser les tokens (nouveau mois)
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    if (data.lastResetDate !== currentMonth) {
      // Nouveau mois, réinitialiser les tokens
      console.log(`[getStructureTokens] Nouveau mois détecté (${currentMonth} vs ${data.lastResetDate}), réinitialisation`);
      const resetData: Partial<StructureTokens> = {
        tokensRemaining: TOKENS_PER_MONTH,
        tokensTotal: TOKENS_PER_MONTH,
        lastResetDate: currentMonth,
        updatedAt: serverTimestamp()
      };
      await updateDoc(tokensRef, resetData);
      const resetTokens = { ...data, ...resetData, lastResetDate: currentMonth, tokensRemaining: TOKENS_PER_MONTH, tokensTotal: TOKENS_PER_MONTH };
      console.log(`[getStructureTokens] Tokens réinitialisés:`, resetTokens);
      return resetTokens;
    }
    console.log(`[getStructureTokens] Tokens retournés (pas de réinitialisation):`, data);
    return data;
  } else {
    // Créer le document avec les tokens initiaux
    console.log(`[getStructureTokens] Document n'existe pas, création avec ${TOKENS_PER_MONTH} tokens`);
    const currentMonth = new Date().toISOString().slice(0, 7);
    const newTokens: StructureTokens = {
      structureId,
      tokensRemaining: TOKENS_PER_MONTH,
      tokensTotal: TOKENS_PER_MONTH,
      lastResetDate: currentMonth,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    await setDoc(tokensRef, newTokens);
    console.log(`[getStructureTokens] Document créé:`, newTokens);
    return newTokens;
  }
};

/**
 * Consomme un token pour créer un prospect
 * Retourne true si le token a été consommé, false si pas assez de tokens
 */
export const consumeToken = async (structureId: string): Promise<{ success: boolean; tokensRemaining: number; error?: string }> => {
  console.log(`[consumeToken] DÉBUT - Structure ID: ${structureId}`);
  
  if (!structureId) {
    console.error('[consumeToken] Structure ID manquant');
    return { success: false, tokensRemaining: 0, error: 'Structure ID requis' };
  }

  try {
    const tokensRef = doc(db, 'structureTokens', structureId);
    console.log(`[consumeToken] Référence du document: structureTokens/${structureId}`);
    
    // Essayer d'abord avec une transaction (plus sécurisé)
    try {
      console.log('[consumeToken] Tentative de transaction...');
      const result = await runTransaction(db, async (transaction) => {
        console.log('[consumeToken] Transaction démarrée');
        const tokensDoc = await transaction.get(tokensRef);
        console.log('[consumeToken] Document récupéré dans transaction, existe:', tokensDoc.exists());
        
        if (!tokensDoc.exists()) {
          // Créer le document avec les tokens initiaux
          const currentMonth = new Date().toISOString().slice(0, 7);
          const newTokens: StructureTokens = {
            structureId,
            tokensRemaining: TOKENS_PER_MONTH - TOKEN_COST_PER_PROSPECT,
            tokensTotal: TOKENS_PER_MONTH,
            lastResetDate: currentMonth,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          transaction.set(tokensRef, newTokens);
          console.log(`[consumeToken] Document créé avec ${newTokens.tokensRemaining} tokens`);
          return { success: true, tokensRemaining: newTokens.tokensRemaining };
        }

        const data = tokensDoc.data() as StructureTokens;
        console.log('[consumeToken] Données actuelles:', data);
        const currentMonth = new Date().toISOString().slice(0, 7);
        
        // Vérifier si on doit réinitialiser (nouveau mois)
        let tokensRemaining = data.tokensRemaining;
        let lastResetDate = data.lastResetDate;
        
        if (data.lastResetDate !== currentMonth) {
          // Nouveau mois, réinitialiser
          console.log(`[consumeToken] Nouveau mois détecté, réinitialisation`);
          tokensRemaining = TOKENS_PER_MONTH;
          lastResetDate = currentMonth;
        }

        // Vérifier si assez de tokens
        if (tokensRemaining < TOKEN_COST_PER_PROSPECT) {
          console.log(`[consumeToken] Pas assez de tokens: ${tokensRemaining} < ${TOKEN_COST_PER_PROSPECT}`);
          return { 
            success: false, 
            tokensRemaining, 
            error: `Quota mensuel atteint. Vous avez utilisé ${data.tokensTotal - tokensRemaining}/${data.tokensTotal} tokens ce mois-ci.` 
          };
        }

        // Consommer le token
        const newTokensRemaining = tokensRemaining - TOKEN_COST_PER_PROSPECT;
        console.log(`[consumeToken] Consommation: ${tokensRemaining} -> ${newTokensRemaining}`);
        transaction.update(tokensRef, {
          tokensRemaining: newTokensRemaining,
          tokensTotal: lastResetDate !== data.lastResetDate ? TOKENS_PER_MONTH : data.tokensTotal,
          lastResetDate,
          updatedAt: serverTimestamp()
        });

        console.log(`[consumeToken] Token consommé via transaction: ${tokensRemaining} -> ${newTokensRemaining} pour structure ${structureId}`);
        return { success: true, tokensRemaining: newTokensRemaining };
      });
      console.log('[consumeToken] Transaction réussie:', result);
      return result;
    } catch (transactionError: any) {
      // Si la transaction échoue (peut-être à cause des règles), utiliser updateDoc en fallback
      console.warn('[consumeToken] Transaction échouée, utilisation du fallback updateDoc:', transactionError);
      console.warn('[consumeToken] Code erreur:', transactionError?.code);
      console.warn('[consumeToken] Message erreur:', transactionError?.message);
      
      // Fallback: utiliser getDoc + updateDoc
      console.log('[consumeToken] Tentative avec fallback (getDoc + updateDoc)...');
      const tokensDoc = await getDoc(tokensRef);
      console.log('[consumeToken] Document récupéré (fallback), existe:', tokensDoc.exists());
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      if (!tokensDoc.exists()) {
        // Créer le document avec les tokens initiaux
        const newTokens: StructureTokens = {
          structureId,
          tokensRemaining: TOKENS_PER_MONTH - TOKEN_COST_PER_PROSPECT,
          tokensTotal: TOKENS_PER_MONTH,
          lastResetDate: currentMonth,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        console.log('[consumeToken] Création du document (fallback)...');
        await setDoc(tokensRef, newTokens);
        console.log(`[consumeToken] Document créé (fallback) avec ${newTokens.tokensRemaining} tokens`);
        return { success: true, tokensRemaining: newTokens.tokensRemaining };
      }

      const data = tokensDoc.data() as StructureTokens;
      console.log('[consumeToken] Données actuelles (fallback):', data);
      
      // Vérifier si on doit réinitialiser (nouveau mois)
      let tokensRemaining = data.tokensRemaining;
      let lastResetDate = data.lastResetDate;
      
      if (data.lastResetDate !== currentMonth) {
        // Nouveau mois, réinitialiser
        console.log(`[consumeToken] Nouveau mois détecté (fallback), réinitialisation`);
        tokensRemaining = TOKENS_PER_MONTH;
        lastResetDate = currentMonth;
      }

      // Vérifier si assez de tokens
      if (tokensRemaining < TOKEN_COST_PER_PROSPECT) {
        console.log(`[consumeToken] Pas assez de tokens (fallback): ${tokensRemaining} < ${TOKEN_COST_PER_PROSPECT}`);
        return { 
          success: false, 
          tokensRemaining, 
          error: `Quota mensuel atteint. Vous avez utilisé ${data.tokensTotal - tokensRemaining}/${data.tokensTotal} tokens ce mois-ci.` 
        };
      }

      // Consommer le token
      const newTokensRemaining = tokensRemaining - TOKEN_COST_PER_PROSPECT;
      console.log(`[consumeToken] Consommation (fallback): ${tokensRemaining} -> ${newTokensRemaining}`);
      await updateDoc(tokensRef, {
        tokensRemaining: newTokensRemaining,
        tokensTotal: lastResetDate !== data.lastResetDate ? TOKENS_PER_MONTH : data.tokensTotal,
        lastResetDate,
        updatedAt: serverTimestamp()
      });

      console.log(`[consumeToken] Token consommé (fallback): ${tokensRemaining} -> ${newTokensRemaining} pour structure ${structureId}`);
      return { success: true, tokensRemaining: newTokensRemaining };
    }
  } catch (error: any) {
    console.error('[consumeToken] Erreur lors de la consommation du token:', error);
    console.error('[consumeToken] Détails de l\'erreur:', {
      message: error?.message,
      code: error?.code,
      structureId,
      stack: error?.stack
    });
    
    // Si c'est une erreur de permission, donner plus de détails
    if (error?.code === 'permission-denied' || error?.message?.includes('permission')) {
      console.error('[consumeToken] ERREUR DE PERMISSION - Vérifiez les règles Firestore pour structureTokens');
    }
    
    return { 
      success: false, 
      tokensRemaining: 0, 
      error: error?.message || 'Erreur lors de la vérification des tokens' 
    };
  }
};

/**
 * Restaure un token (en cas d'erreur lors de la création du prospect)
 */
export const restoreToken = async (structureId: string): Promise<void> => {
  if (!structureId) return;

  try {
    const tokensRef = doc(db, 'structureTokens', structureId);
    const tokensDoc = await getDoc(tokensRef);
    
    if (tokensDoc.exists()) {
      const data = tokensDoc.data() as StructureTokens;
      const currentMonth = new Date().toISOString().slice(0, 7);
      
      // Vérifier si on doit réinitialiser
      let tokensRemaining = data.tokensRemaining;
      if (data.lastResetDate !== currentMonth) {
        tokensRemaining = TOKENS_PER_MONTH;
      }

      await updateDoc(tokensRef, {
        tokensRemaining: Math.min(tokensRemaining + TOKEN_COST_PER_PROSPECT, TOKENS_PER_MONTH),
        updatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Erreur lors de la restauration du token:', error);
  }
};
