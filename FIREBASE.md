# Bascule Supabase → Firebase (plan gratuit Spark)

Décision du 21/10/2026 : rester gratuit, sans carte bancaire et sans SMTP.
Projet Firebase : **SentiqS** (`sentiqs-235ce`), base Firestore en
`europe-west1` (Belgique).

## Ce que le plan gratuit permet, et ce qu'il interdit

| | Spark (gratuit) | Conséquence |
|---|---|---|
| E-mails de connexion par lien | **5 par jour** pour tout le projet | d'où le code par Apps Script (100/jour), Google et le mot de passe |
| E-mails de réinitialisation | 150 par jour | suffisant |
| Connexion Google | sans limite | porte principale sans mot de passe |
| Cloud Functions | **non disponibles** | `publier-collecte`, `autoriser-export`, `rag-ask`, paiements restent sur Supabase ou s'arrêtent |
| Document Firestore | 1 Mo au plus | le cache d'actus (1,4 Mo) devra être découpé |
| Firestore | 50 000 lectures, 20 000 écritures par jour | suffisant pour le pilote |

Source : documentation Firebase « Authentication limits », lue le 21/10/2026.

## Étapes

1. **Connexion et comptes** — fait (PR « Firebase : connexion »). Lien e-mail,
   Google et mot de passe ; profils et journal des connexions dans Firestore.
   Le cache d'actus, l'agenda et la configuration partagée restent sur
   Supabase (`getClientDonnees()`), qui reste gratuit pour eux.
2. **Cache d'actus partagé** — construit le 30/10/2026 (Supabase avait dépassé
   son quota de transfert le 27/10, erreur 402). Écrit par le workflow de
   collecte avec un compte de service (secret GitHub
   `FIREBASE_SERVICE_ACCOUNT`), lu publiquement par la page. Format : JSON
   compressé (gzip) puis base64, découpé en morceaux de 700 000 caractères
   (`collecte_partagee/global_<a|b>_<n>`), annoncé par `collecte_partagee/global`.
   Deux emplacements alternés : une publication interrompue laisse l'ancien
   cache intact. La page ne retélécharge les morceaux que si l'annonce a
   changé (copie dans localStorage). Code : `web/js/cache-firestore.js`
   (commun), `scripts/lib/cache-firestore-ecriture.js` (job).
   **Tant que le secret n'est pas posé, rien ne change** : le job publie sur
   Supabase et la page lit Supabase.
   À faire par le propriétaire : (a) console Firebase > Paramètres du projet >
   Comptes de service > Générer une nouvelle clé privée ; (b) GitHub >
   Settings > Secrets and variables > Actions > secret `FIREBASE_SERVICE_ACCOUNT`
   = tout le contenu du JSON ; (c) supprimer le fichier téléchargé ; (d) recoller
   `firebase/firestore.rules` dans Firestore > Règles (lecture publique de
   `collecte_partagee`) ; (e) relancer la collecte.
   Quotas Spark à surveiller : 50 000 lectures par jour (un visiteur = 1 lecture
   si rien n'a changé, 2 à 4 sinon) et 10 Go de transfert par mois.
   **État au 01/11/2026** : le secret est posé, mais chaque collecte reçoit
   « Firestore HTTP 403 » à l'écriture, et la lecture publique aussi
   (« Missing or insufficient permissions »). Deux causes, toutes deux dans la
   console : les règles publiées ne contiennent pas encore `collecte_partagee`,
   et le compte de service n'a pas de rôle IAM sur Firestore. Voir
   « Déployer » ci-dessous ; `scripts/diagnostic-firebase.js` dit laquelle
   des deux manque.
3. **Agenda** — fait le 01/11/2026 : même format, clé `agenda`
   (`collecte_partagee/agenda`), écrit par le job après le cache d'actus
   (`scripts/lib/agenda-firestore.js` fusionne par id sur 7 jours, 500 au
   plus), lu par la page avant Supabase. Une fois Firestore utilisé, le job ne
   sollicite plus Supabase (402) pour l'agenda ni pour le corpus RAG.
4. **Hébergement** — fait le 01/11/2026 : `firebase.json` sert `web/` sur
   Firebase Hosting (`https://sentiqs-235ce.web.app`), publié avec les règles
   Firestore par le job `firebase` de `.github/workflows/gh-pages-deploy.yml`
   à chaque push sur `main` et après chaque archive de la collecte. GitHub
   Pages continue d'être publié en parallèle : c'est le repli, et l'adresse que
   lit le job de collecte.
5. **Non migré, volontairement** : la configuration EmailJS partagée
   (`config_partagee` ; Firebase envoie lui-même les e-mails de connexion) et
   le corpus de l'Assistant IA (`articles_rag`, qui suppose une fonction Edge :
   pas de Cloud Functions sur Spark). Tous deux échouent sans bloquer la page.

## Déployer (à faire une fois par le propriétaire)

1. **Rôle du compte de service.** Google Cloud console > projet
   `sentiqs-235ce` > IAM et administration > IAM > la ligne
   `firebase-adminsdk-…@sentiqs-235ce.iam.gserviceaccount.com` > crayon >
   Ajouter un autre rôle : **Administrateur Firebase** (`roles/firebase.admin`)
   et **Consommateur Service Usage** (`roles/serviceusage.serviceUsageConsumer`)
   > Enregistrer. C'est ce qui manque derrière le 403 de la collecte, et ce qui
   permet au workflow de publier l'hébergement et les règles.
2. **Secret GitHub** `FIREBASE_SERVICE_ACCOUNT` : déjà posé. Si le diagnostic
   dit que la clé vient d'un autre projet, en regénérer une (console Firebase >
   Paramètres du projet > Comptes de service > Générer une nouvelle clé
   privée), la recoller dans le secret, supprimer le fichier.
3. **Relancer** Actions > « Déploiement GitHub Pages » > Run workflow. Le job
   `firebase` publie les règles (plus de copier-coller) et le site sur
   `https://sentiqs-235ce.web.app`. Son étape « Diagnostic » dit en clair ce
   qui reste refusé.
4. **Relancer la collecte** (Actions > « Collecte planifiée » > Run workflow) :
   le journal doit dire « Cache Firestore publié » puis « Agenda Firestore
   publié ».
5. **Domaine personnalisé** (facultatif) : Hosting > Ajouter un domaine
   personnalisé, puis les enregistrements DNS chez le registraire ; ajouter
   ensuite ce domaine dans Authentication > Paramètres > Domaines autorisés.
   `sentiqs-235ce.web.app` et `.firebaseapp.com` y sont autorisés d'office.

Quotas Hosting du plan Spark : 10 Go stockés, 360 Mo transférés par jour
(la page fait ~1,8 Mo, ~450 Ko compressée).

## Code de connexion pour toute adresse e-mail (01/11/2026)

Demande de YORO : se connecter avec n'importe quelle adresse, par un **code
de vérification**. Firebase n'a pas de code pour l'e-mail, seulement un lien,
5 par jour pour tout le projet sur Spark — et ce lien casse sur les
messageries d'entreprise (scanner de liens qui l'ouvre avant l'utilisateur,
application de messagerie qui l'ouvre dans son propre navigateur, expéditeur
`noreply@…firebaseapp.com` en indésirables). Le 01/11/2026, l'API
d'envoi du lien répondait pourtant « envoyé » (sonde faite vers l'adresse du
propriétaire) : la panne vue par l'utilisateur est en aval, côté livraison et
ouverture du lien, ce que le code de la page ne peut pas réparer.

**La voie gratuite retenue : un script Google Apps Script**
(`firebase/code-connexion/Code.gs`), hébergé gratuitement par Google sous le
compte du propriétaire. Il tire un code à 6 chiffres, l'envoie par Gmail
(100 destinataires par jour pour un compte Gmail gratuit), puis, au bon code,
retrouve ou crée le compte Firebase de l'adresse et renvoie un **jeton
personnalisé** signé par le compte de service. La page l'échange contre une
session Firebase ordinaire : profils, règles, rôle admin et essai de 72 h
inchangés, et une adresse déjà connue (Google, mot de passe) retrouve le même
compte. Ni Cloud Functions, ni carte bancaire, ni fournisseur d'e-mail tiers.
Google et le mot de passe restent proposés.

Tant que `window.SENTIQ_CODE_CONNEXION_URL` est vide dans
`web/js/firebase-config.js`, rien ne change : la page garde le lien Firebase.

### À faire une fois par le propriétaire (10 minutes)

L'e-mail du code partira **de l'adresse Gmail qui déploie le script** : la
choisir en conséquence (une adresse dédiée, par exemple, ou celle de la
console).

1. **Clé du compte de service** : console Firebase > projet `sentiqs-235ce` >
   Paramètres du projet > Comptes de service > « Générer une nouvelle clé
   privée ». Un fichier JSON se télécharge.
2. **Créer le script** : https://script.google.com > Nouveau projet > le
   renommer « SentiqS code de connexion » > remplacer tout le contenu de
   `Code.gs` par celui de `firebase/code-connexion/Code.gs` > Enregistrer.
3. **Poser la clé** : roue « Paramètres du projet » (à gauche) > Propriétés
   du script > Ajouter une propriété : nom `COMPTE_SERVICE`, valeur = **tout**
   le contenu du fichier JSON. Enregistrer, puis **supprimer le fichier**
   téléchargé. Facultatif : `NOM_EXPEDITEUR` (défaut « SentiqS »),
   `QUOTA_JOUR` (défaut 90).
4. **Déployer** : Déployer > Nouveau déploiement > roue « Type » >
   Application Web ; « Exécuter en tant que : Moi » ; « Qui a accès : Tout le
   monde » > Déployer > Autoriser l'accès. Google affiche « Google n'a pas
   validé cette application » (c'est votre propre script) : Paramètres avancés
   > Accéder à SentiqS code de connexion > Autoriser (envoi d'e-mails en votre
   nom, connexion à un service externe).
5. **Copier l'adresse** de l'application Web (elle finit par `/exec`) et
   l'ouvrir dans un navigateur : elle doit répondre `"pret":true`. Cette
   adresse n'est pas un secret : la coller dans
   `window.SENTIQ_CODE_CONNEXION_URL` de `web/js/firebase-config.js` (ou la
   transmettre à Claude), puis publier.

Aucun secret GitHub ni réglage de la console Firebase de plus n'est
nécessaire. Modifier le script plus tard : Déployer > Gérer les déploiements >
crayon > Version : nouvelle version (l'adresse ne change pas).

Garde-fous du script : 1 envoi par minute et 5 par heure par adresse, plafond
quotidien global, 5 essais par code, 10 minutes de validité, usage unique,
seule l'empreinte du code est gardée. Journal d'exécution : éditeur Apps
Script > Exécutions.

## Réglages faits dans la console (21/10/2026)

- Authentication : e-mail/mot de passe, lien e-mail sans mot de passe, Google ;
  domaine autorisé `ytl1-ops.github.io`.
- Firestore : mode production (tout fermé), puis règles de
  `firebase/firestore.rules` publiées.
- Application web « SentiqS Web » : sa configuration publique est dans
  `web/js/firebase-config.js`. Remettre `null` ramène la connexion sur Supabase.

## À savoir

- **Les comptes Supabase ne sont pas repris.** Chacun recrée son compte au
  premier passage (lien e-mail ou Google) ; l'essai de 72 h repart de ce jour.
- **Administrateurs** : yorot225@gmail.com et a3fyee@gmail.com (21/10/2026), vérifiées, inscrites dans les règles,
  reçoivent le rôle admin. Toute autre adresse entre comme utilisateur.
- Si les règles changent dans le dépôt, les recoller dans la console
  (Firestore > Règles) ou `firebase deploy --only firestore:rules`.
