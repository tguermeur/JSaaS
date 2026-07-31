# Système de Changelog

## 📖 Description

Le système de changelog affiche automatiquement une popup élégante aux utilisateurs lors de leur première connexion après une mise à jour. Cette popup présente les nouvelles fonctionnalités de manière visuelle et engageante.

## 🎯 Fonctionnalités

- ✅ **Affichage automatique** : La popup s'affiche automatiquement à la première connexion après une mise à jour
- ✅ **Bouton d'info** : Les utilisateurs peuvent retrouver la popup à tout moment via le bouton "i" dans la navbar
- ✅ **Animations élégantes** : Transitions fluides à l'ouverture et à la fermeture
- ✅ **Design moderne** : Cartes avec gradients, icônes Material-UI, et effets au survol
- ✅ **Mémorisation par utilisateur** : Chaque utilisateur voit la popup une seule fois par version
- ✅ **Responsive** : S'adapte à tous les écrans

## 📁 Fichiers concernés

```
src/
├── components/
│   ├── ChangelogDialog.tsx          # Composant de la popup
│   └── layout/
│       ├── ProtectedLayout.tsx      # Intégration du changelog
│       └── Navbar.tsx                # Bouton "i" pour rouvrir
├── contexts/
│   └── ChangelogContext.tsx          # Contexte de gestion globale
└── types/
    └── user.ts                       # Types mis à jour
```

## 🚀 Comment déployer une nouvelle version

### 1. Modifier la version

Ouvrez le fichier `src/contexts/ChangelogContext.tsx` et changez la version :

```typescript
const CURRENT_VERSION = '2.1.0'; // Changez ce numéro
```

### 2. Mettre à jour le contenu (optionnel)

Si vous voulez modifier les fonctionnalités présentées, éditez `src/components/ChangelogDialog.tsx`.

### 3. Déployer

C'est tout ! La prochaine fois qu'un utilisateur se connecte :
- Si sa `lastSeenChangelogVersion` est différente de `CURRENT_VERSION`
- La popup s'affichera automatiquement
- Son profil sera mis à jour avec la nouvelle version

## 🎨 Personnalisation

### Ajouter une nouvelle fonctionnalité

Dans `ChangelogDialog.tsx`, ajoutez une nouvelle carte dans le `Grid` :

```tsx
<Grid item xs={12} md={6}>
  <FeatureCard elevation={0}>
    <CardContent sx={{ p: 3 }}>
      <VotreIconWrapper>
        <VotreIcon />
      </VotreIconWrapper>
      
      <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
        Titre de la fonctionnalité
      </Typography>
      
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Description courte
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <CheckIcon sx={{ fontSize: 20, color: 'primary.main', mt: 0.2 }} />
          <Typography variant="body2">
            <strong>Point clé</strong> : Description
          </Typography>
        </Box>
      </Box>

      <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
        <NewIcon sx={{ fontSize: 18, color: 'success.main' }} />
        <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
          Où trouver cette fonctionnalité
        </Typography>
      </Box>
    </CardContent>
  </FeatureCard>
</Grid>
```

### Personnaliser les couleurs

Créez un nouveau `IconWrapper` avec un gradient personnalisé :

```typescript
const VotreIconWrapper = styled(IconWrapper)({
  background: 'linear-gradient(135deg, #couleur1 0%, #couleur2 100%)',
  boxShadow: '0 4px 12px rgba(R, G, B, 0.3)'
});
```

## 📊 Données stockées

Pour chaque utilisateur, les champs suivants sont ajoutés dans Firestore :

```typescript
{
  lastSeenChangelogVersion: "2.0.0",  // Dernière version vue
  lastSeenChangelogDate: Timestamp    // Date de visualisation
}
```

## 🔧 Utilisation du bouton "i"

Le bouton d'information dans la navbar permet aux utilisateurs de :
- Revoir les nouveautés à tout moment
- Accéder à l'aide rapidement
- Découvrir des fonctionnalités qu'ils auraient manquées

**Position** : Entre le bouton "idée" (💡) et les notifications (🔔)

## 🎯 Bonnes pratiques

### Quand incrémenter la version ?

- **Majeure (2.0.0 → 3.0.0)** : Refonte majeure, changements importants
- **Mineure (2.0.0 → 2.1.0)** : Nouvelles fonctionnalités significatives
- **Patch (2.0.0 → 2.0.1)** : Corrections de bugs (généralement pas besoin de popup)

### Contenu de la popup

✅ **À faire :**
- Présenter 4-6 fonctionnalités maximum
- Utiliser des descriptions courtes et claires
- Mettre en avant les bénéfices utilisateur
- Ajouter des indications "Où trouver"

❌ **À éviter :**
- Lister trop de fonctionnalités (dilution du message)
- Utiliser du jargon technique
- Présenter des corrections de bugs mineures
- Oublier d'expliquer où trouver les nouveautés

## 🐛 Dépannage

### La popup ne s'affiche pas

1. Vérifiez que l'utilisateur est connecté
2. Vérifiez la console pour les erreurs
3. Testez avec un nouvel utilisateur
4. Vérifiez que `CURRENT_VERSION` a bien été changée

### Forcer l'affichage pour un utilisateur

Dans la console Firebase, supprimez le champ `lastSeenChangelogVersion` du document utilisateur.

### Tester localement

```javascript
// Dans la console du navigateur
localStorage.clear(); // Vider le cache local
// Puis se reconnecter
```

## 📝 Exemple de workflow

1. **Développement** : Vous avez terminé 5 nouvelles fonctionnalités
2. **Préparation** : Mettez à jour `ChangelogDialog.tsx` avec les 5 fonctionnalités
3. **Version** : Changez `CURRENT_VERSION` de "2.0.0" à "2.1.0"
4. **Déploiement** : Déployez votre application
5. **Résultat** : Tous les utilisateurs voient la popup à leur prochaine connexion
6. **Suivi** : Les utilisateurs peuvent la retrouver via le bouton "i"

## 🎉 Résultat

Une magnifique popup qui :
- Informe les utilisateurs des nouveautés
- Augmente l'adoption des fonctionnalités
- Améliore l'expérience utilisateur
- Réduit les demandes de support

---

**Créé avec ❤️ pour JS Connect**

