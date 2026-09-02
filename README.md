# SentiqS

Veille de sûreté sur les **54 pays d'Afrique**, à destination de
professionnels de la sûreté. Le produit est une page web unique, servie par
GitHub Pages : <https://ytl1-ops.github.io/SentiqS/SentiqS_Web.html>

## Ce qu'il fait

- **Collecte** en continu **495 sources** de presse et d'ONG, chacune notée en
  fiabilité. Seules les 183 sources au-dessus du seuil peuvent déclencher une
  alerte ; les autres alimentent le flux d'actualité, jamais le niveau.
- **Classe** chaque article par niveau et par domaine (sécurité, humanitaire,
  économie, politique), déduplique, et attribue un pays.
- **Calcule un niveau d'alerte par pays** — vert, jaune, orange, marron,
  rouge — à partir de quatre apports : 172 incidents vérifiés saisis à la
  main, 38 facteurs de contexte structurel, la collecte du jour plafonnée, et
  un bonus historique. Le calcul est explicite et auditable ; ses seuils sont
  publics (voir `CLAUDE.md`).
- **Archive** un instantané des 54 niveaux chaque jour, et affiche la
  trajectoire de chaque pays.
- **Signale** les changements de niveau sur un canal externe (Slack, Teams ou
  tout relais acceptant un webhook), sans jamais réémettre ce qui a déjà été
  annoncé.
- **Tient un agenda prospectif** de 49 événements datés — élections, scrutins,
  grands rassemblements — chacun avec son impact estimé et une recommandation.

## Ce qu'il ne fait pas

Le dire est plus utile que de le laisser deviner à un acheteur professionnel :

- **Pas de prévision.** L'agenda annonce des échéances connues ; rien ne
  prédit un niveau d'alerte futur.
- **Pas de temps réel.** La collecte planifiée est déclarée à 30 minutes mais
  GitHub l'étrangle : la cadence réelle observée est de 3 h 24 à 5 h 51.
- **Pas d'analyste de garde.** Le socle vérifié est saisi à la main et vieillit
  entre deux revues humaines.
- **Pas de géoréférencement.** L'attribution se fait au pays, pas au point.
- **Deux langues de collecte** seulement, français et anglais.

Une évaluation détaillée, axe par axe, est dans `PASSATION.md`.

## Travailler sur ce dépôt

- `CLAUDE.md` — architecture, comment vérifier une modification, pièges connus
- `PASSATION.md` — état des lieux et arbitrages en cours
- `DEPLOYMENT.md` — déploiement
- `supabase/README.md` — base de données et fonctions Edge

```bash
npm test          # 149 tests
npm run fumee     # charge la page de production dans un navigateur
```
