# Système de Notification Unifié

## Vue d'ensemble

Le système de notification a été entièrement refactorisé pour offrir une expérience unifiée et cohérente dans toute l'application. Il combine les notifications persistantes (stockées en base) et les notifications temporaires (toasts) dans un seul contexte centralisé.

## Architecture

### 1. Contexte de Notification (`NotificationContext`)

Le contexte central gère :
- **Notifications persistantes** : Stockées en Firestore avec statut de lecture
- **Notifications temporaires** : Utilisent notistack pour les toasts
- **Préférences utilisateur** : Personnalisation des notifications
- **Écoute en temps réel** : Mise à jour automatique via Firestore

### 2. Types de Notifications

#### Notifications Persistantes
```typescript
type NotificationType = 
  | 'admin_notification'    // Notifications globales des admins
  | 'report_update'         // Mise à jour de rapport
  | 'report_response'       // Réponse à un rapport
  | 'mission_update'        // Mise à jour de mission
  | 'ambassador_update'     // Événements ambassadeur (demandes, docs, candidatures)
  | 'user_update'           // Mise à jour de profil utilisateur
  | 'system';               // Notifications système
```

#### Priorités
```typescript
type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';
```

### 3. Structure Firestore

```json
{
  "notifications": {
    "id": {
      "type": "string",
      "title": "string",
      "message": "string",
      "read": "boolean",
      "createdAt": "timestamp",
      "priority": "string",
      "userId": "string",           // Pour notifications individuelles
      "structureId": "string",      // Pour notifications de structure
      "reportId": "string",         // Référence optionnelle
      "recipientType": "string",    // 'all' | 'structure' | 'user'
      "readBy": ["array"],          // Pour admin_notification
      "recipientCount": "number",   // Pour admin_notification
      "metadata": "object"          // Données supplémentaires
    }
  }
}
```

## Utilisation

### 1. Hook `useNotifications`

```typescript
import { useNotifications } from '../contexts/NotificationContext';

const MyComponent = () => {
  const {
    persistentNotifications,    // Notifications persistantes
    unreadCount,               // Nombre de notifications non lues
    isLoading,                 // État de chargement
    markAsRead,               // Marquer comme lue
    markAllAsRead,            // Marquer toutes comme lues
    sendNotification,         // Envoyer une notification
    showTemporaryNotification, // Afficher un toast
    updatePreferences         // Mettre à jour les préférences
  } = useNotifications();

  // Utilisation...
};
```

### 2. Service de Notification

```typescript
import { NotificationService } from '../services/notificationService';

// Envoyer à un utilisateur
await NotificationService.sendToUser(
  userId,
  'mission_update',
  'Mission créée',
  'Une nouvelle mission a été créée',
  'medium'
);

// Envoyer à une structure
await NotificationService.sendToStructure(
  structureId,
  'admin_notification',
  'Maintenance prévue',
  'Une maintenance est prévue ce soir',
  'high'
);

// Notification globale
await NotificationService.sendGlobal(
  'system',
  'Nouvelle fonctionnalité',
  'Une nouvelle fonctionnalité est disponible',
  'medium'
);
```

### 3. Fonctions Utilitaires

```typescript
import { 
  notifyMissionCreated,
  notifyReportResponse,
  notifyReportStatusChange 
} from '../services/notificationService';

// Notifications courantes
await notifyMissionCreated(userId, missionId, missionNumber);
await notifyReportResponse(userId, reportId, reportContent);
await notifyReportStatusChange(userId, reportId, 'resolved');
```

### 4. Composants UI

#### NotificationBadge
```typescript
import NotificationBadge from '../components/ui/NotificationBadge';

<NotificationBadge
  onClick={handleClick}
  size="small"
  color="error"
  showBadge={true}
/>
```

#### NotificationList
```typescript
import NotificationList from '../components/ui/NotificationList';

<NotificationList
  notifications={notifications}
  onNotificationClick={handleClick}
  maxHeight={400}
  showEmptyState={true}
  emptyStateMessage="Aucune notification"
/>
```

## Migration depuis l'ancien système

### 1. Remplacement des Snackbars locaux

**Avant :**
```typescript
const [snackbar, setSnackbar] = useState({
  open: false,
  message: '',
  severity: 'success'
});

<Snackbar open={snackbar.open} onClose={handleClose}>
  <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
</Snackbar>
```

**Après :**
```typescript
const { showTemporaryNotification } = useNotifications();

showTemporaryNotification({
  type: 'success',
  message: 'Opération réussie',
  duration: 6000
});
```

### 2. Remplacement des notifications persistantes

**Avant :**
```typescript
const [notifications, setNotifications] = useState([]);
const [unreadCount, setUnreadCount] = useState(0);

// Gestion manuelle...
```

**Après :**
```typescript
const { persistentNotifications, unreadCount } = useNotifications();
// Gestion automatique par le contexte
```

## Fonctionnalités Avancées

### 1. Préférences Utilisateur

```typescript
const { preferences, updatePreferences } = useNotifications();

// Mettre à jour les préférences
await updatePreferences({
  email: true,
  push: false,
  sound: true,
  types: {
    admin_notification: true,
    report_update: false,
    mission_update: true
  }
});
```

### 2. Métadonnées

```typescript
await sendNotification({
  userId,
  type: 'mission_update',
  title: 'Mission assignée',
  message: 'Vous avez été assigné à une mission',
  priority: 'high',
  metadata: {
    missionId: 'abc123',
    action: 'assigned',
    redirectUrl: '/app/mission/abc123'
  }
});
```

### 3. Actions dans les Toasts

```typescript
showTemporaryNotification({
  type: 'info',
  message: 'Nouvelle mission disponible',
  duration: 10000,
  action: {
    label: 'Voir',
    onClick: () => navigate('/app/missions')
  }
});
```

## Bonnes Pratiques

### 1. Priorités
- **urgent** : Erreurs critiques, problèmes de sécurité
- **high** : Actions importantes, mises à jour critiques
- **medium** : Notifications standard (par défaut)
- **low** : Informations générales, mises à jour mineures

### 2. Messages
- Gardez les titres courts et descriptifs
- Utilisez des messages clairs et actionnables
- Incluez des métadonnées pour le contexte

### 3. Performance
- Le contexte utilise `onSnapshot` pour les mises à jour en temps réel
- Les notifications sont limitées à 50 par utilisateur
- Les notifications globales sont limitées à 20

### 4. Accessibilité
- Les notifications supportent les lecteurs d'écran
- Les couleurs respectent les contrastes WCAG
- Les actions sont accessibles au clavier

## Notifications ambassadeur

Les notifications ambassadeur (`ambassador_update`) sont créées par des **Cloud Functions** (pas depuis le client) pour contourner les règles Firestore sur la création cross-utilisateur.

### Déclencheurs

| Fonction | Événement | Destinataires |
|----------|-----------|---------------|
| `onAmbassadorProposalRequest` | Demande de proposition commerciale | Staff structure (permission ambassadeurs) |
| `onAmbassadorDocumentWrite` | Document visible entreprise déposé | Contacts entreprise (`canViewEvents`) |
| `onAmbassadorApplicationWrite` | Candidature / nouveau créneau | Structure (groupé) + entreprise (digest) |
| `flushAmbassadorApplicationDigests` | Planifié (1 h) | Entreprise si seuil ou délai 4 h |

### Regroupement anti-spam

- ID déterministe `notifications/{userId}__{groupKey}` pour fusionner les événements similaires tant que la notif est non lue
- Candidatures entreprise : digest après **3 candidatures** ou **4 h** (`ambassadorDigestState`)
- Deep link : `/app/ambassadeurs/event/{eventId}`

### Fichiers

- `functions/src/ambassadorNotifications.ts`
- `functions/src/ambassadorNotificationRecipients.ts`

## Dépannage

### Problèmes Courants

1. **Notifications non affichées**
   - Vérifiez que le `NotificationProvider` est bien dans l'arbre des composants
   - Vérifiez les permissions Firestore
   - Vérifiez que l'utilisateur est connecté

2. **Compteur incorrect**
   - Vérifiez que les notifications ont bien le bon `userId`
   - Vérifiez que le champ `read` est correctement mis à jour

3. **Toasts non affichés**
   - Vérifiez que `SnackbarProvider` est bien configuré
   - Vérifiez que `notistack` est installé

### Debug

```typescript
// Activer les logs de debug
const { persistentNotifications, unreadCount } = useNotifications();

console.log('Notifications:', persistentNotifications);
console.log('Unread count:', unreadCount);
```


## Architecture 2026 (CF)

Les notifications cross-utilisateur sont créées **uniquement** par Cloud Functions (`notifyUsersCallable`, triggers Firestore). Voir `functions/src/notifications/`.

Emails transactionnels : secrets `EMAILJS_TEMPLATE_ID_*` — catalogue dans [`email-templates/README.md`](email-templates/README.md).

## Évolutions Futures

- [x] Notifications par email (EmailJS via CF + préférences)
- [x] Notifications groupées (pattern ambassadeur + missions)
- [x] Templates email (`email-templates/`)
- [ ] Notifications push navigateur
- [ ] Sons de notification
- [ ] Historique complet des notifications
- [ ] Export des notifications
- [ ] Notifications programmées
