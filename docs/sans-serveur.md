# SentiqS sans serveur : comment l'appli tourne, et quoi faire si un service tombe

Mis à jour le 22/11/2026. Demande de YORO : « je n'ai pas de serveur, trouvez
une solution pour faire tourner l'appli sur Google Drive, sur mon PC, sur
mobile ou autre ».

## 1. Ce qui tourne aujourd'hui (aucun serveur à louer ni à entretenir)

| Rôle | Service gratuit | État au 22/11/2026 |
|---|---|---|
| Héberger la page | GitHub Pages : `ytl1-ops.github.io/SentiqS/SentiqS_Web.html` | en ligne, publié à chaque modification |
| Miroir de secours | Firebase Hosting : `sentiqs-235ce.web.app/SentiqS_Web.html` | en ligne, publié par le même workflow |
| Comptes, profils, cache d'actus | Firebase (plan gratuit Spark) | en service |
| Collecte, traduction, bulletins, archive | GitHub Actions | collecte réussie (5 passages du 21 au 22/11) |

L'appli est une page web statique : un navigateur suffit, sur PC comme sur
téléphone. Les « serveurs » sont ceux de GitHub et de Google, gratuits.

### Limites réelles

- **GitHub Actions** : le dépôt est public, les minutes sont donc gratuites
  et illimitées. GitHub désactive les tâches planifiées d'un dépôt public
  sans activité depuis 60 jours ; la collecte commite l'archive chaque jour,
  ce cas ne se présente pas tant qu'elle tourne. La cadence réelle reste
  de 3 à 5 heures, pas 30 minutes (voir CLAUDE.md, « Collecte planifiée »).
- **Taille du dépôt** : 312 Mo et elle grossit. Le rapport mensuel (PowerPoint,
  Word, PDF, ~24 Mo) est réécrit chaque jour et chaque version reste dans
  l'historique : environ 24 Mo par jour, soit ~700 Mo par mois. GitHub
  recommande de rester sous 1 Go et bloque au-delà de 5 Go. **C'est la
  limite qui arrivera la première** (voir « À décider » plus bas).
- **Firebase Spark** : 50 000 lectures et 20 000 écritures par jour,
  10 Go de sortie Firestore par mois, 360 Mo par jour de transfert pour le
  miroir. Chaque ouverture de l'appli lit le cache d'actus (~1,5 Mo) :
  environ 6 000 ouvertures par mois avant la limite de sortie.
- **Rien ne dépend d'un PC allumé** : tout tourne chez GitHub et Google.

## 2. Consulter sans Internet : la version hors ligne

Menu **Plus → Version hors ligne** (forfaits payants et administrateur).
L'appli télécharge **un seul fichier** `SentiqS-hors-ligne-AAAA-MM-JJ-HHhMM.html`
(~4 Mo) qui contient la page, les actus du moment, l'archive des niveaux,
l'agenda et la police d'icônes.

- **PC** : double-clic sur le fichier, il s'ouvre dans le navigateur, sans
  réseau. Tous les modules marchent : Flux, Alertes, tableau de bord,
  Synthèse, Agenda, assistant. Les exports Word, PDF et PowerPoint
  demandent Internet (leurs bibliothèques viennent d'un CDN) ; l'aperçu
  imprimable marche hors ligne.
- **Google Drive, clé USB, pièce jointe** : y déposer le fichier. Drive
  n'affiche pas une page web : il faut **télécharger** le fichier puis
  l'ouvrir. Google Drive n'héberge plus de sites web depuis 2016.
- **Téléphone Android** : ouvrir le fichier depuis « Fichiers » avec Chrome.
  Sur iPhone, l'aperçu de l'app Fichiers n'exécute pas la page : utiliser
  l'appli en ligne.

Règles de ce fichier : il montre l'appli **telle qu'elle était à l'instant
de l'instantané** (les actus de 36 h restent visibles au lieu de
disparaître), un bandeau permanent dit la date réelle et l'âge réel, et
signale quand ce n'est plus de l'actualité. Il ne collecte rien et n'envoie
rien. Il contient des actus réservées aux comptes : **ne pas le publier**
(pas de lien public sur Drive, pas de partage sur un groupe).

L'application installée sur le téléphone (« Installer l'application ») a
besoin du réseau : elle n'a volontairement pas de cache hors ligne, qui
servirait des niveaux périmés sans le dire. Pour lire hors réseau, c'est le
fichier ci-dessus.

## 3. Sauvegarde des données et retour arrière

Chaque lundi à 4 h 17 UTC, le workflow **Sauvegarde Firebase (chiffrée)**
copie toutes les données Firestore (comptes, profils, paiements déclarés,
validations, bulletins programmés, cache d'actus) dans un fichier chiffré,
gardé 90 jours dans l'onglet Actions de GitHub. Il se lance aussi à la main
(Actions → Sauvegarde Firebase → Run workflow).

Le fichier n'est lisible qu'avec **le fichier JSON du compte de service
Firebase** (celui collé dans le secret `FIREBASE_SERVICE_ACCOUNT`). Le garder
en lieu sûr hors du PC (clé USB, coffre) : sans lui, les sauvegardes sont
illisibles. Les traductions ne sont pas sauvegardées : le job les refait.

Le code, l'archive des niveaux, les bulletins et les rapports sont dans le
dépôt GitHub, avec tout leur historique : rien à faire pour eux.

### Retour arrière

Sur un PC avec Node.js et le dépôt téléchargé :

```
node scripts/restaurer-firestore.js sauvegarde-firebase-2026-11-23.json.enc --compte compte-service.json
```

lit la sauvegarde et dit ce qu'elle contient, sans rien toucher. Pour
remettre une ou plusieurs collections :

```
node scripts/restaurer-firestore.js <fichier> --compte compte-service.json --collections profiles,paiements_declares --appliquer
```

Les documents sont réécrits à l'identique ; rien n'est supprimé. Ne pas
restaurer `collecte_partagee` sans raison : ce serait remettre des actus
vieilles d'une semaine.

## 4. Si GitHub Actions ne tourne plus : la collecte depuis un PC Windows

1. Installer Node.js (version LTS, https://nodejs.org), une fois.
2. Télécharger le dépôt : page GitHub du dépôt → Code → Download ZIP, et le
   décompresser.
3. Copier le fichier JSON du compte de service dans `outils\pc\` sous le nom
   `compte-service.json` (il ne sera jamais envoyé ni publié).
4. Double-cliquer sur `outils\pc\Lancer la collecte.bat`.

La première fois, il installe le navigateur de collecte (quelques minutes).
Ensuite il fait ce que fait GitHub : collecte, puis publie le cache d'actus
dans Firebase. Tous les utilisateurs voient les nouvelles actus. Si GitHub
Pages ne répond pas, il passe par le miroir Firebase. L'archive des niveaux
et les bulletins restent sur ce PC.

## 5. Si GitHub Pages tombe

Donner l'adresse du miroir : `https://sentiqs-235ce.web.app/SentiqS_Web.html`.
Mêmes comptes, mêmes données. Aucun autre hébergeur (Netlify, Cloudflare
Pages) n'est nécessaire : ils demanderaient un compte de plus pour le même
service.

## À décider

- **Taille du dépôt** : garder dans l'historique Git seulement la version
  finale du rapport mensuel, et publier les versions quotidiennes autrement
  (artefact ou « release » GitHub), ce qui arrête la croissance de ~700 Mo
  par mois. Cela change l'endroit d'où le module Rapports télécharge le
  rapport du mois en cours.
