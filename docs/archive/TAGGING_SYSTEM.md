# Système de Tagging et Notifications

## Fonctionnalités

Le système de tagging permet de mentionner des utilisateurs dans les notes de mission et de leur envoyer automatiquement des notifications.

### Comment utiliser le tagging

1. **Tagger un utilisateur** :
   - Dans le champ de saisie des notes, tapez `@` suivi du nom de l'utilisateur
   - Une liste de suggestions apparaîtra avec les utilisateurs de la structure
   - Sélectionnez l'utilisateur souhaité dans la liste

2. **Affichage des suggestions** :
   - Les suggestions incluent le prénom, nom, email et rôle de l'utilisateur
   - Les rôles sont affichés avec des couleurs différentes :
     - Admin : Orange
     - Superadmin : Rouge
     - Membre : Gris

3. **Utilisateurs taggés** :
   - Les utilisateurs taggés apparaissent sous forme de chips sous le champ de saisie
   - Vous pouvez supprimer un tag en cliquant sur la croix du chip

### Notifications

- Quand une note avec des mentions est ajoutée, les utilisateurs taggés reçoivent automatiquement une notification
- La notification contient :
  - Le nom de la personne qui a ajouté la note
  - Le numéro de la mission
  - Un lien vers la note

### Affichage des mentions

- Dans les notes existantes, les mentions `@nom` sont affichées en gras avec un fond bleu clair
- Cela permet de repérer facilement les mentions dans le contenu

### Utilisateurs disponibles

Le système propose automatiquement tous les utilisateurs de la structure :
- Membres
- Admins
- Superadmins

### Navigation clavier

- Utilisez les flèches haut/bas pour naviguer dans les suggestions
- Appuyez sur Entrée pour sélectionner l'utilisateur
- Appuyez sur Échap pour fermer les suggestions

## Composants

### TaggingInput
Composant réutilisable qui gère :
- La détection des mentions `@`
- L'affichage des suggestions
- La sélection des utilisateurs
- L'affichage des utilisateurs taggés

### NotificationService
Service qui gère l'envoi des notifications aux utilisateurs taggés.

## Structure des données

### Utilisateur pour tagging
```typescript
{
  id: string;
  displayName: string;
  email: string;
  photoURL?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}
```

### Notification
```typescript
{
  userId: string;
  type: 'mission_note';
  title: string;
  message: string;
  priority: 'medium';
  metadata: {
    missionId: string;
    missionNumber: string;
    noteId: string;
    mentionedBy: string;
  };
}
``` 