# Passation — 3 septembre 2026

## Ce qui a changé le 3 septembre

Un audit intégral, mesuré sur le site en ligne et sur le cache de production
du matin (262 articles), puis sept PR fusionnées dans la journée (#41 à #47)
et une huitième en cours. Le rapport d'audit : voir l'artefact « Audit
intégral SentiqS » (lien dans la conversation de passation).

| PR | Objet | Mesure |
|---|---|---|
| #41 | Les fiches pays citent leurs sources | 3 fiches sourcées, Ghana bloqué faute de source externe |
| #42 | Fiches pays lisibles et datées | 24 textes sous le seuil AA → 0, mesuré sur le DOM rendu ; 5 fiches datées « non révisée depuis » |
| #43 | L'archive quotidienne déclenche la mise en ligne | le site servait un relevé de moins que le dépôt ; **à constater sur le prochain passage planifié** |
| #44 | Le tri met en tête ce qui compte | 20 articles au-dessus du normal, 3 utiles → 17 au-dessus, 12 utiles ; 6 doublons de registre retirés ; « vérifié » = recoupé |
| #45 | Exports chargés au premier clic | 3,8 Mo → 1,44 Mo avant le premier geste ; SheetJS 0.18.5 → 0.20.3 (deux CVE) |
| #46 | Pages légales incomplètes en noindex | 3 pages servies avec 33 trous, indexables → noindex, contrôle CI |
| #47 | Liste de revue : âge négatif = zéro | Mauritanie, Libye, Soudan sortent de la tête de liste |
| en cours | Anglais complet + dépendance webapp | 56 → 126 clés, cliquet contre le français en dur ; react-router 7.18.3 |

**Nouveaux instruments** : `scripts/banc-tri.js` rejoue la vraie `classify()`
sur un cache réel et nomme le mot qui fait monter chaque article — toute
modification de lexique passe par là. `scripts/lib/contraste.js` mesure le
contraste WCAG. Quatre nouveaux cliquets en test : flux de registre en double,
jeton CSS non défini, bouton ou champ en français en dur, page légale
incomplète sans noindex.

**Ce que je n'ai pas prouvé** : que le déclenchement Pages après archive
(#43) parte réellement — GitHub documente l'exception `workflow_dispatch`,
les tests vérifient le câblage, seul le prochain passage planifié le montrera.
Regarder la liste des runs de « Déploiement GitHub Pages » : il doit y en
avoir un après chaque commit `Archive des niveaux d'alerte`.

**Corrigé dans le rapport d'audit après publication** : l'affirmation que
treize entrées de l'agenda avaient une date illisible était fausse — c'était
mon script de mesure qui ne lisait pas les mois abrégés, pas la page.

---

## État au 2 septembre (conservé)

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
