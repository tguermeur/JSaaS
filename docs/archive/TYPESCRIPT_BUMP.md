# Archive — notes Phase 8

Fichiers Markdown déplacés depuis la racine du repo et `scripts/` (guides incident) pour alléger la racine.

Conservés en place :
- `docs/PLAN_SCALE.md`
- `docs/STAGING_SETUP.md`
- `docs/EU_MIGRATION.md` (Phase 6)

## TypeScript 5.4.5

`typescript` a été bumpé à `^5.4.5`. `skipLibCheck` reste `true` dans `tsconfig.json` pour éviter des erreurs de libs tierces. Si le build typecheck échoue massivement, garder `skipLibCheck: true` et corriger uniquement le code applicatif.
