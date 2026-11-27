'use strict';
// « Pas à jour et les rendus des rapports sont inexploitables » (YORO,
// 27/11/2026). Ces tests gardent les correctifs de ce jour-là ; chacun a été
// vu échouer sur l'ancien code.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { HTML } = require('./_bac');
const { langueTexte, faitEnFrancais, faitsDuMois, faitsNonTraduits } = require('../lib/faits-grsci');
const { estHorsSurete } = require('../lib/hors-surete');
const redaction = require('../lib/redaction-grsci');
const { signaturePage } = require('../lib/signature-page');

const RACINE = path.join(__dirname, '..', '..');

// ── Une page ouverte apprend qu'une nouvelle version est servie ──────────

test('le déploiement écrit version.json avec la signature de la page, sur Pages et sur Firebase', () => {
  const wf = fs.readFileSync(path.join(RACINE, '.github/workflows/gh-pages-deploy.yml'), 'utf8');
  const n = (wf.match(/node scripts\/ecrire-version\.js/g) || []).length;
  assert.strictEqual(n, 2, 'une étape par cible de déploiement');
  assert.ok(fs.existsSync(path.join(RACINE, 'scripts/ecrire-version.js')));
});

test('la page compare version.json à sa propre signature et propose de recharger', () => {
  assert.match(HTML, /async function verifierNouvelleVersion\(force\)/);
  assert.match(HTML, /fetch\('version\.json\?t='/);
  assert.match(HTML, /signatureCode\(\)/);
  assert.match(HTML, /function afficherBandeauVersion/);
  // Vérifiée au retour sur l'onglet, pas seulement au chargement.
  const reouverture = HTML.slice(HTML.indexOf('const relancerSiReouverture'), HTML.indexOf("addEventListener('visibilitychange', relancerSiReouverture)"));
  assert.match(reouverture, /verifierNouvelleVersion\(false\)/);
});

test('la signature calculée par le job est celle que calcule la page', () => {
  // Même algorithme que signatureCode() (FNV-1a des scripts en ligne, hors
  // data-src). Une divergence afficherait le bandeau en permanence.
  const s = signaturePage(HTML);
  assert.match(s, /^[0-9a-z]+$/);
  const i = HTML.lastIndexOf('</body>');
  const avecHorsLigne = HTML.slice(0, i) + '<script data-src="x">var a=1;</script>' + HTML.slice(i);
  assert.strictEqual(signaturePage(avecHorsLigne), s, 'un script data-src ne compte pas');
  const modifiee = HTML.replace('async function verifierNouvelleVersion(force)', 'async function verifierNouvelleVersion(force )');
  assert.notStrictEqual(signaturePage(modifiee), s, 'un changement de code change la signature');
});

test('au retour sur l\'onglet, le cache partagé est relu avant toute collecte par le navigateur', () => {
  const reouverture = HTML.slice(HTML.indexOf('const relancerSiReouverture'), HTML.indexOf("addEventListener('visibilitychange', relancerSiReouverture)"));
  const iLecture = reouverture.indexOf('lireCollectePartagee()');
  const iCollecte = reouverture.indexOf('doCollect()');
  assert.ok(iLecture > 0, 'le cache partagé est lu');
  assert.ok(iCollecte > iLecture, 'la collecte n\'est que le repli');
});

test('l\'heure des données est affichée, sans couleur d\'alerte quand elles vieillissent', () => {
  assert.match(HTML, /id="majDonnees"/);
  assert.match(HTML, /id="majDonneesPied"/);
  assert.match(HTML, /function majHeureDonnees\(ts\)/);
  const css = HTML.slice(HTML.indexOf('NOUVELLE VERSION ET HEURE DES DONNÉES'), HTML.indexOf('NOUVELLE VERSION ET HEURE DES DONNÉES') + 3000);
  const vieux = (css.match(/\.vieux\{[^}]*\}/g) || []).join(' ');
  assert.ok(vieux, 'une règle .vieux existe');
  assert.doesNotMatch(vieux, /var\(--(r|m|a|o|j)\b|#(DC2626|B91C1C|EA580C|CA8A04)/i);
});

// ── Une seule langue dans Présentation 1 ─────────────────────────────────

test('un titre anglais, portugais ou espagnol sans langue notée est reconnu', () => {
  assert.strictEqual(langueTexte('Gunmen kill 12 villagers in Zamfara attack'), 'en');
  assert.strictEqual(langueTexte('Ghana’s police arrest suspects'), 'en');
  assert.strictEqual(langueTexte('Ataque armado mata 12 pessoas em Cabo Delgado e a polícia não confirma'), 'pt');
  assert.strictEqual(langueTexte('Ataque armado deja cinco muertos en Malabo y los heridos'), 'es');
  // Le français reste du français, même avec un nom arabe ou anglais cité.
  assert.strictEqual(langueTexte('Abidjan : le préfet interdit la marche de l’opposition'), null);
  assert.strictEqual(langueTexte('Le ministre reçoit l’ambassadeur à محمد'), null);
});

test('un fait au titre étranger non traduit est écarté et compté', () => {
  const cumul = { pays: { CI: [
    { id: 'a', titre: 'Gunmen kill 12 villagers in the north', date: '2026-11-10', niveau: 'crit', cat: 'securite', source: 'S1', url: 'https://ex/a' },
    { id: 'b', titre: 'Abidjan : trois blessés dans une attaque à main armée', date: '2026-11-11', niveau: 'crit', cat: 'securite', source: 'S2', url: 'https://ex/b' },
  ] } };
  assert.strictEqual(faitEnFrancais(cumul.pays.CI[0]), false);
  const titres = JSON.stringify(faitsDuMois(cumul, 'CI', 'Côte d\'Ivoire'));
  assert.doesNotMatch(titres, /Gunmen/);
  assert.match(titres, /Abidjan/);
  assert.strictEqual(faitsNonTraduits(cumul, 'CI', 'Côte d\'Ivoire'), 1);
});

test('un extrait étranger non traduit n\'est pas cité dans un fait rédigé', () => {
  const r = redaction.rediger({ titre: 'Attaque à Tillabéri', resume: 'Gunmen attacked the village and killed several people on the road', source: 'S', date: '2026-11-10', niveau: 'crit' }, 'Niger');
  assert.strictEqual(r.extraits.length, 0);
});

test('les mentions des flux (« The post … appeared first on », ReliefWeb) sortent des extraits', () => {
  assert.strictEqual(redaction.sansMentionsDeFlux('Six morts. The post Bénin : six morts appeared first on Banouto.').trim(), 'Six morts.');
  assert.strictEqual(redaction.sansMentionsDeFlux('appel à la cessation […] The post Togo : les signataires du MGT revendiquent le succès de la…'), 'appel à la cessation …');
  assert.strictEqual(redaction.sansMentionsDeFlux('Source: Famine Early Warning System Network Please refer to the attached file. Messages clés').trim(), 'Messages clés');
});

// ── Un avis administratif n'est pas un fait de sûreté ────────────────────

test('un avis à manifestation d\'intérêt ou un appel d\'offres sort du rapport', () => {
  for (const t of [
    'AVIS à manifestation d’intérêt n°002/CA pour le recrutement d’un cabinet',
    'Avis d’appel d’offres pour la construction de salles de classe',
    'Avis de recrutement d’un consultant chargé de l’évaluation',
  ]) assert.ok(estHorsSurete({ titre: t }, 'ML'), t);
  // Une vraie manifestation reste un fait de sûreté.
  assert.ok(!estHorsSurete({ titre: 'Bamako : une manifestation dispersée par la police' }, 'ML'));
});
