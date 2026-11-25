'use strict';
// Pont Node → traducteur hors ligne (scripts/traducteur-local.py, Argos
// Translate, puis CTranslate2 en direct le 25/11/2026), 22/11/2026. Voir l'en-tête du script Python pour le pourquoi.
//
// demarrerTraducteurLocal() lance le processus et attend qu'il annonce ses
// modèles ; il rend une fonction (lignes, source, cible) → Promise<tableau
// de même longueur | null>, ou null si Python ou les modèles manquent. Le
// job ne s'arrête jamais pour autant : sans traducteur local, il garde les
// services en ligne seuls, comme avant.

const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');

const SCRIPT = path.join(__dirname, '..', 'traducteur-local.py');

function demarrerTraducteurLocal(opts) {
  const o = opts || {};
  const python = o.python || process.env.TRADUCTEUR_LOCAL_PYTHON || 'python3';
  const delaiDemarrageMs = o.delaiDemarrageMs || 10 * 60 * 1000;
  // Délai proportionnel au paquet (25/11/2026) : un délai fixe de 60 s
  // faisait compter en échec un paquet de 25 chapôs encore en cours, et le
  // processus, toujours occupé, faisait échouer les suivants en cascade.
  const delaiBaseMs = o.delaiRequeteMs || 60 * 1000;
  const delaiParLigneMs = o.delaiParLigneMs || 3 * 1000;
  const lancer = o.spawn || spawn;
  return new Promise((resolve) => {
    let enfant;
    try {
      enfant = lancer(python, [SCRIPT], { stdio: ['pipe', 'pipe', 'inherit'] });
    } catch (e) {
      resolve(null);
      return;
    }
    let pret = false;
    let mort = false;
    let suivant = 1;
    const attente = new Map();
    const fin = (val) => { if (!pret) { pret = true; resolve(val); } };
    const minuteur = setTimeout(() => { try { enfant.kill(); } catch (_) {} fin(null); }, delaiDemarrageMs);
    enfant.on('error', () => { mort = true; clearTimeout(minuteur); fin(null); });
    enfant.on('exit', () => {
      mort = true; clearTimeout(minuteur); fin(null);
      attente.forEach((r) => r(null)); attente.clear();
    });
    readline.createInterface({ input: enfant.stdout }).on('line', (ligne) => {
      let msg;
      try { msg = JSON.parse(ligne); } catch (_) { return; }
      if (msg && msg.pret) {
        clearTimeout(minuteur);
        const paires = Array.isArray(msg.paires) ? msg.paires : [];
        const traduire = (lignes, source, cible) => new Promise((ok) => {
          if (mort || !Array.isArray(lignes) || !lignes.length || !source || source === 'auto') { ok(null); return; }
          const id = suivant++;
          const t = setTimeout(() => { attente.delete(id); ok(null); }, Math.max(delaiBaseMs, lignes.length * delaiParLigneMs));
          attente.set(id, (res) => { clearTimeout(t); ok(res); });
          enfant.stdin.write(JSON.stringify({ id, source, cible, lignes }) + '\n');
        });
        traduire.paires = paires;
        traduire.arreter = () => { try { enfant.stdin.end(); } catch (_) {} };
        fin(traduire);
        return;
      }
      if (msg && attente.has(msg.id)) {
        const r = attente.get(msg.id);
        attente.delete(msg.id);
        const l = msg.lignes;
        r(Array.isArray(l) ? l : null);
      }
    });
  });
}

module.exports = { demarrerTraducteurLocal, SCRIPT };
