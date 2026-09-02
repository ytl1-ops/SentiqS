#!/usr/bin/env node
// Fiches pays : chacune doit s'appuyer sur des donnees verifiees.
//
// POURQUOI CE CONTROLE EXISTE
//
// scripts/generate-country-fiche.js porte une regle explicite : il ne genere
// JAMAIS de contenu securitaire a partir de rien. Il exige un fichier
// data/pays/<slug>.json dont le champ « sources » ne doit pas etre vide, et
// refuse de produire la fiche sinon.
//
// Mesure du 02/09/2026 : neuf fiches sont publiees, quatre seulement ont leur
// fichier de donnees. Cinq — Burkina Faso, Cote d'Ivoire, Guinee, Liberia,
// Mali — ont ete ecrites hors du generateur. Le garde-fou existait et il est
// bon ; il a simplement ete contourne, et rien ne le signalait.
//
// Ces cinq-la sont nommees ci-dessous comme dette assumee : les depublier ou
// les sourcer est une decision editoriale, pas un correctif automatique. Mais
// AUCUNE NOUVELLE fiche ne doit s'ajouter a cette liste.
const fs = require('node:fs');
const path = require('node:path');
const {
  jetonsOrphelins, contrastesInsuffisants, dateVisible,
} = require('./lib/fiches-pays.js');

const RACINE = path.join(__dirname, '..');
const FICHES = path.join(RACINE, 'web', 'pays');
const DONNEES = path.join(RACINE, 'data', 'pays');

// Dette au 02/09/2026. Cette liste est faite pour RETRECIR. Y ajouter un slug
// reviendrait a annuler le controle : c'est exactement le contournement qu'il
// est cense rendre visible.
const DETTE_SANS_DONNEES = [
  'burkina-faso', 'cote-divoire', 'guinee', 'liberia', 'mali',
];

const slugs = fs.readdirSync(FICHES)
  .filter((f) => f.endsWith('.html') && f !== 'index.html')
  .map((f) => f.replace(/\.html$/, ''))
  .sort();

const sansDonnees = slugs.filter((s) => !fs.existsSync(path.join(DONNEES, s + '.json')));
const nouvelles = sansDonnees.filter((s) => !DETTE_SANS_DONNEES.includes(s));
const resorbees = DETTE_SANS_DONNEES.filter((s) => !sansDonnees.includes(s));

// Une fiche dont le fichier de donnees existe doit AUSSI declarer des sources
// non vides : un fichier present mais vide contournerait le controle en le
// satisfaisant formellement.
const sansSources = [];
for (const s of slugs) {
  const f = path.join(DONNEES, s + '.json');
  if (!fs.existsSync(f)) continue;
  try {
    const d = JSON.parse(fs.readFileSync(f, 'utf8'));
    if (!Array.isArray(d.sources) || d.sources.length === 0) sansSources.push(s);
  } catch (_) { sansSources.push(s + ' (JSON illisible)'); }
}

console.log('Fiches pays publiees : ' + slugs.length + ' sur 54 pays couverts par l\'application');
console.log('  adossees a un fichier de donnees : ' + (slugs.length - sansDonnees.length));
console.log('  sans fichier de donnees          : ' + sansDonnees.length
  + (sansDonnees.length ? ' (' + sansDonnees.join(', ') + ')' : ''));

if (resorbees.length) {
  console.log('\n→ ' + resorbees.length + ' fiche(s) sortie(s) de la dette : ' + resorbees.join(', '));
  console.log('   Retirez-la(les) de DETTE_SANS_DONNEES dans ce script pour verrouiller le gain.');
}

// Trois regles qui portent sur la page servie, pas sur ses donnees : une fiche
// peut etre parfaitement sourcee et rester illisible ou non datee.
const orphelins = [];
const contrastes = [];
const sansDate = [];
for (const s of slugs) {
  const html = fs.readFileSync(path.join(FICHES, s + '.html'), 'utf8');
  const o = jetonsOrphelins(html);
  if (o.length) orphelins.push(s + ' : ' + o.join(', '));
  const c = contrastesInsuffisants(html);
  if (c.length) contrastes.push(s + ' : ' + c.join(', '));
  if (!dateVisible(html)) sansDate.push(s);
}

const echecs = [];
if (nouvelles.length) {
  echecs.push('Fiche(s) publiee(s) sans fichier de donnees verifiees : ' + nouvelles.join(', '));
}
if (sansSources.length) {
  echecs.push('Fichier(s) de donnees sans aucune source : ' + sansSources.join(', '));
}
if (orphelins.length) {
  echecs.push('Jeton(s) CSS reference(s) sans etre defini(s) — le repli du var() '
    + 'applique une couleur d\'un autre theme, en silence : ' + orphelins.join(' ; '));
}
if (contrastes.length) {
  echecs.push('Texte sous le seuil AA de 4,5:1 une fois compose sur le fond : '
    + contrastes.join(' ; '));
}
if (sansDate.length) {
  echecs.push('Fiche(s) sans date lisible par le lecteur (<p class="meta-fresh">) : '
    + sansDate.join(', ') + '. Une evaluation de risque sans date se lit comme si '
    + 'elle etait d\'aujourd\'hui.');
}

if (echecs.length) {
  console.error('\n✗ Fiches pays :');
  echecs.forEach((e) => console.error('   ' + e));
  console.error('\nUne fiche pays est une evaluation de risque publiee sous le nom de SentiqS.');
  console.error('Elle se produit avec scripts/generate-country-fiche.js, a partir d\'un fichier');
  console.error('data/pays/<slug>.json rempli depuis des sources verifiees — jamais a la main.');
  process.exit(1);
}
console.log('\n✓ Aucune fiche pays ne s\'est ajoutee hors du generateur.');
console.log('✓ ' + slugs.length + ' fiche(s) : jetons CSS tous definis, texte au seuil AA, date lisible.');
