# Récapitulatif des fonctionnalités - Module Ambassadeurs

## 📄 Page Ambassadors.tsx (`/app/ambassadeurs`)

### Vue d'ensemble
Page principale de gestion du programme Ambassadeurs avec une interface moderne inspirée d'Apple.

### Fonctionnalités principales

#### 1. **Gestion des événements ambassadeurs**
- **Création d'événements** : Bouton "Créer un événement" pour les admins et contacts avec permission `canViewEvents`
- **Liste des événements** : Affichage de tous les événements ambassadeurs dans l'onglet "Événements"
- **Permissions granulaires** : Gestion des permissions pour les contacts entreprise (canViewEvents, canManageAmbassadors)

#### 2. **Gestion des ambassadeurs**
- **Ajout d'ambassadeurs** : Bouton "Ajouter un Ambassadeur" pour inviter de nouveaux membres
- **Liste des ambassadeurs** : Onglet dédié avec liste complète des ambassadeurs inscrits
- **Permissions** : Contrôle d'accès basé sur les rôles (admin, entreprise avec permissions)

#### 3. **Informations entreprise**
- **Onglet Informations** : Affichage et gestion des informations de l'entreprise partenaire
- **Configuration** : Paramètres liés au programme ambassadeurs

#### 4. **Interface utilisateur**
- **Design Apple** : Interface moderne avec typographie et espacements soignés
- **Tabs** : Navigation par onglets (Événements, Ambassadeurs, Informations)
- **Responsive** : Adaptation mobile et desktop
- **Actions rapides** : Boutons d'action visibles selon les permissions

### Contrôles d'accès
- **Admins de structure** : Accès complet (admin, admin_structure, membre, superadmin)
- **Entreprises** : Accès conditionnel selon les permissions de contact
- **Étudiants** : Redirection automatique vers `/app/available-missions`

---

## 📄 Page AmbassadorEventDetails.tsx (`/app/ambassadeurs/event/:eventId`)

### Vue d'ensemble
Page de détail d'un événement ambassadeur avec gestion complète des candidatures et conversion en mission.

### Fonctionnalités principales

#### 1. **Affichage de l'événement**
- **Informations générales** : Titre, lieu, dates, campagne
- **Horaires détaillés** : Affichage jour par jour avec :
  - Heures de début et fin
  - Calcul automatique des heures travaillées
  - Gestion des pauses (affichage et calcul)
  - Total d'heures par jour et global
- **Statistiques** : Capacité, acceptés, taux de remplissage avec barre de progression

#### 2. **Gestion des candidatures**
- **Liste des candidatures** : Affichage de toutes les candidatures avec statuts (En attente, Acceptée, Refusée)
- **Informations détaillées** :
  - Nom, email de l'ambassadeur
  - Date de candidature
  - CV (lien de téléchargement)
  - Lettre de motivation
  - Statut de validation du dossier
- **Actions** : Accepter/Refuser les candidatures
- **Filtrage** : Distinction entre candidatures et inscriptions manuelles

#### 3. **Ajout manuel d'ambassadeurs**
- **Dialog d'ajout** : Interface pour ajouter des ambassadeurs directement à un créneau
- **Sélection de créneau** : Choix du créneau avec affichage de la capacité disponible
- **Sélection multiple** : Possibilité d'ajouter plusieurs ambassadeurs en une fois
- **Vérification de capacité** : Contrôle automatique de la capacité disponible
- **Création automatique** : Création des candidatures avec statut "Acceptée" pour les ajouts manuels

#### 4. **Conversion en mission**
- **Dialog de conversion** : Interface pour convertir un événement ambassadeur en mission standard
- **Génération automatique** : Numéro de mission auto-généré (format YYMMNN)
- **Sélection du chargé** : Choix du chargé de mission (utilisateur actuel par défaut)
- **Transfert des données** :
  - Candidatures acceptées et en attente
  - Horaires et pauses (tous les jours)
  - Lieu et coordonnées GPS
  - Capacité totale
  - Entreprise et contact par défaut
- **Calcul automatique** : Heures totales et heures par étudiant
- **Vérification** : Contrôle d'unicité du numéro de mission

#### 5. **Modification d'événement**
- **Édition** : Formulaire complet pour modifier tous les aspects de l'événement
- **Formulaire réutilisable** : Utilisation du composant `AmbassadorEventForm`

#### 6. **Documents de mission**
- **Affichage** : Liste des documents générés liés à l'événement
- **Téléchargement** : Accès direct aux documents PDF

#### 7. **Navigation et UX**
- **Bouton retour** : Retour vers la liste des ambassadeurs
- **Scroll automatique** : Animation de scroll vers le haut au chargement
- **États de chargement** : Indicateurs visuels pendant les opérations
- **Gestion d'erreurs** : Messages d'erreur clairs

### Contrôles d'accès
- **Admins de structure** : Accès complet à toutes les fonctionnalités
- **Contacts avec accès** : 
  - `canViewEvents` : Peut voir et modifier les événements
  - `canManageAmbassadors` : Peut ajouter des ambassadeurs et gérer les candidatures
- **Filtrage par entreprise** : Les contacts ne voient que les événements de leur entreprise

### Points techniques importants
- **Synchronisation** : Recherche des candidatures dans les missions converties
- **Validation de dossier** : Synchronisation avec HumanResources pour le statut de validation
- **Gestion des slots** : Calcul précis des heures avec prise en compte des pauses
- **Performance** : Chargement optimisé avec gestion des permissions asynchrones

---

## 🎯 Fonctionnalités transverses

### Permissions
- Système de permissions granulaires pour les contacts entreprise
- Vérification asynchrone des permissions avec délai de chargement
- Gestion des rôles multiples (admin, entreprise, contact avec accès)

### Design
- Interface moderne inspirée d'Apple
- Animations et transitions fluides
- Responsive design
- Accessibilité

### Intégration
- Intégration avec le système de missions
- Synchronisation avec HumanResources
- Gestion des documents générés
- Conversion bidirectionnelle événement ↔ mission
