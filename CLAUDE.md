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

## La date de l'événement, pas seulement celle de publication

`estRecentReel` exige **deux** conditions : l'article doit être publié dans
`FENETRE_ACTUALITE_MS`, **et** l'événement qu'il décrit doit y tomber aussi.
La seconde est estimée par `extraireDateSurvenance`, à partir d'indices de
texte (« hier », « il y a trois jours », une date explicite, un jour de la
semaine).

C'est la bonne intention — un compte rendu publié aujourd'hui d'un conseil des
ministres du 7 mai n'est pas une actualité — mais elle peut **effacer un pays
entier**, et le silence ressemble alors au calme : exactement ce que
`paysMuet()` combat par ailleurs.

**Le défaut du 06/09/2026, mesuré sur les 560 sources un dimanche.** Le jour de
la semaine cité était systématiquement renvoyé dans le passé :

```js
if (diff === 0) diff = 7; // le jour cite est forcement dans le passe
```

Or la presse francophone écrit « ce dimanche », « dimanche matin » pour le jour
même. Un article publié **il y a trois heures** se retrouvait daté d'**une
semaine**, donc hors fenêtre, donc invisible.

Sur 560 sources, **107 articles publiés dans la fenêtre** étaient écartés sur
leur date d'événement, dont **36 par ce seul cas**. Parmi eux, à moins de cinq
heures de publication :

| Publié | Daté | Article |
|---:|---:|---|
| 3 h | 171 h | **Accident mortel de bus à Fogo : au moins 25 morts** (Cap-Vert) |
| 4 h | 172 h | Application de la peine de mort (Algérie, critique) |
| 4 h 54 | 173 h | Incendie à Sfax (Tunisie) |
| 9 h | 177 h | Peine de mort au conseil des ministres (Algérie, critique) |

Le révélateur du défaut : **« Le poème du dimanche »**, qui ne portait ce mot
que parce qu'on était dimanche.

Effet mesuré du correctif, à moisson identique : **614 → 650 articles,
46 → 47 pays** (la Mauritanie entre), critiques 24 → 29, aucun pays perdu.

Un renvoi explicite à la semaine écoulée (« dimanche dernier », « dimanche
passé ») garde la lecture ancienne : c'est le seul cas où le rédacteur a dit
lui-même qu'il ne parlait pas du jour même. Un test l'exige dans les deux sens.

**Les 71 autres articles écartés ne sont pas un défaut** : dates explicites
(« du 27 septembre »), « il y a trois semaines », commémorations. On ne les
touche pas — c'est le travail que cette règle doit faire.

**Le piège de mesure rencontré ici :** la comparaison avant/après a d'abord
donné « 0 article » pour la version d'avant. Ce n'était pas un résultat mais un
plantage muet — la page avait été copiée hors de `web/`, donc elle ne trouvait
plus `js/noyau.js`, et chaque appel levait. Une version de référence doit être
chargée **depuis `web/`**, sinon la mesure conclut ce qu'on veut.

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

**48 heures ne gagnerait rien, et c'est mesuré.** Le 06/09/2026 au soir,
l'arbitrage a failli être repris sur un souvenir : sept pays absents avaient
leur article le plus frais « à 58 h, juste hors fenêtre », d'où la conclusion
qu'un passage à 48 h les rattraperait. **58 h dépasse aussi 48 h.** La
recommandation annonçait trois pays gagnés ; la mesure en donne **zéro**.

`scripts/sensibilite-fenetre.js` rejoue les 560 flux moissonnés sur la vraie
page, à fenêtre variable :

| Fenêtre | Articles | Pays | Pays gagnés |
|---:|---:|---:|---|
| **36 h** | 655 | **47** | *(courante)* |
| 42 h | 713 | 47 | aucun |
| 48 h | 729 | 47 | **aucun** |
| 60 h | 861 | **49** | Botswana, Gambie |
| 72 h | 943 | 49 | aucun |

L'article le plus frais de chaque pays encore absent : BW 59 h, GM 59 h,
ST 83 h, SC 275 h, DJ 295 h, ER 327 h, et le **Lesotho n'en a aucun**, quelle
que soit la fenêtre. Le vrai seuil pour gagner deux pays est **60 h**, au prix
de 206 articles de plus dont l'essentiel a plus de deux jours.

L'éditeur a tranché le 06/09/2026 : **on reste à 36 h**. Le script ne
recommande rien et deux tests l'y obligent — il lit la fenêtre dans la page au
lieu de la recopier, et il ne conclut pas à la place de l'éditeur.

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

## Qui est collecté en premier

Depuis les 71 médias ajoutés au registre, la collecte planifiée **s'arrête au
plafond** de `COLLECT_TIMEOUT_MS` (11 min 03 s sur 560 sources, contre 6 min et
« Collecte complète » sur 489). L'ordre de la file décide donc de qui est
sacrifié — ce n'est plus une question théorique.

`ordonnerFileCollecte()` range les sources en trois rangs :

1. la **zone prioritaire** choisie par l'utilisateur à la connexion ;
2. les **pays aveugles** — aucun article dans le cache courant ;
3. tout le reste, en **ordre rotatif** (`rangRotatif`, pour qu'aucune tranche du
   registre ne soit *toujours* en queue).

**Mesure du 06/09/2026 qui a imposé le rang 2.** Neuf pays sur 54 n'avaient
aucun article. En interrogeant une par une toutes leurs sources capables
d'alerter, un seul avait du contenu frais à portée : la **Mauritanie**
(7 articles sous 12 h chez `fr_mr`, 2 chez `allafrica_mr`, 2 chez `ami_mr`).
Ses sources n'avaient simplement pas été atteintes avant l'arrêt. Les huit
autres n'avaient **rien publié sous 36 h** :

| Pays | Ce qui bloque |
|---|---|
| RW, SC | `igihe_rw` et `sna_sc` répondent **403** — le site refuse le robot |
| GM, ST, BW | dernière publication à **58-59 h**, juste hors fenêtre |
| DJ, ER, LS | aucune presse locale à flux vivant trouvée (270 à 326 h) |

Autrement dit : **un ordre de file ne fait gagner qu'un pays**. Les autres
demandent des sources, pas du code — et pour trois d'entre eux, la mesure dit
qu'il n'y en a pas.

**Le filet en aval ne pouvait pas jouer ce rôle.** La reprise « pays
manquants », en fin de `doCollect`, ne retentait que les sources en **erreur**,
jamais celles qui n'avaient jamais été essayées ; et sur un passage tronqué
elle ne s'exécute même pas, `doCollect()` étant abandonné en vol par le
plafond. D'où une priorité **en amont** plutôt qu'un rattrapage en aval.

Les sources d'un pays aveugle échappent aussi au cooldown (`srcIsSkippable`),
pour la même raison que la zone prioritaire : une source en cooldown vaut mieux
qu'un pays sur lequel on ne sait rien.

**Piège rencontré en écrivant ces tests :** `o.maintenant || Date.now()` traite
l'instant `0` comme absent. Un test qui passait `maintenant: 0` retombait sur
l'horloge réelle et changeait d'ordre à chaque exécution — il passait sur la
version cassée une fois sur deux. Un test non déterministe ne prouve rien.

---

## Collecte planifiée

`.github/workflows/collecte-planifiee.yml` déclare `*/30 * * * *`, mais GitHub
étrangle : la **cadence réelle observée est de 3 h 24 à 5 h 51**. Ne pas
raisonner comme si le cache avait 30 minutes.

**Le plafond de 11 minutes ne mord pas aujourd'hui, et c'est mesuré.** Le
06/09 au soir, avec 560 sources et des relais publics saturés, la collecte
s'arrêtait au plafond (11 min 03 s). Le 07/09, sur les huit passages de la
journée à 581 sources, le journal dit à chaque fois « Collecte complète
publiée avec succès » — 507 sources sur 581 ont répondu au passage n° 847
(87 %), publication à 5 min 30. **L'étape du job dure pourtant 11 minutes** :
les six minutes qui suivent la publication sont de l'attente de fermeture du
navigateur, pas de la collecte. Ne pas lire la durée de l'étape comme une
durée de collecte. Le plafond reste à 11 : le relever ne rapporterait rien
tant que le journal dit « complète », et la troncature revient dès que les
relais saturent — c'est `ordonnerFileCollecte()` qui décide alors de qui est
sacrifié, pas une minute de plus.

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

**Ce que l'éditeur en a fait, le 06/09/2026.** Les 74 candidats ont été
revérifiés juste avant intégration — 71 répondaient encore, trois avaient
cessé — puis notés **72 en bloc**, donc **au-dessus du seuil de 70** : ils
peuvent faire monter un niveau d'alerte.

| | Avant | Après |
|---|---:|---:|
| Sources au registre | 489 | **560** |
| Capables d'alerter | 140 | **211** |
| Pays à source unique | 13 | **4** |

Les quatre qui restent — Érythrée, Guinée équatoriale, Guinée-Bissau,
Lesotho — n'ont aucun média local avec un flux vivant. La mesure n'a rien
trouvé à leur donner ; ce n'est pas un oubli.

**La nuance qui doit rester écrite** : la note a été posée en bloc, sur la
mesure de couverture, et non média par média après lecture éditoriale.
Aucun de ces titres n'a été évalué sur sa fiabilité. Le risque a été énoncé
avant l'arbitrage et assumé : un titre mal calibré chez l'un d'eux peut
faire passer un pays au rouge.

Deux réserves signalées avant l'arbitrage et conservées dans le registre :
`voicegambia.com`, dont l'échantillon mesuré était presque entièrement
sportif, et `eswatinipositivenews.online`, qui ne publie que de bonnes
nouvelles par principe — l'Eswatini paraîtra couvert par un média qui ne
rapportera jamais un incident, exactement le piège que `paysMuet()` combat
ailleurs.

Neuf des 71 ont été reclassés en `economique` (EcoMatin, Investir au
Cameroun, Jornal Mercado, Forbes África Lusófona, BusinessTech…) : les
verser tous en `securite` aurait faussé le filtre par catégorie.

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

## Chercher un média local : la méthode qui marche

Le 07/09/2026, sept pays n'avaient aucun article. Deux approches ont été
essayées ; une seule paie.

**Le crawl d'annuaires ouverts a coûté 47 minutes pour rien.** Ramasser les
liens externes des pages Wikipédia d'un pays ramène surtout ses **références
bibliographiques** : le sondage est parti interroger `pubmed.ncbi.nlm.nih.gov`.
Même en se limitant aux pages consacrées aux médias, 462 candidats donnaient
76 flux dont **11 seulement** sur un domaine national, et beaucoup de bruit
(`france24`, `wikimediafoundation`, `pewforum`).

**Tester nominativement les grands titres connus de chaque pays a tout
trouvé, en quelques minutes** : sept titres par pays, sondés sur les
emplacements RSS usuels. C'est cette passe qui a sorti Kerr Fatou, Sunday
Express, Téla Nón — et les deux adresses mortes ci-dessous.

Résultat : **47 → 52 pays couverts**.

| Pays | Média | Dernier article |
|---|---|---:|
| Botswana | Weekend Post | 20 min |
| Botswana | The Business Weekly & Review (`economique`) | 40 min |
| Gambie | Kerr Fatou | 5 h |
| Lesotho | Sunday Express | 12 h |
| São Tomé | Téla Nón | 11 h |

**Deux sources déjà au registre pointaient à côté**, et c'est le genre de
panne qui ne se voit pas :

- `adi_dj` (score 70, **seule source d'alerte de Djibouti**) appelait
  `adi.dj/feed/` → **404**. La vraie adresse est `adi.dj/rss` → 50 articles.
- `stppress_st` passait par une requête Google News alors que l'agence a un
  flux natif — or `sourceDateNonFiable` écarte justement les requêtes Google
  News, donc ces articles ne comptaient jamais comme actualité.

Un test l'interdit désormais : **`rss_method` doit correspondre à l'adresse
réelle du flux**. Corriger l'une sans l'autre le fait tomber. Son premier jet
ne mesurait rien — il cherchait l'hôte par l'expression
`(^|.)news.google.com/`, qui ne reconnaît aucune des 318 requêtes Google News
du registre, faute du `//` qui les précède. L'hôte se lit avec `new URL()`.

**Deux pays restent sans solution, et c'est mesuré, pas oublié :**

- **Érythrée** — la presse d'État n'expose aucun flux ; les sites trouvés sont
  des publications de la diaspora, pas de la presse locale.
- **Seychelles** — seule SBC (radiodiffusion publique) a un flux vivant, mais
  elle publie **en créole seychellois**, que les lexiques ne lisent pas. Elle
  ferait « pays couvert » sans jamais pouvoir signaler quoi que ce soit :
  exactement le piège du média eswatini qui ne publie que de bonnes
  nouvelles. Écartée volontairement.

La note de 72 a été posée **en bloc** par l'éditeur, comme pour les 71 médias
du 06/09 : sur la mesure de publication, pas après une lecture éditoriale
titre par titre. Le risque a été énoncé avant l'arbitrage et assumé.

Le cliquet `PLAFOND_PAYS_SOURCE_UNIQUE` descend de **4 à 3** — le Lesotho en
sort. Restent l'Érythrée, la Guinée équatoriale et la Guinée-Bissau.

---

## Le registre vieillit : 74 flux natifs en panne, et ce qu'on peut en faire

Second recensement du 07/09/2026, sur les 560 sources : **74 flux natifs ne
répondaient pas** (les 319 requêtes Google News sont à part). Quatre familles,
et une seule se répare par du code :

| Famille | Combien | Ce qu'on fait |
|---|---:|---|
| Adresse changée, même média, **même périmètre** | 9 | réparé (RFI Afrique, Africanews, AllAfrica FR, L'Infodrome, Alwihda, Addis Fortune, CEDEAO, BCEAO, Togoweb) |
| Adresse vivante mais **autre périmètre** | 5 | **laissé mort** : HRW, OCHA, ReliefWeb, VOA, Almarsad n'ont plus que des flux mondiaux ou en arabe. Un flux « Afrique » remplacé par un flux « monde » n'est pas une réparation, c'est une autre source |
| Défi Cloudflare depuis ce bac à sable | 15 | non concluant d'ici — Punch, Nation, Monitor, L'Express, Igihe… Le journal du job planifié dit s'ils passent depuis GitHub |
| Accueil vivant, aucun flux déclaré | 29 | rien à faire côté code — dont tous les canaux Telegram via `rsshub.app`, instance publique morte |
| Domaine disparu (DNS vide) | 5 | à retirer, décision éditoriale : `togofirst`, `lanation`, `beninwebs`, `acap_cf`, `conakrylive` |

**Deux « réparations » étaient des doublons.** `jeune_afrique` et `citizen_tz`
pointaient vers une adresse morte alors que `jeuneafrique` et `thecitizen_tz`
lisent déjà le bon flux. Les remettre d'aplomb aurait créé deux entrées sur
le même flux — le cliquet de `tri.test.js` l'a refusé, c'est son travail. Ils
sont laissés tels quels et signalés : supprimer un doublon est une décision
de registre, pas un correctif.

**La panne qui ne se voyait pas : Jeune Afrique publiait toutes les heures et
paraissait muet.** Son flux enveloppe la date dans un CDATA entouré de
retours à la ligne ; `new Date()` n'en fait rien, donc ses 30 articles
étaient sans date, donc écartés. Un `.trim()` dans `parseRSS` — le titre en
avait déjà un deux lignes plus haut. Le test de fumée le vérifie désormais
sur un flux synthétique de cette forme exacte, et il a été vu dire « PERDUE »
sans le trim.

**Même famille, second cas : un espace avant `<?xml` fait refuser tout le
document.** Diario Rombe, ajouté le 07/09, ne remontait rien ; son flux était
valide, 6 articles, mais commençait par `\r\n`. `DOMParser` répond « XML
declaration allowed only at the start of the document » et `parseRSS`
renvoie `[]`. Rejeu de la moisson des 540 flux : **un seul autre** était dans
ce cas, `sosmediasburundi_bi` (score 72), muet pour la même raison. Les
espaces de tête et le BOM sont retirés avant l'analyse, et le test de fumée
porte un second flux synthétique, vu dire « REFUSE » sans le correctif.

**Et une fois lus, ses articles partaient en Guinée.** « Guinea Ecuatorial »
— l'ordre des mots espagnol — n'était ni dans la détection de la Guinée
équatoriale ni dans le masque qui empêche « guinea » de compter pour la
Guinée. Le seul pays hispanophone suivi perdait sa propre presse au profit de
son homonyme, Ahora EG compris. Masque et nom espagnol ajoutés, gentilé
« ecuatoguineano » aussi ; un test porte les deux sens (la Guinée tout court
reste la Guinée).

Leçon commune aux trois cas : **une source qui paraît muette doit être
rejouée sur la vraie page avant d'être crue muette — et ses articles suivis
jusqu'au pays où ils atterrissent.** Les deux fois, le flux
répondait et le défaut était dans notre lecture.

**Les 15 sites derrière Cloudflare sont morts aussi depuis GitHub, et c'est
mesuré sans les journaux.** Il suffit de regarder le cache publié : si une
source y a des articles, elle passe depuis le runner. Sur les huit caches
publiés le 07/09/2026, **aucun** des quinze (Punch, Nation, Monitor,
L'Express, Igihe, Sudan Tribune, Graphic, Herald…) n'a produit un seul
article. Ce n'est plus « non concluant » : ils ne fonctionnent pas en
production. Leur note est élevée (80 à 93) et leur silence est invisible.
Rien à réparer côté code — un défi Cloudflare ne se contourne pas par une
adresse — ; les retirer ou changer de route de collecte est une décision de
l'éditeur.

**Rwanda, même méthode nominative, avec un piège de langue.** Vingt-trois
titres sondés, sept flux vivants — mais cinq publient en **kinyarwanda**
(Umuseke, Umuryango, Bwiza, Panorama, Rushyashya), que les lexiques ne
lisent pas. Bwiza titrait sur les combats du M23 à Masisi : un signal réel,
illisible pour le classement. Seuls Taarifa et KT Press, en anglais, sont
entrés. La règle vaut pour toute langue hors lexiques : un flux qu'on ne sait
pas lire fait « pays couvert » sans jamais pouvoir alerter.

Douze pays ont reçu un média local de plus par la méthode nominative
(GQ, GW, TD ×2, NE ×4, DJ, BW ×2, LS ×2, GM ×2), et deux agences (ANP Niger,
ANG Guinée-Bissau) passent de Google News au flux natif. Le cliquet
`PLAFOND_PAYS_SOURCE_UNIQUE` descend de **3 à 1** : reste l'Érythrée. Il ne
descendra à zéro qu'avec une source érythréenne réelle.

**Diario Rombe (Guinée équatoriale) a été écarté du lot puis soumis à part** :
publication d'opposition éditée depuis l'Espagne, principale voix indépendante
sur un pays sans presse libre — mais ce n'est pas de la presse locale, et ce
choix n'appartenait pas au code. **L'éditeur l'a accepté le 07/09/2026**, en
connaissance de cause ; l'entrée du registre porte une `note:` qui le dit.

---

## Les quatre arbitrages du 07/09/2026 sur le registre

Posés à l'éditeur en une fois, avec la mesure sous chaque question. Ce qui a
été décidé, et ce que le code en a fait :

**1. Les sept entrées mortes sont retirées.** Cinq domaines disparus
(`togofirst`, `lanation`, `beninwebs`, `acap_cf`, `conakrylive`) et les deux
doublons d'une adresse vivante (`jeune_afrique`, `citizen_tz`). Aucun pays ne
perd de couverture : chacun garde au moins une autre source, le contrôle
`verifier-sources.js` le prouve à chaque PR.

**2. Les quinze sites derrière Cloudflare passent par Google News.** Punch,
Nation, Monitor, L'Express, Igihe, Sudan Tribune, Graphic, Herald, Crisis
Group, APA… n'avaient produit **aucun article** sur les huit caches publiés
du 07/09. Chaque entrée devient une requête `site:<domaine>` sur l'édition
Google News du pays, `rss_method` mis en cohérence (le test de `tri.test.js`
l'exige).

**Ce que cette bascule donne réellement : rien de visible, et c'est mesuré
sur la collecte n° 850, la première après la fusion.** La phrase écrite
d'abord ici — « ils alimentent le flux et le niveau d'alerte, mais ne
comptent plus pour la fraîcheur » — était fausse. `sourceDateNonFiable`
n'écarte pas seulement ces articles du décompte de fraîcheur : il les fait
refuser par `estRecentReel`, donc ils n'entrent **jamais dans `ALL`**, jamais
dans le cache publié, jamais dans `getLiveAlertEvents`. Leur seule trace est
`HISTORIQUE`, qui pèse au plus 0,5 point dans `calcAlertScore`. Expérience
hors ligne sur la vraie page avec le flux Google News de Punch : 8 articles
lus, 0 retenu. Et sur les deux caches publiés du 07/09, **zéro article issu
d'une requête Google News** — sur les 331 du registre, pas seulement les
quinze. Les quinze médias Cloudflare sont donc perdus pour l'alerte, par
Google News comme par leur flux natif. La décision est maintenue en
connaissance de cause : la route reste écrite pour le jour où l'arbitrage
n° 4 changerait, et elle ne coûte rien.

**3. Les 94 notes de 72 posées en bloc redescendent à 68.** Les 71 médias du
06/09 et les 23 du 07/09 (tous marqués `col:'#4B5563'`) avaient reçu 72 sur
une mesure de publication, jamais après lecture. À 68 ils restent au
registre et dans le flux, mais **ne peuvent plus faire monter un niveau**.
Effet mesuré, et il est plus lourd que ce que la question annonçait :

| | Avant | Après |
|---|---:|---:|
| Sources capables d'alerter | 211 | **175** |
| Pays à source unique | 1 | **13** |

La question disait « le plafond remonterait de 1 à 6 » : c'était une
estimation, la mesure a d'abord dit **13** — BI CG ER GM GQ GW KM LS LY MZ
SL SS SZ. `PLAFOND_PAYS_SOURCE_UNIQUE` est remonté à 13 : la valeur 1
mesurait une dette masquée par des notes provisoires, pas une dette
résorbée.

**Puis 13 s'est révélé lui-même un sous-compte, le même soir.** Les deux
contrôles de registre tenaient pour « capable d'alerter » toute source
notée 70 ou plus. Or **50 de ces sources sont des requêtes Google News de
recherche**, que la page écarte avant `ALL` (voir ci-dessus) : AIP 90,
ACLED 95, Crisis Group 93, ISS 91, AIB 88, AMAP 85, MAP 82, TAP 81, MENA 80,
APS 80, les présidences… et les quinze médias Cloudflare tout juste
basculés, avec leur note d'origine. Treize pays paraissaient couverts par
une source qui ne peut rien signaler. La règle vit désormais dans
`scripts/lib/capacite-alerte.js`, les deux contrôles la partagent, et un
test la confronte entrée par entrée à `sourceDateNonFiable` dans la page.
Compte réel : **26 pays à source unique** — AO BI BJ BW CD CG DZ ER GA GM GQ
GW KM LR LS LY MR MZ SC SD SL SS SZ TG TN ZW — aucun à zéro. Le cliquet est
à 26, et un test exige qu'il reste égal à la dette mesurée. Il redescendra
média par média, à mesure que les titres relus retrouvent 72, ou quand une
agence nationale retrouvera un flux natif au lieu d'une requête Google News.
Le chemin de retour est une lecture éditoriale, pas un correctif.

**Le coût de la décision, mesuré sur le cache d'après** : 153 articles
au-dessus du normal, dont **55 ne tiennent qu'aux 94 médias** (12 critiques,
13 élevés, 30 modérés). Parmi les critiques : l'effondrement d'un immeuble
à Maal (Mauritanie, 5 morts), 80 migrants présumés morts au départ de la
Gambie, le rapport d'Amnesty sur 37 fidèles enlevés au Nigeria. Mais aussi
un match de Trabzonspor, un sommet d'affaires à Bangkok et une tribune sur
l'IA classés critiques : la note en bloc couvrait des titres mal calibrés,
c'est la raison d'être de la lecture. La liste de lecture est produite dans
l'ordre du risque : d'abord les médias des pays à source unique, puis par
niveau du pays, puis par nombre d'articles au-dessus du normal portés seul.

**4. Google News : statu quo.** Le `robots.txt` interdit `/rss/`,
`fetchRespectueux` le respecte, la page retombe sur les relais publics. Rien
ne change dans le code. Mais la mesure du n° 850 déplace la question : même
relayées, ces requêtes ne produiraient **aucune** actualité ni alerte, parce
que `sourceDateNonFiable` les écarte par construction. **331 des 576 entrées
du registre ne servent donc qu'au bonus historique**, plafonné à 0,5 point.
La vraie question à poser à l'éditeur n'est pas « relais ou pas » mais :
que faire des cinquante sources de premier rang (agences nationales, ACLED,
Crisis Group, ISS) dont la seule route est une requête Google News ? Leur
trouver un flux natif est la réponse qui rend la note à ce qu'elle mesure.

**L'éditeur a dit oui le soir même, et la sonde a rendu douze flux.** Même
méthode que pour les médias locaux : emplacements RSS usuels et
auto-découverte, avec `curl`, sur les cinquante domaines. Douze flux natifs
vivants, tous avec des articles du jour : AIB, AMAP (la vraie agence est
`amap.ml` ; l'accueil du registre pointait sur Maliweb), Radio Okapi, SIG
Burkina, AIP, Daily Monitor (`/rss.xml`, l'ancien `/uganda/rss` était
mort), ATOP, FrontPageAfrica, AGP Gabon, AMI, KNA, Parlement CEDEAO. Le
cliquet descend de **26 à 21** : GA, LR, MR, TG et CD sortent de la source
unique.

Ce qui n'a pas été basculé, et pourquoi :

- **Punch** : son flux natif répond d'ici, mais c'est l'adresse exacte qui
  a produit zéro article sur huit caches publiés depuis GitHub. Le remettre
  serait remettre l'état mesuré mort.
- **Crisis Group** : deux flux, l'un mélange des titres de suivi
  (« Washington 27 August 2026 #3 »), l'autre écrit ses dates en toutes
  lettres (« Friday, August 28, 2026 - 12:46 »), que `new Date()` refuse.
  Il faudrait un analyseur de date de plus pour une seule source
  internationale.
- **Union africaine** : `au.int/rss.xml` n'a rien publié depuis mai 2025.
- **Cinq requêtes doublonnent un flux natif déjà lu** : Koaci, L'Infodrome,
  Abidjan.net, ACLED, ISS. Les retirer est une décision de registre.
- **Le reste** : défi Cloudflare (Sudan Tribune, Nation, Herald, Igihe, MAP,
  MENA, L'Express, ABP, SNA, APA), ou aucun flux trouvé (APS, ENA, ANGOP,
  i24, Graphic, présidences et assemblée du Sénégal), ou site injoignable
  d'ici (TAP, certificat ; AGuinée, NAMPA, présidence ivoirienne).

AMI et KNA répondent en quarante secondes deux fois sur trois : ils
retomberont peut-être en veille. Ce n'est pas pire qu'une requête Google
News muette, et la prochaine collecte le mesure.

**Mesuré sur la collecte n° 851, la première après la bascule.** Huit des
douze produisent depuis GitHub : AMAP 9 articles, Radio Okapi 9, Daily
Monitor 12, AGP Gabon 8, SIG Burkina 3, AIB 1, AIP 1, ATOP 1 — 44 articles,
13 au-dessus du normal, le plus frais à douze minutes. Quatre ne donnent
rien : AMI et KNA (les deux lents), FrontPageAfrica (flux vivant d'ici,
muet depuis le runner), Parlement CEDEAO (rien publié depuis juin). Le
cache passe de 1 412 à 1 522 articles ; les Comores en sortent, non à
cause de la bascule mais parce que leur dernier article a vieilli hors
fenêtre.

**Et la même collecte a fait passer trois pays au rouge sur un seul
article chacun.** `calcAlertScore` rejoué hors ligne sur le cache publié,
pays par pays :

| Pays | Socle vérifié + facteurs | Ce qui ajoute le dernier point |
|---|---:|---|
| Centrafrique | 13 | « Fraude alimentaire : à Bangui, des consommateurs dénoncent des produits frelatés » (élevé) |
| Niger | 13 | « Santé militaire dans l'espace AES : le médecin-colonel … prend les rênes » (élevé, congrès de médecine) |
| Ouganda | 12 | « Bishop Suubi, leaders link domestic violence to school dropouts at Bugiri wedding » (élevé, mot « violence ») + un portrait de Jeune Afrique (élevé, mot « menace ») |

Le seuil du rouge est 14. Six pays ont un socle à 12 ou 13 — CF MZ NE SS
CM UG — et **n'importe quel article classé élevé par une source à 70 les
fait basculer**, recoupé ou non. `borneRougeVerifie` ne joue pas : le
socle est déjà marron, c'est le cas qu'elle autorise. La collecte change
le niveau de 7 pays sur 54 ce soir-là ; les trois passages au rouge
tiennent tous à un titre qui n'est pas un incident. La question posée à
l'éditeur : le point qui fait franchir le rouge peut-il venir d'un article
seul, ou doit-il être recoupé ou critique ? Effet mesuré de la seconde
règle sur ce cache : rouge 8 → 5, rien d'autre ne bouge. À passer par
`tableau-niveaux.js` avant toute décision.

**Un prénom n'est pas un pays.** « Anicet Ekanè - Son dernier combat
politique pour Kamto », article camerounais dont le corps commence par
« Maurice Kamto a choisi le Manidem », était rattaché à l'**île Maurice**,
ville Port-Louis, classé élevé, et faisait passer l'île de jaune à orange.
Masque `maurice kamto` dans `TERMES_AMBIGUS_MASQUES`, test vu tomber sans
le masque.

---

## Le même fait en trois langues

`articlesSontDoublons` compare les mots significatifs des titres. Entre deux
langues il n'y en a aucun de commun : « 25 tuées dans un accident de bus »,
« Bus crash kills 25 », « Acidente de autocarro faz 25 mortos ». Mesure du
06/09/2026 sur le cache publié : **l'accident de Fogo (Cap-Vert) y figurait
cinq fois**, dont trois au niveau élevé, et aucune paire n'était reconnue.

Le pont, dans le noyau (`memeEvenementEntreLangues`), n'est pas une
traduction. Deux titres sont rapprochés s'ils portent **le même nombre** —
un bilan, jamais une année — **et un mot de la même famille d'événement**,
les familles étant douze courtes listes de synonymes en trois langues
(`FAMILLES_EVENEMENT`). Le nombre seul serait trop faible, la famille seule
aussi ; les deux, dans le même pays et la même fenêtre, ne désignent qu'un
fait.

Effet mesuré sur deux caches publiés : 0 → 6 paires reconnues (les quatre
articles de Fogo se replient en un), 0 → 5 (Fogo à nouveau, plus un incendie
en Indonésie en deux langues). **Chaque nouvelle fusion a été relue.**

**La limite, à garder en tête** : un article de *suivi* qui reprend le bilan —
« deux jours de deuil national pour les 25 victimes » — est replié avec
l'accident. Les funérailles, sans chiffre, restent un article à part, et un
test l'exige. C'est un arbitrage : un doublon gardé coûte moins qu'un fait
effacé, mais un suivi replié n'est pas effacé, il corrobore. Si un jour un
suivi doit rester visible, c'est cette règle qu'il faut affiner, pas retirer.

**La trace des fusions s'allongeait sans fin.** Le cache partagé est
refusionné à chaque cycle avec les articles frais, qui portent les mêmes
identifiants : le même repli se rejouait à chaque passage et `_fusionnes`
grossissait. Mesure du 07/09/2026 sur le cache publié : **372 traces pour
46 articles distincts**, 28 fois le même titre, 98 Ko sur 1,4 Mo. Défaut
préexistant, vu seulement en relisant les fusions du pont. Un repli déjà
tracé ne se note plus une seconde fois ; un test rejoue deux cycles.

La garde à l'ajout ne suffisait pas : après elle, **60 répétitions
subsistaient, toutes héritées**, sur six articles dont le jumeau ne revient
plus dans le flux — jamais refusionnés, donc jamais retouchés. La trace de
tous les articles est normalisée à l'entrée de `dedupliquerArticles`, à
chaque cycle. Mesurer après chaque étape, pas seulement après la première.

**Et le sport a des trous de vocabulaire, pas de règle.** `estContenuSportif`
existait et classait bien en « sport » ; deux titres sont passés en critique
parce qu'aucun de leurs mots n'était dans la liste — « Coupe de la
Confédération », « CAN U20 », « handball », « s'incline face ». Les
compétitions continentales de clubs, les catégories d'âge et les sports
collectifs hors football manquaient. Quand un match remonte en alerte,
chercher le mot manquant, pas une nouvelle règle.

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
