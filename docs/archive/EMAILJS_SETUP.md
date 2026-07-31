# Configurer EmailJS pour les invitations ambassadeurs

Ce guide explique comment configurer EmailJS pour que les **emails d'invitation ambassadeur** (personnes sans compte) soient envoyés automatiquement.

**Important :** les emails sont envoyés **depuis le navigateur** (client) via `@emailjs/browser`, pas depuis les Firebase Functions. EmailJS renvoie **403 "API calls are disabled for non-browser applications"** si on appelle leur API depuis un serveur (Node / Cloud Functions). On n’utilise que la **Public Key** ; la Private Key ne sert pas pour les invitations.

---

## 1. Créer un compte EmailJS

1. Rendez-vous sur **[https://www.emailjs.com/](https://www.emailjs.com/)**
2. Cliquez sur **Sign Up Free**
3. Créez votre compte (email + mot de passe)

---

## 2. Ajouter un service email

Les emails sont envoyés via *votre* service email (Gmail, Outlook, etc.). EmailJS fait le relais.

1. Dans le tableau de bord : **Email Services** → **Add New Service**
   - Lien direct : [https://dashboard.emailjs.com/admin](https://dashboard.emailjs.com/admin)
2. Choisissez un fournisseur, par exemple **Gmail**
3. Renseignez :
   - **Service name** : ex. `Gmail - JS Connect`
   - **Service ID** : laissé par défaut (ex. `service_xxxxx`) ou personnalisé — **notez-le**, c’est `EMAILJS_SERVICE_ID`
4. Pour Gmail :
   - Soit **compte personnel** : connectez-vous via OAuth (popup Google)
   - Soit **App Password** : [mot de passe d’application](https://support.google.com/accounts/answer/185833) si 2FA activée
5. Cliquez sur **Create Service**
6. Utilisez **Test** pour envoyer un email de test et vérifier que ça fonctionne

---

## 3. Créer un template « Invitation Ambassadeur »

1. **Email Templates** → **Create New Template**  
   - [https://dashboard.emailjs.com/admin/templates](https://dashboard.emailjs.com/admin/templates)
2. **Name** : par ex. `Invitation Ambassadeur`
3. **Content** :
   - **To Email** : `{{to_email}}` (le destinataire invité)
   - **Subject** : `{{subject}}` ou en dur : `Invitation à devenir Ambassadeur - JS Connect`
   - **Content** (corps du message) : utilisez du **HTML** (recommandé). Un template prêt à l’emploi est dans **`scripts/emailjs-template-ambassador-invite.html`** — copiez tout le HTML dans le champ Content du template EmailJS. Sinon, version texte simple :

```text
Bonjour,

Vous êtes invité(e) à rejoindre le programme Ambassadeurs de JS Connect.

Pour créer votre compte et accepter l'invitation, cliquez sur le lien ci-dessous :

{{registration_link}}

À bientôt,
L'équipe JS Connect
```

4. **Settings** (à droite) :
   - **Email Service** : sélectionnez le service créé à l’étape 2
5. **Save** le template
6. Notez le **Template ID** (ex. `template_xxxxx`) → c’est `EMAILJS_TEMPLATE_ID` (ou `EMAILJS_TEMPLATE_ID_AMBASSADOR` si vous utilisez un template dédié)

**Variables utilisées par le code :**

| Variable            | Description                                      |
|---------------------|--------------------------------------------------|
| `{{to_email}}` ou `{{email}}` | **To Email** : adresse du destinataire (invité). Le code envoie les deux ; utilisez l’un ou l’autre dans le champ **To Email** du template. |
| `{{registration_link}}` | Lien d’inscription avec `?ambassador=true&email=...` |
| `{{subject}}`       | Objet (optionnel si vous mettez un sujet fixe)   |

**Important :** si vous avez « The recipients address is empty » (422), le champ **To Email** du template doit contenir `{{to_email}}` ou `{{email}}`, et non un objet vide ou une autre variable.

---

## 4. Récupérer la Public Key (User ID)

1. **Account** → **API Keys** (ou **General** selon l’interface)  
   - [https://dashboard.emailjs.com/admin](https://dashboard.emailjs.com/admin)
2. Notez la **Public Key** (User ID) → `VITE_EMAILJS_USER_ID`

Pour les **invitations ambassadeurs**, on n’utilise **que la Public Key** côté navigateur. La Private Key n’est pas nécessaire pour ce flux.

---

## 5. Configurer le projet

### 5.1 Fichier `.env` (à la racine du projet)

Les variables **`VITE_*`** sont exposées au frontend (Vite). Ajoutez ou complétez :

```env
# EmailJS – Invitations ambassadeurs (envoi depuis le navigateur)
VITE_EMAILJS_USER_ID= votre_public_key
VITE_EMAILJS_SERVICE_ID=service_xxxxx
VITE_EMAILJS_TEMPLATE_ID_AMBASSADOR=template_yyyyy

# Base URL de l’app (lien d’inscription dans l’email). Ex. https://js-connect.fr
VITE_APP_URL=https://votre-domaine.com
```

Remplacez par vos valeurs (Public Key, Service ID, Template ID ambassadeur, URL de l’app).

**Important :** ne commitez jamais `.env`. Il doit rester dans `.gitignore`.

### 5.2 (Optionnel) Secrets Firebase Functions

Les **invitations ambassadeurs** n’utilisent plus la Cloud Function `sendAmbassadorInvite` ni les secrets Firebase pour EmailJS. Si vous avez d’autres usages (ex. formulaire Contact via Functions), conservez les secrets comme décrit dans [CONFIGURER_SECRETS_FIREBASE.md](./CONFIGURER_SECRETS_FIREBASE.md).

---

## 6. Build et déploiement du frontend

Aucun déploiement de Functions n’est requis pour les invitations ambassadeurs. Assurez-vous que le **frontend** est buildé et déployé avec les variables `VITE_*` correctes (elles sont injectées au build par Vite).

```bash
npm run build
# Puis déployer le résultat (Firebase Hosting, etc.)
```

---

## 7. Tester l’invitation ambassadeur

1. Aller sur **Ambassadeurs** → **Ajouter un Ambassadeur**
2. Saisir un **email qui n’a pas encore de compte**
3. Envoyer l’invitation

Si tout est correct :
- L’invitation est enregistrée (comportement actuel même sans EmailJS)
- Un email est envoyé à cet adresse avec le lien `{{registration_link}}`

En cas d’erreur :
- Ouvrir la **console navigateur** (F12) et vérifier les logs / erreurs réseau
- Vérifier que `VITE_EMAILJS_USER_ID`, `VITE_EMAILJS_SERVICE_ID`, `VITE_EMAILJS_TEMPLATE_ID_AMBASSADOR` et `VITE_APP_URL` sont bien définis dans `.env` et que le frontend a été **rebuilt** après modification
- Tester le service et le template depuis le dashboard EmailJS

---

## 8. Dépannage

| Problème | Pistes |
|----------|--------|
| `EmailJS non configuré` | Vérifier les variables `VITE_EMAILJS_*` et `VITE_APP_URL` dans `.env`, puis `npm run build`. |
| **403 "API calls are disabled for non-browser applications"** | L’envoi se fait maintenant **côté client** via `@emailjs/browser`. Ne pas appeler l’API EmailJS depuis une Cloud Function. |
| `The Public Key is invalid` | Vérifier que `VITE_EMAILJS_USER_ID` correspond exactement à la Public Key du dashboard EmailJS (pas d’espace ni de saut de ligne). |
| **422 (Unprocessable Entity)** | Le message exact s’affiche dans le popup. « The recipients address is empty » → le champ **To Email** du template doit être `{{to_email}}` ou `{{email}}` (pas vide). Sinon, vérifier **Subject** = `{{subject}}`, corps avec `{{registration_link}}`, et que Service/Template ID correspondent. |
| Email non reçu | Vérifier les spams, les limites du service email (ex. Gmail), et les logs EmailJS. |
| Mauvais lien d’inscription | Vérifier `VITE_APP_URL` (URL de prod, ex. `https://js-connect.fr`). |

---

## 9. Formulaire de contact (optionnel)

Le formulaire **Contact** peut utiliser le **même** service EmailJS avec un **autre template** (variables : `from_company`, `from_email`, `message`, `to_email`). Voir `sendContactEmail` dans `functions/src/index.ts` et la doc [CONFIGURER_SECRETS_FIREBASE.md](./CONFIGURER_SECRETS_FIREBASE.md) pour les détails.

---

## Résumé des variables (invitations ambassadeurs, côté client)

| Variable | Où la trouver | Utilisation |
|----------|----------------|-------------|
| `VITE_EMAILJS_USER_ID` | Account → API Keys → **Public Key** | Envoi depuis le navigateur |
| `VITE_EMAILJS_SERVICE_ID` | Email Services → votre service | Service d’envoi |
| `VITE_EMAILJS_TEMPLATE_ID_AMBASSADOR` | Template « Invitation Ambassadeur » | Template utilisé |
| `VITE_APP_URL` | URL de l’app (ex. `https://js-connect.fr`) | Lien `{{registration_link}}` dans l’email |

Une fois ces éléments en place, les invitations ambassadeurs pourront être envoyées par email automatiquement depuis le navigateur.

---

## 10. Nouveaux templates transactionnels (2026)

HTML prêts à coller dans EmailJS : dossier **[`email-templates/`](email-templates/)** (+ [`email-templates/README.md`](email-templates/README.md)).

**DA** : même design que `ambassador-invite.html` (dégradé `#173B6C → #21BDA3`).

Ces emails sont envoyés **depuis les Cloud Functions** (Private Key EmailJS), pas depuis le navigateur. Après création des templates dans EmailJS, renseigner les secrets Firebase :

```
EMAILJS_TEMPLATE_ID_MEMBER_INVITE
EMAILJS_TEMPLATE_ID_WELCOME
EMAILJS_TEMPLATE_ID_MISSION_ACCEPTED
EMAILJS_TEMPLATE_ID_MISSION_REJECTED
EMAILJS_TEMPLATE_ID_MISSION_ASSIGNED
EMAILJS_TEMPLATE_ID_EXPENSE_REJECTED
EMAILJS_TEMPLATE_ID_AMBASSADOR_RESULT
EMAILJS_TEMPLATE_ID_TRIAL_ENDING
EMAILJS_TEMPLATE_ID_PAYMENT_FAILED
EMAILJS_TEMPLATE_ID_COTISATION_DUE
EMAILJS_TEMPLATE_ID_COTISATION_PAID
EMAILJS_TEMPLATE_ID_DOCUMENT_TO_SIGN
EMAILJS_TEMPLATE_ID_SIGNATURE_COMPLETED
EMAILJS_TEMPLATE_ID_ETUDE_ASSIGNED
```

Tant qu’un ID est vide, l’envoi email est **skipped** (les notifs in-app fonctionnent).

Le formulaire **Contact** (`/contact`) utilise désormais la CF `sendContactEmail` (comme la homepage).

