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
2. **Cache d'actus partagé** — à faire : écrit par le workflow de collecte avec
   un compte de service (secret GitHub `FIREBASE_SERVICE_ACCOUNT`), découpé en
   morceaux de moins de 1 Mo, lu publiquement par la page.
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
