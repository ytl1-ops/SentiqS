# Bascule Supabase → Firebase (plan gratuit Spark)

Décision du 21/10/2026 : rester gratuit, sans carte bancaire et sans SMTP.
Projet Firebase : **SentiqS** (`sentiqs-235ce`), base Firestore en
`europe-west1` (Belgique).

## Ce que le plan gratuit permet, et ce qu'il interdit

| | Spark (gratuit) | Conséquence |
|---|---|---|
| E-mails de connexion par lien | **5 par jour** pour tout le projet | d'où Google et le mot de passe en secours |
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
3. **Agenda, configuration, corpus** — à faire, même méthode.

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
