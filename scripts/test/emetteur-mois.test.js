// L'identité d'envoi du rapport mensuel se précise à chaque génération
// demandée, et SentiqS sort par défaut (consigne de YORO du 14/11/2026).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const g = require('../lib/rapport-grsci.js');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'emetteur-'));
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]), Buffer.from([0, 0, 1, 0, 0, 0, 0, 100]), Buffer.alloc(8)]);

test('sans identité saisie : SentiqS par défaut, et on le sait', () => {
  const racine = tmp();
  assert.strictEqual(g.fixerEmetteurMois(racine, '2026-11', { identite: '   ' }), null);
  assert.ok(!fs.existsSync(g.cheminEmetteurMois(racine, '2026-11')));
  const em = g.emetteurDuMois(racine, '2026-11', path.join(racine, 'absent.json'));
  assert.strictEqual(em.identite, 'SentiqS');
  assert.strictEqual(em.precise, false);
});

test('l’identité saisie est retenue pour le mois, pas pour les autres', () => {
  const racine = tmp();
  const conf = path.join(racine, 'conf');
  fs.mkdirSync(conf);
  fs.writeFileSync(path.join(conf, 'logo-dsi.png'), PNG);
  const cfg = path.join(conf, 'rapport-mensuel.json');
  fs.writeFileSync(cfg, JSON.stringify({ identite: 'SentiqS' }));
  g.fixerEmetteurMois(racine, '2026-11', { identite: 'Direction de la Sûreté', signature: 'Groupe X', logo: 'logo-dsi.png' });
  const em = g.emetteurDuMois(racine, '2026-11', cfg);
  assert.strictEqual(em.identite, 'Direction de la Sûreté');
  assert.strictEqual(em.signature, 'Groupe X');
  assert.strictEqual(em.logo, path.join(conf, 'logo-dsi.png'));
  assert.strictEqual(em.precise, true);
  assert.strictEqual(g.emetteurDuMois(racine, '2026-12', cfg).identite, 'SentiqS', 'un autre mois garde le défaut');
});

test('un logo ne sort jamais du dossier de configuration', () => {
  const racine = tmp();
  g.fixerEmetteurMois(racine, '2026-11', { identite: 'Org', logo: '../../etc/passwd.png' });
  assert.strictEqual(g.emetteurDuMois(racine, '2026-11').logo, null);
});

test('le job passe l’émetteur du mois aux trois formats et le lancement manuel le demande', () => {
  const job = fs.readFileSync(path.join(__dirname, '..', 'collecte-planifiee.js'), 'utf8');
  assert.match(job, /rapportGrsci\.emetteurDuMois\(RACINE_GRSCI, moisR\)/);
  assert.match(job, /rapportGrsci\.ecrire\(RACINE_GRSCI, PptxGenJS, \{ jour: fin, ci, regionaux, emetteur \}\)/);
  assert.match(job, /ecrireWord\(RACINE_GRSCI, require\('docx'\), \{ jour: fin, ci, regionaux, emetteur \}\)/);
  assert.match(job, /aucune identité d\\'envoi précisée/);
  const wf = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'collecte-planifiee.yml'), 'utf8');
  for (const k of ['identite_envoi', 'signature_envoi', 'logo_envoi', 'RAPPORT_IDENTITE: ${{ inputs.identite_envoi }}']) assert.ok(wf.includes(k), k);
});
