// L'archive quotidienne doit ARRIVER a l'utilisateur, pas seulement etre
// commitee.
//
// Defaut constate le 03/09/2026 : GitHub ne declenche aucun workflow sur un
// push effectue avec le GITHUB_TOKEN d'un job (garde-fou anti-recursion). Les
// cinq commits d'archive du bot n'avaient donc jamais declenche de
// deploiement Pages. main portait les releves du 2 ET du 3 septembre ; le site
// public servait encore le seul releve du 2.
//
// Ce n'est pas un detail d'infrastructure : la fleche de tendance exige DEUX
// releves. Tant que le site n'en sert qu'un, elle ne s'affiche pour personne —
// la fonctionnalite etait livree, testee, et invisible.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const FLUX = path.join(__dirname, '..', '..', '.github', 'workflows');
const COLLECTE = fs.readFileSync(path.join(FLUX, 'collecte-planifiee.yml'), 'utf8');

// Le nom de fichier que la collecte demande a declencher. On le lit plutot
// que de le supposer : c'est le lien exact dont depend toute la chaine.
function fluxDeclenche(source) {
  const m = /gh workflow run\s+([\w.-]+\.ya?ml)/.exec(source);
  return m ? m[1] : null;
}

test('la collecte declenche un deploiement apres avoir pousse l\'archive', () => {
  const cible = fluxDeclenche(COLLECTE);
  assert.ok(cible, 'aucun « gh workflow run » : l\'archive resterait invisible');

  // L'appel doit suivre le push, pas le preceder — deployer avant de pousser
  // publierait l'etat precedent.
  const iPush = COLLECTE.indexOf('git push origin HEAD:main');
  const iDeploi = COLLECTE.indexOf('gh workflow run');
  assert.ok(iPush !== -1 && iDeploi > iPush,
    'le declenchement doit venir APRES le push de l\'archive');
});

test('le flux declenche existe et accepte d\'etre declenche', () => {
  const cible = fluxDeclenche(COLLECTE);
  const chemin = path.join(FLUX, cible);
  assert.ok(fs.existsSync(chemin), cible + ' : flux introuvable');

  // Sans workflow_dispatch, l'appel echoue et l'archive redevient invisible.
  // C'est la seule exception au garde-fou anti-recursion de GitHub : la
  // retirer casserait la chaine sans qu'aucun test d'interface ne bronche.
  assert.match(fs.readFileSync(chemin, 'utf8'), /^\s*workflow_dispatch:/m,
    cible + ' : doit accepter workflow_dispatch');
});

test('le job porte les droits necessaires au declenchement', () => {
  // Sans actions: write, l'appel echoue en 403 — et le job continue, puisque
  // l'archive est deja poussee. L'echec serait donc silencieux.
  const bloc = /permissions:([\s\S]*?)\n    steps:/.exec(COLLECTE);
  assert.ok(bloc, 'bloc permissions introuvable');
  assert.match(bloc[1], /actions:\s*write/,
    'actions: write est requis pour « gh workflow run »');
  assert.match(COLLECTE, /GH_TOKEN:\s*\$\{\{\s*secrets\.GITHUB_TOKEN\s*\}\}/,
    'le CLI gh a besoin de GH_TOKEN');
});
