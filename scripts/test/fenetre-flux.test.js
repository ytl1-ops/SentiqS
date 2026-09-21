// La fenetre d'actualite (FENETRE_ACTUALITE_MS, 36h) est censee gouverner le
// Flux, le tableau de bord et le compteur de pays couverts (voir CLAUDE.md,
// « La fenetre d'actualite »). Trois endroits ne la suivaient pas : ils
// imposaient un 12h en dur, reste de l'ancienne fenetre d'avant le passage
// a 36h du 06/09/2026, jamais mis a jour au moment du reglage.
//
// getFiltered() (le Flux lui-meme) passait ce 12h a antiHalluFilter() en
// second argument, ecrasant son repli sur FENETRE_ACTUALITE_MS — tout
// article de 12 a 36h etait donc invisible dans le Flux alors que le
// tableau de bord, lui, le comptait deja comme actualite (chacun via
// estRecentReel(), qui lit correctement la constante). publierCollectePartagee()
// purgeait a 12h les articles herites du cache partage avant de le
// republier : chaque cycle de collecte effacait silencieusement, du cache
// que tous les visiteurs lisent, les articles de 12 a 36h que la fenetre
// documentee dit pourtant garder. compteurRegional() (stat "Regional" de la
// barre du Flux) comptait aussi a 12h.
//
// Six autres occurrences du meme 12*60*60*1000 dans le fichier etaient des
// variables locales jamais lues (le filtre reel, juste en-dessous, appelait
// deja estRecentReel() — correctement sur 36h) : du code mort, mais dont le
// nom pouvait laisser croire a un filtre actif. Retirees.
const test = require('node:test');
const assert = require('node:assert');
const { HTML, tranche } = require('./_bac');

test('getFiltered() ne recopie plus sa propre fenetre, plus courte que celle du reste de l\'appli', () => {
  const f = tranche('function getFiltered() {', '\n  return a;\n}');
  assert.doesNotMatch(f, /12\s*\*\s*60\s*\*\s*60\s*\*\s*1000/,
    'getFiltered() impose encore une fenetre en dur au lieu de suivre FENETRE_ACTUALITE_MS');
  assert.match(f, /antiHalluFilter\(\[\.\.\.ALL\]\)/,
    'getFiltered() doit appeler antiHalluFilter() sans second argument, pour retomber sur FENETRE_ACTUALITE_MS');
});

test('publierCollectePartagee() ne purge plus le cache partage a 12h en dur', () => {
  const f = tranche('const existantsRecents = ', 'existantsRecents.forEach');
  assert.doesNotMatch(f, /12\s*\*\s*60\s*\*\s*60\s*\*\s*1000/,
    'la purge du cache partage impose encore 12h au lieu de FENETRE_ACTUALITE_MS');
  assert.match(f, /FENETRE_ACTUALITE_MS/,
    'la purge du cache partage doit suivre FENETRE_ACTUALITE_MS, la meme fenetre que le reste de l\'appli');
});

test('compteurRegional() suit la meme fenetre que le reste du Flux', () => {
  const f = tranche('function compteurRegional() {', '\n}');
  assert.doesNotMatch(f, /12\s*\*\s*60\s*\*\s*60\s*\*\s*1000/,
    'compteurRegional() impose encore 12h en dur');
  assert.match(f, /FENETRE_ACTUALITE_MS/, 'compteurRegional() doit suivre FENETRE_ACTUALITE_MS');
});

test('aucune fenetre de 12h en dur ne subsiste hors des deux exceptions documentees', () => {
  // Deux occurrences de 12*60*60*1000 sont legitimes, pour deux raisons
  // distinctes qui n'ont rien a voir l'une avec l'autre :
  //  - getLiveAlertEvents : fenetre PROPRE aux signaux d'alerte,
  //    volontairement plus courte que celle du Flux (voir CLAUDE.md,
  //    « La fenetre d'actualite »).
  //  - FCDO_CACHE_MS : duree de cache d'un appel a l'API de conseils aux
  //    voyageurs du Foreign Office britannique — une limitation de frequence
  //    d'appel reseau, sans aucun rapport avec la fraicheur d'un article.
  // Un cliquet, comme les autres dettes gelees de ce depot : s'il remonte
  // au-dela de 2, c'est qu'un nouveau 12h en dur vient d'etre introduit
  // ailleurs pour filtrer des actualites, exactement le defaut corrige ici.
  const occurrences = [...HTML.matchAll(/12\s*\*\s*60\s*\*\s*60\s*\*\s*1000/g)];
  assert.strictEqual(occurrences.length, 2,
    occurrences.length + ' occurrence(s) de 12*60*60*1000 trouvees, deux attendues ' +
    '(getLiveAlertEvents, FCDO_CACHE_MS) : toute autre doit suivre FENETRE_ACTUALITE_MS');
  const g = tranche('function getLiveAlertEvents(cy) {', '\n  const now = Date.now();');
  assert.match(g, /12\s*\*\s*60\s*\*\s*60\s*\*\s*1000/,
    'une des deux occurrences restantes doit etre celle de getLiveAlertEvents');
  assert.match(HTML, /const FCDO_CACHE_MS = 12 \* 60 \* 60 \* 1000;/,
    'l\'autre occurrence restante doit etre celle de FCDO_CACHE_MS');
});
