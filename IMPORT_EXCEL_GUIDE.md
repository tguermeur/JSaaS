# Guide d'import Excel pour les Prospects

## Fonctionnalité d'import Excel/CSV

Cette fonctionnalité permet d'importer en masse des prospects depuis un fichier Excel ou CSV dans votre base de données.

## Formats supportés

- **CSV** (.csv)
- **Excel** (.xlsx, .xls)

## Étapes d'import

### 1. Sélection du fichier
- Cliquez sur le bouton "Importer Excel" dans la page Commercial
- Sélectionnez votre fichier Excel ou CSV
- Vous pouvez également télécharger le modèle CSV pour voir le format attendu

### 2. Mapping des colonnes
Le système détecte automatiquement les colonnes et propose un mapping. Vous pouvez ajuster manuellement :
- **Nom** : nom, name, prénom, firstname
- **Entreprise** : entreprise, company, société, organisation
- **Email** : email, mail, courriel
- **Téléphone** : telephone, phone, tel, mobile
- **Poste** : poste, title, position, job
- **Adresse** : adresse, address, rue, street
- **Secteur** : secteur, sector, industrie, domaine
- **Source** : source, origine, provenance
- **Notes** : notes, commentaire, description
- **URL LinkedIn** : linkedin, profile, url
- **Statut** : statut, status, état, phase

### 3. Validation des données
Le système valide automatiquement :
- Présence des champs obligatoires (Nom et Entreprise)
- Format des emails
- Statuts valides

### 4. Import
- Les prospects sont importés un par un avec une barre de progression
- Chaque prospect est créé avec le statut "Non qualifié" par défaut
- Les erreurs sont affichées en temps réel

## Statuts valides

Les statuts suivants sont acceptés (avec variations) :
- **Non qualifié** : non_qualifie, non qualifié, nouveau
- **Contacté** : contacte, contacté
- **À recontacter** : a_recontacter, à recontacter
- **Négociation** : negociation, négociation
- **Abandon** : abandon
- **Déjà client** : deja_client, déjà client, client

## Modèle CSV

Le fichier modèle contient les colonnes suivantes :
```csv
nom,entreprise,email,telephone,poste,adresse,secteur,source,notes,linkedinUrl,statut
```

## Conseils d'utilisation

1. **Préparez vos données** : Assurez-vous que vos données sont propres et cohérentes
2. **Utilisez le modèle** : Téléchargez le modèle CSV pour voir le format attendu
3. **Vérifiez les statuts** : Utilisez les statuts valides ou laissez vide pour "Non qualifié"
4. **Testez avec un petit fichier** : Commencez par importer quelques prospects pour vérifier le format
5. **Vérifiez les erreurs** : Corrigez les erreurs avant de relancer l'import

## Gestion des erreurs

Les erreurs courantes et leurs solutions :
- **Email invalide** : Vérifiez le format email@domaine.com
- **Statut invalide** : Utilisez un des statuts valides listés ci-dessus
- **Champs manquants** : Nom et Entreprise sont obligatoires

## Support

En cas de problème avec l'import, vérifiez :
1. Le format de votre fichier
2. L'encodage (UTF-8 recommandé)
3. Les valeurs dans chaque colonne
4. Les logs d'erreur affichés dans l'interface 