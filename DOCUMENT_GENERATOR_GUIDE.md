# Guide du Générateur de Documents Intelligent

## Vue d'ensemble

Le nouveau système de génération de documents a été complètement repensé pour offrir une expérience utilisateur intuitive et des fonctionnalités avancées. Il permet de créer des templates de documents avec des balises automatiques qui se remplacent par les vraies données des études, entreprises, étudiants, etc.

## 🚀 Nouvelles fonctionnalités

### 1. Interface utilisateur améliorée
- **Processus guidé en 5 étapes** : Import → Analyse → Configuration → Prévisualisation → Finalisation
- **Support multi-format** : PDF, Word (.docx), PowerPoint (.pptx)
- **Détection automatique des balises** dans les documents importés
- **Prévisualisation en temps réel** avec les vraies données de l'étude

### 2. Bibliothèque complète de balises

Le système propose maintenant **plus de 50 balises** organisées par catégories :

#### 📋 Étude/Mission
- `<etude_numero>` - Numéro unique de l'étude (ex: E2024-001)
- `<etude_titre>` - Titre de l'étude
- `<etude_description>` - Description détaillée
- `<etude_date_debut>` - Date de début
- `<etude_date_fin>` - Date de fin
- `<etude_prix_ht>` - Prix HT
- `<etude_total_ttc>` - Montant total TTC
- `<etude_nb_etudiants>` - Nombre d'étudiants assignés
- `<etude_heures_totales>` - Nombre total d'heures
- `<etude_statut>` - Statut actuel
- `<etude_etape>` - Étape actuelle (Négociation, Recrutement, etc.)

#### 👨‍🎓 Étudiant
- `<etudiant_nom>` - Nom de famille
- `<etudiant_prenom>` - Prénom
- `<etudiant_nom_complet>` - Nom complet
- `<etudiant_email>` - Email
- `<etudiant_telephone>` - Téléphone
- `<etudiant_ecole>` - École
- `<etudiant_formation>` - Formation suivie
- `<etudiant_programme>` - Programme d'études
- `<etudiant_annee_diplome>` - Année de diplômation
- `<etudiant_adresse>` - Adresse
- `<etudiant_ville>` - Ville de résidence
- `<etudiant_nationalite>` - Nationalité
- `<etudiant_date_naissance>` - Date de naissance
- `<etudiant_numero_securite_sociale>` - Numéro de sécurité sociale

#### 🏢 Entreprise
- `<entreprise_nom>` - Nom de l'entreprise
- `<entreprise_siret>` - Numéro SIRET
- `<entreprise_adresse>` - Adresse
- `<entreprise_ville>` - Ville
- `<entreprise_telephone>` - Téléphone
- `<entreprise_email>` - Email
- `<entreprise_site_web>` - Site web
- `<entreprise_description>` - Description
- `<entreprise_secteur>` - Secteur d'activité

#### 👤 Contact Entreprise
- `<contact_nom>` - Nom du contact
- `<contact_prenom>` - Prénom du contact
- `<contact_nom_complet>` - Nom complet
- `<contact_email>` - Email du contact
- `<contact_telephone>` - Téléphone
- `<contact_poste>` - Poste occupé
- `<contact_linkedin>` - Profil LinkedIn

#### 🏛️ Structure (Junior Entreprise)
- `<structure_nom>` - Nom de la structure
- `<structure_siret>` - SIRET de la structure
- `<structure_adresse>` - Adresse
- `<structure_telephone>` - Téléphone
- `<structure_email>` - Email
- `<structure_site_web>` - Site web
- `<structure_tva>` - Numéro de TVA

#### 👨‍💼 Chargé d'Étude
- `<charge_nom>` - Nom complet du chargé d'étude
- `<charge_email>` - Email du chargé d'étude
- `<charge_telephone>` - Téléphone du chargé d'étude

#### 🧾 Facturation
- `<facture_numero>` - Numéro de facture
- `<facture_date>` - Date de facture
- `<facture_montant_ht>` - Montant HT
- `<facture_montant_ttc>` - Montant TTC

#### ⚙️ Système
- `<aujourd_hui>` - Date du jour
- `<heure_actuelle>` - Heure actuelle
- `<annee_actuelle>` - Année en cours
- `<mois_actuel>` - Mois en cours

## 📖 Comment utiliser le générateur

### Depuis une étude

1. **Accéder au générateur** : Dans l'onglet "Documents" d'une étude, cliquez sur "Générateur intelligent"

2. **Importer votre document** : 
   - Glissez-déposez ou sélectionnez votre fichier (PDF, Word, PowerPoint)
   - Le système supporte les formats : `.pdf`, `.docx`, `.doc`, `.pptx`, `.ppt`

3. **Analyse automatique** :
   - Le système analyse votre document et détecte automatiquement les balises existantes
   - Un rapport vous indique combien de balises ont été trouvées

4. **Configuration** :
   - Vérifiez les balises détectées
   - Consultez la bibliothèque complète pour ajouter d'autres balises
   - Copiez facilement les balises dans le presse-papier

5. **Prévisualisation** :
   - Voyez un aperçu du document final avec les vraies données de votre étude
   - Les balises sont automatiquement remplacées par les informations réelles

6. **Finalisation** :
   - Téléchargez votre document généré
   - Sauvegardez le template pour une utilisation future

### Depuis les paramètres

- **Générateur autonome** : `/app/settings/document-generator`
- **Bibliothèque des balises** : `/app/settings/tag-library`

## 💡 Exemples d'utilisation

### Convention étudiante
```
CONVENTION D'ÉTUDE

Entre la société <entreprise_nom>, représentée par <contact_nom_complet>,
et l'étudiant <etudiant_prenom> <etudiant_nom> de l'école <etudiant_ecole>.

Objet : <etude_titre>
Période : du <etude_date_debut> au <etude_date_fin>
Lieu : <etude_lieu>
Rémunération : <etude_total_ht> HT

Fait le <aujourd_hui>
```

### Facture
```
FACTURE N° <facture_numero>

<structure_nom>
<structure_adresse>
<structure_telephone>
<structure_email>

Facturé à :
<entreprise_nom>
<entreprise_adresse>

Étude : <etude_titre> (<etude_numero>)
Montant HT : <etude_total_ht>
TVA (20%) : <etude_tva>
Montant TTC : <etude_total_ttc>

Date d'émission : <aujourd_hui>
```

### Proposition commerciale
```
PROPOSITION COMMERCIALE

<structure_nom> vous propose la réalisation de l'étude suivante :

Titre : <etude_titre>
Description : <etude_description>

Chargé d'étude : <charge_nom>
Email : <charge_email>
Téléphone : <charge_telephone>

Période prévisionnelle : <etude_date_debut> au <etude_date_fin>
Nombre d'étudiants : <etude_nb_etudiants>
Durée totale : <etude_heures_totales>

Montant de la prestation : <etude_total_ht> HT
```

## 🔧 Fonctionnalités techniques

### Détection automatique
- **Analyse intelligente** du contenu des documents
- **Reconnaissance des patterns** de balises existantes
- **Suggestions contextuelles** basées sur le type de document

### Remplacement intelligent
- **Formatage automatique** des dates (format français)
- **Formatage des montants** avec devise
- **Gestion des valeurs manquantes** (affichage de valeurs par défaut)
- **Support des calculs** (TVA automatique, totaux, etc.)

### Intégration complète
- **Données en temps réel** depuis la base de données
- **Synchronisation automatique** avec les modifications
- **Historique des générations** pour traçabilité

## 🎯 Avantages du nouveau système

### Pour les utilisateurs
- **Interface intuitive** avec processus guidé
- **Gain de temps considérable** grâce à l'automatisation
- **Réduction des erreurs** de saisie manuelle
- **Templates réutilisables** pour tous types de documents

### Pour les administrateurs
- **Bibliothèque centralisée** de toutes les balises
- **Documentation automatique** téléchargeable
- **Gestion simplifiée** des templates
- **Traçabilité complète** des générations

## 🔄 Migration depuis l'ancien système

L'ancien système de templates PDF reste accessible via "Templates PDF (Ancien)" dans les paramètres pour assurer une transition en douceur. Les utilisateurs peuvent progressivement migrer vers le nouveau système.

## 📞 Support

Pour toute question ou problème avec le générateur de documents :
1. Consultez d'abord la bibliothèque des balises
2. Vérifiez la syntaxe de vos balises
3. Testez avec la prévisualisation avant finalisation

---

*Dernière mise à jour : ${new Date().toLocaleDateString('fr-FR')}*

