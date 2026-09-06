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
npm test          # node --test scripts/test/*.test.js — 176 tests
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

### Les quatorze contrôles automatiques

`.github/workflows/webapp-ci.yml`, job `collecte` : syntaxe du JS inline,
couverture des proxys, accessibilité du fichier de production, pages légales,
symétrie du dictionnaire i18n, registre des sources, ressources référencées
présentes, datation des incidents vérifiés, fiches pays adossées à des
données, aucun nouveau fichier de secrets suivi, accessibilité du DOM rendu,
les 176 tests, chargement réel de la page. Chacun a son script dans
`scripts/verifier-*.js`.

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

```bash
node scripts/banc-tri.js cache.json            # rejoue classify() sur un cache réel
node scripts/banc-tri.js cache.json --diff banc-avant.json
```

Le banc rejoue **la vraie `classify()`**, extraite du fichier de production,
et nomme le mot qui a fait monter chaque article. `SENTINEL_HTML_PATH` permet
de rejouer la version de `main` pour produire la référence « avant ».

**Un accident n'est pas une attaque, et un plafond le dit.** Mesure du
06/09/2026 sur le cache publié : sur vingt-cinq articles au-dessus du normal,
**cinq étaient des accidents de la route** — dont l'accident de bus du
Cap-Vert, compté trois fois — et **trois n'étaient pas des événements** : une
cérémonie du souvenir (« 12 police officers killed in line of duty to be
remembered ») et deux avis de police.

`estAccident` plafonne à **élevé**, `estBilanRoutier` à **modéré**,
`estNonEvenement` à **modéré**. Le partage entre les deux premiers a été
tranché par l'éditeur du produit, pas par le code : un autocar à vingt-cinq
morts doit rester très visible, une statistique routière non.

`AGRESSION_RE` est la garde qui donne son sens au plafond : un bus attaqué
par des hommes armés n'est pas un carambolage. **Le premier test de cette
garde passait sur la version cassée** — ses titres ne contenaient aucun mot
du motif « accident », la garde n'était jamais exercée. Un cas de garde doit
porter les deux vocabulaires à la fois.

Effet mesuré : critiques 15 → 6, élevés 10 → 14, modérés 9 → 14, et **aucun
article ne quitte le radar**.

**Le titre décide, le corps nuance.** `classify(txt, src, titre)` reçoit le
titre seul en troisième argument. Un mot du titre fait le niveau ; le corps
seul ne le fait qu'avec au moins deux familles de mots distinctes, et un mot
isolé du corps vaut modéré. Mesure du 03/09/2026 qui a imposé la règle : sur
les vingt articles au-dessus du normal, dix-sept tenaient à un mot du corps
(« violence » dans un appel à l'unité, « sécurité » dans le sommaire d'un
journal télévisé). Les formats éditoriaux (journal télévisé, chronique,
communiqué du conseil des ministres) sont exclus en tête de titre, et une
condamnation plafonne au modéré.

**Les lexiques sont bilingues.** 62 des 262 titres du cache étaient en
anglais et aucun mot anglais n'y figurait : « Troops rescue 30 kidnap
victims » restait au niveau normal. « threat » est volontairement absent : dans
la presse politique nigériane c'est une menace électorale.

**« Vérifié » veut dire recoupé.** `verified` n'est posé que par la fusion de
deux sources dans `dedupliquerArticles` ; la note de la source est portée par
`fiable`. Le 03/09/2026, 125 articles portaient le badge, 120 n'avaient qu'une
source.

---

## La fenêtre d'actualité

`FENETRE_ACTUALITE_MS` décide jusqu'à quel âge un article compte comme
« actualité » — dans le Flux, le tableau de bord, le compteur de pays
couverts et le score de fraîcheur. **36 heures depuis le 06/09/2026**, contre
douze auparavant, en deux arbitrages successifs le même soir.

Mesure qui a motivé les deux pas, les 110 sources natives capables d'alerter
interrogées une par une :

| Fenêtre | Sources fraîches | Pays couverts |
|---|---:|---:|
| 12 h | 27 | **18/54** |
| 24 h | 47 | **34/54** |
| 36 h | 51 | **37/54** |
| 48 h | 55 | 38/54 |

Le second pas, de 24 à 36 h, gagne Madagascar, la Guinée et le Tchad — deux
d'entre eux au niveau élevé — pour douze heures de plus. 48 h n'en gagnerait
qu'un de plus.

**La contrepartie est réelle** : un incident vieux d'une journée et demie
s'affiche comme une actualité alors qu'il peut avoir été résolu. C'est le
prix payé pour ne plus confondre le pays calme avec le pays sur lequel on ne
sait rien.

À douze heures, trente pays restaient vides en permanence — dont dix des
treize qui n'ont qu'une seule source d'alerte — sans que rien ne distingue le
pays calme du pays sur lequel on ne sait rien. C'est exactement ce que
`paysMuet()` combat, réintroduit par le réglage.

Beaucoup de titres africains publient une fois par jour : **une fenêtre plus
courte que leur rythme ne mesure pas la sûreté, elle mesure l'heure de
bouclage.** 48 h a été écarté par l'éditeur : un incident d'avant-hier
affiché comme actualité peut avoir été résolu.

Le seuil est défini **une seule fois** et un test l'exige : la décroissance
du score de fraîcheur le suit, sinon la moitié des articles affichés
perdraient d'un coup leurs trente points. La fonction `isWithin12h` a été
renommée `estDansFenetreActualite` — son nom mentait dès que la fenêtre a
bougé.

**Les tests lisent la fenêtre dans la page** plutôt que de la recopier : ils
ont dû être recalés deux fois en une soirée, et un seuil recopié se périme à
chaque arbitrage éditorial. Un test vérifie aussi que les étiquettes qui
annoncent une durée à l'écran — la tuile « Actus /Xh » — disent la vraie
fenêtre : après le passage à 36 h elle affichait encore « /24h » alors que
son compteur, lui, comptait déjà sur 36. Les autres « 24h » de la page ne
sont pas des étiquettes de fenêtre (l'audience du site, l'historique social,
et un média qui s'appelle « 24h Benin ») et ne doivent pas être touchés.

**Ce que ce réglage ne répare pas.** Le recensement du 06/09/2026 a aussi
montré que **30 des 110 sources natives d'alerte ne répondent plus** : douze
en 404 (adresse du flux périmée — Abidjan.net, Le Faso, APS, Dakaractu,
Graphic, The Citizen…) et treize en 403 (le site refuse notre robot — Punch,
Nation, L'Express, Monitor, Igihe…). Et le filet de secours des petits pays,
AllAfrica, publie une fois par jour au mieux : 22 h d'écart typique, 19 jours
pour le Malawi. L'agence gabonaise AGP n'a rien publié depuis quatorze mois.

**Google News bloque son propre flux.** `news.google.com/robots.txt` porte
`Disallow: /` et n'autorise que `/topics/`, `/stories/`, `/publications/` —
pas `/rss/`. Or 319 des 489 entrées du registre sont des requêtes Google
News. `fetchRespectueux` refuse donc de les chercher directement et la page
retombe sur les proxys CORS publics, saturés sous 900 requêtes depuis une
seule adresse : 359 replis au passage du 06/09. Contourner par un proxy
public ce que le robots.txt demande de ne pas faire est un arbitrage qui
appartient au propriétaire du produit, pas au code.

---

## L'archive des niveaux

Le job de collecte écrit **un instantané par jour** dans
`web/historique/AAAA-MM-JJ.json`, plus une `serie.json` compacte que
l'interface télécharge pour afficher la trajectoire de chaque pays. Le
premier passage de la journée fait foi ; le refus d'écraser *est* le
mécanisme « un par jour », il ne dépend d'aucun état conservé entre deux runs.

L'archive vit sous `web/` et non sous `data/` parce que c'est `web/` que Pages
sert : l'interface la lit sans Supabase ni API.

Le calcul de tendance (`tendanceNiveaux`) est dans le **noyau**, partagé par
l'interface et par le job. Ne pas le dupliquer : c'est la trajectoire montrée
à l'utilisateur qui paierait la divergence.

**Aucune flèche n'est affichée en dessous de deux relevés.** Une trajectoire
annoncée le premier jour serait une affirmation sans mesure.

---

## La sortie d'alerte

`scripts/lib/alerte-sortante.js` poste un message sur `WEBHOOK_ALERTES` (un
secret Actions) quand un pays **change de niveau**. Charge utile
`{"text": "..."}` — le plus petit dénominateur commun entre Slack, Teams et la
plupart des relais e-mail.

Trois règles à ne pas défaire :

- **On n'annonce que les changements, jamais l'état.** Le job tourne cinq à
  quinze fois par jour ; envoyer la situation à chaque cycle produirait un
  canal que plus personne ne lit — et une alerte qu'on ne lit plus est pire
  qu'une alerte absente.
- **La référence est `web/historique/dernier-signale.json`**, pas la mémoire
  du processus, qui repart de zéro à chaque run. Cet état retient le dernier
  niveau *annoncé*, pas le dernier *observé* : un pays qui redescend puis
  remonte doit être annoncé une seconde fois.
- **L'état avance même sans canal configuré**, sinon le jour du branchement
  déverserait tout l'arriéré d'un coup.

Sans `WEBHOOK_ALERTES`, le job journalise le message qui *serait* parti. C'est
la façon de mesurer le bruit avant de brancher quoi que ce soit.

---

## Le cliquet sur les facteurs structurels

38 facteurs de `FACTEURS_SPECIAUX` pèsent leur bonus plein sans date de revue.
Les dater demande un analyste, pas du code.

`scripts/verifier-datation-incidents.js` porte donc un plafond,
`PLAFOND_FACTEURS_NON_DATES = 38` : toute PR qui ajoute un facteur non daté
échoue. Il est fait pour **descendre** au fil des revues, jamais pour monter —
le relever annulerait le seul garde-fou de ce socle. Une date `revu` illisible
ou dans le futur bloque aussi : elle affiche « revu récemment » et endort la
vigilance, ce qui est pire que pas de date.

**Le poids des facteurs ne dépend d'aucune date de revue**, et un test
l'interdit. Faire décroître un facteur non revu est l'idée évidente ; elle
demande des dates que personne n'a produites, et sur cet outil un faux négatif
coûte plus cher qu'une donnée périmée. Si ce test tombe un jour, c'est que
quelqu'un a branché la décroissance : mesurer d'abord.

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

## Les trois cliquets

Même forme, même raison d'être : une dette qu'on ne peut pas résorber par du
code, nommée dans le script, avec interdiction de l'agrandir. Chacun indique
quoi abaisser quand la dette recule ; aucun ne doit être relevé.

| Contrôle | Dette gelée | Ce qu'il refuse |
|---|---|---|
| `verifier-datation-incidents.js` | 38 facteurs non datés | un 39ᵉ, une date de revue illisible ou future |
| `verifier-fiches-pays.js` | 5 fiches sans données | une 10ᵉ fiche, un fichier de données aux sources vides |
| `verifier-secrets-suivis.js` | `webapp/.env` | tout nouveau `.env` suivi par git |

Deux tests comparent la dette **déclarée** à la dette **réelle** : allonger la
liste au lieu de fournir les données fait tomber le test. C'est exactement le
contournement que ces cliquets visent.

---

## Accessibilité

`verifier-accessibilite-interface.js` mesure le **DOM après rendu**, jamais le
fichier source : l'essentiel de cette interface est construit par JavaScript,
et compter les attributs dans le source ne dit rien de ce que voit un lecteur
d'écran. La note d'accessibilité de ce produit a été fausse deux fois pour
cette raison exacte.

Cliquet à **zéro champ sans nom accessible**. Les repères de structure sont
posés en attributs (`role=`) et non en changeant les balises : le CSS est
entièrement indexé sur les classes.

**Un libellé inventé est pire qu'un libellé absent** — il décrit à
l'utilisateur un autre contrôle que celui qu'il manipule. Reprendre le texte
déjà visible à l'écran, à côté du champ.

---

## Les services externes tombent, et il faut cesser de les rappeler

Mesure du 02/09/2026 : les trois miroirs de Lingva répondent 500, 502 et 403.
Morts, pas lents. La chaîne de traduction les essayait avec neuf secondes de
patience chacun, pour **chaque titre**.

`creerDisjoncteur` / `avecDisjoncteur`, dans le noyau : après deux échecs
consécutifs le service est court-circuité pour la session — on lève tout de
suite au lieu d'attendre le réseau. Un seul succès le referme, parce qu'un
miroir qui revient doit pouvoir resservir.

Aucun moteur n'est retiré de la liste : c'est le disjoncteur qui décide, pas
une suppression figée dans le code.

---

## Accessibilité

`verifier-accessibilite-interface.js` mesure le **DOM après rendu**, jamais le
fichier source : l'essentiel de cette interface est construit par JavaScript,
et compter les attributs dans le source ne dit rien de ce que voit un lecteur
d'écran. La note d'accessibilité de ce produit a été fausse deux fois pour
cette raison exacte.

Cliquet à **zéro champ sans nom accessible**. Les repères de structure sont
posés en attributs (`role=`) et non en changeant les balises : le CSS est
entièrement indexé sur les classes.

**Un libellé inventé est pire qu'un libellé absent** — il décrit à
l'utilisateur un autre contrôle que celui qu'il manipule. Reprendre le texte
déjà visible à l'écran, à côté du champ.

**En CI, ce contrôle échoue si le navigateur manque.** Il est entré en CI en
passant au vert sans rien mesurer, parce que l'installation de Playwright
vivait dans une étape ultérieure. Un contrôle muet occupe la place d'une
garantie sans en donner aucune.

---

## Les services externes tombent, et il faut cesser de les rappeler

Mesure du 02/09/2026 : les trois miroirs de Lingva répondent 500, 502 et 403.
Morts, pas lents. La chaîne de traduction les essayait avec neuf secondes de
patience chacun, pour **chaque titre**.

`creerDisjoncteur` / `avecDisjoncteur`, dans le noyau : après deux échecs
consécutifs le service est court-circuité pour la session — on lève tout de
suite au lieu d'attendre le réseau. Un seul succès le referme, parce qu'un
miroir qui revient doit pouvoir resservir.

Aucun moteur n'est retiré de la liste : c'est le disjoncteur qui décide, pas
une suppression figée dans le code.

---

## Silence n'est pas calme

Au run #800, **39 sources sur 495** avaient publié depuis douze heures,
couvrant **31 pays sur 54**. Les vingt-trois autres s'affichaient dans le
cartogramme exactement comme un pays calme.

Pour un professionnel de la sûreté, c'est l'ambiguïté la plus coûteuse de
l'outil : l'absence de signal ressemble à l'absence de risque. `paysMuet()`
et `marqueSilence()` distinguent désormais les deux.

La marque est délibérément **discrète et sans couleur d'alerte** : un pays
muet n'est pas un pays dangereux, c'est un pays sur lequel on ne sait rien.
Un test interdit la couleur d'alerte sur cette marque.

**Deux états, pas un.** « Muet » = rien du tout sur ce pays. « Hors alerte » =
du flux existe, mais aucune source au-dessus du seuil 70 n'a publié, donc
`getLiveAlertEvents` ne retient rien et le niveau *ne peut pas monter*. Le
second est le plus trompeur des deux, parce que l'interface a l'air alimentée.
Un test vérifie que le seuil de la marque reste identique à celui de
`getLiveAlertEvents` : les laisser diverger ferait dire « couvert » à un pays
qui ne l'est plus.

**Treize pays n'ont qu'une seule source d'alerte** — SS BI CG ER GM GW SL GQ
KM LS SZ MZ LY. Une source qui se tait douze heures suffit à les rendre
aveugles. `verifier-redondance-sources.js` pose un cliquet à 13 ; il descend
en évaluant éditorialement de nouvelles sources, jamais en leur attribuant un
score au jugé.

**Ce n'est pas un manque de sources, c'est le seuil.** `sensibilite-seuil.js`
le mesure : à 70, treize pays à source unique ; **à 68, zéro**, et la médiane
passe de 2 à 3. Les 63 sources notées exactement 68 sont en majorité des
requêtes « <Pays> — Sécurité » de Google News, plus douze médias nommés.

Le script ne tranche rien, et c'est voulu. Descendre le seuil laisserait une
agrégation Google News faire monter un niveau d'alerte : c'est un arbitrage
entre un faux négatif (treize pays aveugles) et un faux positif (une
agrégation qui alarme). Il appartient à l'éditeur. La vraie question n'est
d'ailleurs pas « 70 ou 68 » mais « ce média nommé mérite-t-il 72 ? », et elle
se décide source par source.

**Et `couverture-mediatique.js` produit la liste de ces médias nommés.** Chaque
article d'un flux Google News nomme son éditeur (`<source url=...>`). Rejouer
les requêtes Google News **déjà présentes dans le registre**, pays par pays,
donne donc les médias qui parlent réellement de ce pays — ceux que la veille
lit déjà, et ceux qu'elle voit passer sans les créditer comme source.

Mesure du 06/09/2026, sur les 54 pays : **7 590 articles, 1 405 domaines
absents du registre**, dont **572 revus au moins deux fois** en sept jours.
Les pays dits aveugles ne le sont pas faute de flux — l'Eswatini, une seule
source d'alerte, montrait 145 articles et 42 médias inconnus.

**Le détour par les annuaires ouverts a été essayé et abandonné.** Wikidata ne
référence, avec site officiel déclaré, qu'un média pour le Soudan du Sud, un
pour les Comores, un pour le Congo-Brazzaville, et **aucun** pour l'Érythrée,
le Burundi, la Sierra Leone, la Guinée équatoriale. Les pays les moins
couverts par la veille sont aussi les moins documentés par les bases
ouvertes : l'annuaire reproduit l'angle mort qu'il devait combler.

**Le piège qui a coûté une passe entière :** composer la requête avec le nom
français du pays alors que l'édition interrogée est anglophone ou lusophone.
« Afrique du Sud » sur l'édition `ZA:en` ramenait 18 articles, « South
Africa » en ramène 161 ; « Soudan du Sud » 7, « South Sudan » 161 ; « Gambie »
4, « The Gambia » 148. Vingt-cinq pays sur cinquante-quatre étaient touchés,
et la mesure n'avait pas l'air cassée : elle concluait simplement que ces pays
étaient peu couverts. Reprendre les requêtes du registre, déjà écrites dans la
bonne langue, supprime la classe d'erreur au lieu de la contourner.

Un cliquet le protège : **chaque pays doit avoir au moins une requête
thématique** dans le registre. Un pays qui n'en aurait plus ne produirait
aucun candidat, et le rapport le montrerait « bien couvert » exactement comme
un pays dont tous les médias sont déjà lus — la même ambiguïté que
`paysMuet()` combat côté interface.

**La mesure ne note personne**, et un test l'interdit. Elle compte des
occurrences ; le score de fiabilité reste un jugement éditorial.

**Et elle a trouvé le défaut avant les sources.** Le même piège de langue
était déjà dans le registre : 81 requêtes Google News, sur 18 pays,
interrogeaient une édition anglophone, lusophone ou arabophone avec le nom
**français** du pays. Mesure du 06/09/2026 sur trente jours, requêtes de
sûreté uniquement :

| Pays | Avant | Après | Nom attendu |
|---|---|---|---|
| Cap-Vert | 0 | 71 | Cabo Verde |
| Soudan du Sud | 1 | 66 | South Sudan |
| Afrique du Sud | 4 | 72 | South Africa |
| Gambie | 4 | 50 | The Gambia |
| São Tomé | 3 | 27 | São Tomé e Príncipe |
| Tanzanie | 5 | 70 | Tanzania |
| Zambie | 9 | 63 | Zambia |
| Soudan | 10 | 64 | Sudan |
| Éthiopie | 10 | 70 | Ethiopia |
| Mozambique | 13 | 62 | Moçambique |

**367 → 1 009 articles** sur les dix-sept requêtes de sûreté concernées. Le
Soudan du Sud, pays au niveau marron, recevait **un article par mois**.

C'est le pire genre de panne : silencieuse. Rien n'échouait, aucun contrôle
ne rougissait — le pays paraissait simplement calme. C'est exactement ce que
`paysMuet()` combat côté interface, entré cette fois par la requête.

Un cliquet le refuse désormais (`scripts/test/couverture-medias.test.js`) :
aucune requête thématique ne peut porter le nom français du pays sur une
édition qui ne l'est pas. **Seul le paramètre `q=` a changé** : le libellé
affiché reste en français, c'est la langue de l'interface, et un test le
vérifie aussi.

**Même faute sur les villes, mesurée puis corrigée** — mais pas partout :

| Ville | Avant | Après | |
|---|---:|---:|---|
| Le Caire | 5 | 71 | القاهرة |
| Sinai | 9 | 64 | سيناء |
| Darfour | 9 | 46 | Darfur |
| Le Cap | 1 | 40 | Cape Town |
| Djouba | 10 | 37 | Juba |
| Mogadiscio | 49 | 62 | Mogadishu |

Quatre autres ont été mesurés **neutres** et laissés tels quels : Tripoli
(65 → 64), Benghazi (68 → 72), Addis-Abeba (63 → 64), Port-Louis (24 → 24).
Google les retrouve en écriture latine sur ces éditions. On ne change pas ce
que la mesure ne justifie pas, et le cliquet ne les liste pas : les y
inscrire les figerait comme des fautes alors qu'ils n'en sont pas.

---

## Par où commencer la revue du socle

`revue-socle.js` transforme « relire les 172 incidents » en liste ordonnée,
à partir du dernier instantané archivé : niveau affiché × ancienneté du socle
× part du socle dans le score, atténué de moitié si la collecte apporte
quelque chose.

Au 02/09/2026 : **33 pays sur 54** ont leur incident vérifié le plus récent à
plus de soixante jours. En tête, la Somalie — **marron, 332 jours, 96 % du
score porté par le socle, aucun apport de la collecte**.

Un pays au vert sort toujours de la liste : c'est le seul niveau où une donnée
périmée ne peut pas produire de faux négatif visible.

**Et `incidents-porteurs.js` réduit le volume.** Il retire chaque incident un
par un et redemande son niveau à la page : si le pays descend d'un cran,
l'incident *porte* le niveau. Sinon il s'ajoute à un socle déjà suffisant, et
le relire ne changerait rien à ce que voit l'utilisateur.

Mesure du 02/09/2026 : **70 incidents sur 172 sont porteurs**, et **36 d'entre
eux ont plus de 180 jours** ou une date non analysable. Les 102 autres peuvent
attendre. C'est ce qui fait passer « relire 172 incidents » à une liste qu'un
analyste peut finir.

Le triage vit dans `scripts/lib/priorisation.js` (`triageIncident`) et une
date illisible y compte comme **ancienne** : on ne sait pas, donc on regarde.
La traiter comme récente ferait disparaître de la liste les incidents les
moins bien saisis — exactement ceux qui méritent un œil.

---

## Trois cliquets de plus, même forme

| Contrôle | Ce qu'il refuse |
|---|---|
| `scripts/test/tri.test.js` | deux entrées du registre `SRCS` sur le même flux |
| `scripts/test/langue.test.js` | un bouton ou un champ du HTML statique sans accroche `data-i18n` / `data-i18n-ph` |
| `verifier-pages-legales.js` | une page légale incomplète sans `noindex` — Pages la sert, liée ou non |

Les quatre bibliothèques d'export (Word, Excel, PowerPoint, PDF, 2,37 Mo)
se chargent au premier clic via `chargerBibliotheque()`, jamais au démarrage ;
un test l'interdit. SheetJS vient de `cdn.sheetjs.com` (autorisé dans la
CSP) parce que les versions corrigées n'existent pas sur npm.

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
