# Validation hors prod (sans second projet Firebase)

**Décision** : un seul projet Firebase — `jsaas-dd2f7`. Pas de projet `jsaas-staging`.

La « Phase 0 » se limite à :

1. **Configurer l’app via variables d’environnement** (projectId, région Functions, base URL) — déjà en place (`VITE_FIREBASE_*`, `VITE_FUNCTIONS_REGION`, `VITE_FUNCTIONS_BASE_URL`).
2. **Valider les règles Firestore / Storage avec l’émulateur** (`npm run test:rules`) avant tout `firebase deploy`.
3. **Déployer par étapes sur le projet existant** (rules → functions ciblées → hosting), avec rollback = redeploy du commit précédent.

## Alias `.firebaserc`

| Alias | Projet |
|-------|--------|
| `default` / `prod` | `jsaas-dd2f7` |
| `prof` | legacy (= prod) — à ne plus utiliser |

## Workflow recommandé avant un déploiement sensible

```bash
# 1. Isolation multi-tenant (émulateur local — ne touche pas la prod)
npm run test:rules

# 2. Tests unitaires front
npm test

# 3. Déploiement ciblé sur le projet existant
firebase use prod
firebase deploy --only firestore:rules,storage
# puis functions / hosting si OK
```

## Seed émulateur (optionnel)

Pour peupler l’émulateur Firestore avec un échantillon anonymisé (lecture prod → écriture **émulateur uniquement**) :

```bash
# Terminal 1
firebase emulators:start --only firestore --project jsaas-dd2f7

# Terminal 2 — dry-run puis exécution
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seed-emulator-from-prod.mjs --dry-run
FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node scripts/seed-emulator-from-prod.mjs --limit=50
```

Ce script **n’écrit jamais** dans Firestore prod (cible = émulateur via `FIRESTORE_EMULATOR_HOST`).

## Rollback

`firebase deploy` du commit / artefact précédent sur `jsaas-dd2f7` (rules, functions, hosting selon le périmètre).
