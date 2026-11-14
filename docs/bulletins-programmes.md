# Bulletins programmés — ce qu'il faut brancher

Demande de YORO du 14/11/2026 : programmer des bulletins sur des pays précis,
envoyés automatiquement par e-mail, Telegram ou WhatsApp à des horaires choisis.

## Comment ça marche

1. **Paramètres > Bulletins programmés** : l'utilisateur choisit jusqu'à cinq
   pays, quatre heures par jour, les jours, son fuseau, la langue (FR ou EN)
   et les canaux. La programmation est écrite dans Firestore
   (`bulletins_programmes/<uid>`).
2. **La collecte** (`collecte-planifiee.yml`) écrit à chaque passage un
   instantané des 54 pays (`bulletins_instantanes/courant`) : niveau,
   confiance, faits notables cotés, lien vers le bulletin complet.
3. **L'envoi** (`envoi-bulletins.yml`, toutes les 15 minutes, sans
   navigateur) envoie chaque créneau échu et écrit ce qu'il a fait
   (`bulletins_etat/<uid>`), que Paramètres affiche.

Règles, créneaux et texte du message : `web/js/bulletin-message.js`, partagé
par la page et le job (l'aperçu de Paramètres est le message qui partira).

## Forfaits

| Forfait | Programmations |
|---|---:|
| Découverte (gratuit, 72 h) | 0 |
| Particulier | 1 |
| Professionnel Sûreté | 5 |
| Institution / International | 20 |

Les règles Firestore et le job relisent le forfait dans le **profil**, qu'un
utilisateur ne peut pas modifier lui-même.

## Consentement et données personnelles

- L'adresse du compte reçoit directement.
- Toute autre adresse reçoit **une seule** demande d'accord, au nom du
  titulaire du compte ; rien d'autre sans son « J'accepte »
  (`web/abonnement.html`). Un refus ou un désabonnement est définitif pour ce
  compte. Chaque bulletin porte un lien de désabonnement (et l'en-tête
  `List-Unsubscribe`).
- Telegram : un robot ne peut écrire qu'à qui l'a ouvert (`/start`) ; `/stop`
  détache la conversation.
- WhatsApp : l'utilisateur atteste l'accord des titulaires des numéros.
- Les journaux GitHub Actions (publics) ne montrent ni adresse ni numéro en clair.

## Ce que l'éditeur doit fournir (Settings > Secrets and variables > Actions)

Rien n'est obligatoire pour fusionner : sans secret, le job note ce qui serait
parti et l'état avance (pas d'arriéré déversé au branchement).

| Canal | Secrets | Coût | Où l'obtenir |
|---|---|---|---|
| Lecture des programmations | `FIREBASE_SERVICE_ACCOUNT` (déjà utilisé par la collecte) | gratuit | déjà en place |
| E-mail (recommandé : Brevo) | `SMTP_HOTE=smtp-relay.brevo.com`, `SMTP_PORT=587`, `SMTP_UTILISATEUR`, `SMTP_MOT_DE_PASSE` (clé SMTP), `SMTP_EXPEDITEUR` (adresse vérifiée chez Brevo) | gratuit, 300 e-mails/jour | brevo.com > SMTP & API |
| E-mail (variante Gmail) | `SMTP_HOTE=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_UTILISATEUR` (adresse Gmail), `SMTP_MOT_DE_PASSE` (mot de passe d'application, validation en deux étapes requise) | gratuit, ~500/jour | myaccount.google.com > Sécurité > Mots de passe des applications |
| Telegram | `TELEGRAM_BOT_TOKEN` | gratuit | @BotFather > /newbot (nom suggéré : SentiqS Bulletins) |
| WhatsApp (facultatif) | `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE` | **payant** au message (modèle « Utilitaire »), compte Meta Business et numéro dédié | developers.facebook.com > WhatsApp > Cloud API |

Modèle WhatsApp à faire approuver (catégorie Utilitaire, FR et EN), quatre
variables dans cet ordre : `{{1}}` pays, `{{2}}` niveau, `{{3}}` nombre de
faits notables, `{{4}}` lien du bulletin. Exemple FR : « SentiqS — Bulletin
{{1}} : niveau {{2}}, {{3}} fait(s) notable(s). Détail : {{4}} ».

Tant que WhatsApp n'est pas branché, la page oriente vers les **rappels
WhatsApp en un clic**, gratuits (Paramètres > Canaux de partage).

## Après avoir posé les secrets

Lancer **Actions > Envoi des bulletins programmés > Run workflow** : le journal
dit « Canaux : e-mail oui, Telegram oui… ». Paramètres affiche alors « activé »
pour chaque canal branché.

Les règles Firestore (`firebase/firestore.rules`) sont publiées par le job
`firebase` de `gh-pages-deploy.yml` au déploiement.

## Limites connues

- GitHub retarde souvent les tâches planifiées : un envoi part au premier
  passage qui suit l'heure choisie (souvent dans le quart d'heure, parfois
  plus). Un créneau de plus de trois heures de retard est abandonné plutôt
  qu'envoyé périmé.
- Les données ont l'âge du dernier passage de la collecte (3 à 6 heures en
  pratique) ; le message dit l'heure de la collecte.
