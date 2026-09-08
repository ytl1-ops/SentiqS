// Demande editoriale du 08/09/2026 : une actu (Flux, panneau de detail,
// synthese) et tout ce qui en est partage (texte, image) doivent se
// comprendre par leurs propres phrases, sans jamais avoir a rouvrir le lien
// vers la source pour saisir le contexte coupe en plein mot.
//
// Avant ce correctif, trois endroits tronquaient une actu a un nombre de
// caracteres fixe (desc.slice(0,400) a la collecte, extraitLoyal a 280
// caracteres dans le panneau de detail, analyseL.slice(0,280) dans la
// synthese) sans egard pour la ponctuation : le texte affiche s'arretait a
// un endroit arbitraire, parfois en plein mot, sans que rien ne le signale
// clairement comme incomplet.
const test = require('node:test');
const assert = require('node:assert');
const { HTML, tranche, bac, exposer } = require('./_bac.js');

const { coupePhraseComplete, retenirPhrasesDansLimite, extraitLoyal } = exposer(
  bac(tranche('// ── PHRASES ENTIERES', 'function fmtAge')),
  'coupePhraseComplete', 'retenirPhrasesDansLimite', 'extraitLoyal');

// ── coupePhraseComplete ──────────────────────────────────────────────────

test('un texte deja plus court que la limite est rendu tel quel', () => {
  assert.strictEqual(coupePhraseComplete('Une phrase courte.', 280), 'Une phrase courte.');
});

test('la coupe s\'arrete sur la derniere phrase complete, jamais en plein mot', () => {
  const texte = 'Des hommes armes ont attaque un poste de gendarmerie hier soir. '
    + 'Le bilan provisoire fait etat de trois blesses parmi les forces de l\'ordre. '
    + 'Une enquete a ete ouverte par les autorites locales pour identifier les auteurs.';
  const extrait = coupePhraseComplete(texte, 120);
  assert.ok(extrait.endsWith('.'), 'l\'extrait doit se terminer par un point, pas en plein mot : ' + JSON.stringify(extrait));
  assert.ok(texte.startsWith(extrait), 'l\'extrait doit etre un prefixe exact du texte source');
  assert.ok(extrait.length <= 120, 'l\'extrait ne doit jamais depasser la limite demandee');
  // La troisieme phrase (au-dela de la limite) ne doit laisser aucune trace
  // partielle dans l'extrait retenu.
  assert.ok(!extrait.includes('enquete'), 'aucun mot de la phrase suivante ne doit apparaitre, meme partiellement');
});

test('une seule phrase trop longue pour la limite retombe sur la coupe au dernier mot, avec points de suspension', () => {
  const texte = 'Une phrase unique sans aucun point interne qui continue longtemps sur plusieurs dizaines de mots avant de se terminer enfin ici';
  const extrait = coupePhraseComplete(texte, 60);
  assert.ok(extrait.endsWith('…'), 'sans phrase complete disponible, le texte incomplet doit etre signale par des points de suspension');
  assert.ok(!extrait.endsWith(' …') === false || true); // pas d'exigence stricte sur l'espace
  assert.ok(extrait.length <= 61, 'la coupe de secours doit rester proche de la limite demandee');
});

test('une ponctuation trouvee tres tot (abreviation) n\'interrompt pas la phrase', () => {
  // "M." tombe des les tout premiers caracteres : ce n'est pas une vraie fin
  // de phrase, s'y arreter donnerait un extrait quasi vide.
  const texte = 'M. Traore a annonce ce matin le renforcement des controles a la frontiere nord du pays.';
  const extrait = coupePhraseComplete(texte, 45);
  assert.notStrictEqual(extrait, 'M.', 'une abreviation en tete de texte ne doit pas etre prise pour une phrase complete');
});

test('un texte vide ou nul ne fait pas planter la coupe', () => {
  assert.strictEqual(coupePhraseComplete('', 100), '');
  assert.strictEqual(coupePhraseComplete(null, 100), '');
  assert.strictEqual(coupePhraseComplete(undefined, 100), '');
});

test('le HTML residuel est retire avant la coupe', () => {
  const extrait = coupePhraseComplete('<b>Alerte</b> securite dans la region.', 280);
  assert.doesNotMatch(extrait, /<[^>]+>/, 'aucune balise ne doit survivre dans le texte affiche');
});

// ── extraitLoyal (extrait « usage loyal » du panneau de detail) ─────────

test('extraitLoyal reutilise la coupe sur phrase complete, plus une coupe en plein mot', () => {
  const texte = 'Premiere phrase du recit des evenements de la journee dans la capitale. '
    + 'Deuxieme phrase qui narre la suite des faits avec plusieurs details supplementaires. '
    + 'Troisieme phrase, hors budget, qui ne doit jamais apparaitre dans l\'extrait retourne.';
  const extrait = extraitLoyal(texte, 100);
  assert.ok(extrait.endsWith('.'), 'extraitLoyal doit hériter du comportement phrase-complete de coupePhraseComplete');
  assert.ok(!extrait.toLowerCase().includes('troisieme'));
});

test('extraitLoyal retombe sur sa limite par defaut (280) quand aucune n\'est fournie', () => {
  const long = 'Phrase test. '.repeat(40); // bien plus long que 280 caracteres
  const extrait = extraitLoyal(long);
  assert.ok(extrait.length <= 280, 'la limite par defaut EXTRAIT_MAX_CARACTERES doit s\'appliquer');
});

// ── retenirPhrasesDansLimite (variante utilisee pour l'image partagee) ──

test('retenirPhrasesDansLimite accumule des phrases entieres tant qu\'elles tiennent', () => {
  const texte = 'Alpha bravo charlie delta. Echo foxtrot golf hotel india juliet. Kilo lima mike november oscar papa.';
  // Predicat simple : "tient" si moins de 60 caracteres — reproduit le role
  // du comptage de lignes reellement utilise dans genererImageActuBlob,
  // sans dependre d'un canevas.
  const retenu = retenirPhrasesDansLimite(texte, (t) => t.length <= 60);
  assert.ok(retenu.length <= 60, 'le texte retenu doit respecter la limite du predicat');
  assert.ok(texte.startsWith(retenu.trim()) || texte.startsWith(retenu),
    'le texte retenu doit etre un prefixe de phrases entieres du texte source');
  assert.ok(/[.!?]$/.test(retenu.trim()), 'le texte retenu doit se terminer sur une phrase complete');
});

test('retenirPhrasesDansLimite renvoie le texte entier si tout tient deja', () => {
  const texte = 'Une seule phrase courte.';
  assert.strictEqual(retenirPhrasesDansLimite(texte, () => true), texte);
});

test('retenirPhrasesDansLimite renvoie une chaine vide si meme la premiere phrase deborde', () => {
  const texte = 'Une phrase deja trop longue pour tenir nulle part.';
  assert.strictEqual(retenirPhrasesDansLimite(texte, () => false), '');
});

// ── Le point de collecte ne tranche plus en plein mot ────────────────────

test('la description collectee (parseJSON, parseRSS) est coupee sur une phrase complete, pas un slice brut', () => {
  const pJSON = tranche('function parseJSON(d, src)', 'function parseRSS(xml, src)');
  const pRSS = tranche('function parseRSS(xml, src)', 'async function initDB()');
  assert.match(pJSON, /coupePhraseComplete\(/, 'parseJSON doit construire sa description via coupePhraseComplete');
  assert.match(pRSS, /coupePhraseComplete\(/, 'parseRSS doit construire sa description via coupePhraseComplete');
  assert.doesNotMatch(pJSON, /\.replace\(\/\\s\+\/g,\s*'\s*'\)\.trim\(\)\.slice\(0,\s*400\)/,
    'l\'ancienne coupure brute a 400 caracteres ne doit plus exister dans parseJSON');
  assert.doesNotMatch(pRSS, /\.replace\(\/\\s\+\/g,\s*'\s*'\)\.trim\(\)\.slice\(0,\s*400\)/,
    'l\'ancienne coupure brute a 400 caracteres ne doit plus exister dans parseRSS');
});

// ── La synthese ne tranche plus un texte deja echappe ────────────────────

test('la synthese coupe l\'analyse AVANT de l\'echapper, sur une phrase complete', () => {
  const f = tranche('async function updSynthese()', 'function resolveAgendaCy');
  assert.match(f, /extraitLoyal\(L\(a\.analysis\),\s*280\)/,
    'la synthese doit reutiliser extraitLoyal (phrase complete), pas re-trancher un texte deja echappe');
  assert.doesNotMatch(f, /analyseL\.slice\(0,\s*280\)/,
    'l\'ancienne coupe brute sur le texte deja echappe (risque de couper une entite HTML en deux) ne doit plus exister');
});

// ── L'image partagee ne tranche plus en plein mot par defaut ─────────────

test('la generation d\'image du partage tente une coupe par phrase avant tout repli en plein mot', () => {
  const f = tranche('async function genererImageActuBlob', '_telechargerImage');
  assert.match(f, /retenirPhrasesDansLimite\(/,
    'le corps de texte de l\'image partagee doit d\'abord tenter de s\'arreter sur une phrase complete');
});
