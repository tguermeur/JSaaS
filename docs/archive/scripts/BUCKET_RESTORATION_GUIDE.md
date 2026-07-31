# Guide de Restauration de Bucket Firebase Storage

## Situation Actuelle

- **Bucket actif**: `jsaas-dd2f7.firebasestorage.app` sur **US-CENTRAL1**
  - Créé le: 11 novembre 2025 à 23:21:25
  - Contient: 3 objets (missions, logo, template)
  
- **Bucket supprimé**: `jsaas-dd2f7.firebasestorage.app` sur **EUROPE-WEST3**
  - Supprimé le: 11 novembre 2025 à 23:20:50
  - Génération: `1742421543371078829`
  - Peut être restauré jusqu'au: 18 novembre 2025 (7 jours après suppression)

## Problème

Google Cloud Storage ne permet pas d'avoir deux buckets avec le même nom. Pour restaurer le bucket supprimé sur EUROPE-WEST3, il faut d'abord supprimer le bucket actif sur US-CENTRAL1.

## Options Disponibles

### Option 1: Restaurer le bucket sur EUROPE-WEST3 (avec sauvegarde)

Cette option sauvegarde les 3 objets du bucket actif, supprime le bucket actif, puis restaure le bucket supprimé.

**Étapes:**

1. **Sauvegarder les objets du bucket actif:**
   ```bash
   # Les objets seront sauvegardés dans un bucket temporaire
   node scripts/migrate-and-restore-bucket.mjs jsaas-dd2f7.firebasestorage.app 1742421543371078829
   ```

2. **Vérifier que la restauration a réussi:**
   ```bash
   node scripts/check-bucket-status.mjs jsaas-dd2f7.firebasestorage.app
   ```

3. **Restaurer les objets si nécessaire:**
   - Si le bucket restauré sur EUROPE-WEST3 ne contient pas les objets souhaités
   - Copiez les objets du bucket temporaire vers le bucket restauré
   - Supprimez le bucket temporaire

**Avantages:**
- ✅ Le bucket est restauré sur EUROPE-WEST3 (région souhaitée)
- ✅ Les objets du bucket actif sont sauvegardés
- ✅ Pas de perte de données

**Inconvénients:**
- ⚠️ Le bucket actif est supprimé (mais ses objets sont sauvegardés)
- ⚠️ Nécessite de copier les objets si nécessaire

### Option 2: Garder le bucket actif sur US-CENTRAL1

Cette option garde le bucket actif et ne restaure pas le bucket supprimé.

**Étapes:**

1. **Aucune action nécessaire**
   - Le bucket actif reste utilisé
   - Le bucket supprimé ne sera pas restauré

**Avantages:**
- ✅ Aucune action nécessaire
- ✅ Le bucket actif continue de fonctionner

**Inconvénients:**
- ❌ Le bucket n'est pas sur EUROPE-WEST3 (région souhaitée)
- ❌ Le bucket supprimé ne sera pas restauré
- ❌ Les données du bucket supprimé seront définitivement perdues après 7 jours

### Option 3: Restaurer le bucket sur EUROPE-WEST3 (sans sauvegarde)

Cette option supprime directement le bucket actif et restaure le bucket supprimé, sans sauvegarder les objets.

**⚠️ ATTENTION: Cette option supprime définitivement les 3 objets du bucket actif!**

**Étapes:**

1. **Supprimer manuellement les objets du bucket actif:**
   - Via Google Cloud Console: https://console.cloud.google.com/storage/browser
   - Ou via gcloud CLI: `gcloud storage rm -r gs://jsaas-dd2f7.firebasestorage.app/*`

2. **Supprimer le bucket actif:**
   ```bash
   node scripts/restore-bucket-with-conflict-resolution.mjs jsaas-dd2f7.firebasestorage.app 1742421543371078829 --force-delete-active
   ```

**Avantages:**
- ✅ Le bucket est restauré sur EUROPE-WEST3
- ✅ Processus rapide

**Inconvénients:**
- ❌ Les 3 objets du bucket actif sont perdus définitivement
- ⚠️ Pas de sauvegarde

## Recommandation

**Option 1 (avec sauvegarde)** est recommandée si vous voulez restaurer le bucket sur EUROPE-WEST3 tout en préservant les données du bucket actif.

## Scripts Disponibles

- `scripts/find-deleted-bucket.mjs`: Trouve les buckets supprimés
- `scripts/list-buckets.mjs`: Liste tous les buckets (actifs et supprimés)
- `scripts/check-bucket-status.mjs`: Vérifie le statut d'un bucket
- `scripts/restore-bucket.mjs`: Restaure un bucket supprimé
- `scripts/restore-bucket-with-conflict-resolution.mjs`: Gère les conflits lors de la restauration
- `scripts/migrate-and-restore-bucket.mjs`: Migre les données et restaure le bucket

## Notes Importantes

1. **Limite de 7 jours**: Les buckets supprimés peuvent être restaurés pendant 7 jours après la suppression. Après cette période, ils sont définitivement supprimés.

2. **Régions différentes**: Le bucket actif est sur US-CENTRAL1, tandis que le bucket supprimé était sur EUROPE-WEST3. Ces régions ont des caractéristiques différentes (latence, coûts, etc.).

3. **Firebase Storage**: Firebase Storage utilise Google Cloud Storage en arrière-plan. Les buckets Firebase Storage ont des noms globaux uniques.

4. **Sauvegarde**: Il est toujours recommandé de sauvegarder les données avant de supprimer un bucket.

## Support

Pour plus d'informations, consultez:
- [Documentation Google Cloud Storage](https://cloud.google.com/storage/docs)
- [Documentation Firebase Storage](https://firebase.google.com/docs/storage)
- [API REST Google Cloud Storage](https://cloud.google.com/storage/docs/json_api/v1/buckets/restore)






