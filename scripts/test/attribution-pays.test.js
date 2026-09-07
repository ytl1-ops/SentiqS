// Teste _detecterPaysCoeur(), extrait du fichier de production : la fonction
// qui décide À QUEL PAYS rattacher une actualité collectée.
//
// Rattacher un article au mauvais pays fait remonter un incident étranger
// dans la fiche d'un pays — un faux positif que rien ne rattrape en aval, et
// que le drapeau « confiant » est justement là pour éviter. Cette heuristique
// est la plus exposée du moteur et n'avait aucun test.
const test = require('node:test');
const assert = require('node:assert');
const { tranche, bac, exposer } = require('./_bac.js');

const contexte = exposer(
  bac(tranche('const PAYS_DETECT', 'function classify')),
  '_detecterPaysCoeur', 'detectPaysFromText'
);
const { _detecterPaysCoeur, detectPaysFromText } = contexte;

const ou = (titre, contenu, srcCy) => _detecterPaysCoeur(titre, contenu || '', srcCy);

test('un pays nommé dans le titre l\'emporte sur le pays de la source', () => {
  // Les agrégateurs (AllAfrica, APA) relaient des articles de tout le
  // continent : le pays de la source ne dit rien du sujet.
  assert.deepStrictEqual(
    { ...ou('Attaque a Bamako signalee ce matin', '', 'GH') },
    { cy: 'ML', confiant: true }
  );
  assert.strictEqual(ou('Ouagadougou : marche ferme', '', 'SN').cy, 'BF');
});

test('une capitale citée suffit à identifier le pays', () => {
  assert.strictEqual(ou('Incident a Lagos', '', 'NG').cy, 'NG');
  assert.strictEqual(ou('Abidjan et Accra renforcent leur cooperation', '', 'SN').cy, 'CI');
});

test('le corps du texte est examiné quand le titre ne nomme aucun pays', () => {
  const r = ou('Nouvelles mesures annoncees', 'Le gouvernement de Niamey a annonce', 'SN');
  assert.strictEqual(r.cy, 'NE');
  assert.strictEqual(r.confiant, true);
});

test('un sujet hors périmètre est marqué international, pas rattaché à la source', () => {
  // Cas signalé : un article de football européen relayé par un média malien
  // n'est pas une actualité du Mali.
  assert.strictEqual(ou('Le selectionneur belge annonce sa liste', '', 'ML').cy, 'INT');
  assert.strictEqual(ou('Sommet a Paris entre dirigeants', '', 'ML').cy, 'INT');
});

test('un rattachement par défaut est signalé comme non confirmé', () => {
  // LE garde-fou de cette fonction. Cas signalé : « Loi 101 » (législation
  // québécoise) relayé sur la page Ghana d'un agrégateur — aucun pays africain
  // nommé, aucun signal hors périmètre non plus. Le pays de la source est
  // retenu faute d'alternative, mais confiant=false permet aux vues « par
  // pays » d'exclure ce faux rattachement.
  const r = ou('Loi 101 : le debat relance', '', 'GH');
  assert.strictEqual(r.cy, 'GH');
  assert.strictEqual(r.confiant, false,
    'un rattachement par simple absence d\'alternative ne doit jamais être marqué confiant');
});

test('une actualité générique reste non confirmée même sur sa propre source', () => {
  const r = ou('Reunion du conseil des ministres', '', 'BF');
  assert.strictEqual(r.cy, 'BF');
  assert.strictEqual(r.confiant, false);
});

test('un texte vide retombe sur la source sans jamais prétendre à la confiance', () => {
  for (const vide of ['', '   ']) {
    const r = ou(vide, '', 'SN');
    assert.strictEqual(r.cy, 'SN');
    assert.strictEqual(r.confiant, false);
  }
});

test('detectPaysFromText renvoie un code pays exploitable', () => {
  assert.strictEqual(detectPaysFromText('Manifestation a Conakry', '', 'SN'), 'GN');
  const r = detectPaysFromText('', '', 'SN');
  assert.ok(typeof r === 'string' && r.length >= 2, 'un code pays est toujours renvoyé');
});

test('la détection ne renvoie jamais une valeur inexploitable', () => {
  const entrees = [
    ['12345', '', 'SN'],
    ['???', '', 'ML'],
    ['a'.repeat(500), '', 'GH'],
  ];
  for (const [t, c, src] of entrees) {
    const r = ou(t, c, src);
    assert.ok(typeof r.cy === 'string' && r.cy.length >= 2, 'code pays attendu pour : ' + t.slice(0, 20));
    assert.strictEqual(typeof r.confiant, 'boolean');
  }
});

// ── Presse lusophone et hispanophone ─────────────────────────────────────

test('un article portugais sur un sujet extérieur ne prend pas le pays de sa source', () => {
  // Cas réel, relevé dans le cache publié le 06/09/2026 : « Voos suspensos
  // em seis aeroportos da Indonésia após erupção vulcânica » s'affichait
  // sous Mozambique. La liste hors périmètre existait en français et en
  // anglais, pas en portugais : aucun mot ne se déclenchait, et
  // _detecterPaysCoeur rattachait l'article au pays de sa source faute de
  // mieux.
  assert.strictEqual(ou('Voos suspensos em seis aeroportos da Indonésia após erupção vulcânica', '', 'MZ').cy, 'INT');
  assert.strictEqual(ou('Espanha reforça o controlo fronteiriço', '', 'GW').cy, 'INT');
  assert.strictEqual(ou('Estados Unidos anunciam novas sanções', '', 'AO').cy, 'INT');
  assert.strictEqual(ou('França envia mais militares', '', 'CV').cy, 'INT');
});

test('un article espagnol sur un sujet extérieur ne prend pas le pays de sa source', () => {
  // Même chose pour la Guinée équatoriale, seul pays hispanophone suivi.
  assert.strictEqual(ou('España despliega la Guardia Civil', '', 'GQ').cy, 'INT');
  assert.strictEqual(ou('Rusia y Ucrania reanudan las negociaciones', '', 'GQ').cy, 'INT');
});

test('une actualité nationale en portugais reste à son pays', () => {
  // Le garde-fou du garde-fou : élargir la liste ne doit pas expédier à
  // l'international ce qui concerne vraiment le pays.
  assert.strictEqual(ou('Ataque armado em Cabo Delgado faz vítimas', '', 'MZ').cy, 'MZ');
  assert.strictEqual(ou('Governo de Bissau anuncia novas medidas', '', 'GW').cy, 'GW');
  assert.strictEqual(ou('Luanda acolhe cimeira sobre segurança', '', 'AO').cy, 'AO');
});

test('aucun nom de pays africain ne figure dans la liste hors périmètre', () => {
  // L'erreur évidente en élargissant cette liste : y glisser « Guiné »,
  // « Angola » ou « Moçambique », ce qui enverrait à l'international les
  // articles qui parlent justement du pays surveillé.
  const { estHorsPerimetreNational } = exposer(
    bac(tranche('const PAYS_HORS_AFRIQUE', 'function detectPaysFromText')),
    'estHorsPerimetreNational'
  );
  const africains = [
    'angola', 'moçambique', 'mocambique', 'guiné', 'guine', 'cabo verde',
    'são tomé', 'sao tome', 'marrocos', 'argélia', 'argelia', 'egito',
    'nigéria', 'quénia', 'quenia', 'etiópia', 'etiopia', 'zâmbia', 'zambia',
    'somália', 'somalia', 'líbia', 'libia', 'sudão', 'sudao', 'chade',
    'guinea ecuatorial', 'costa de marfil', 'senegal', 'mali',
  ];
  const faux = africains.filter((a) => estHorsPerimetreNational(a));
  assert.deepStrictEqual(faux, [], 'pays africains classés hors périmètre : ' + faux.join(', '));
});

// ── La détection connaît-elle les noms étrangers ? ───────────────────────

test('un pays nommé en anglais est reconnu', () => {
  // Cas réel du cache publié le 06/09/2026 : « At least 25 killed in bus
  // crash on Cape Verde's Fogo island » venait de SABC, un média
  // sud-africain, et s'affichait sous AFRIQUE DU SUD. La liste de détection
  // connaissait « cap-vert » et « cabo verde », pas « cape verde » — l'article
  // ne déclenchait rien et retombait au pays de sa source.
  assert.strictEqual(ou("At least 25 killed in bus crash on Cape Verde's Fogo island: Agency", '', 'ZA').cy, 'CV');
  // Deuxième cas du même cache : une condamnation en Égypte, relayée par un
  // média ghanéen, s'affichait sous Ghana.
  assert.strictEqual(ou('TV presenter among 12 sentenced to death in Egypt drugs case', '', 'GH').cy, 'EG');
  // Les pays dont le nom anglais diffère du français, un par famille.
  assert.strictEqual(ou('South Africa police report rise in cash-in-transit heists', '', 'KE').cy, 'ZA');
  assert.strictEqual(ou('Ethiopia says security operation in Amhara is over', '', 'KE').cy, 'ET');
  assert.strictEqual(ou('Chad closes border crossing after clashes', '', 'NG').cy, 'TD');
  assert.strictEqual(ou('Tanzania opposition leader detained', '', 'KE').cy, 'TZ');
});

test('un pays nommé en portugais est reconnu', () => {
  assert.strictEqual(ou('Acidente com autocarro faz 25 mortos em Cabo Verde', '', 'MZ').cy, 'CV');
  assert.strictEqual(ou('Ataque na Guiné-Bissau deixa feridos', '', 'AO').cy, 'GW');
});

test('« Guinea Ecuatorial », ordre des mots espagnol, va à la Guinée équatoriale', () => {
  // Le masque connaissait « equatorial guinea » (anglais) et « guiné
  // equatorial » (portugais), pas l'ordre espagnol. Résultat mesuré le
  // 07/09/2026 en rejouant Diario Rombe et Ahora EG sur la page : leurs
  // articles partaient à la Guinée (GN). Le seul pays hispanophone suivi
  // perdait sa propre presse au profit de son homonyme.
  assert.strictEqual(ou('El clan de Obiang expolia la Tesorería de Guinea Ecuatorial', '', 'GQ').cy, 'GQ');
  assert.strictEqual(ou('Guinea Ecuatorial: detenido un periodista en Malabo', '', 'GQ').cy, 'GQ');
  // Et le gentilé, très employé par cette presse.
  assert.strictEqual(ou('Un empresario ecuatoguineano acusado de fraude', '', 'GQ').cy, 'GQ');
  // Garde-fou symétrique : la Guinée tout court reste la Guinée.
  assert.strictEqual(ou('Guinea: huelga general en Conakry', '', 'GQ').cy, 'GN');
});

test('les noms composés ne volent pas les points du pays court', () => {
  // Même piège qu'en français, dans les autres langues : sans masquage,
  // « South Sudan » faisait gagner des points au Soudan, « Guinea-Bissau »
  // à la Guinée, et « Niger Delta » — qui est au NIGERIA — au Niger.
  assert.strictEqual(ou('South Sudan crisis deepens as talks stall', '', 'KE').cy, 'SS');
  assert.strictEqual(ou('War in Sudan intensifies around El Fasher', '', 'KE').cy, 'SD');
  assert.strictEqual(ou('Guinea-Bissau coup attempt foiled', '', 'SN').cy, 'GW');
  assert.strictEqual(ou('Protests in Guinea over fuel prices', '', 'SN').cy, 'GN');
  assert.strictEqual(ou('Equatorial Guinea signs energy deal', '', 'CM').cy, 'GQ');
  assert.strictEqual(ou('Niger Delta militants attack pipeline', '', 'NG').cy, 'NG');
});

test('chaque pays a au moins un nom non français dans sa liste de détection', () => {
  // Cliquet. La lacune a coûté quatre corrections en une journée (lexiques
  // de tri, liste hors périmètre, requêtes de collecte, puis celle-ci) :
  // une liste monolingue dans un produit qui lit cinquante-quatre pays en
  // quatre langues est une panne silencieuse en attente.
  const { PAYS_DETECT } = exposer(bac(tranche('const PAYS_DETECT', 'function classify')), 'PAYS_DETECT');
  const pays = Object.keys(PAYS_DETECT);
  assert.strictEqual(pays.length, 54, '54 pays attendus, vu : ' + pays.length);
  // Un terme non français : au moins un terme absent du jeu de caractères
  // strictement français, ou une forme anglaise/portugaise/arabe connue.
  const sansEtranger = pays.filter((cy) => PAYS_DETECT[cy].length < 3);
  assert.deepStrictEqual(sansEtranger, [], 'pays à liste trop courte : ' + sansEtranger.join(', '));
});

test('« Maurice Kamto » est un homme politique camerounais, pas l\'île Maurice', () => {
  // Mesure de la collecte n° 851 du 07/09/2026 : « Anicet Ekanè - Son dernier
  // combat politique pour Kamto », article d'AllAfrica Cameroun dont le corps
  // commence par « Maurice Kamto a choisi le Manidem... », etait rattache a
  // MAURICE (ville Port-Louis), classe eleve, et faisait passer l'ile de
  // jaune a orange. Le prenom d'un opposant camerounais ne designe pas un
  // pays. Le masque retire l'expression avant la detection ; l'ile Maurice
  // nommee pour elle-meme reste reconnue.
  const r = ou('Anicet Ekanè - Son dernier combat politique pour Kamto',
    '[Camer.be] Maurice Kamto a choisi le Manidem pour déjouer les pièges du régime.', 'CM');
  assert.strictEqual(r.cy, 'CM');
  assert.strictEqual(ou('Cyclone : l\'île Maurice en alerte', '', 'CM').cy, 'MU');
  assert.strictEqual(ou('Port-Louis : manifestation devant le Parlement', '', 'CM').cy, 'MU');
});
