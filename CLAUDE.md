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

**Le 20/09/2026, une seconde sortie a été ajoutée sur le même canal** :
`scripts/lib/alerte-couverture.js` annonce les changements de l'*ensemble*
des pays sans actualité de moins de 12 h (`couverture.paysSansArticleFrais`),
jusque-là calculé et journalisé à chaque cycle sans que personne ne le
relise ailleurs que dans les journaux GitHub Actions. Trois collectes
réelles indépendantes ce jour-là, étalées sur quatre heures, ont donné
**exactement le même septuor** (BI, BJ, ER, KM, LS, MR, SC) — un signal
stable, pas un accident de collecte, et pourtant invisible sans aller le
chercher à la main. C'est le pendant côté exploitation de ce que `paysMuet()`
fait déjà côté interface (voir « Silence n'est pas calme »).

Même règle « on n'annonce que les changements » que ci-dessus, avec une
différence : contrairement à un changement de niveau, un pays sans actualité
dès le tout premier signalement est une information utile, pas un faux
départ — rien n'est donc supprimé au premier run. État propre dans
`web/historique/couverture-signalee.json`, à côté de `dernier-signale.json`
mais indépendant de lui.

**Délibérément PAS branché sur `couverture.enVeille`** (sources en échec
répété) : ce chiffre est mesuré volatile d'un cycle à l'autre selon la
saturation des proxys CORS publics — 43 → 96 en quatre heures le 20/09/2026,
sans rien de cassé entre les deux passages — et alerter dessus produirait
justement le canal qu'on finit par couper.

---

## L'identité d'envoi ignorée par le format image

Le menu de partage d'une actu ou d'un rapport propose « Signer en tant que »
dès que plus d'une identité d'envoi est configurée (`identite1/2/3`,
Paramètres > Marque personnalisée). Jusqu'au 21/09/2026, ce choix
n'atteignait que le format **texte** (`signatureEnvoiActuelle()`, en pied de
message) — le format **image** (`genererImageActuBlob`,
`genererImageRapportBlob`, dessin `<canvas>`) ne dessinait que
`nomMarqueActuelle()`, le nom de *marque*, un champ différent de l'identité
choisie pour ce partage précis. Un utilisateur signant « Jean Dupont » en
texte mais partageant en image voyait cette identité disparaître sans le
moindre message.

`identiteEnvoiActuelle()` porte maintenant la résolution partagée par les
deux formats (nom seul, sans les `\n\n— ` du format texte, que `<canvas>` ne
sait pas interpréter comme un saut de ligne) ; les deux fonctions de dessin
l'affichent en bas à droite de l'image, symétrique à la date en bas à
gauche. Neuf tests dans `scripts/test/identite-envoi.test.js`, vus échouer
sur l'ancien code (`identiteEnvoiActuelle is not defined`).

---

## L'adresse de l'administrateur ne vit plus dans le code servi

Audit de sécurité du 21/09/2026 : `const ADMIN_EMAIL = '...'` vivait en clair
dans `web/SentiqS_Web.html` — n'importe quel visiteur pouvait la lire via
« Afficher le code source ». Une vingtaine de comparaisons (`user.email ===
ADMIN_EMAIL`) décidaient qui garde un accès illimité, qui ne peut pas être
suspendu/supprimé, qui voit son adresse masquée dans les tableaux d'admin.

La vraie frontière de sécurité vivait déjà ailleurs et n'a pas bougé : la
migration `app/sentinel-app/supabase/migrations/20260718020000_profiles_auth.sql`
attribue le rôle `admin` par un trigger `before insert` côté serveur — ce
fichier-là n'est jamais servi par Pages. Le client n'avait donc jamais
besoin de connaître l'adresse elle-même, seulement de lire un rôle déjà
posé par le serveur.

`estAdmin(u)` remplace toutes les comparaisons : lit `.role` sur un objet
utilisateur/session, et ne retombe sur une recherche par e-mail dans
`getUsers()` que pour les rares agrégats qui n'en portent pas (stats de
téléchargement/trafic par e-mail seul). Six tests dans
`scripts/test/est-admin.test.js`, vus échouer sur l'ancien code avant le
correctif.

**Ce qui reste, et pourquoi.** Deux messages affichés à un utilisateur
suspendu ou dont l'essai a expiré ont toujours besoin d'indiquer une
adresse de contact réelle — ce n'est pas une vérification de droits, c'est
une information utile qu'on ne peut pas supprimer sans casser le parcours
de récupération. Isolée dans `SUPPORT_CONTACT_EMAIL`, avec la même valeur
qu'avant faute d'adresse professionnelle à y mettre : à remplacer dès qu'il
en existe une, dans cette seule constante.

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
règle sur ce cache : rouge 8 → 5, rien d'autre ne bouge.

**L'éditeur a tranché le soir même : recoupé ou critique.** La règle est
`borneRougeRecoupe`, dans le noyau à côté de `borneRougeVerifie` : quand le
socle ne place pas déjà le pays au rouge, le rouge automatique exige qu'au
moins un signal du jour soit recoupé par une seconde source (fusion au
dédoublonnage) ou classé critique — un critique n'entre dans
`getLiveAlertEvents` que corroboré. Chaque signal live porte désormais
`recoupe` et `niveauArticle`, parce que `verified` y est un drapeau
d'affichage forcé à `false`. Rejeu de la vraie page sur le cache publié,
avant et après : **CF, NE et UG reviennent au marron, aucun autre pays ne
bouge**, et `motifPlafond` dit pourquoi. `tableau-niveaux.js` mesure « au
repos », live à zéro : il ne peut pas voir cette règle, c'est le rejeu sur
un cache publié qui la mesure (`scripts/tableau-niveaux.js` reste la
référence pour tout ce qui touche au socle).

**Les cinq requêtes en doublon sont gardées**, décision d'éditeur du même
soir (Koaci, L'Infodrome, Abidjan.net, ACLED, ISS) : elles ne coûtent
qu'une requête par collecte et n'apportent que le bonus historique.

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

## L'audit d'interface du 07/09/2026

Première mesure de l'interface **rendue** — page servie localement dans
Chromium, DOM après rendu, trois largeurs. Ce que les contrôles existants ne
regardaient pas.

**L'écran annonçait « 12h » alors que la fenêtre en vaut 36.** Trente-deux
étiquettes : le compteur du Flux, la tuile « Pays couverts », les états
vides, les titres des fenêtres ouvertes depuis les tuiles, la marque
`paysMuet` (« depuis 12 h »), le badge de survenance (« ⚠ plus de 12h », qui
se déclenche à 36 h) — et les rapports exportés en PDF, Word et PowerPoint :
« ÉVÉNEMENTS DES DERNIÈRES 12 HEURES », envoyés aux clients. Seule la tuile
« Actus /Xh » avait été recalée en septembre, **parce qu'elle seule avait un
test**. Le français mentait là où l'anglais disait vrai (`note_flux` : « 12
dernières heures » contre « the last 36 hours »).

`libelleFenetre()` / `libelleFenetreCourt()` dérivent la durée de la
constante ; les textes traduisibles portent `{h}` / `{hc}`, substitués au
rendu ; le HTML statique porte `data-fenetre-h`. Un test refuse toute durée
d'actualité écrite en dur, avec trois exceptions justifiées : la fenêtre
propre à `getLiveAlertEvents` (12 h, volontairement plus courte), le badge
« -12H » (qui dit vrai), et la validité de l'essai gratuit.

**Un « a » collé devant une déclaration faisait disparaître le vert.** Ligne
100 : `a--g:#0F4F2A`. Déclaration invalide, donc `--g` n'existait pas dans le
thème clair — le thème sombre, lui, le définissait. Quatorze usages sans
valeur de repli : la propriété était abandonnée sans un mot. Cinq autres
jetons étaient lus sans être déclarés, avec des replis pris à une **autre
palette** : `var(--rouge,#b3261e)` et `var(--vert,#2e7d32)` coloraient les
flèches de tendance, `var(--acc,#2563eb)` un lien, et `var(--surface)`
n'avait aucun repli. C'est la panne décrite dans `scripts/lib/contraste.js`,
en pire.

**Nuance à garder :** j'avais d'abord annoncé que le compteur « Recoupés »
s'affichait en noir. Le jeton était bien indéfini — mesuré dans le
navigateur — mais ce compteur-là vit dans une bande repliée par défaut, et
Chromium ne recalcule pas les styles d'un sous-arbre `display:none`. La
mesure valable est celle du témoin : `color:var(--g)` rendait le noir hérité
avant, `#0F4F2A` après.

**117 textes sous le seuil AA, jamais mesurés.** Le contrôle d'interface ne
regardait que les *noms* accessibles. Le gris secondaire `#718096` (une
centaine d'usages) plafonnait à 4,02 sur blanc et 3,41 sur le fond de page ;
le jaune de gravité `#CA8A04` tombait à 2,49 — une couleur d'**alerte**,
portée par le nombre « pays en tension ». Corrigés : `--lg` → `#5D6B7E`, et
`--j-txt:#854D0E` pour le jaune **en texte** seulement — la pastille et le
fond gardent `#CA8A04`, qui est la signature du niveau. `NIV.jaune` portait
déjà cette variante texte. Mesure : **117 → 0**.

**On ne pouvait pas changer de module sans souris.** Parcours réel à la
touche Tab : quatorze arrêts, aucun n'était un onglet. Les huit modules sont
des `<div onclick>`. Sur 130 éléments cliquables, 118 étaient invisibles au
clavier. Le cliquet d'accessibilité était vert pendant ce temps : il mesure
les noms accessibles des champs, une propriété plus étroite que la
pilotabilité. **Il ne mentait pas, il mesurait autre chose** — c'est la leçon
à retenir de ce cliquet-là.

La barre devient `role="tablist"`, chaque module `role="tab"` avec
`aria-selected` et un **tabindex glissant** : un seul arrêt de tabulation,
les flèches circulent dedans, Entrée active. Trente-six liens écrits en
`<span onclick>` reçoivent `role="button"` et `tabindex`. Dette : **118 →
61**, presque tous des cartes conteneurs. Elle descend en convertissant une
action qui compte, jamais en posant un `tabindex` sur tout : faire de chaque
carte un arrêt rendrait le parcours inutilisable, une régression pour la
personne qu'on prétend aider.

**Une largeur d'écran ne dit pas si une barre déborde.** À 768 px la barre
mesurait 823 px, « Tableau de bord » était hors champ, et les flèches
restaient cachées parce que leur règle vit dans `@media (max-width:760px)`.
`majDebordementOnglets()` mesure `scrollWidth` contre `clientWidth` ; la
règle l'emporte sur les modes forcés, parce qu'une barre qui déborde doit
montrer la sortie.

### Trois cliquets de plus, mesurés sur le DOM rendu

`verifier-accessibilite-interface.js` en porte désormais trois, tous mesurés
après rendu et jamais sur le fichier source :

| Cliquet | Valeur | Ce qu'il refuse |
|---|---:|---|
| `PLAFOND_CHAMPS_SANS_NOM` | 0 | un champ sans nom accessible |
| `PLAFOND_TEXTES_SOUS_CONTRASTE` | 0 | un texte sous le seuil AA |
| `PLAFOND_CLIQUABLES_SANS_CLAVIER` | 61 | un cliquable de plus hors de portée du clavier |

Plus une règle sans plafond : **aucun onglet de module ne peut sortir de
portée du clavier**. Vus échouer sur la version cassée — 104 textes sous le
seuil, code de sortie 1.

### Ce qui n'a pas été touché, et pourquoi

- **343 px de bandeaux avant le premier contenu sur un téléphone** (41 % de
  l'écran), dont 175 px pour le bandeau d'explication de la collecte. Il
  porte déjà une croix qui mémorise le renvoi ; réduire son contenu est une
  décision éditoriale.
- **180 textes sous 10 px**, les trois tailles dominantes étant 9, 9,5 et
  8,5 px. Remonter l'échelle typographique change la densité de toutes les
  vues : c'est un arbitrage, pas un correctif.
- **Pas d'échelle d'espacement** : 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
  16, 20, 24, 28, 36 et 40 px — tous les nombres. Chaque écran a été réglé à
  la main.
- **Les 172 incidents saisis n'ont pas d'accents** (« Attaque signalee
  convoi logistique axe Kaya-Dori »). C'est de la donnée, pas du code.
- **La vue Alertes répète le même avertissement de quarante mots sur chaque
  carte**, affiche « Aggravants : 7 » puis « Facteurs : 7 » — même nombre,
  deux noms — et « RSS applique: 0/0 », qui ne veut rien dire pour un
  lecteur. Pendant ce temps ce qui distingue les pays rouges (87,5 / 86,5 /
  85,3 / 84) est en 9 px et « ROUGE » est répété cinq fois par carte.

---

## La refonte visuelle du 21/09/2026 : amplifier l'identité existante

L'audit du même soir (sécurité / marketing / design) jugeait le design « trop
classique ». Deux éléments d'identité existaient déjà, choisis lors du 3ᵉ
rebranding (« Horizon Cobalt & Bronze »), mais quasi invisibles à l'usage :
`--font-serif` (3 usages réels sur 20 900 lignes, tous dans des wordmarks) et
l'accent bronze `--sig` (1 seul usage, sur une balise de thème). La refonte
n'invente donc pas une nouvelle palette — elle amplifie une identité déjà
tranchée mais sous-employée.

**Un mockup séparé, comparé avant de toucher au fichier servi.** Deux
artboards (`Connexion`, `Tableau de bord`) ont d'abord été construits comme
Artifact, en fond sombre par défaut. Confronté au `:root` du fichier réel, qui
porte une consigne explicite — pas de fond très sombre par défaut — l'écart a
été posé à l'éditeur plutôt que tranché seul : le thème clair reste celui par
défaut. Seules les idées typographiques et de hiérarchie du mockup passent en
production, pas sa palette sombre en tant que défaut.

**Premier incrément, scope volontairement restreint au tableau de bord.**
Deux changements dans `renderDashboard()` :

- Les tuiles pays du cartogramme (`zonePanel()`, dans `cartogramme()`)
  passent d'un fond simplement teinté par le niveau à une carte blanche,
  bordure supérieure colorée, ombre portée, score en 17px mono, et surtout un
  **nom de niveau en toutes lettres** (`NIV[s.key].sous` — Stable / Modéré /
  Élevé / Critique / Grave), absent jusqu'ici : seule la couleur portait le
  niveau, ce qui ne sert à rien pour un lecteur qui la distingue mal.
- L'en-tête « Carte régionale des risques » (et ses variantes Radar / Profil)
  passe en `var(--font-serif)`, seul vrai usage de titre de section avec ce
  traitement — l'étiquette « TABLEAU DE BORD » en tout-petit-capitales n'y
  passe pas, le serif y nuirait à la lisibilité plutôt que d'aider.

**`marqueSilence(s.cy)` a changé de voisin dans la tuile**, pas de rôle : elle
s'affiche désormais à côté du nom du niveau plutôt qu'à côté du score. Le
test `la marque est cablee dans la tuile du cartogramme`
(`scripts/test/silence.test.js`) vérifiait l'ancienne adjacence par une
regex exacte ; il a été mis à jour pour vérifier la nouvelle, pas supprimé —
c'est le genre de test qui doit casser bruyamment si `marqueSilence` disparaît
de la tuile, casser au premier remaniement de mise en page n'est pas une
raison de l'affaiblir.

Vérifié : `npm test` (403/403), `verifier-syntaxe-html.js`, et une capture
Playwright du tableau de bord rendu (thème clair, jeton collecteur) comparée
à la version d'avant.

**Deuxième incrément : le Flux.** Un seul changement, volontairement
minuscule : le bandeau diviseur par pays (visible en mode « Tous les pays »,
`renderFeed()`, ligne ~11385) passe le nom du pays en `var(--font-serif)` —
le seul autre vrai « titre de section » du Flux, au même rang que l'en-tête
du cartogramme. Les titres d'actu eux-mêmes (`.atit`) n'ont **pas** été
touchés.

**Ce qui a été vérifié avant de ne pas y toucher, et pourquoi c'est
important à noter.** `.atit`/`.asum`/`.rtg` sont déclarés deux fois dans la
feuille de style : une première fois ligne 568 (13px/700), une seconde ligne
1670, sous le commentaire « Titre des cartes » et avec `!important` sur
chaque propriété. Les deux ont la même spécificité ; à spécificité égale
c'est la déclaration la plus tardive dans le fichier qui l'emporte, donc
c'est la seconde qui régit réellement l'écran — mesuré par style calculé
dans Chromium (12,5px/600/IBM Plex Sans), pas supposé. Le commentaire laisse
penser qu'elle vise `.acard` (les cartes KPI/Alertes) ; en réalité `.atit`
n'est utilisé nulle part dans du `.acard`, seulement dans les cartes `.art`
du Flux et de la mini-liste « Articles source » de Géopolitique — c'est donc
bien le Flux qu'elle régit, sous un commentaire qui décrit autre chose.
Retenu comme **lecture plausible plutôt que bug tranché** : alléger le poids
d'un titre répété plusieurs centaines de fois à l'écran est un choix de
densité défendable, pas forcément un accident. N'a donc pas été « corrigé »
sans arbitrage — seulement mesuré et écrit ici, pour que la prochaine passe
sur le Flux parte de l'état réel plutôt que du commentaire trompeur.

Vérifié : `npm test` (403/403), `verifier-syntaxe-html.js`, et le Flux rendu
avec le cache réel du 20/09 injecté dans `ALL` (la collecte réelle est
inatteignable depuis ce bac à sable — voir « Contraintes de cet
environnement d'exécution »).

**Troisième incrément : les Alertes.** Deux changements dans `v-alertes`
(HTML statique) : le titre « Module Niveau d'Alerte Sûreté » et l'en-tête
« Tableau récapitulatif — Niveaux d'alerte par pays » passent tous les deux
en `var(--font-serif)` — mêmes titres de section que le tableau de bord et
le Flux, même traitement.

**Et un troisième changement, hors typographie mais découvert en lisant
`renderAlertCard` pour ce pass.** Chaque fiche pays affichait une ligne de
debug interne, inconditionnelle (`score.debug` est toujours renseigné, le
`?:` qui semblait la gater ne gate donc jamais rien) : `Verifies: X | RSS
applique: Y/Z | Facteurs: N`. C'est exactement les deux défauts nommés dans
l'audit du 07/09/2026 (« Ce qui n'a pas été touché, et pourquoi ») :
`RSS applique: 0/0` illisible pour un lecteur, et `Facteurs: N` qui
redouble — même valeur, `score.debug.specials` n'étant que
`score.specialScore` recopié — le « Aggravants : N » déjà affiché juste
au-dessus dans la bande de score. Contrairement aux autres points de cette
liste, celui-ci n'avait pas de justification éditoriale associée dans
CLAUDE.md : ligne supprimée du rendu de la carte. L'objet `score.debug`
reste en place (rien d'autre n'en dépendait, vérifié par recherche dans
`scripts/test/`) — seul son affichage dans la carte disparaît.

Vérifié : `npm test` (403/403), `verifier-syntaxe-html.js`, et les 54 fiches
pays rendues avec le cache réel du 20/09 injecté dans `ALL` (`recalcAlertes()`
appelé directement, `switchView` seul ne suffit pas à peupler la grille dans
ce contexte de test).

**Ce qui reste hors scope** : la répétition « ROUGE » (badge + libellé) et le
9 px qui distingue les scores les plus élevés, tous deux nommés dans l'audit
du 07/09/2026, n'ont pas été repris ici — ce sont des questions de hiérarchie
visuelle de la carte, pas d'amplification de l'identité, et elles mériteraient
leur propre passage mesuré plutôt qu'un ajout à celui-ci. Agenda,
Géopolitique, Synthèse et Rapports n'ont pas non plus été touchés.

**Quatrième incrément : l'Agenda.** Trois titres, tous de vrais moments de
« masthead » plutôt que des étiquettes structurelles, passent en
`var(--font-serif)` :

- Le titre de module « Agenda sûreté — [zone] » (`#agTitreZone`, mis à jour
  dynamiquement par `renderAgenda()` — c'est un attribut `style`, pas la
  classe `.ag-tt` partagée avec `#geoTitre` de Géopolitique, pour ne pas
  faire déborder ce changement sur un module qui n'est pas encore passé).
- Le libellé mois de la vue Calendrier (« Septembre 2026 »,
  `renderAgendaCalendrierHtml`).
- Le libellé année de la vue Année (« 2026 », `renderAgendaAnneeHtml`).

Les en-têtes de section internes (« ÉVÉNEMENTS PASSÉS DE 2026 », les
étiquettes de statut EN COURS/URGENT/PLANIFIÉ) restent en petites capitales
sans-serif — même logique que la tuile « TABLEAU DE BORD » et les libellés
de ville du Flux : ce sont des repères de structure, pas des titres.

Vérifié : `npm test` (403/403), `verifier-syntaxe-html.js`, et les trois vues
(liste, calendrier, année) rendues avec le cache réel du 20/09 injecté dans
`ALL` (105 événements dérivés via `articleVersAgenda`).

**Cinquième incrément : la Géopolitique.** Un seul changement : le titre de
module `#geoTitre` passe en `var(--font-serif)`, via un attribut `style`
propre (même raison que pour `#agTitreZone` : la classe `.ag-tt` est
partagée entre les deux titres, seul celui du module en cours de passage
doit changer). `#geoTitre` sert aussi bien à l'aperçu (« Géopolitique ») qu'à
la fiche d'un pays sélectionné (« Géopolitique — 🇨🇫 Centrafrique »,
texte remplacé par `childNodes[0].nodeValue`, jamais l'attribut `style`) : le
changement couvre donc les deux vues sans édition supplémentaire.

Pas d'autre section de ce module ne s'y prêtait : les libellés restants
(« PUBLICATIONS GÉOPOLITIQUES — SOURCES OUVERTES & GRATUITES », « ARTICLES
SOURCE », les cartes-thème dans `genererAnalyseGeopolitique`) sont soit des
petites capitales structurelles, soit des cartes de contenu répétées — même
distinction que dans les quatre incréments précédents.

Vérifié : `npm test` (403/403), `verifier-syntaxe-html.js`, et les deux vues
(aperçu et détail pays) rendues avec le cache réel du 20/09 injecté dans
`ALL`.

**Sixième incrément : la Synthèse** (module interne « analyse »,
`id="v-analyse"` — le nom d'affichage a changé sans que l'id ni les
identifiants JS suivent). Un seul changement, mais le plus net des six :
`.sy-tt`, le titre de la page de couverture du rapport (« Synthèse
sécuritaire — [zone] »), passe en `var(--font-serif)`. Classe éditée
directement (un seul usage dans tout le fichier, contrairement à `.ag-tt`
partagée entre Agenda et Géopolitique) plutôt qu'un attribut `style`.

C'est le bloc `.sy-cv` qui s'en rapproche le plus d'une vraie couverture de
rapport dans toute l'appli : une étiquette d'usage restreint au-dessus, le
titre, la date, puis les compteurs critiques/élevés/sources — la mesure
avant/après est nette, le titre se détache maintenant clairement de
l'étiquette au-dessus et des sections en dessous, plutôt que de n'être
qu'une ligne plus grosse dans la même famille sans-serif. `.sy-tg`
(étiquette d'usage restreint, petites capitales) et `.sy-shd` (en-têtes de
catégorie — Situation sécuritaire, Axe humanitaire, Pouls réseaux
sociaux...) restent sans-serif, même distinction que partout ailleurs.

Vérifié : `npm test` (403/403), `verifier-syntaxe-html.js`, et la synthèse
rendue avec le cache réel du 20/09 injecté dans `ALL` (`updSynthese()`
appelé directement après `switchView('analyse', ...)` — le nom de vue
interne, pas le libellé affiché).

**Septième et dernier incrément : les Rapports.** Le titre de module
« Rapports & exports » (static HTML, sans id, pas de classe partagée) passe
en `var(--font-serif)`.

**Et une trouvaille qui referme la boucle plutôt que d'ouvrir un nouveau
chantier.** En cherchant s'il existait, comme pour la Synthèse, un vrai
« masthead » de couverture à amplifier dans ce module, il s'est avéré que
les documents générés pour impression/aperçu (`_apPageWrap`, utilisée par
Flux/Agenda/Alertes/Rapport complet, et son équivalent autonome
`_buildRapportSyntheseHTML`) importent **déjà** Source Serif 4 depuis
Google Fonts et l'utilisent pour leur `<h1>` (40px/800) et leurs chiffres
de synthèse (32px/700) — cohérent avec `--sig`/`--font-serif`, mais écrit
indépendamment, avant cette série d'incréments. Les documents exportés
(Word/PDF/PowerPoint envoyés aux clients) étaient donc déjà à l'identité
cible ; c'est l'interface live qui était en retard, exactement ce que ces
sept incréments viennent de rattraper. Rien à changer côté export.

Vérifié : `npm test` (403/403), `verifier-syntaxe-html.js`, et le module
rendu avec le cache réel du 20/09 injecté dans `ALL`.

**Bilan des sept incréments (21/09/2026).** Tableau de bord, Flux, Alertes,
Agenda, Géopolitique, Synthèse, Rapports — chaque titre de section réel
amplifie maintenant `var(--font-serif)`, jamais les petites capitales
structurelles ni les titres d'articles/cartes répétés en liste, cette
distinction étant tenue identique d'un module à l'autre. Un seul effet de
bord trouvé et corrigé en cours de route, documenté à son incrément : la
ligne de debug qui fuitait dans chaque fiche d'alerte (3/N) — le reste de
chaque passage s'est limité à la typographie. Aucun test cassé sur les sept
commits ; deux points restent volontairement écrits ici plutôt que corrigés
sans arbitrage éditorial (la répétition « ROUGE » et le score en 9px des
Alertes ; le fait que `.atit` du Flux soit piloté par une règle plus tardive
que celle qu'on lit en premier dans le fichier).

---

## L'identité d'envoi manquait aussi dans les rapports bureautiques

Suite du correctif du 21/09/2026 sur le format image (voir « L'identité
d'envoi ignorée par le format image ») : le menu de partage du module
Rapports propose *toujours* « Signer en tant que » (contrairement au partage
d'une actu, où il ne s'affiche qu'à partir de 2 identités configurées — un
rapport partagé au nom d'une organisation doit pouvoir préciser qui l'envoie
même avec une seule identité renseignée). Mais `_partageIdentiteChoisie`,
posée par `envoyerRapportCanal()` avant de générer le document, n'était lue
nulle part dans les cinq générateurs de document : `exportWord`, `exportPDF`,
`exportPPTX`, `_apPageWrap` (aperçu HTML de Flux/Agenda/Alertes/Rapport
complet) et `_buildRapportSyntheseHTML` (aperçu HTML de la Synthèse)
n'affichaient tous que `nomMarqueActuelle()` — le nom de *marque*, jamais
l'identité choisie pour ce partage précis. Un utilisateur choisissant
« Jean Dupont » voyait ce choix appliqué à l'image mais disparaître
silencieusement dès qu'il téléchargeait un Word, un PDF, un PowerPoint ou un
aperçu imprimable.

`identiteEnvoiActuelle()` est désormais lue dans les cinq, toujours en
**suffixe** du pied de page ou du bandeau de date/créneau existant, jamais à
la place de la marque : « Généré le [date] · Partagé par [identité] » (PDF
tronqué à 28 caractères, seul format à dessiner ce bandeau à position fixe
sans retour à la ligne — les autres sont en flux HTML/Word et absorbent
naturellement un nom plus long). Dans le PowerPoint, l'auteur du fichier
(métadonnée « Propriétés ») porte l'identité plutôt que la marque — la
Société (`pres.company`), elle, reste la marque, comme le veut la
convention Word/PowerPoint habituelle.

**Trouvée en même temps, sans lien avec l'identité :** la diapositive de
couverture du PowerPoint écrivait `'SentiqS'` en dur au lieu d'appeler
`nomMarqueActuelle()` — seul endroit du fichier où une marque personnalisée
restait ignorée alors que Word/PDF/l'aperçu HTML l'affichent tous
correctement. Corrigé au même endroit.

Vérifié : `npm test` (403/403), `verifier-syntaxe-html.js`, et les deux
aperçus HTML (Flux, Synthèse) ouverts dans Chromium avec deux identités
configurées — le texte généré contient bien « Partagé par Jean Dupont ».
Word/PDF/PowerPoint n'ont pas pu être exécutés dans ce bac à sable (leurs
bibliothèques — docx.js, pdf-lib, pptxgenjs — se chargent depuis
`cdn.jsdelivr.net`/`cdn.sheetjs.com`, injoignables ici, voir « Contraintes de
cet environnement d'exécution ») : le correctif y est strictement le même
motif, déjà prouvé sur les deux formats testables.

**Trouvée en creusant la même zone, une deuxième adresse en clair.** Le
métadonnées Excel (`exportExcel`, onglet « Métadonnées ») portait
`_maskEmail('yorot225@gmail.com')` — une deuxième copie littérale de
l'adresse à côté de `SUPPORT_CONTACT_EMAIL`, exactement la duplication que
cette constante devait éviter (voir « L'adresse de l'administrateur ne vit
plus dans le code servi »). Remplacée par `_maskEmail(SUPPORT_CONTACT_EMAIL)`.
Une troisième copie vivait dans le lien de contact du bandeau de pied de
page (HTML statique, avant tout script) : l'élément porte désormais un id
et son `href`/texte sont synchronisés depuis `SUPPORT_CONTACT_EMAIL` au
chargement, pour qu'un changement de cette constante se propage partout —
c'était tout l'intérêt de l'avoir isolée.

---

## Le rail de navigation vertical du 21/09/2026

Demande explicite : passer les neuf onglets de modules (Flux, Recherche,
Synthèse, Agenda, Géopolitique, Rapports, Alertes, Tableau de bord,
Paramètres) d'une barre horizontale à un rail vertical, sans rien changer
au fonctionnement. `.nav-wrap` (jusque-là frère de `.layout`, tous deux
enfants directs de `<body>`) devient le premier enfant de `.layout`, à
côté de `.main` : `.layout{display:flex}` range les deux côte à côte sur
ordinateur, `.ntab` passe de `border-bottom` à `border-left` pour son
accent de sélection, et `clavierOnglets(ev)` gagne `ArrowDown`/`ArrowUp`
comme alias de `ArrowRight`/`ArrowLeft` — un rail vertical se parcourt
naturellement de haut en bas.

**Mobile reste inchangé, mais ça ne va pas de soi.** Le rail vertical est
scopé au bureau ; sur petit écran (`html:not(.force-web)`) et en mode
mobile forcé (`html.force-mobile`) une règle restaure explicitement
`.nav-wrap{flex-direction:row}` pour retrouver la barre horizontale du
haut. Un premier jet laissait `.layout{display:flex}` (donc **ligne**, pas
colonne) sur mobile aussi, avec `align-items:stretch` hérité : `.nav-wrap`,
qui n'a plus de largeur fixe sur mobile, se dimensionnait alors à son
contenu (861 px, neuf onglets côte à côte) au lieu de la largeur de
l'écran, et s'étirait sur toute la hauteur disponible (`align-items:stretch`
sur l'axe croisé d'une ligne, c'est la hauteur) — un immense bandeau vide
avec les onglets perdus au milieu, mesuré et vu à l'écran avant d'être
compris. Correctif : `.layout{flex-direction:column}` sur mobile
uniquement, pour que `.nav-wrap` redevienne une bande horizontale de
hauteur naturelle au-dessus de `.main`, comme avant le passage au rail.

**Le module plein écran cassait aussi, silencieusement au premier clic.**
`ouvrirModulePleinEcran()` déplaçait explicitement `.nav-wrap` ET `.layout`
(`document.querySelector('body > .nav-wrap')`) vers l'overlay, parce que
les deux étaient jusque-là des frères directs du `<body>`. Une fois
`.nav-wrap` imbriqué dans `.layout`, ce sélecteur ne trouvait plus rien —
`navWrap.parentNode` levait `Cannot read properties of null`, détecté par
Playwright, pas par les 403 tests (aucun ne couvrait cette fonctionnalité).
Simplifié plutôt que rafistolé : `.nav-wrap` étant maintenant le premier
enfant de `.layout`, déplacer `.layout` seul suffit, il l'emporte avec lui.
`fermerModulePleinEcran()` simplifiée à l'identique.

`scripts/test/navigation-clavier.test.js` bornait sa tranche sur un
`</div>\n</div>` qui n'avait jamais été la vraie fin de `#navTabs` — une
coïncidence ailleurs dans le fichier, cessée d'exister après le
déplacement (piège récurrent de `tranche()`, déjà documenté plus haut).
Rebornée sur `<button class="nav-arrow nav-arrow-r"`, qui suit réellement
la liste d'onglets dans les deux dispositions.

Vérifié : `npm test` (403/403), `verifier-syntaxe-html.js`, et Playwright
sur trois configurations — bureau (rail vertical 208px, changement de
module au clic, `ArrowDown` déplace le focus), mobile auto-détecté à
390px (barre horizontale, largeur correcte), mobile forcé sur écran large
(barre horizontale identique) — plus l'aller-retour plein écran
(ouverture, fermeture, `.nav-wrap` restauré à sa place, changement de
module encore fonctionnel après).

---

## La bannière publicitaire retirée, pas seulement masquée

`initAdBanner()` était un no-op depuis un incident antérieur (Auto Ads
injectant des formats plein écran incontrôlables) et `.ad-banner` restait
`display:none` en dur dans le HTML — aucune publicité ne s'affichait plus
nulle part, mais tout le balisage (HTML, CSS, i18n FR/EN, les fonctions
`dismissAdBanner`/`initAdBanner`, les constantes `ADSENSE_CLIENT_ID`/
`ADSENSE_SLOT_ID`, la balise `<script>` AdSense commentée et le meta de
vérification de compte) restait en place, en attente d'une réactivation
qui n'était plus prévue. Demande explicite de retirer la pub : plutôt que
de laisser cette dette de code mort grandir, l'ensemble est supprimé —
`web/SentiqS_Web.html` ne contient plus aucune trace d'AdSense.

Effet de bord sur `ouvrirModulePleinEcran()` (voir section précédente) :
la liste des éléments masqués en plein écran perd `.ad-banner`.

**Ce qui reste, volontairement.** Le panneau d'administration
« Tarification & abonnements » décrit encore le modèle économique
(« La version gratuite reste financée par les publicités affichées... »)
et les grilles de fonctionnalités des offres portent « Publicités
affichées » / « Sans publicité ». C'est la description d'un modèle
tarifaire, pas du code d'affichage — retirer le bandeau ne change rien à
ce que ces offres promettent commercialement. Ce texte n'a pas été
touché : le faire aurait été un arbitrage sur l'offre commerciale, pas un
nettoyage de code mort, et il appartient à l'éditeur.

`scripts/test/chargement.test.js` portait déjà un test qui vérifiait que
le bandeau restait masqué (`display:none`) ; il est remplacé par un test
qui vérifie l'absence complète du balisage, des fonctions et de toute
trace AdSense — vu échouer sur l'ancien code avant le retrait.

Vérifié : `npm test` (403/403), `verifier-syntaxe-html.js`.

---

## Le Flux appliquait encore 12h, trois cycles après le passage à 36h

Signalement du 21/09/2026 : « la zone de consultation des actus est très
réduite et pénible à parcourir ». Le symptôme pointait vers l'affichage,
la cause était dans le filtre. `FENETRE_ACTUALITE_MS` (36h depuis le
06/09/2026, voir « La fenêtre d'actualité » plus haut) est censée
gouverner le Flux — mais `getFiltered()`, la fonction qui peuple
concrètement le Flux, portait son propre `MAX_AGE = 12*60*60*1000` en dur
et l'imposait à `antiHalluFilter()` en second argument, écrasant le repli
de cette dernière sur `FENETRE_ACTUALITE_MS`. Reste de l'ancienne fenêtre,
jamais mis à jour au moment du passage à 36h : le Flux affichait moins
d'un tiers de ce que la fenêtre documentée autorise, alors que le tableau
de bord et le compteur de pays couverts (qui appellent `estRecentReel()`
directement, sans ce second argument) affichaient déjà, eux, la bonne
fenêtre — deux modules de la même page en désaccord sur ce qui compte
comme actualité, sans qu'aucun contrôle ne le détecte.

**Mesuré sur un jeu synthétique de 746 articles répartis uniformément sur
0 à 39h** (rejoue `getFiltered()` sur la vraie page, comme `tableau-niveaux.js`
et les autres scripts de mesure de ce dépôt) :

| | Avant | Après |
|---|---:|---:|
| Articles affichés | 207 | **582** |
| Pays couverts | 35 | **48** |

Une distribution synthétique uniforme n'est pas la distribution réelle des
publications (voir « La fenêtre d'actualité » : les sources ne publient pas
à rythme constant), donc ces chiffres précis ne sont pas ceux d'une
collecte réelle — mais l'écart de nature (moins d'un tiers du contenu
promis par la fenêtre documentée) est la mesure qui compte ici, pas le
chiffre exact.

**Même défaut, deuxième endroit, plus grave car cumulatif.**
`publierCollectePartagee()` — la fonction qui écrit le cache partagé que
*tous* les visiteurs lisent (voir « Collecte planifiée ») — fusionne le
cache existant avec les articles fraîchement collectés, puis purge de la
fusion tout ce qui dépasse un âge donné avant de republier. Cette purge
portait le même `12*60*60*1000` en dur. Le job tourne plusieurs fois par
jour (3h24 à 5h51 d'écart réel, voir « Collecte planifiée ») : à chaque
cycle, tout article de 12 à 36h hérité d'un cycle précédent et non
re-collecté ce coup-ci (le cas courant pour la presse africaine qui publie
une fois par jour, voir « La fenêtre d'actualité ») sortait purement et
simplement du cache partagé — invisible pour quiconque le lit ensuite,
alors que la fenêtre documentée dit qu'il devait encore compter comme
actualité pendant jusqu'à 24h de plus.

**Troisième endroit, mineur** : `compteurRegional()` (statistique
« Régional » de la bande repliée du Flux) comptait aussi à 12h — même
correctif, impact visuel faible (bande repliée par défaut).

**Six autres occurrences du même `12*60*60*1000` étaient du code mort** :
une variable locale déclarée puis jamais lue, le filtre réel juste
en-dessous appelant déjà `estRecentReel()` (36h, correct) — dans le
purgeur de collecte, `updStats()`, `showKpiDrill()`, `renderDashboard()`,
le chargement du cache au démarrage, et `updateSocialCounts()`. Retirées :
un nom qui dit « 12h » a beau ne servir à rien, il ment à qui lit le code
ensuite.

**Deux occurrences restent, et sont légitimes — un cliquet nouveau les
distingue explicitement.** `getLiveAlertEvents()` garde volontairement une
fenêtre plus courte que le Flux (documenté plus haut, « La règle qui
compte »). `FCDO_CACHE_MS` n'a rien à voir avec la fraîcheur d'un article :
c'est la durée de cache d'un appel à l'API de conseils aux voyageurs du
Foreign Office britannique, une limitation de fréquence réseau qui
partage la même valeur numérique par coïncidence. `scripts/test/fenetre-flux.test.js`
compte les occurrences de `12*60*60*1000` dans tout le fichier et exige
exactement deux, nommées ; toute troisième future doit justifier
pourquoi elle échappe à `FENETRE_ACTUALITE_MS`, exactement le silence qui
a permis à ce défaut de durer trois passages d'arbitrage éditorial sans
être vu.

Les quatre tests de ce fichier ont d'abord été vus échouer sur le code
d'avant correctif (0/4).

Vérifié : `npm test` (407/407), `verifier-syntaxe-html.js`, `verifier-i18n.js`,
et la mesure Playwright ci-dessus rejouée sur `web/SentiqS_Web.html`.

---

## La refonte des tuiles du cartogramme avait réintroduit le jaune illisible

CI (`Moteur de collecte`, PR #94) a fait échouer `verifier-accessibilite-interface.js`
sur les tuiles pays du tableau de bord : 32 textes sous le seuil AA, tous
`rgb(202,138,4)` — le jaune d'alerte brut (`--j`, `#CA8A04`), 2,94:1 sur
blanc contre un seuil de 4,5:1. Exactement le défaut déjà corrigé une fois
(voir « L'audit d'interface du 07/09/2026 », `--j-txt` existe justement pour
ce cas) — réintroduit par le premier incrément de la refonte du 21/09/2026
(score en 17px + nom du niveau en toutes lettres dans `zonePanel()`), qui
réutilisait `scoreColor(s)` — pensée pour les bordures/pastilles — comme
couleur de **texte**.

`textColor(s)` ajouté à côté de `scoreColor(s)` (`renderDashboard()`,
même portée) : mapping identique sauf jaune, qui bascule sur `--j-txt` au
lieu de `--j`. `col` (brut) reste réservé au non-texte (`border-top`,
`outline`) ; le score et le libellé de niveau prennent `txt`.

**Ce script ne s'exécute pas dans ce bac à sable par défaut** — il cherche
`chromium_headless_shell`, absent ici — mais `CHROMIUM_PATH` le fait
pointer vers le binaire disponible localement :

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
  node scripts/verifier-accessibilite-interface.js
```

Vérifié ainsi, avant/après : 32 → **0** texte(s) sous le seuil. Puis
`npm test` (407/407) et `verifier-syntaxe-html.js`.

---

## Le système de design du 23/09/2026 : échelle typographique, espacement, rayons

Audit du 23/09/2026 sur le DOM rendu des 8 modules (mesure, pas estimation) :
**22 tailles de police distinctes**, et **70 % du texte** (12 114 nœuds sur
17 262) **sous 10px**. La taille la plus utilisée de toute l'application
était 8px, 207 textes étaient à 7px, et le haut de l'échelle était quasi
vide (165 nœuds à 17px seulement) : pas de hiérarchie, seulement « du petit
avec des variantes ». Même constat sur l'espacement (21 valeurs, tous les
entiers de 1 à 16px) et les rayons (11 distincts). Sur un outil consulté sur
un portable en plein jour par un professionnel de la sûreté, c'est le défaut
qui coûte le plus cher en lisibilité.

**La dette était concentrée, pas diffuse.** 79 signatures de composants pour
14 898 nœuds sous 11px, dont 20 faisaient 90 % du volume — presque toutes
des pastilles de carte d'actu (`.stag` 1677×, `.balise` 1183×,
`.cy-niv-pill`, `.conf-badge`, `.rtag`, `.social-badge`, `.utg`, `.rpill`).
Chaque carte portait une dizaine de micro-étiquettes à 8px autour d'un
titre à 12,5px.

Sept tailles dans `:root` (`--fs-micro` à `--fs-xl`), un **plancher à
10px** (aucune pastille ne descend plus bas), six espacements
(`--sp-1` à `--sp-6`, base 4), trois rayons + une pilule. Appliqués à la
carte d'actu (`.art`, `.atit`, `.asum`, `.stag`, `.balise`, `.rtag`,
`.cy-niv-pill`, `.rpill`, `.tr-btn`, `.share-trigger`…) et aux badges à 7px
des fiches d'alerte (`-12H`, `Signal RSS`, `Vérifié`).

Le titre d'actu (`.atit`) était régi par une déclaration `!important` plus
tardive que celle qu'on lit en premier dans le fichier (même piège que
l'audit du 21/09/2026) : corrigée en même temps, 12,5px/600 → 15px/700.

Mesuré avant → après : texte sous 10px **70 % → 18 %** (12 114 → 3 065).

Vérifié : `npm test` (407/407), `verifier-syntaxe-html.js`,
`verifier-accessibilite-interface.js` (0 texte sous le seuil AA).

---

## Le budget vertical mobile du Flux : 175px de bandeau, 87px après

Suite directe de l'audit ci-dessus : la carte d'actu agrandie aggravait le
scan mobile tant que la moitié de l'écran restait mangée par des bandeaux.
Mesure précise, poste par poste, sur un écran de téléphone type (844px de
haut) : `.tb` 46px, **`.proxy-bar` 175px**, `.cbar` 31px, `.flashinfo`
26px, `.compact-filters` 28px, `.tlbr` 85px, `.sstrip-hd` 17px — 554px de
chrome avant la première actu, contre 290px de zone de lecture (34 % de
l'écran). Le bandeau « Collecte RSS automatique » à lui seul valait plus
que la zone de lecture.

`pb-title` (« Collecte RSS automatique — Cliquez Actualiser ») masqué sur
mobile uniquement : il redoublait le début, en gras, de `pb-step`
(« **Cliquez sur Actualiser**… »). Le détail explicatif
(`pb-step-detail`, « la veille se met à jour depuis le cache partagé… »)
masqué sur mobile mais intact sur bureau (vérifié inchangé, 74px). La
pastille « Détection en cours » rejoint le texte sur la même ligne
(`pb-body` en flex) au lieu d'une ligne séparée. **Aucune information
retirée** — la croix de fermeture et son `localStorage` restent
identiques, et tout redevient visible sur bureau ou en re-largissant la
fenêtre.

Mesuré avant → après : bandeau 175px → **87px**, zone de lecture 290px →
**380px** (34 % → 45 % de l'écran).

Vérifié : `npm test` (407/407), `verifier-syntaxe-html.js`,
`verifier-accessibilite-interface.js`, capture bureau confirmant qu'il n'a
pas bougé.

---

## La palette du 23/09/2026 : direction B, « bronze en avant »

Signalement du 23/09/2026 après l'audit typographique : « ressemble à une
appli démo ». Mesure, pas impression : `var(--b)` (l'accent cobalt,
`#2C5AAE`) et ses dérivés servaient **à la fois** la structure (rien, elle
était déjà navy), l'action (boutons, liens) **et** les états actifs
(onglets, chips, filtres) — un seul bleu générique faisait tout le travail
d'interface, exactement le registre visuel d'un gabarit SaaS non
personnalisé. Le bronze de marque (`--sig`, choisi au 3ᵉ rebranding
« Horizon Cobalt & Bronze ») n'avait qu'un usage réel avant le 21/09/2026
(audit du même jour).

**Trois maquettes comparées avant de toucher au fichier servi** (même
méthode que le 21/09/2026 pour la typographie serif) : l'état actuel, une
direction « cobalt approfondi » (même identité, plus dense), et une
direction « bronze en avant » (structure navy, action bronze — deux rôles
distincts au lieu d'un bleu unique partout). L'éditeur a tranché pour la
troisième : donner un rôle distinct à chaque couleur de la palette déjà
choisie, plutôt qu'inventer une nouvelle palette.

**Un seul jeu de tokens, tout le produit suit** : `--b` (155 usages),
`--bl`/`--bb` (38+14 usages) passent du cobalt au bronze — la même valeur
que `--sig`/`--sigl`/`--sigb`, jusque-là quasi inutilisés. `--n`/
`--nav-bg`/`--nav-border` restent navy : c'est le rôle structurel de
Direction B, il n'a pas besoin de changer. Neutres (`--t`, `--t2`, `--gr`,
`--lg`, `--sf`, `--bd`, `--page-bg`) reteintés chaud (gris-bleu → gris-brun)
pour que le blanc/gris froid restant ne jure pas à côté du bronze.

**Chaque remplacement mesuré au moins égal au ratio de contraste WCAG
d'origine**, jamais estimé à l'œil — calculé avant d'écrire la moindre
valeur dans `:root` (luminance relative, formule WCAG). Aucun n'est
descendu sous 4,5:1 ; la plupart dépassent l'ancien ratio (`--lg` sur
blanc : 5,43:1 → 6,21:1). Vérifié ensuite sur le DOM rendu :
`verifier-accessibilite-interface.js`, 0 texte sous le seuil.

**Le vert/jaune/orange/marron/rouge de sévérité n'a pas bougé, et c'est
délibéré** — c'est la garantie que ce changement de palette ne peut
silencieusement faire dire à un pays qu'il est plus ou moins dangereux
qu'il ne l'est. Ni les couleurs d'identité des sources dans le registre
(`SRCS`, `col:`, 500+ entrées) ni les cartes de classification sémantique
(`NIVEAU_COL`, `lbg()`, `TT_NIV_COL`, `LVL_COL`, `COULEUR_STATUT`, `TYP`
des types d'événements d'agenda, la catégorie « politique » de
Géopolitique/Synthèse) n'ont été touchées : ce sont des cartes de
signification, pas du chrome décoratif, et les modifier aurait été un
arbitrage différent, plus risqué, jamais demandé.

**Une trentaine d'usages de `#2C5AAE`/`rgba(44,90,174,…)` codés en dur**,
hors du système de tokens, ont été retrouvés et alignés à la main —
boutons « Actualiser » de chaque module (Flux, Recherche, Synthèse,
Agenda, Rapports, Diagnostic), logo, barre de progression de collecte,
badges « Auto »/« Nouveau », carte pays mise en avant, halos et
soulignés des images générées pour le partage. Les générateurs de rapports
exportés (`_apPageWrap`, `_apCorrelationCard`) codent déjà toutes leurs
couleurs en dur (pas de `var()`, contexte hors de `:root`) : la même valeur
bronze y est recopiée littéralement pour rester cohérente avec le motif
existant.

**Le thème sombre avait sa propre surcharge**, oubliée si elle n'avait pas
été relue : `--bl`/`--bb` y restaient teintés cobalt alors que le thème
clair venait de passer au bronze — un bouton bronze à côté de pastilles
encore bleues dès l'activation du thème sombre. Corrigé au minimum
nécessaire (`--b`/`--bl`/`--bb` alignés sur la variante bronze déjà
définie pour `--sig` en sombre) ; **les neutres du thème sombre n'ont pas
été reteintés** — hors du périmètre comparé sur maquette (le thème clair
reste celui par défaut), à reprendre dans un passage dédié si besoin.

Vérifié : `npm test` (407/407), `verifier-syntaxe-html.js`,
`verifier-accessibilite-interface.js` (0 texte sous le seuil AA), capture
des 9 modules (bureau + mobile) sans erreur JavaScript.

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
