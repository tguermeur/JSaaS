# Custom claims dans les security rules (Phase 3)

## Mode dual (claims + fallback)

Les helpers `tokenStructureId()` et `tokenIsSuperAdmin()` lisent d’abord `request.auth.token` :

| Helper | Token | Fallback |
|--------|--------|----------|
| `tokenStructureId()` | `request.auth.token.structureId` | `getUserData().structureId` si le doc `users/{uid}` existe |
| `tokenIsSuperAdmin()` | `request.auth.token.superadmin == true` | `status` / `role` == `'superadmin'` via `getUserData()` |

Présents dans `firestore.rules` et `storage.rules`. `isSuperAdmin()` délègue à `tokenIsSuperAdmin()`.

Les égalités tenant (`… == structureId`) passent par `tokenStructureId()` quand c’est équivalent sémantiquement. Les checks de **status / rôle / poles** continuent d’utiliser `getUserData()` (ou un `let userData = getUserData()` local).

## Phase 3b (plus tard)

Retirer le fallback Firestore dans ces helpers : token-only. Prérequis : tous les clients refreshent le token après changement de droits, et les claims sont toujours synchronisés (`syncUserClaims`).

## Exceptions : `hasPermission` et docs permissions

Même avec des claims, `hasPermission` / `hasModulePermission` / équivalents font encore un `get()` (ou `exists` + `get`) sur :

`structures/{structureId}/permissions/{permissionId}`

C’est **1 lecture document** par évaluation pour la matrice rôles/membres — les claims ne portent pas cette matrice. Documenter comme exception acceptée aux critères « ≤ 1 get sur chemins courants ».

Autres besoins `get()` hors fallback claims : `status`, `role`, `poleIds`, `companyId`, chemins étudiant / entreprise / contacts.

## Client : refresh token obligatoire

Les claims ne sont actifs qu’après refresh du ID token. Dans `AuthContext` :

- au login / hydratation : `await user.getIdToken(true)`
- sur `onSnapshot` user, si `structureId`, `role` ou `status` change : **`await user.getIdToken(true)` avant `setCurrentUser`**

Ne pas laisser un fire-and-forget : sinon les rules peuvent encore évaluer l’ancien token.

## Sync serveur

`functions/src/userSync.ts` (`syncUserClaims`) écrit les claims `structureId`, `role`, `status`, et `superadmin: true` si status/role superadmin.
