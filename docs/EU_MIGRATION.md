# Migration UE (EU) — Firestore, Functions, Storage, crypto tenant

## Contexte

La **région Firestore est immuable** après création du projet. Un projet Firebase dont la base est en `us-central` (ou multi-région US) ne peut pas être « déplacé » vers l’UE.

## Options

### A. Nouveau projet UE (recommandé pour conformité stricte)

1. Créer un projet Firebase / GCP avec Firestore en **europe-west1** (ou multi-région `eur3`).
2. Dupliquer Auth, Storage (bucket EU), Functions en `europe-west1`.
3. Migrer les données (export/import, scripts de copy, cutover).
4. Basculer les DNS / Hosting et les secrets.

Coût : migration complète, double run pendant la transition.

### B. Approche progressive (Functions + Storage EU d’abord)

Sur le projet actuel (Firestore US immuable) :

1. Déployer de **nouvelles** Cloud Functions en `europe-west1` (adoption via `functions/src/region.ts` + `FUNCTIONS_REGION`).
2. Créer un bucket Storage UE et y écrire les nouveaux fichiers.
3. Garder Firestore US jusqu’à un cutover projet (option A), ou accepter que les métadonnées restent US temporairement.
4. Côté client : `VITE_FUNCTIONS_REGION=europe-west1` une fois les callables cibles migrées.

Ne **pas** changer en masse les ~100 fonctions d’un coup : trop risqué (Eventarc, cold starts, quotas). Migrer par codebase / groupe de fonctions.

## Crypto par tenant (Phase 6)

- Module : `functions/src/tenantCrypto.ts`
- Dérivation : HKDF-SHA256(`ENCRYPTION_KEY`, info=`jsaas-tenant-crypto-v1:{structureId}`)
- Ciphertext : `ENC2:v1:{structureIdHash}:{iv}{tag}{data}`
- Legacy : `ENC:` avec clé globale — `decrypt()` gère les deux
- Script de re-chiffrement (dry-run d’abord) : `node scripts/reencrypt-tenant-keys.mjs --dry-run --structureId=...`

Les champs d’affichage `displayFirstName` / `displayLastName` / `displayName` restent en **clair** (pas de ciphertext dans les listes UI).

## Variables utiles

| Variable | Où | Exemple |
|----------|-----|---------|
| `FUNCTIONS_REGION` | Cloud Functions runtime | `europe-west1` |
| `VITE_FUNCTIONS_REGION` | Frontend build | `europe-west1` |
| `ENCRYPTION_KEY` | Secret Functions | hex 64 chars |

## Références code

- `functions/src/region.ts` — constante d’adoption progressive
- `functions/src/encryption.ts` — `encrypt(text, structureId?)` / `decrypt`
- `docs/STAGING_SETUP.md` — validation sans second projet (émulateurs + deploy ciblé)
