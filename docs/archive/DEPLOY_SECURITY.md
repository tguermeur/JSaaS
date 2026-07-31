# Déploiement sécurité (rules + storage + functions)

> **Mai 2026** : règles Firestore pré-audit rétablies localement (accès membres). Déployer `firestore:rules` et `decryptUserDataForStructure` pour appliquer en prod.

Les correctifs Firestore/Storage/Cloud Functions ne protègent la production **qu’après déploiement**.

## Commande recommandée

```bash
npm run deploy:security
```

Équivalent :

```bash
firebase deploy --only firestore:rules,storage,functions
```

> **Ne pas utiliser** `storage:rules` — Firebase interprète `rules` comme un nom de bucket.

## Si le déploiement functions échoue (quota GCP)

Symptômes dans le terminal :

- `HTTP Error: 429` — trop de mises à jour functions en une minute (Firebase réessaie souvent seul).
- `Quota exceeded for total allowable CPU per project per region` — limite Cloud Run du projet atteinte pendant le déploiement massif.

**Ce qui a probablement réussi** : `firestore.rules`, `storage.rules`, et la majorité des functions (dont `decryptUserDataForStructure`, `migrateStripeSecretsAdmin`, `fetchUserStripePaymentIntents`).

**Relancer les functions en échec** — ne pas les déployer les deux en même temps (429 + pic CPU).

Option recommandée (une par une, avec pauses et retries) :

```bash
npm run deploy:security-failed:staggered
```

Ou manuellement, **dans cet ordre**, en attendant 3–5 min entre chaque commande :

```bash
npm run deploy:saveStructureStripeSecret
# attendre 3–5 min
npm run deploy:encryptUserOnWrite
```

Si `429 Quota exceeded` ou `total allowable CPU per project per region` :

1. Attendre **15–30 minutes** (les anciennes révisions Cloud Run libèrent du CPU).
2. Relancer une seule function à la fois.
3. Console GCP → **IAM & Admin → Quotas** → filtrer **Cloud Run** / **Cloud Functions** → demander une augmentation si besoin.

Les functions ont été configurées avec `cpu: 0.25` pour réduire la pression sur le quota régional au prochain déploiement réussi.

## Migration clés Stripe legacy

Le script utilise `firebase-admin` depuis `functions/` (pas la racine du repo).

```bash
# Simulation
npm run migrate:stripe-secrets:dry-run

# Migration + purge du champ public stripeSecretKey
npm run migrate:stripe-secrets
```

Alternative superadmin (sans script local) : callable **`migrateStripeSecretsAdmin`** depuis l’app SuperAdmin ou la console Firebase Functions, une fois connecté en superadmin.

## Stats dashboard

Si `structures.stats` est vide, déclencher `recomputeStructureStats` (callable) ou attendre les triggers missions/études.

## Vérifications post-déploiement

- [ ] Lecture `structures` sans auth → refusée
- [ ] `stripeSecretKey` absent des docs `structures` publics
- [ ] Paiements Stripe via `fetchUserStripePaymentIntents` uniquement
- [ ] `saveStructureStripeSecret` déployée (paramètres Stripe structure)
- [ ] Templates / prospects : accès limité à la structure
