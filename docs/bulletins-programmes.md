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
- WhatsApp : l'utilisateur atteste l'accord des titulaires des numéros (règle
  de Meta, dont il est l'expéditeur en titre avec son propre compte).
- Les journaux GitHub Actions (publics) ne montrent ni adresse ni numéro en clair.

## Chacun apporte son compte (décisions de YORO du 14/11/2026)

**WhatsApp** : aucun compte WhatsApp Business côté SentiqS. Chaque utilisateur
qui le veut crée le sien chez Meta et saisit dans Paramètres > Bulletins
programmés > « Mon compte WhatsApp Business » : l'identifiant du numéro, un
jeton permanent (utilisateur système) et le nom de son modèle. Les bulletins
partent de **son** numéro, facturés par Meta sur **son** compte. Le guide pas
à pas est dans la page (FR et EN). Essai : modèle `hello_world`, présent sur
tout compte neuf.

**E-mail** : l'utilisateur choisit les adresses qui **reçoivent** (dans chaque
programmation) et peut désigner l'adresse qui **envoie** (« Mon adresse
d'envoi e-mail » : Gmail avec mot de passe d'application, Brevo, messagerie
d'entreprise). À défaut, le serveur de l'éditeur sert s'il en a posé un.

**Sécurité des identifiants apportés.** Le jeton Meta et le mot de passe SMTP
sont chiffrés **dans le navigateur** (AES-256-GCM, clé enveloppée en RSA-OAEP
avec la clé publique du compte de service, publiée par le job dans
`bulletins_etat/_canaux.clePublique`) avant d'être écrits dans
`whatsapp_comptes/<uid>` et `smtp_comptes/<uid>`. Seul le job, qui détient la
clé privée (secret `FIREBASE_SERVICE_ACCOUNT`), les relit. Les règles
Firestore refusent toute lecture depuis un navigateur, y compris par leur
auteur : on remplace ou on supprime, on ne relit jamais. Aucune erreur ni
journal ne cite le secret (`scripts/lib/identifiants-envoi.js`, `nettoyer`).

Risque résiduel, à connaître : qui obtiendrait la clé du compte de service
(secret GitHub) pourrait déchiffrer ces identifiants — mais il aurait déjà
tout accès à la base. Conseil donné aux utilisateurs : un jeton Meta limité à
`whatsapp_business_messaging` / `whatsapp_business_management`, un mot de
passe d'application (jamais le mot de passe principal), révocables à tout
moment. Si la clé du compte de service change, les identifiants enregistrés
deviennent illisibles : Paramètres affiche « à ressaisir », rien ne part au
hasard.

## Ce que l'éditeur peut fournir (Settings > Secrets and variables > Actions)

Rien n'est obligatoire : sans secret, le job note ce qui serait parti et
l'état avance (pas d'arriéré déversé au branchement).

| Canal | Secrets | Coût | Où l'obtenir |
|---|---|---|---|
| Lecture des programmations | `FIREBASE_SERVICE_ACCOUNT` (déjà utilisé par la collecte) | gratuit | déjà en place |
| E-mail de secours, pour les comptes sans adresse d'envoi (facultatif) | `SMTP_HOTE`, `SMTP_PORT`, `SMTP_UTILISATEUR`, `SMTP_MOT_DE_PASSE`, `SMTP_EXPEDITEUR` | gratuit (Brevo 300/jour, Gmail ~500/jour) | brevo.com > SMTP & API |
| Telegram | `TELEGRAM_BOT_TOKEN` | gratuit | @BotFather > /newbot |
| WhatsApp | aucun : chaque utilisateur apporte son compte | payé par l'utilisateur à Meta | guide dans Paramètres |

Modèle WhatsApp que chaque utilisateur fait approuver (catégorie Utilitaire),
quatre variables dans cet ordre : `{{1}}` pays, `{{2}}` niveau, `{{3}}`
nombre de faits notables, `{{4}}` lien du bulletin. Texte FR : « Bulletin
sûreté {{1}} : niveau {{2}}, {{3}} fait(s) notable(s). Détail : {{4}} ».

Sans compte WhatsApp, la page oriente vers les **rappels WhatsApp en un
clic**, gratuits (Paramètres > Canaux de partage).

## Après avoir posé les secrets

Lancer **Actions > Envoi des bulletins programmés > Run workflow** : le journal
dit « Canaux de l'éditeur : e-mail oui, Telegram oui ». Paramètres affiche
l'état de chaque canal, le dernier passage du service et, pour un compte
apporté, le résultat de son essai.

Les règles Firestore (`firebase/firestore.rules`) sont publiées par le job
`firebase` de `gh-pages-deploy.yml` au déploiement.

## Limites connues

- GitHub retarde souvent les tâches planifiées : un envoi part au premier
  passage qui suit l'heure choisie (souvent dans le quart d'heure, parfois
  plus). Un créneau de plus de trois heures de retard est abandonné plutôt
  qu'envoyé périmé.
- Les données ont l'âge du dernier passage de la collecte (3 à 6 heures en
  pratique) ; le message dit l'heure de la collecte.
