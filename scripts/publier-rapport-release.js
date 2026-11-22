// Dépose le rapport du mois en cours (PowerPoint, Word, PDF) dans la release
// GitHub `rapport-AAAA-MM`, pose son adresse dans index.json, puis retire les
// fichiers de l'arbre : seule la version finale d'un mois clos est commitée.
// Choix de YORO du 22/11/2026 (« version finale seule dans Git ») : le rapport,
// recommité chaque jour, faisait grossir le dépôt de ~700 Mo par mois.
//
// Un échec (gh absent, droits, réseau) ne retire rien : les fichiers restent
// et sont commités comme avant. Le rapport n'est jamais perdu pour une release.
//
// Appelé par collecte-planifiee.yml après le PDF et l'index (formats à jour).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { tagRelease, nomAsset, baseRelease, marquerRelease } = require('./lib/rapport-grsci');

const FORMATS = ['pptx', 'docx', 'pdf'];

function ghParDefaut(args) {
  return execFileSync('gh', args, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
}

/**
 * @param {{ racine:string, depot:string, mois:string, gh?:(args:string[])=>string, journal?:(m:string)=>void }} o
 * @returns {{ publie:boolean, raison?:string, base?:string, fichiers?:string[] }}
 */
function publier(o) {
  const gh = o.gh || ghParDefaut;
  const journal = o.journal || console.log;
  const { racine, depot, mois } = o;
  if (!/^[\w.-]+\/[\w.-]+$/.test(String(depot || ''))) return { publie: false, raison: 'dépôt inconnu' };
  const locaux = FORMATS.filter((f) => fs.existsSync(path.join(racine, mois + '.' + f)));
  // Rien d'écrit ce passage-ci (le rapport du jour existe déjà) : rien à faire.
  if (!locaux.length) return { publie: false, raison: 'aucun fichier du mois' };
  const tag = tagRelease(mois);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rapport-'));
  try {
    // Nom de l'asset = nom du fichier enregistré : l'attribut `download` d'un
    // lien n'agit pas sur une autre origine que la page.
    const fichiers = locaux.map((f) => {
      const dest = path.join(tmp, nomAsset(mois, f));
      fs.copyFileSync(path.join(racine, mois + '.' + f), dest);
      return dest;
    });
    let existe = true;
    try { gh(['release', 'view', tag, '--repo', depot]); } catch (e) { existe = false; }
    if (!existe) {
      gh(['release', 'create', tag, '--repo', depot, '--latest=false',
        '--title', 'Présentation 1 — ' + mois,
        '--notes', 'Rapport mensuel de sûreté du mois en cours, remplacé chaque jour par la collecte planifiée. '
          + 'La version finale du mois est ensuite commitée dans web/rapports/mensuel/.']);
    }
    gh(['release', 'upload', tag, '--repo', depot, '--clobber'].concat(fichiers));
    const base = baseRelease(depot, mois);
    marquerRelease(racine, mois, base, locaux);
    for (const f of locaux) fs.unlinkSync(path.join(racine, mois + '.' + f));
    journal('Rapport ' + mois + ' déposé dans la release ' + tag + ' (' + locaux.join(', ') + ').');
    return { publie: true, base, fichiers: locaux };
  } catch (e) {
    const msg = String((e && (e.stderr || e.message)) || e).split('\n')[0];
    journal('::warning::Release du rapport ' + mois + ' en échec (' + msg + ') : les fichiers restent commités.');
    return { publie: false, raison: msg };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

module.exports = { publier, FORMATS };

if (require.main === module) {
  const racine = process.env.RACINE_RAPPORTS_GRSCI || path.join(__dirname, '..', 'web', 'rapports', 'mensuel');
  const mois = process.env.MOIS_RAPPORT || new Date().toISOString().slice(0, 7);
  if (fs.existsSync(path.join(racine, 'index.json'))) publier({ racine, depot: process.env.GITHUB_REPOSITORY, mois });
}
