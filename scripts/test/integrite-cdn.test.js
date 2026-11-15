// Audit du 15/11/2026 : la page chargeait « @supabase/supabase-js@2 » et
// « @emailjs/browser@4 » — la DERNIÈRE version publiée, quelle qu'elle soit,
// exécutée sans contrôle dans une page qui porte la session de l'utilisateur.
// Et aucun script tiers ne portait d'empreinte SRI : un fichier modifié sur le
// CDN s'exécutait comme le nôtre. Ce test refuse les deux, hors ligne ; la
// conformité de chaque empreinte au fichier réellement servi est vérifiée en
// CI par scripts/verifier-integrite-cdn.js (le bac à sable n'a pas le réseau).
const test = require('node:test');
const assert = require('node:assert');
const { inventaire, versionFlottante } = require('../lib/scripts-cdn.js');

const liste = inventaire();

test('les scripts tiers sont bien inventoriés (le test ne regarde pas une liste vide)', () => {
  const urls = liste.map((x) => x.url).join('\n');
  for (const attendu of ['supabase-js', 'emailjs', 'docx@', 'pdf-lib@', 'pptxgenjs@', 'xlsx-', 'firebase-auth-compat.js']) {
    assert.ok(urls.includes(attendu), 'absent de l\'inventaire : ' + attendu);
  }
});

test('aucun script tiers n\'est chargé en version flottante', () => {
  const flottants = liste.filter((x) => versionFlottante(x.url)).map((x) => x.ou + ' : ' + x.url);
  assert.deepStrictEqual(flottants, []);
});

test('chaque script tiers porte une empreinte SRI sha384 et crossorigin', () => {
  const sans = liste.filter((x) => !/^sha384-[A-Za-z0-9+/]{64}$/.test(x.integrity || '') || !x.cors)
    .map((x) => x.ou + ' : ' + x.url + ' → ' + x.integrity);
  assert.deepStrictEqual(sans, []);
});

test('une même adresse a la même empreinte partout', () => {
  const vu = new Map();
  for (const x of liste) {
    if (vu.has(x.url)) assert.strictEqual(x.integrity, vu.get(x.url), x.url);
    vu.set(x.url, x.integrity);
  }
});
