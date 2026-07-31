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

#### Informations de base
- **Nom** : nom, name
- **Entreprise** : entreprise, company
- **Email** : email
- **Téléphone** : telephone, phone, tel
- **Poste** : poste, title, position, job
- **À propos** : about, description
- **URL LinkedIn** : linkedin, linkedinUrl
- **Photo** : photoUrl, photo, avatar
- **Statut** : statut (par défaut: non_qualifie)
- **Source** : source (par défaut: Import Excel)

#### Localisation
- **Localisation** : location, localisation, ville
- **Pays** : pays, country
- **Adresse** : adresse, address

#### Secteur d'activité
- **Secteur** : secteur, sector, industrie
  - Exemples : Technologies de l'information, Banque et finance, Conseil en stratégie, Santé, Commerce, Industrie, etc.

#### Données entreprise
- **Raison sociale** : raisonSociale, raison sociale
- **Code secteur** : codeSecteur, code secteur, ape
- **Siège social** : siegeSocial, siège social, siege
- **SIREN** : siren
- **SIRET** : siret
- **Secteur d'activité** : companySector, secteur activité

#### Données commerciales
- **Valeur potentielle** : valeurPotentielle, valeur potentielle, value
- **Méthode d'extraction** : extractionMethod, méthode extraction

#### Expériences professionnelles
Pour ajouter plusieurs expériences, utilisez les colonnes numérotées :
- **Experience1Title** : Titre du premier poste
- **Experience1Company** : Entreprise du premier poste
- **Experience1Duration** : Durée du premier poste
- **Experience2Title** : Titre du deuxième poste
- **Experience2Company** : Entreprise du deuxième poste
- **Experience2Duration** : Durée du deuxième poste
- etc.

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

## Exemples de secteurs valides

Voici quelques exemples de secteurs que vous pouvez utiliser :
- **Technologies** : Technologies de l'information, Logiciels, SaaS, Cloud computing, Cybersécurité
- **Finance** : Banque et finance, Assurance, Gestion d'actifs, Fintech
- **Conseil** : Conseil en stratégie, Conseil en management, Audit, Conseil IT
- **Industrie** : Industrie manufacturière, Agroalimentaire, Pharmaceutique, Chimie
- **Santé** : Santé et médical, Biotechnologie, Dispositifs médicaux
- **Commerce** : Commerce de détail, E-commerce, Distribution, Grande distribution
- **Services** : Services professionnels, Ressources humaines, Marketing, Communication
- **Immobilier** : Immobilier commercial, Immobilier résidentiel, Promotion immobilière
- **Énergie** : Énergie et environnement, Énergies renouvelables, Pétrole et gaz
- **Transport** : Transport et logistique, Aérien, Maritime, Ferroviaire
- **Éducation** : Éducation et formation, E-learning, Formation professionnelle
- **Médias** : Médias et divertissement, Publicité, Production audiovisuelle

## Modèle CSV

Le fichier modèle contient les colonnes suivantes :
```csv
nom,entreprise,email,telephone,poste,adresse,secteur,source,linkedinUrl,statut,location,pays,about,photoUrl,valeurPotentielle,extractionMethod,raisonSociale,codeSecteur,siegeSocial,siren,siret,companySector,experience1Title,experience1Company,experience1Duration,experience2Title,experience2Company,experience2Duration
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