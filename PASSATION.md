# Passation — 2 septembre 2026

État des lieux à la reprise du dépôt par un autre développeur.
Référence : `main` = `b7c9f7f`, déployé sur GitHub Pages (run #183, vert à
06 h 21 UTC). Les octets servis ont été vérifiés identiques à `main`, page et
noyau.

Les repères durables sont dans `CLAUDE.md`. Ce fichier-ci ne décrit que la
situation à cette date, et se périme.

---

## Ce qui a été fait

Sept correctifs fusionnés, chacun avec ses tests :

| PR | Objet |
|---|---|
| #27 | Deux signaux de collecte qui mentaient |
| #28 | Mesure de ce qui porte réellement le niveau d'alerte, pays par pays |
| #29 | Le socle vérifié devient un plancher : la collecte peut porter le niveau |
| #30 | Restitution des signaux, auditée sur l'interface réellement servie |
| #31 | Correction du radar + vue Profil (la nature du risque, pas son ampleur) |
| #32 | Élargissement des lexiques humanitaire et économique, sans bouger un niveau |
| #33 | Le périmètre passe avant le niveau dans la file de traitement |
| #34 | Documentation du dépôt pour la passation |
| #35 | Archive quotidienne, sortie d'alerte, cliquet sur les facteurs |

La couverture de test est passée de 16 à **149 tests**. Dix contrôles
automatiques tournent en CI.

### Ce que la PR #35 a réglé, et ce qu'elle n'a pas pu régler

Après une évaluation du produit sur cinquante axes face au niveau de
référence du secteur (107/250, soit 50 % de la référence), quatre chantiers
ont été menés :

- **l'archive quotidienne des niveaux** et la trajectoire par pays — le
  produit ne pouvait montrer qu'un état, jamais un mouvement ;
- **la sortie d'alerte** vers Slack, Teams ou tout relais webhook, sur
  changement de niveau uniquement ;
- **le cliquet** sur les 38 facteurs structurels non datés, et leur
  affichage dans la fiche pays ;
- **un README honnête**, qui dit aussi ce que le produit ne fait pas.

Quatre écarts de la grille **ne se comblent pas par du code**, et il faut
le dire plutôt que de les laisser croire réglés :

- **Les 9 fiches pays sur 54.** Le générateur refuse délibérément de
  produire du contenu sûreté à partir de rien : il exige un fichier de
  données rempli à partir de sources vérifiées. Générer les 45 manquantes
  reviendrait à fabriquer des évaluations de sûreté. Cette limite est une
  protection, pas un obstacle.
- **Le réseau humain de terrain et l'analyste de garde.** C'est ce que
  vendent Crisis24 et International SOS ; aucun code ne le remplace.
- **La latence.** GitHub étrangle le cron ; descendre sous l'heure demande
  une infrastructure d'exécution, pas un réglage.
- **Les langues de collecte.** Ajouter des sources en arabe, portugais ou
  swahili sans étendre d'abord les lexiques produirait des articles mal
  classés — c'est-à-dire une régression déguisée en couverture.

Sur #33 : un item allemand concernant la Russie, seul CRITIQUE du cycle,
ouvrait la file « À traiter » devant tout le contenu africain. Le correctif de
#30 ne suffisait pas — il ne rétrogradait l'international qu'à niveau égal.
Le tri met désormais le périmètre avant le niveau.

---

## Ce qui bloque, et qui appartient au propriétaire

Rien de tout cela ne se code : ce sont des actions dans les consoles Supabase,
GitHub et Netlify. Par ordre d'urgence.

1. **Reprendre l'accès administrateur** — bloquant aujourd'hui, ~5 min.
   `getSession()` renvoie désormais `role:'reader'` par défaut au lieu de
   `role:'admin'` (correction de sécurité volontaire). Conséquence non
   anticipée sur le moment : sans compte admin réel, l'interface se voit en
   lecteur, donc **sans les noms de sources** dans les panneaux, `f_sources`
   étant limité à `roles:['admin']`.
   Marche à suivre : Supabase → *Authentication → Users → Add user*, avec
   *Auto Confirm*, puis
   `insert into public.profiles (…) … on conflict (id) do update set role = 'admin'`.

2. **Sauvegardes Supabase et test de restauration** — seul axe noté 0/5 à
   l'audit. Une sauvegarde jamais restaurée n'est pas une sauvegarde.

3. **Rotation de trois clés** — `sb_publishable_KFnCBm…` (encore dans
   l'historique git), `sb_publishable_E1KT…` (`webapp/.env`, encore suivi par
   git). La clé anonyme de production, elle, est **publique par conception** et
   doit rester dans le fichier servi : ne pas la « corriger ».

4. **Bascule des écritures partagées vers la fonction Edge** — procédure dans
   `supabase/README.md`, **l'ordre des étapes est critique**. La fonction est
   dans `app/sentinel-app/supabase/functions/publier-collecte/index.ts`. Le
   point de contrôle est la ligne de journal
   `Jeton de publication injecté : publication via la fonction Edge.`

5. **Sortir `webapp/.env` du dépôt** — subordonné à la vérification que
   `VITE_PUBLIC_SUPABASE_URL` et `VITE_PUBLIC_SUPABASE_ANON_KEY` existent bien
   côté Netlify (`stirring-gumption-f4bc94`). Les retirer avant cette
   vérification casse le build.

---

## Signalé sans conclusion

**Divergence de projet Supabase.** L'application pointe sur
`zpdwqmliogxbuwirziny` ; le contrôle GitHub « Supabase Preview » pointe sur
`yttctytqjtmaiheegqky`. Les deux ont été constatés, l'explication n'a pas été
établie. À élucider avant toute opération de migration.

---

## Différé volontairement, et pourquoi

- **Les 172 incidents figés** (`ALERTE_EVENTS`) ont besoin de la relecture d'un
  analyste sûreté : le plus récent datait de 62 jours. Ce n'est pas un travail
  de développeur.

- **Un faux positif identifié, non corrigé** : « AGRICULTURE — Besalohy
  renforce la sécurité alimentaire » ressort en ÉLEVÉ. Une bonne nouvelle
  promue en alerte. Le correctif n'a pas été tenté : il faut d'abord savoir
  combien de cas cela représente sur plusieurs cycles, plutôt que de coder une
  règle sur deux exemples. Compter d'abord — et depuis la PR #35, l'archive
  quotidienne rend ce comptage possible.

- **La décroissance des facteurs structurels non revus** est délibérément
  absente, et un test l'interdit tant qu'aucune mesure ne l'a validée. Sur
  cet outil un faux négatif coûte plus cher qu'une donnée périmée : une
  première décroissance sur le socle vérifié faisait tomber la Somalie, le
  Kenya et l'Éthiopie au VERT.

- **Le déséquilibre des quatre axes Profil** vient du corpus, pas du
  classifieur : 72,5 % des articles collectés sont sécuritaires, et seulement
  12 sur 512 portaient un mot-clé humanitaire. Quand le mot-clé est là, la
  catégorie gagne dans 83 % des cas. La correction passe donc par **de
  nouvelles sources** humanitaires et économiques, pas par plus de lexique.
  Élargir encore les lexiques sur ce corpus ne ferait que fabriquer des faux
  positifs.

- **`unicef` a été retiré** de la liste des mots-clés candidats : 2 faux
  positifs sur 19 occurrences (des articles de gouvernance sur le Conseil
  junior namibien).

---

## Une mise en garde de méthode

Un chiffre publié ici a d'abord été faux, et de façon crédible : « part du
socle figé dans le score : 100 % » — vrai par construction puisque le live vaut
zéro, et donc sans information. Il a été remplacé par `partMaxCollecte`, la
puissance maximale de la collecte à plafond saturé, soit **38,9 %** en médiane.

Sur ce produit, une statistique qui confirme trop bien ce qu'on attendait
mérite d'être recalculée avant d'être montrée.
