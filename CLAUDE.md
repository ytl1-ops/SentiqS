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
| La page de garde (animation d'ouverture) | `web/js/intro.js` | `<script src="js/intro.js">` dans `SentiqS_Web.html` ET `index.html` |

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

## L'identité d'envoi se désigne désormais PAR MODULE de rapport

Demande explicite du 15/10/2026 : pouvoir désigner « avec précision, sur chaque
module » l'identité d'envoi, parmi les trois de Paramètres > Personnalisation
de marque. Jusque-là il n'existait qu'une identité *active* globale et le choix
ponctuel « Signer en tant que » du menu de partage, perdu après chaque envoi :
impossible de dire « la Synthèse part toujours sous la Cellule de Veille,
l'Agenda sous la Direction de la Sûreté ».

**Donnée.** `identitesModules` dans la personnalisation de marque
(`sentinel_marque_perso`) : `{ rapport_complet, flux, synthese, agenda,
sources, alertes }` → `1`/`2`/`3`, ou `0` (absent) = « identité active ». Les
six clés sont `MODULES_IDENTITE_ENVOI`. `identitesModulesMarquePerso(m)` les
normalise : une valeur invalide, ou qui pointe vers une identité *vidée*
depuis, redevient `0` — jamais une signature vide.

**Résolution — `identiteEnvoiActuelle(module)`**, dans cet ordre :

1. le choix explicite « Signer en tant que » fait *pour cet envoi* — mais
   **seulement pendant un partage lancé depuis le module Rapports**
   (`_rapportPartageEnCours`, posé par l'enveloppe `envoyerRapportCanal`) ;
2. l'identité désignée pour le module ;
3. l'identité active globale (comportement historique).

Sans `module` (partage d'une actu, d'une fiche pays), rien ne change.

**Piège évité : la fuite d'un ancien choix.** `_partageIdentiteChoisie` n'était
remise à zéro *qu'au début* de chaque envoi, jamais à la fin : partager une actu
en signant « Beta », puis exporter le Flux depuis sa barre d'export, signait le
Word « Beta ». D'où le drapeau `_rapportPartageEnCours` : hors d'un partage
Rapports, un export direct, un aperçu impression ou un rappel WhatsApp
programmé ignorent tout choix resté en mémoire et lisent la désignation du
module. `envoyerRapportCanal` est devenue une enveloppe `try/finally` autour de
`_envoyerRapportCanalInterne` : le choix est remis à zéro même si l'envoi échoue
ou est annulé (`AbortError`).

**Où chaque générateur la lit.** Tous reçoivent leur module : `exportWord(type)`,
`exportPPTX(type)`, `exportExcel(type)` (nouvelle ligne « Partagé par » dans
l'onglet Métadonnées — seul format bureautique à ne la porter nulle part),
`_apPageWrap(..., type)`, `_buildRapportSyntheseHTML` (`'synthese'`),
`genererImageRapportBlob(type)`. Le PDF passe par `_pdfBuilder`, hors de portée
de `type` : `exportPDF` pose `b.identiteEnvoi` et `bulletinHeader` le lit (repli
sur la résolution globale pour le guide d'utilisation, qui ne le pose pas).
`dlFile(blob, name, module)` retient le module du dernier document, pour que le
message d'accompagnement de son partage (`_docShareMessage`) soit signé de la
bonne identité. Le rappel WhatsApp programmé envoie la Synthèse : il annonce et
signe l'identité du module `synthese`.

**Interface.** Deux familles de listes, volontairement distinctes :
`[data-id-module]` (les six cartes du module Rapports + les barres d'export
Flux, Synthèse, Agenda) enregistre *immédiatement* — elles ne proposent que des
identités déjà enregistrées ; `[data-id-module-param]` (tableau de Paramètres)
s'enregistre avec « Enregistrer la personnalisation », car il propose aussi des
identités saisies mais pas encore enregistrées. `changerIdentiteModule` /
`renderIdentitesModules` / `renderIdentitesModulesParams` les resynchronisent
toutes. Le menu « Signer en tant que » d'un rapport pré-sélectionne l'identité
du module (`identiteParDefautModule`) au lieu de l'identité active ; le choisir
autrement ne vaut que pour cet envoi. Plan gratuit : listes masquées, aucune
identité signée (inchangé).

**Non couvert, volontairement :** le partage d'une actu du Flux et d'une fiche
pays (module Alertes) continuent d'utiliser « identité active + choix à
l'envoi » — la désignation par module ne s'applique qu'aux rapports. Le CSV n'a
aucun en-tête où loger une identité.

Vérifié : `npm test` (435/435, dont 28 dans `identite-module.test.js`, tous vus
échouer sur l'ancien code), les contrôles de la CI (syntaxe, i18n, accessibilité,
ressources, fumée), et un banc Chromium (46 contrôles) qui génère de **vrais**
Word, PDF et PowerPoint avec docx / pdf-lib / pptxgenjs servis en local et relit
la ligne « Partagé par » dans les fichiers — Synthèse « Service de
Renseignement », Agenda « Cellule de Veille Sécuritaire », Flux (non désigné)
« Direction de la Sûreté » ; choix explicite prioritaire puis remis à zéro ;
désignation orpheline supprimée quand son identité est vidée. Excel : SheetJS
0.20.3 est injoignable ici, la vérification a donc utilisé un double minimal de
`XLSX` qui capture les lignes de l'onglet « Métadonnées » — « Partagé par »
présent et correct par module, absent en plan gratuit, jamais de ligne vide.
Non vérifié avec la vraie bibliothèque.

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

## La vidéo de démarrage du 05/10/2026

Courte animation de marque (10 s, logo puis signature « Expertise en
sûreté et renseignement stratégique en Afrique ») jouée en plein écran
avant l'écran de connexion — `web/assets/intro-sentiqs.mp4`, posée dans
`#authOverlay` au-dessus de la scène d'accueil existante (`skyline-scene`
+ `auth-box`), pas à la place : au clic sur « Passer » ou à la fin de la
vidéo, l'écran habituel (globe animé, carte de connexion) apparaît
inchangé.

**Ne doit jamais retarder ni modifier le chemin automatisé.** Le job de
collecte planifiée ouvre cette page avec `#collecteur-<TOKEN>` ;
`checkCollectorSession()` l'intercepte et masque `#authOverlay` en entier
avant qu'aucune autre logique ne s'exécute — la vidéo, posée à l'intérieur
de ce même conteneur, est donc masquée avec lui et ne se lance jamais. Une
reconnexion automatique du jour (`_ouvrirSessionDepuisSupabase`) suit le
même chemin de retour anticipé. Mesuré avec le jeton collecteur réel :
`authOverlay` et la vidéo masqués, lecture jamais démarrée
(`introVideoEl.paused === true`), aucune erreur JS.

Ne joue qu'une fois par onglet (`sessionStorage`), jamais à chaque retour
à l'écran de connexion (déconnexion explicite, inscription, mot de passe
oublié — tous passent par `showLoginForm()`, jamais par la nouvelle
`afficherEcranConnexion()` qui, elle, est le seul point d'appel de
`afficherIntroVideo()`). Un navigateur en navigation privée stricte qui
refuse `sessionStorage` fait sauter l'intro plutôt que de bloquer l'accès
à la connexion ; un autoplay refusé par le navigateur révèle directement
l'écran de connexion au lieu de rester bloqué sur un premier cadre figé.

**Mise à jour du 15/10/2026 — la logique a quitté la page.** Elle vit
désormais dans `web/js/intro.js` (module à injection d'environnement, testé sans
navigateur par `scripts/test/intro.test.js`), chargé en tête de
`SentiqS_Web.html` ET de `index.html` : l'animation joue aussi à l'ouverture de
la page d'accueil, avant tout contenu (donc avant le formulaire d'inscription et
son mot de passe), et le drapeau `sentinel_intro_vue` est **partagé** — accueil →
connexion ne la rejoue pas, connexion → accueil non plus. Voir la section
« Pages hors appli, page de garde enchaînée et allègement » plus bas. Ce qui a
changé pour l'écran de connexion : `afficherIntroVideo()` n'est plus qu'un appel
à `SentiqIntro.lancer()` (et ne fait rien si le module n'a pas chargé : jamais
d'obstacle à la connexion) ; la vidéo porte `preload="none"` (elle ne se
télécharge qu'à la lecture) ; le stockage refusé fait **vraiment** sauter
l'intro (l'ancien code la jouait malgré ce que disait ce paragraphe).

Vérifié : `npm test` (407/407), `verifier-syntaxe-html.js`,
`verifier-i18n.js` (nouvelle clé `intro_video_skip`, FR/EN),
`verifier-ressources.js`, `verifier-accessibilite.js` et
`verifier-accessibilite-interface.js` (0 violation), et capture Playwright
des trois chemins : visite normale (vidéo jouée, Passer fonctionnel,
transition vers l'écran de connexion réel), revisite dans le même onglet
(vidéo non rejouée), session collecteur (vidéo jamais lancée).

---

## La barre de couverture du Flux, 05/10/2026

Demande explicite de reprendre la direction visuelle d'une capture
d'écran de l'app Ground News (bandes de couleur sous chaque article,
ligne d'en-tête compacte, titres affirmés) sur les cartes d'actu du Flux
— adaptée à l'identité déjà en place plutôt que copiée telle quelle.

**La comparaison a d'abord tranché ce qui ne devait PAS être copié.** La
carte d'actu de ce produit porte déjà, par carte : pays + niveau d'alerte
pays + impact sur le score + survenance (`.art-top`), titre en 15px/700
depuis la refonte du 23/09, portée/ville/catégorie/source/sentiment/
viralité (`.meta2`), puis source(s) + confiance + score + recoupement +
fraîcheur (`.aftr`). Ground News n'affiche que 4 éléments par carte
(catégorie, lieu, titre, barre). Y plaquer cette sparsité aurait voulu
dire supprimer des informations qu'un professionnel de la sûreté lit
réellement (niveau d'alerte, recoupement, score de fiabilité) — personne
ne l'a demandé, et ce n'est pas ce qu'« adapter plutôt que copier » veut
dire. Le titre affirmé et la ligne d'en-tête compacte existaient déjà
(passes du 21/09 et du 23/09) ; le seul élément réellement absent était
la bande de couleur elle-même.

**Donc : une seule addition, purement additive.** `.score-bar` /
`.score-bar-fill` dans `.aftr`, juste avant le badge `.rtg` existant —
même donnée (`a.score`), mêmes seuils de couleur que `rc()` (`var(--g)`
≥85, `var(--a)` ≥65, `var(--r)` en dessous) : la barre illustre un chiffre
déjà calculé et déjà affiché en toutes lettres, elle n'en invente aucun.
Volontairement discrète (42×4px) plutôt qu'à la largeur de Ground News :
la ligne `.aftr` porte déjà cinq à six badges, une barre large y aurait
dominé au lieu de s'y glisser. Aucun badge existant retiré ni déplacé.

Vérifié : `npm test` (407/407), `verifier-syntaxe-html.js`,
`verifier-accessibilite-interface.js` (0 violation), capture Playwright du
Flux avec le cache réel (`cache.json`) injecté dans `ALL` — la barre
s'affiche et se colore correctement sur plusieurs cartes, aucune carte
cassée, aucune erreur JS.

---

## La revue de présentation du 15/10/2026 : lisibilité, clic, clavier — sur les 9 modules

Demande : « revoir la présentation du Flux avec les skills de design », puis
« appliquer les modifications à tous les modules ». Cadrage retenu avec le
propriétaire : refonte **ciblée, rien de retiré** (aucune information de carte
supprimée), livrée en demande de fusion à valider.

**La mesure a précédé le dessin.** Chromium, réseau coupé, articles de
démonstration dans `ALL`, les 9 modules × clair/sombre × bureau (1360px) /
mobile (390px), mesure sur le DOM rendu (même principe que
`verifier-accessibilite-interface.js`). Cumul des 36 combinaisons :

| | avant | après |
|---|---|---|
| textes sous le seuil AA (4,5:1 / 3:1) | 1 836 | 10 (boutons désactivés, exemptés par WCAG 1.4.3) |
| textes sous le plancher de 10px | 6 520 | 0 |
| cliquables sans accès clavier | 948 | 0 |
| cibles de clic < 24px (zone réelle, pseudo-éléments compris) | 1 274 | 8 (une case à cocher, un lien dans une phrase) |

Le pire module était **Alertes en sombre : 349 textes sous le seuil**, puis
Agenda (87), Flux (49), Tableau de bord (39). Les cartes d'actu, les résultats
de Recherche (28) et les 54 tuiles pays n'avaient aucun arrêt de tabulation.

**Causes racines — et donc où la correction a été posée.**

1. *Couleurs de gravité écrites en dur pour un fond CLAIR dans des styles en
   ligne* (`color:#78350F`, `#6B7280`, `#92400E`…). Le thème sombre ne les
   retouchait jamais. Correction **unique, dans le bloc « REVISION DESIGN DU
   15/10/2026 »** en fin de feuille : sélecteurs d'attribut
   (`html[data-theme="dark"] body [style*="color:#78350F" i]`) qui renvoient
   vers les jetons `--a/--r/--g/--m/--j-txt/--t2`. En clair, ces jetons valent
   exactement les anciennes couleurs : seul le sombre change. Écrire ça dans
   200 fonctions de rendu aurait été illisible et aurait dérivé ; le bloc se
   relit, se mesure et se retire d'un coup.
2. *Fonds PASTEL en dur* (`NIV.bg/bgLight` : `#FEF2F2`, `#F3E1CB`, `#DCFCE7`…).
   **Piège rencontré** : éclaircir seulement le texte en sombre a fait passer
   Alertes de 349 à 527 défauts — le texte clair se retrouvait sur un
   rectangle clair. Les fonds ont donc leur équivalent sombre **opaque**
   (`DARK_FOND`) ; des fonds translucides s'empilaient dans les cartes
   imbriquées d'Alertes et re-éclaircissaient le fond. Un test lit `NIV` et
   exige une règle sombre pour chacun de ses fonds : un nouveau niveau sans
   équivalent échoue au lieu de réapparaître éblouissant.
   `NIV` lui-même n'a PAS été touché : les exports Word/PDF/PowerPoint le lisent.
3. *Tailles 7–9,5px restées hors du système de jetons du 23/09* (62 déclarations
   de classes + des centaines de styles en ligne). Classes → `var(--fs-micro)`
   (10px, le plancher) ; styles en ligne → un filet de sécurité
   `[style*="font-size:9px" i]:not(svg *){font-size:var(--fs-micro) !important}`
   (les étiquettes de carte SVG, à l'espace compté, sont exclues). `@media print`
   n'est pas touché.
4. *Zones de clic réduites au glyphe* (puces 20px, drapeau 14px). **Sans grossir
   la mise en page** : un pseudo-élément `::after{inset:-7px -4px}` déborde de
   l'élément ; seuls les boutons et champs de barre d'outils reçoivent un
   `min-height:24px` (le seuil AA ; **pas** de palier 32/44px au doigt : un
   premier essai à 36px a fait reculer la zone de lecture mobile de 45% à 40%,
   le budget vertical du Flux étant le plus cher à gagner — le niveau AAA de
   44px reste à arbitrer séparément). Sur mobile les
   lignes de liens s'empilent à 15px : un débordement y chevaucherait la ligne
   voisine, ces éléments (`.slink/.ev-cy/.ev-sc`) y prennent donc une vraie
   hauteur de 24px.
5. *Accès clavier* : `accessibiliserCliquables()` + un `MutationObserver` rendent
   atteignable tout `onclick` posé sur un `<div>/<span>/<tr>`, y compris ce que
   les rendus ajouteront. **Politique du dépôt conservée** : une carte qui
   contient déjà des liens/boutons n'est pas un arrêt (rôle imbriqué) — son
   TITRE l'est (`.atit` porte `role="button" tabindex="0"`, Entrée/Espace via
   `clavierRolesBouton`). Un voile en `position:fixed`, un élément sans texte
   ni nom, les onglets (tabindex glissant) et le SVG sont exclus. Le cliquet
   `PLAFOND_CLIQUABLES_SANS_CLAVIER` passe de 61 à **0**.

**Le Flux, en propre.** Avant : un bandeau BRONZE plein largeur par pays (38px)
puis un sous-titre ville (28px) avant la première carte ; l'œil allait au
bandeau, pas au niveau « CRITIQUE ». Après : en-tête de pays clair et
**collant** (`.feed-pays-hd`, serif, `position:sticky`) qui annonce « N
critiques · N élevées » avant les articles ; nom, total d'articles et lien vers
la fiche pays conservés. Doublons retirés — jamais une information :

- le nom du pays dans chaque carte, sous un en-tête de pays, est masqué à
  l'écran (`.cy-nom`) mais **reste dans le DOM** pour les lecteurs d'écran ;
- la pastille « RSS » générique (ligne secondaire) disparaît ; le badge RSS du
  pied de carte reste, une seule fois, et s'efface quand la ligne secondaire
  porte déjà le vrai type de source (`_srcBadge` : « RSS institutionnel »…) ;
- la puce de catégorie n'est écrite qu'une fois (la balise thématique
  « Sécurité » la porte déjà pour les niveaux critique/élevé) ;
- « 2 src » / « 1 src » → « Recoupé · 2 sources » / « Source unique » ;
- barre d'outils : recherche / pays / tri / Actualiser sur une ligne, filtres
  sur la suivante (à 1360px, « Actualiser » restait seul sur sa ligne) ;
- accents rétablis (« Plus récent », « Priorité », « Fiabilité », « Économique »,
  « Ville non précisée », « ESTIMÉ ») ; le monogramme de source choisit son
  texte (blanc ou foncé) selon la luminance du fond (`couleurTexteSur`, le
  blanc sur orange `#F97316` faisait 2,8:1).

Mobile : la colonne gauche de la carte (pastille de niveau + monogramme, ~100px)
écrasait le texte ; première carte de **394px → 312px** (moyenne 343 → 289), la
pastille de niveau passe sur la ligne pays/heure. Le gain est partiellement
repris par les contrôles passés à 24px (barre d'outils +10px), net : le texte
de la carte occupe toute la largeur au lieu de 60%. Les règles mobiles sont écrites **deux fois**
(`@media (max-width:760px){html:not(.force-web) …}` ET `html.force-mobile …`,
le bouton Web/Mobile) — aucun test historique ne garde cette parité ; celui du
15/10 la vérifie pour les règles de cette passe.

**Ce qui n'a pas été touché, et pourquoi.** Les documents exportés
(Word/PDF/PowerPoint/rapport imprimable : autres documents, sans `data-theme` ni
cette feuille) ; les valeurs de `NIV` ; les blocs `@media print` ; les textes
SVG. Restent à 0,6–0,95 d'opacité par conception les cartes de moyens de
paiement inactives (`.pm-inactif`) et deux boutons désactivés (« Recalculer »,
« Tester l'envoi ») — des composants inactifs sont exemptés du contraste.

**Pièges de méthode, pour la prochaine passe.**

- Les sélecteurs d'attribut ne voient que le **texte exact** du style : `#6B7280`
  est couvert, `rgb(107,114,128)` ne l'est pas. Les couleurs `rgb()` en ligne
  restent à corriger au cas par cas.
- Un commentaire contenant « @media print » a fait croire à mon script de
  correction qu'un bloc d'impression commençait : la détection ne regarde que
  les lignes qui COMMENCENT par `@media print`.
- Le test `jetons-couleur` exige que tout `var(--x)` soit déclaré dans le `:root`
  PRINCIPAL (pas dans un second `:root`) : les trois jetons ajoutés (`--on-b`,
  `--bleu-txt`, `--violet-txt`) y sont, clair et sombre.
- `[onclick^="f"]` rate `onclick="event.stopPropagation();f()"` : utiliser `*=`.
- En banc hors ligne la police d'icônes Tabler ne charge pas : les boutons
  d'icône y mesurent 16×8px. La mesure de zone de clic se fait donc sur
  l'élément ET sur `elementFromPoint` à ±11px de son centre.
- Le gris secondaire du sombre `--lg` passe de `#8CA0B4` à `#9AAEC2` (4,4:1 sur
  certains fonds de Paramètres).

Vérifié : `npm test`, `verifier-syntaxe-html.js` et les huit autres vérificateurs
statiques, `test-fumee.js`, `verifier-accessibilite-interface.js` (plafond clavier
61 → 0, contraste 0), `scripts/test/revision-design.test.js` (16 gardes, dont un
contrôle par mutation : réintroduire une taille de 9px, retirer un fond sombre ou
rétablir la pastille « RSS » les fait échouer).

---

## Pages hors appli, page de garde enchaînée et allègement — 15/10/2026

Demande : « appliquer à tous les modules **et aux pages hors appli**. Reprendre
la page de garde avec l'animation vidéo au début avant la zone d'insertion du mot
de passe. Alléger l'appli pour rendre plus portable. » Cadrage retenu avec le
propriétaire : page de garde **enchaînée** (accueil puis connexion, une seule
lecture par onglet) ; allègement = **recompresser les deux vidéos**, même
animation ; **une seule** demande de fusion pour tout (revue de présentation des
modules + pages hors appli + page de garde + vidéos), à valider, non fusionnée.
« Pages hors appli » = `web/index.html`, `web/pays/*.html` (+ le hub) et
`web/legal/*.html`.

### 1. Les pages hors appli — mesurées avant d'être corrigées

Même banc que pour les modules (Chromium, réseau coupé, DOM rendu), 14 pages ×
bureau/mobile, **clair et sombre pour les pages légales** (elles suivent la
préférence du système ; `color-scheme: light dark`). Cumul :

| | avant | après |
|---|---|---|
| textes sous le seuil AA | 212 | 0 |
| textes sous 10 px | 22 | 0 |
| cibles tactiles < 24 px (liens en ligne exemptés) | 106 | 0 |
| pages qui défilent à l'horizontale à 390 px | 2 | 0 |

Ce que la mesure a trouvé, et qu'aucun contrôle ne voyait :

- **3 forfaits sur 4 avaient un bouton blanc sur gris clair (1,1:1).** Les
  boutons « fantôme » sont des `<button class="btn btn-ghost">` ; `.btn` ne
  réinitialisait pas `background`, donc le navigateur imposait son gris
  `#EFEFEF` sous un texte blanc. Correction à la racine : `.btn{background:transparent}`.
- **Le titre de l'accueil tombait à 1,4:1 sur certains plans de la vidéo** (la
  parabole blanche, les écrans de code) et son mot clé, en bleu marine sur fond
  sombre, à 1,0:1. Un contrôle DOM ne voit pas les pixels d'une vidéo : la
  mesure s'est faite **image par image** (voir « Méthode » ci-dessous).
- Pages légales en **mode sombre** : gris `#64748b` et liens `#2563eb` en dur
  (3,6:1 et 3,4:1 sur fond sombre). Jetons `--maj/--lien/--bord`, valeurs sombres
  dans `@media (prefers-color-scheme: dark)`.
- La politique de confidentialité débordait à **509 px pour un écran de 390** (un
  tableau de 4 colonnes) : sur mobile les tableaux s'empilent (étiquettes de
  colonne par `data-l`, lues dans l'en-tête).
- Accueil sans `<main>`, sans lien d'évitement ; titres qui sautaient de h2 à h4
  puis h5 (`.step h4` → h3, titres de pied de page → h2) ; textes à 9–9,5 px ;
  jetons `--ink3/--ink4` à .44/.28 (4,1:1 et 2,4:1 sur les cartes) → .64/.56, et
  `--ink2` .68 → .78 pour garder la hiérarchie ; marque collée au bouton
  « Se connecter » à 390 px.
- Fiches pays : le **teaser d'alertes flouté** (`.alert-blur-item`, flou 3,5 px,
  `user-select:none`) est illisible *par conception* — mais il l'était pour l'œil
  seulement : les lecteurs d'écran en lisaient des exemples comme des alertes
  réelles. Il porte maintenant `aria-hidden="true"` (gabarit, générateur **et** les
  quatre fiches déjà produites). Jugement à connaître : c'est la seule chose
  **retirée de la lecture** dans toute la passe ; le texte reste dans le HTML.

**Où les corrections ont été posées.** Accueil : jetons de `:root` + un bloc
`revue-pages-2026-10-15` en fin de feuille. Fiches pays : le **gabarit**
(`scripts/templates/fiche-country.template.html`) et le **générateur**
(`generate-country-fiche.js`) ont reçu les mêmes changements que les dix pages
existantes — régénérer une fiche ne fait pas revenir les défauts.
`verifier-fiches-pays.js` (jetons définis, AA, date visible) reste vert. Pages
légales : **le texte juridique n'a pas bougé** (les 36 « À COMPLÉTER » sont là, le
`noindex` aussi) ; seuls le style et la structure ont changé.

**Méthode — texte sur vidéo.** Onze images de `hero.mp4` (1 par seconde) sont
posées tour à tour en fond de `.scene` (la vidéo masquée), le texte de la page
est rendu **transparent** (`color:transparent`, les `text-shadow` restent), une
capture donne le fond réel sous chaque élément, et le contraste de la vraie
couleur du texte est calculé pixel par pixel. Statistique retenue : le **10ᵉ
centile** du contraste sous l'élément (90 % des pixels font mieux), pire image des
onze. Avant → après, bureau :

| élément | avant | après |
|---|---|---|
| titre `h1` (seuil 3:1) | 1,37 | 7,58 |
| mot clé `h1 em` (3:1) | 1,03 | 5,92 |
| sous-titre (4,5:1) | 1,24 | 8,55 |
| étiquettes de chiffres (4,5:1) | 1,97 | 4,77 |
| bouton secondaire (4,5:1) | 2,78 | 18,72 |
| liens de navigation (4,5:1) | 2,29 | 5,68 |

Mobile : mêmes éléments, pire cas 5,05 après (1,03–1,41 avant). Moyens : un
**voile radial local** derrière le bloc de texte (`.hero-content::before`,
`closest-side`, qui s'estompe à 0 — pas de rectangle visible), une ombre portée
sur le titre, le mot clé en `--sky`, le fond de la barre de navigation à .72, un
fond sous le bouton secondaire. La vidéo reste visible sur les bords.
**Ce mesure-là n'est pas dans la CI** (il demande ffmpeg et Pillow) ; la CI
garde le reste via `scripts/verifier-pages-hors-appli.js`, plafonds à 0, contrôle
négatif fait sur les pages d'origine (il retrouve exactement 212 / 22 / 106 / 2).
Si la vidéo de fond change, **refaire cette mesure**.

### 2. La page de garde

`web/js/intro.js` (une logique, deux pages) :

| situation | effet |
|---|---|
| première visite de l'onglet, accueil | animation plein écran **avant** le contenu |
| première visite de l'onglet, connexion directe | animation avant la carte de connexion |
| accueil puis connexion (ou l'inverse), même onglet | **une seule lecture** (drapeau de session partagé) |
| « Passer » ou Échap | s'arrête, le drapeau est posé |
| `prefers-reduced-motion`, économiseur de données, 2G/slow-2g, stockage refusé | pas d'animation, page immédiate, drapeau non posé (sauf stockage) |
| lien profond (`index.html#tarifs`) ou clic depuis une autre page du site | accueil sans animation (pas une « arrivée ») |
| lecture refusée, fichier illisible, rien ne démarre en 6 s | la page s'ouvre, jamais de blocage |
| `#collecteur-<JETON>` | **inchangé** : `checkCollectorSession()` retourne avant tout appel à `lancer()` |

Pendant la lecture, le reste de la page est `inert` (clavier **et** lecteurs
d'écran : on ne tabule pas dans des champs cachés par la vidéo) ; le focus est
sur « Passer » ; l'overlay est un `role="dialog"` nommé par la signature de
marque (la vidéo, sans son, n'a pas d'autre texte). Sur l'accueil, l'overlay est
**masqué par défaut dans le HTML** : sans JavaScript ou pour un robot, le contenu
est intact (rien de référencé n'est retardé). Le décor vidéo de l'accueil
(`hero.mp4`) ne démarre **qu'après** l'animation : deux vidéos en parallèle, c'est
ce qui pèse le plus sur mobile ; il a `preload="none"` et ne dépend plus de
l'attribut `autoplay` (repli : si `intro.js` ne charge pas, il démarre quand même).

Vérifié dans un vrai DOM (Chromium, lecture simulée — son build n'a pas H.264),
15 scénarios : accueil→connexion sans rejeu, connexion→accueil, Passer, Échap,
Tab prisonnier de l'overlay, lien profond, animations réduites, lecture refusée,
démarrage bloqué (abandon à 6 s), économiseur de données, `sessionStorage` qui
lève, `intro.js` bloqué, mobile 390 px. **Non vérifié** : la lecture réelle du
H.264 dans le navigateur de production (même format qu'avant, ré-encodé : voir
plus bas, et `ffprobe`), et la chaîne `#collecteur-<JETON>` avec un jeton réel
(inchangée par construction ; mesurée le 05/10).

### 3. L'allègement — deux vidéos recompressées, même animation

`ffmpeg`, H.264 High, `yuv420p`, `-movflags +faststart` (lecture avant la fin du
téléchargement), `-crf 28 -preset slower`. `hero.mp4` : 1080p conservé. `intro-sentiqs.mp4` :
720p conservé, **piste audio AAC supprimée** (l'élément est `muted`, ~0,3 Mo
inutiles). Similarité (SSIM) avec l'original : 0,989 et 0,974 ; contrôle visuel
côte à côte à 1 s / 5 s / 9 s : indiscernables. Les affiches (`*-poster.jpg`)
ne changent pas.

| | avant | après |
|---|---|---|
| `hero.mp4` | 6 808 927 o | 1 955 294 o (÷ 3,5) |
| `intro-sentiqs.mp4` | 2 555 144 o | 772 562 o (÷ 3,3) |
| dossier `web/` | 11,8 Mo | 5,2 Mo |
| accueil, première visite (octets transférés, texte gzippé) | 6,96 Mo | 2,93 Mo — **animation d'ouverture comprise** |
| connexion, première visite, intro jouée | 3,04 Mo | 1,27 Mo |
| parcours complet accueil → connexion, première visite | ≈ 10,0 Mo | ≈ 3,4 Mo |

**Ce que ça ne fait pas** : le HTML de l'application *grossit* (1 586 175 → 1 621 880 o,
+8 Ko gzippé) — c'est le prix du bloc de revue de présentation du 15/10 ; l'allègement
vient entièrement des vidéos. `SentiqS_Web.html` reste un fichier de 1,6 Mo : il n'y a
pas d'étape de build pour `web/` (voir le début de ce fichier), et le découper en
modules chargés à la demande serait un chantier d'architecture à décider à part.
Un test (`intro.test.js`) plafonne les deux vidéos (2,5 Mo / 1,0 Mo) et vérifie
l'absence de piste audio dans l'intro.

### 4. Pièges de méthode, pour la prochaine passe

- **Le DOM ne voit pas une vidéo.** Un contrôle de contraste sur `body *` mesurait
  le titre blanc contre la couleur de la page (`#05080B`, ≈ 19:1) alors que l'œil le
  voit sur l'image de la vidéo (1,4:1 au pire) : le fond mesuré n'est pas le fond vu.
  Toute zone de texte posée sur une vidéo ou une photo se mesure sur les pixels.
- **Un élément `<button>` n'hérite pas du fond de la page.** `background` reste le
  gris système tant qu'une règle ne le réinitialise pas ; les `<a class="btn">`
  n'avaient jamais le problème, d'où un défaut invisible tant qu'on regardait les liens.
- **`opacity:0` n'est pas `display:none`.** Le formulaire d'inscription (fermé, `opacity:0`)
  sortait comme 13 faux défauts par rendu, à 1,0:1 : le banc exclut les ancêtres à opacité
  quasi nulle. Et dans les pages légales en sombre, la « toile » du navigateur
  n'apparaît dans aucun `background-color` calculé (`#121212` par défaut) : sans
  elle, tout sortait à 1,0:1.
- **Le module de logique ne se charge pas au même moment sur les deux pages.** Sur
  l'accueil, le script qui lance l'intro s'exécute avant que le reste du `<body>`
  soit analysé : rendre « le reste de la page » inerte doit être refait à
  `DOMContentLoaded`, sinon rien n'est inerte (une version l'oubliait : le test
  Tab l'a attrapé).
- **`git stash` n'est pas un outil de comparaison.** Une commande de vérification
  a lancé un `git stash` par mégarde au milieu de cette passe ; tout a été restauré
  (`git stash pop`), rien perdu — mais la comparaison avant/après se fait sur une
  copie (`base-web/`), jamais sur l'arbre de travail.

Vérifié : `npm test` (478), les onze vérificateurs statiques, `test-fumee.js`,
`verifier-accessibilite-interface.js` (0/0), `verifier-pages-hors-appli.js` (0/0/0/0,
nouveau, en CI), `verifier-ressources.js` (désormais aussi pour `index.html`, qui
porte `js/intro.js` et les deux vidéos), tests `intro.test.js` (16) et
`pages-hors-appli.test.js` (11).

---

## Le bulletin quotidien du pays pilote — 20/10/2026

Décisions du 20/10/2026 (l'éditeur a délégué l'arbitrage) : profil pilote
responsable sûreté d'entreprise, **Côte d'Ivoire en pays pilote n° 1**, un
bulletin par jour vers 7 h GMT, un flash seulement quand un pays franchit un
seuil.

**Le bulletin** (`scripts/lib/bulletin.js`) est une page HTML statique écrite
par le job de collecte sous `web/bulletins/<PAYS>/AAAA-MM-JJ.html` (plus
`dernier.html`), commitée avec l'archive et servie par Pages. Les données
viennent de `donneesBulletinPays(cy)` **dans la page**, appelée après la
collecte : rien n'est recalculé à côté. Premier passage à partir de 6 h GMT,
refus d'écraser = un par jour. La cadence réelle du job (3 h 24 à 5 h 51)
fait arriver le bulletin entre 6 h et midi : c'est écrit dans la page.

Cinq blocs : en bref (niveau, confiance, tendance), faits de la fenêtre cotés,
ce qui porte le niveau (socle + facteurs), ce que nous ne savons pas, liens
vers les conseils officiels (FCDO, Département d'État, France Diplomatie —
des **liens**, jamais un résumé qui se périmerait).

**Cotation client** (`cotationArticle`, noyau) : Confirmé = recoupé par une
seconde source (rien de plus, le bulletin le dit) ; Probable = source unique
capable d'alerter (même règle que `peutAlerter`) ; Non confirmé = le reste.

**Piège évité :** la tendance se calcule contre le niveau **imprimé** dans le
bulletin (`tendanceDuJour`), pas contre l'instantané du jour, qu'un passage
antérieur a pu écrire avec un autre niveau. Et une baisse annoncée précise
qu'elle peut tenir à une revue du socle : celle de la Côte d'Ivoire
(orange → jaune le 20/10) vient du retrait des inondations, pas d'une
amélioration sur le terrain.

**Seuil du flash** (`filtrerFlash`, `alerte-sortante.js`) : marron et rouge
partout, **orange pour la Côte d'Ivoire**. Les montées sous le seuil sont
comptées dans le message et l'état avance quand même. Le bulletin annonce son
adresse sur le même canal, une fois par jour.

**ACLED : non** (décision du 20/10/2026, licence payante). Ne pas en dépendre.
**`WEBHOOK_ALERTES` n'est pas branché** au 20/10/2026 : les messages qui
seraient partis sont dans les journaux du job. Si le canal est un flux
Teams « Workflows », vérifier au premier envoi qu'il accepte `{"text": ...}` :
certains modèles n'acceptent qu'une carte adaptative.

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

---

## La confiance s'affiche à côté du niveau — 20/10/2026

Audit du 20/10/2026 sur l'archive `web/historique` : aucun des 172 incidents
vérifiés n'avait moins de 112 jours, l'âge médian du socle des 22 pays marron
ou rouge était de 115 jours, et la collecte du jour n'apportait que 4,6 % des
points. Le socle est un plancher qui ne décroît pas (voir « Le calcul du
niveau d'alerte ») : un rouge de juin s'affichait en octobre comme un rouge
de la veille, rapports clients compris. L'âge n'était visible que sur la fiche
d'alerte, en petit.

Arbitrage : **le niveau ne bouge pas, la confiance s'affiche partout à côté
de lui.** `indiceConfiance` (noyau) : faible si socle de plus de 90 jours (ou
aucun incident daté) sans signal du jour ; moyenne si socle de plus de 45 jours
(`DECROISSANCE_PLEIN_J`), sans signal du jour, ou pays muet ; élevée sinon.
`calcAlertScore` l'expose en `confiance`, calculée **après** la clé et sans la
toucher (un test l'exige). Affichée par `marqueConfiance` sur la tuile du
cartogramme et la fiche d'alerte — sans couleur d'alerte, même parti pris que
`marqueSilence` — et par `texteConfianceRapport` dans le PDF, le Word, la
diapositive pays du PowerPoint et l'aperçu imprimable des alertes (FR/EN).

La fiche disait « au-delà de ce délai, les signaux du jour pèsent davantage » :
faux depuis que la décroissance a été retirée. Remplacé.

**À savoir avant de lire l'écran hors ligne** : sans collecte, tous les pays
sont muets, donc tous à confiance faible. C'est juste, pas un défaut.
Mesuré dans Chromium : 54 marques sur les tuiles, 54 sur les fiches, 0 erreur.

### Première revue du socle : la Côte d'Ivoire, pays pilote (20/10/2026)

Arbitrage de l'éditeur : « cadrer avec la réalité sans être alarmiste ». La
Côte d'Ivoire était à l'orange sur des faits du 29/06 dont trois incidents et
un facteur décrivaient les inondations d'Abidjan, un épisode de saison des
pluies clos. Retirés. Reste la pression sur le nord, revue contre les conseils
aux voyageurs du FCDO (déconseillé à moins de 40 km des frontières du Burkina
Faso et du Mali, Savanes, nord du Zanzan, parc de la Comoé), qui porte
désormais `revu:'2026-10'` — premier facteur daté du socle.
`PLAFOND_FACTEURS_NON_DATES` : 38 → 36. Rejeu de la vraie page avant/après :
**seule la Côte d'Ivoire bouge, orange → jaune** ; ALERTE_EVENTS passe de 172
à 169 incidents. La revue du pays pilote est hebdomadaire pendant le pilote.

---

## « Ce que nous ne savons pas » — 20/10/2026

Étape 3 du plan d'audit. `angleMort` (noyau) range un périmètre en quatre
familles : pays muets, pays « hors alerte » (du flux mais aucune source
fiable), pays à une seule source capable d'alerter (ou aucune), pays dont le
socle a plus de 90 jours (`CONFIANCE_SOCLE_ANCIEN_J`). Il ne note aucun pays.
Affiché en tête de la Synthèse (même périmètre que ses filtres) et avant les
fiches dans les rapports d'alertes (PDF, Word, aperçu imprimable), FR/EN, avec
la phrase : un pays listé n'est pas plus dangereux, c'est un pays que l'outil
voit mal.

La règle « capable d'alerter » (`peutAlerter`, `estRequeteGoogleNews`) a
quitté `scripts/lib/capacite-alerte.js` pour le noyau, qui la partage avec la
page ; la bibliothèque la réexporte. Mesuré sur la vraie page : 21 pays à
source unique, exactement le cliquet `PLAFOND_PAYS_SOURCE_UNIQUE`.

---

## La direction « Salle de veille » — 20/10/2026

Demande : une présentation « robuste et sécuritaire », sur le modèle de
palantir.com et lacoste.com. On en reprend des **principes**, jamais un logo,
une image ou un texte : une seule couleur d'action (l'encre), la couleur
réservée à ce qui signifie (les cinq niveaux de gravité), des filets d'un
pixel au lieu des ombres, des angles courts (4 px), des petites capitales
très espacées pour les repères, et un chrome sombre qui encadre un contenu
clair.

Ce qui a changé : `--b` passe du bronze à l'encre (`#14171C`, blanc cassé en
sombre) ; neutres froids au lieu de chauds ; rayons `--r-md` 8 → 4 px ; plus
d'ombres de carte. Barre du haut, rail des modules et scène de connexion
passent à l'encre (`--ink`). Le bronze `--sig` devient la signature : filet
sous la barre du haut, onglet actif, cadre du logo, nœuds du globe. Le thème
sombre passe du bleu nuit au graphite. Les tuiles d'indicateurs du tableau
de bord (`kpiCard`, classe `kpi-tile`) mettent le chiffre en avant (28 px,
chiffres tabulaires). **La zone de lecture reste claire par défaut** : la
consigne « pas de fond très sombre » vaut toujours pour le contenu.

**Le mécanisme à connaître** : `.tb,.nav-wrap{--w:…;--t:…;--b:…}` redéfinit
les jetons **localement**. Tout ce qui, dans ces deux zones, lit un jeton
suit sans qu'on touche aux styles en ligne. Un élément ajouté dans la barre
du haut avec une couleur **en dur** ne suivra pas : utiliser les jetons.

Pas touché : les couleurs de gravité (un test l'exige), les documents
exportés (Word/PDF/PowerPoint/bulletin gardent leur bronze, codé en dur),
`NIV`, les couleurs de source du registre.

Mesuré (7 modules × bureau/mobile × clair/sombre, DOM rendu) : 0 texte sous
AA en clair hors « Recalculer » désactivé (exempté), comme avant. En sombre,
deux défauts antérieurs corrigés au passage : « FLASH INFO » blanc sur le
rouge clair (2,8:1) et la pastille « Collecte » verte foncée (3:1).
`scripts/test/salle-de-veille.test.js` garde la redéfinition locale des
jetons et le seuil AA des couples de jetons.

---

## La direction « Bleu nuit » et les visuels d'actu — 20/10/2026 (soir)

L'éditeur a jugé « Salle de veille » sans élégance, trop noire et sans
impact, et écarté aussi une maquette claire : il veut des **fondus de bleu
nuit** et une image liée à chaque actu, à la manière d'Opera News, partout,
rapports compris.

**Le sombre devient le défaut.** Le script du `<head>` pose `data-theme="dark"`
et ne revient au clair que sur `sentinel_theme_choix === 'light'`, écrit
**seulement** par le bouton (`toggleTheme`). L'ancienne clé `sentinel_theme`
était réécrite à chaque chargement par `appliquerTheme` : la relire aurait
figé en clair tous les utilisateurs existants sans qu'aucun l'ait choisi. Un
test l'exige. La consigne « pas de fond très sombre par défaut » écrite plus
haut dans ce fichier est **levée par l'éditeur**.

Jetons sombres : surfaces bleu nuit étagées (`--page-bg` #071431 < `--sf` <
`--w` #0F2450), action et signature en or `#E6BA6E` (texte bleu nuit dessus,
9,8:1), texte le plus pâle `--lg` à 6,9:1 sur une carte et 5,7:1 sur le halo
le plus clair du dégradé de page. Le bloc CSS « DIRECTION « BLEU NUIT » » ne
touche que le sombre, sauf les visuels d'actu. Gravité inchangée.

**Le visuel d'une actu : `visuelActu(a, taille)`**, une seule fonction pour la
vignette du Flux, « À la une » (Flux) et « Les faits du jour »
(`renderPanelATraiter`, donc tableau de bord et Synthèse) via `carteUneHtml`.

- L'image est celle de la **source** (`_media` du flux, sinon aperçu Open
  Graph pour une source fiable, au plus `VISUEL_OGP_MAX` = 24 par rendu),
  affichée depuis son adresse, **jamais copiée**, avec le domaine en crédit.
  Le crédit apparaît même quand `sourcesVisibles()` masque les noms de
  source : afficher l'image d'un tiers sans dire d'où elle vient n'est pas
  défendable. À trancher par l'éditeur s'il veut l'inverse.
- `https` seulement (la CSP refuse le reste) et motif strict : une adresse
  avec un guillemet ne devient jamais un `<img>`.
- Une vidéo ne se lit pas sur place (la CSP n'autorise aucun cadre) :
  vignette officielle YouTube (`i.ytimg.com`) ou repli, et un bouton qui
  ouvre la source.
- Sans image, un **repli de marque** dit pays, thème et gravité, au lieu
  d'une photo d'illustration qui laisserait croire à un document. Il est
  toujours sous l'image : une image qui ne charge pas le laisse apparaître.

**Mesurer sur les données réelles.** Ce bac à sable n'a pas de réseau : il ne
voit que des replis. `scripts/apercu-visuels.js` lit le cache publié, compte
dans la page (`mediaActu`) la part d'actus avec image, et photographie le Flux
et le tableau de bord ; le workflow `apercu-visuels.yml` le lance sur chaque
PR qui touche la page et dépose les captures en artefact. Informatif, il
n'échoue jamais une PR.

**Le logo de l'organisation (identité d'envoi).** L'éditeur a précisé que
l'identité d'envoi d'un rapport, c'est le nom **et le logo** de
l'organisation. Paramètres > Personnalisation de marque reçoit un champ logo :
l'image est réduite à `LOGO_MARQUE_MAX_PX` (360 px), gardée en data URL PNG
(JPEG si trop lourde) dans `sentinel_marque_perso` (`logoMarque`,
`logoMarqueRatio`), jamais envoyée à un serveur. `logoMarqueActuelle()` suit
la règle du nom : plan payant seulement. Imprimé en tête de l'aperçu HTML
(Flux, Agenda, Alertes, rapport complet, Synthèse), du Word, du PDF (à gauche
du titre) et de la couverture PowerPoint. `pmSaveMarquePerso` reconstruit tout
l'objet : un test exige qu'il garde le logo déjà enregistré.

Les rapports HTML montrent aussi l'image de la source à côté de chaque
article (même règle que `visuelActu`), sans repli quand il n'y en a pas, pour
ne pas coûter d'encre. **Pas encore fait** : le logo et les images dans le
bulletin quotidien (page publique produite par le job, sans personnalisation
d'utilisateur) et dans les cartes d'actu des Word/PDF/PowerPoint.

### Vidéos ouvrables, rapports détaillés, réglages d'affichage — 20/10/2026 (soir)

Trois demandes de l'éditeur, une passe.

- **Une vidéo s'ouvre comme un lien de source.** `lienVideoActu(a)` donne la
  page YouTube (`embed` devient `watch`), sinon le fichier vidéo `https` publié
  par la source, sinon l'article. Toute la surface du visuel est le lien
  (`.vact-play`, `inset:0`), le détail d'une actu porte « Ouvrir la vidéo »,
  et `resolveOGP` retient aussi `og:video`.
- **Les rapports ne s'arrêtent plus au titre.** `detailRapportActu(a)` :
  résumé (l'analyse, coupée à `RESUME_RAPPORT_MAX`, jamais un rappel du titre),
  cotation, publication, survenance, source si `sourcesVisibles()`, lien
  article et lien vidéo. Lu par l'aperçu HTML (`_apDetailActu`), le PDF
  (`articleItem`), le Word (`detailWord`) et le PowerPoint (`detailPptx` ;
  trois ou quatre actus par diapositive au lieu de cinq à douze titres).
- **Paramètres > Affichage**, pour tous les rôles, enregistré sur l'appareil :
  format (automatique / ordinateur / tablette / mobile), taille du texte
  (`zoom` de la zone de lecture), présentation compacte ou « magazine »,
  « économiser les données » (aucune image chargée ni aperçu demandé ; une
  vidéo reste ouvrable). Le format tablette (rail compact de 96 px, « À la
  une » sur deux colonnes) s'applique d'office entre 761 et 1180 px ; forcé,
  il ne vaut qu'à partir de 761 px. Ses règles sont écrites deux fois et un
  test exige qu'elles restent identiques.

`scripts/test/videos-rapports-affichage.test.js` (11 tests, tous vus échouer
sur la version précédente).

---

## La page de garde « capitales de nuit » — 20/10/2026 (soir)

Demande de l'éditeur, sur le modèle de mise en page de scutum-sf.com (on en
reprend la **composition** : grand titre en capitales calé à gauche, bouton
contour « En savoir plus », photo plein cadre — jamais un texte, un logo ni une
image) : « votre partenaire sûreté sur l'Afrique », avec des vues de nuit de
grandes capitales africaines qui se fondent les unes dans les autres derrière
le texte.

- La vidéo `hero.mp4` (1,9 Mo) et son affiche sont **retirées** ; six photos de
  Wikimedia Commons sous licence libre (CC0, domaine public, CC BY, CC BY-SA)
  les remplacent dans `web/assets/capitales/` : Abidjan, Lagos, Nairobi,
  Le Caire, Johannesburg, Addis-Abeba. `credits.json` porte auteur, licence et
  lien de chaque fichier.
- Elles ont été choisies et redimensionnées (1600 px) par
  `scripts/capitales-nuit.py`, lancé en CI (`capitales-nuit.yml`) : le bac à
  sable n'a pas de réseau. La CSP de l'accueil (`img-src 'self' data:`) impose
  de les héberger.
- **Crédit obligatoire** (CC BY / BY-SA) : légende sur l'image en cours, et
  liste complète en pied de page (`#credits-photos`) avec lien vers le fichier
  source, la licence et la mention « image redimensionnée ».
- Une seule image se charge d'abord (`src` + `fetchpriority`), les cinq autres
  portent `data-src` et ne sont demandées qu'à la fin de l'animation
  d'ouverture (`demarrerDecor`). Mouvement lent (fondu + zoom, cycle 42 s),
  coupé sous `prefers-reduced-motion`.
- Lisibilité tenue par un voile radial local et une teinte bleu nuit
  (`.scene::after`, multiply) ; vérifiée à l'œil sur les six photos.
  **Le contraste sur pixels n'a pas été remesuré** comme le 15/10 pour la
  vidéo : à refaire si une photo plus claire entre dans la rotation.
