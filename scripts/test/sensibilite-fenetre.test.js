// Garde-fous sur scripts/sensibilite-fenetre.js.
//
// Ce script existe parce qu'un arbitrage sur la fenetre d'actualite a ete
// pris de memoire le 06/09/2026 : sept pays absents avaient leur article le
// plus frais « a 58 h, juste hors fenetre », d'ou la conclusion qu'un passage
// a 48 h les rattraperait. Or 58 h depasse aussi 48 h. La recommandation
// annoncait trois pays gagnes ; la mesure en a donne ZERO, et le vrai seuil
// pour gagner le Botswana et la Gambie est 60 h.
//
// Les deux choses que ces tests refusent sont exactement celles qui rendraient
// le script inutile : recopier la fenetre au lieu de la lire, et laisser le
// script trancher a la place de l'editeur.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const CHEMIN = path.join(__dirname, '..', 'sensibilite-fenetre.js');
const SOURCE = fs.readFileSync(CHEMIN, 'utf8');
const HTML = fs.readFileSync(path.join(__dirname, '../../web/SentiqS_Web.html'), 'utf8');

test('la fenetre courante est LUE dans la page, jamais recopiee', () => {
  // Un seuil recopie se perime au premier arbitrage editorial — la fenetre a
  // deja bouge trois fois en une soiree — et le script mesurerait alors un
  // reglage qui n'existe plus.
  assert.match(SOURCE, /FENETRE_ACTUALITE_MS = \(\\d\+\)|const FENETRE_ACTUALITE_MS = \(\\d\+\)/,
    'le script doit extraire FENETRE_ACTUALITE_MS du fichier de production');
  const m = /const FENETRE_ACTUALITE_MS = (\d+) \* 60 \* 60 \* 1000;/.exec(HTML);
  assert.ok(m, 'la page doit declarer FENETRE_ACTUALITE_MS en heures');
  // Le motif du script doit reellement retrouver la declaration de la page :
  // une expression qui ne correspond plus ferait echouer le script au lieu de
  // mesurer, et c'est ici qu'on veut l'apprendre.
  const motif = /const FENETRE_ACTUALITE_MS = \(\\d\+\) \\\* 60 \\\* 60 \\\* 1000;/;
  assert.match(SOURCE, motif, 'le motif de lecture doit suivre la declaration reelle de la page');
});

test('le script ne recommande aucune largeur et le dit', () => {
  // Meme regle que sensibilite-seuil.js : il produit le tableau, l'editeur
  // tranche. Un script de mesure qui conclut devient un script de decision.
  assert.match(SOURCE, /NE TRANCHE RIEN/, 'l\'intention doit rester ecrite dans le fichier');
  assert.match(SOURCE, /ne recommande rien/, 'la sortie doit le rappeler a qui lit le tableau');
  for (const verbe of ['recommandation :', 'il faut passer a', 'conseille de']) {
    assert.ok(!SOURCE.includes(verbe), 'le script ne doit pas conclure : « ' + verbe + ' »');
  }
});

test('le script ne touche pas au fichier de production', () => {
  // Il mesure une page ; il n'en ecrit jamais aucune.
  assert.ok(!/writeFileSync|createWriteStream|appendFileSync/.test(SOURCE),
    'aucune ecriture de fichier dans un script de mesure');
});

test('la mesure ne va pas sur le reseau', () => {
  // Deux passes doivent pouvoir rejouer LE MEME jeu de donnees : une mesure
  // qui remoissonne a chaque fois ne compare plus rien.
  assert.match(SOURCE, /r\.request\(\)\.url\(\)\.startsWith\('file:\/\/'\) \? r\.continue\(\) : r\.abort\(\)/,
    'toute requete hors file:// doit etre coupee');
  assert.ok(!/fetch\(|https?\.get|axios/.test(SOURCE), 'aucun appel reseau direct');
});
