# SentiqS — repères pour travailler sur ce dépôt

Veille de sûreté sur les 54 pays d'Afrique. Le produit sert des professionnels
de la sûreté : un niveau d'alerte faux leur coûte cher dans les deux sens, une
alerte manquée comme une alerte de trop.

Ce fichier dit **où vit quoi**, **comment vérifier une modification**, et
**quels pièges ont déjà coûté du temps**. L'état d'avancement, lui, est dans
`PASSATION.md` — il se périme, celui-ci non.

---

## Ce qui est réellement servi

| Ce que voit l'utilisateur | Fichier | Servi par |
|---|---|---|
| Le produit | `web/SentiqS_Web.html` (20 878 lignes, 1,46 Mo) | GitHub Pages, depuis `web/` |
| Le noyau logique | `web/js/noyau.js` | `<script src="js/noyau.js">`, ligne 45 |

**Il n'y a pas d'étape de build pour `web/`.** Le HTML est du monolithe vanilla :
ce qui est commité est, à l'octet près, ce qui est servi. Le déploiement Pages
part tout seul au push sur `main` (`.github/workflows/gh-pages-deploy.yml`).

Les autres répertoires ne sont **pas** ce que voit le visiteur de
`sentiqs.com` :

- `webapp/` — application React/Vite déployée sur Netlify (`stirring-gumption-f4bc94`)
- `app/sentinel-app/` — application mobile + `supabase/config.toml` et les
  fonctions Edge (la CLI Supabase se lance depuis là)
- `backend/`, `data/` — antérieurs, non servis

Avant de modifier un fichier « parce qu'il a l'air d'être la page », vérifier
qu'il est bien celui que Pages sert. Plusieurs heures ont déjà été perdues à
corriger un fichier que personne ne charge.

---

## Vérifier une modification

```bash
npm test          # node --test scripts/test/*.test.js — 104 tests
npm run fumee     # charge la page de production dans Chromium
```

Le socle de test est `scripts/test/_bac.js`. Il existe parce que la logique
métier est encore majoritairement **inline dans le HTML** :

- `noyau` est chargé par `require` — c'est un vrai module (double export
  navigateur / CommonJS)
- le reste (`classify`, l'attribution pays, le score de confiance, le rendu)
  est **découpé par marqueurs de texte** via `tranche(debut, fin)`, puis évalué
  dans un contexte `vm`

Conséquence : les tests exercent le code de production, pas une copie. C'est le
but. Mais `tranche()` échoue bruyamment si un marqueur disparaît — c'est voulu,
un test muet vaut moins que pas de test.

**Piège récurrent avec `tranche()` :** les bornes ont été fausses deux fois, et
le test passait quand même en n'examinant rien. Après avoir écrit une tranche,
imprimer ce qu'elle contient réellement et vérifier que le code visé est dedans.

**Deuxième piège, plus vicieux :** deux tests écrits ici passaient sur la
version cassée qu'ils prétendaient couvrir (l'un vérifiait la *présence* d'un
critère de tri, pas sa *position* ; l'autre la position d'une ancre de texte,
pas la demi-largeur du texte centré). Un test neuf doit d'abord être vu
**échouer** sur l'ancien comportement.

### Les dix contrôles automatiques

`.github/workflows/webapp-ci.yml`, job `collecte` : syntaxe du JS inline,
couverture des proxys, accessibilité du fichier de production, pages légales,
symétrie du dictionnaire i18n, registre des sources, ressources référencées
présentes, datation des incidents vérifiés, les 104 tests, chargement réel de
la page. Chacun a son script dans `scripts/verifier-*.js`.

Le job `integrite` refuse toute PR où `webapp/` aurait disparu — né d'une
fusion qui a supprimé 16 889 lignes sans que personne ne le remarque.

---

## Le calcul du niveau d'alerte

Quatre apports, dans `calcAlertScore` :

1. `ALERTE_EVENTS` — **172 incidents figés**, datés, saisis à la main (ligne 15774)
2. `FACTEURS_SPECIAUX` — contexte structurel non daté (ligne 15956)
3. la collecte live, plafonnée à `MAX_LIVE_EVENTS_PAR_PAYS = 5` par pays
4. l'historique, plafonné

Seuils `getNivKey` : 2 / 5 / 8 / 14 → vert, jaune, orange, marron, rouge.

**La règle qui compte** (`borneRougeVerifie`, dans `noyau.js`) : la collecte
seule ne peut pas faire passer un pays au rouge si le socle vérifié ne le place
pas déjà au moins à marron. Le rouge reste porté par du fait daté.

Avec les nombres actuels cette borne **ne se déclenche jamais** : 5,5 points de
live + historique ne franchissent pas l'écart 8 → 14. C'est une garde pour
plus tard, prouvée par un test qui simule un plafond relevé. Ne pas la retirer
en la croyant morte.

Pour mesurer l'effet réel d'un changement de barème avant de le proposer :

```bash
node scripts/tableau-niveaux.js   # produit niveaux-pays.json (gitignoré)
```

Ce script charge la vraie page dans Chromium et interroge **son**
`calcAlertScore` — il ne réimplémente rien. Une proposition de barème qui n'a
pas été passée par là est une intuition, pas une mesure. Une recommandation a
déjà été écrite ici qui aurait fait *chuter* de 16 à 5 le nombre de pays
pouvant atteindre le rouge — Somalie, Tchad, Soudan du Sud, RCA incluses.

---

## Classification des articles

`classify()` attribue un niveau et une catégorie (sécurité, humanitaire,
économie, politique) à partir de lexiques `CK_*`.

Deux choses à savoir avant d'y toucher :

- **Élargir un lexique peut lever des alertes.** `lienSecuriteFaible` regardait
  le score humanitaire : ajouter « paludisme » suffisait à faire passer
  « Paludisme : le Mali à la tête d'une révolution thérapeutique » en ÉLEVÉ.
  D'où `CK_HUM_DOMAINE`, qui n'alimente **que** la catégorie, jamais le niveau.
- **`rehydrateArticles` doit recalculer le niveau**, pas seulement le pays.
  Sans ça une correction de classification reste invisible tant que le cache
  n'a pas tourné — soit jusqu'à 12 h.

Après tout changement de lexique : mesurer sur le cache réel combien de niveaux
bougent. La bonne réponse est presque toujours zéro.

---

## Collecte planifiée

`.github/workflows/collecte-planifiee.yml` déclare `*/30 * * * *`, mais GitHub
étrangle : la **cadence réelle observée est de 3 h 24 à 5 h 51**. Ne pas
raisonner comme si le cache avait 30 minutes.

Le cache partagé vit dans la table `collecte_partagee`. Deux fenêtres
distinctes, à ne pas confondre :

- `COLLECTE_PARTAGEE_LECTURE_MAX_MS` = 6 h — au-delà, le client collecte
  lui-même plutôt que de servir du périmé
- `COLLECTE_PARTAGEE_FRAICHEUR_MS` = 40 min — garde anti-rafale à la
  publication

Accessibilité des sources mesurée : **~83 %** (411/495 sur le run #795, 412/495
sur le #798). C'est sain. Un chiffre plus bas vu une fois n'est pas une
dégradation — le vérifier sur deux runs avant de conclure.

---

## Contraintes de cet environnement d'exécution

- **Chromium ne peut pas atteindre Internet** à travers le proxy. Tout actif
  externe doit être miroité avec `curl` puis servi localement, et les requêtes
  interceptées avec `page.route()`. C'est le cas du SDK Supabase dans les
  scripts Playwright.
- Le binaire est `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, à lancer
  avec `--no-sandbox`. Ne jamais lancer `playwright install`.
- `require('playwright')` doit être résolvable depuis la racine du dépôt.

---

## Conventions

- **Tout en français** : commits, commentaires, noms de fonctions et de
  variables du code métier, messages d'interface.
- Les commentaires expliquent **pourquoi**, en citant l'incident réel quand il
  y en a eu un. Le dépôt en est plein — c'est la mémoire du projet, l'entretenir.
- Un commit = un changement défendable, avec son test.
- Les migrations Supabase des deux emplacements s'appliquent à la **même**
  instance (voir `supabase/README.md`).

## Ce qui ne se fait pas sans le propriétaire

Supabase en production, les clés, les paiements. La bascule des écritures
partagées est **critique dans l'ordre des étapes** : inverser les étapes 3 et 1
arrête la collecte. La procédure est dans `supabase/README.md`.
