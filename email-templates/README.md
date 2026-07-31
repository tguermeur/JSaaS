# Templates EmailJS — JS Connect (max 6 slots)

## Répartition des 6 slots

| # | Nom EmailJS | Template ID | Fichier |
|---|-------------|-------------|---------|
| 1 | Notification JS Connect | `template_q592uap` | `generic-notification.html` |
| 2 | Signature *(optionnel)* | `template_qcy6y05` | `signatures-notification.html` |
| 3 | Mail ambassadeurs | `template_9lubcyf` | `ambassador-invite.html` |
| 4 | Nouveau salon ambassadeur | `template_bvef69c` | `ambassador-event-announcement.html` |
| 5 | Password Reset | `template_5s077im` | `js-connect-password-reset.html` |
| 6 | *(libre)* | — | — |

> **Mails signature** : passent par le slot **Signature** (`template_qcy6y05` / secret `EMAILJS_TEMPLATE_ID_SIGNATURE`). Fallback générique si le secret est vide.

## Affichage HTML (critique) — template à modifier : **Signature**

Dans EmailJS, ouvre **Signature** (`template_qcy6y05`) et :

1. Colle le contenu de [`signatures-notification.html`](signatures-notification.html) (ou au minimum)
2. Remplace `{{body_html}}` par **`{{{body_html}}}`** (3 accolades)
3. Subject du template : `{{subject}}`
4. **From Name** : `{{from_name}}` → affichera « Jobencia Service » (pas « gestion »)
5. **From Email** : laisse `gestion@js-connect.fr` (adresse technique du service)
6. Variables : `to_email`, `subject`, `from_name`, `structure_name`, `header_title`, `header_subtitle`, `body_html`, `cta_label`, `cta_link`

Avec 2 accolades, Gmail affiche littéralement `<br />` et `<strong>`.

## Anti-spam / délivrabilité

Côté code : sujets plus clairs, corps transactionnel, préheader, footer d’identité.

Côté DNS (obligatoire pour sortir des spams) pour le domaine d’envoi (`js-connect.fr` / `gestion@js-connect.fr`) :

1. **SPF** : enregistrement TXT autorisant EmailJS (voir doc EmailJS → Domains)
2. **DKIM** : clé fournie par EmailJS à ajouter en TXT
3. **DMARC** : ex. `v=DMARC1; p=none; rua=mailto:gestion@js-connect.fr`
4. Vérifier le domaine dans EmailJS (Account → Sending domains) jusqu’au statut « verified »

Sans SPF/DKIM alignés sur `js-connect.fr`, Gmail classera souvent en spam même si le HTML est correct.


Les mails partent **depuis le serveur** (Firebase Functions). Dans EmailJS :

1. [Account → Security](https://dashboard.emailjs.com/admin/account/security)
2. Activer **Allow EmailJS API for non-browser applications** (API access from non-browser environments)

Sans cette option, l’audit trail affiche `email_failed` avec le message  
`API access from non-browser environments is currently disabled`.

Vérifier aussi que `EMAILJS_SERVICE_ID`, `EMAILJS_USER_ID`, `EMAILJS_PRIVATE_KEY` et `EMAILJS_TEMPLATE_ID_GENERIC` sont bien définis en secrets Functions, et que `FRONTEND_URL` pointe vers `https://js-connect.fr` (liens de signature).

À **supprimer** dans EmailJS (plus nécessaires) :
- Mail démarchage 1 → passe par le générique
- Demande proposition commerciale → passe par le générique

## Variables générique / signatures

Même HTML et mêmes variables :

`to_email`, `subject`, `header_title`, `header_subtitle`, `body_html`, `cta_label`, `cta_link`

- **To Email** : `{{to_email}}`
- **Subject** : `{{subject}}`

## Secrets / env (branchés)

| Secret / var | Template ID |
|--------------|-------------|
| `EMAILJS_TEMPLATE_ID_GENERIC` / `VITE_EMAILJS_TEMPLATE_ID_GENERIC` | `template_q592uap` |
| `EMAILJS_TEMPLATE_ID_SIGNATURE` / `VITE_EMAILJS_TEMPLATE_ID_SIGNATURE` | `template_qcy6y05` *(optionnel)* |
| `EMAILJS_TEMPLATE_ID_AMBASSADOR` / `VITE_EMAILJS_TEMPLATE_ID_AMBASSADOR` | `template_9lubcyf` |
| `VITE_EMAILJS_TEMPLATE_ID_AMBASSADOR_EVENT_ANNOUNCEMENT` | `template_bvef69c` |
| `EMAILJS_TEMPLATE_ID_PASSWORD_RESET` | `template_5s077im` |

## Logo

```
https://js-connect.fr/images/logo.png?v=2
```

Pas d’attachement EmailJS.
