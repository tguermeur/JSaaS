# Découpage Cloud Functions (phase 4)

Le déploiement actuel utilise un seul `index.ts` (cold start lourd). Pour isoler les domaines :

1. Créer des codebases Firebase séparées (`firebase.json` → tableau `functions`).
2. Exemple de groupes :
   - `default` : auth, userSync, structureStats, structureStripeSecrets
   - `stripe` : exports depuis `src/stripe.ts` uniquement
   - `encryption` : `encryptionFunctions.ts`, `fileEncryption.ts`
   - `ai` : `importAi.ts`, `scoring.ts`

En attendant le split physique, les batchs scoring sont limités à 50 prospects et les stats structure sont recalculées via triggers Firestore.
