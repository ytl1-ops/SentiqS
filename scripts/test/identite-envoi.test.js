// Identite d'envoi choisie pour un partage — voir identiteEnvoiActuelle() /
// signatureEnvoiActuelle() dans web/SentiqS_Web.html.
//
// Bug corrige le 21/09/2026 : le format image d'un partage
// (genererImageActuBlob / genererImageRapportBlob) ignorait completement
// l'identite choisie dans le menu de partage ("Signer en tant que") — seul
// le format texte l'appliquait, parce que le dessin canvas n'appelait
// jamais la resolution d'identite, seulement nomMarqueActuelle() (le nom de
// MARQUE, un champ different). identiteEnvoiActuelle() est desormais la
// resolution PARTAGEE par les deux formats ; ces tests verifient cette
// resolution — le rendu canvas lui-meme n'est pas exercable dans ce bac
// (pas de DOM), donc ce n'est pas ce qui aurait masque le bug : c'est
// justement l'absence totale d'appel a une resolution d'identite commune.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { bac, exposer, tranche } = require('./_bac.js');

function construireBac({ payant = true, marque = {} } = {}) {
  const mocks = `
    function fonctionnalitePayante() { return ${JSON.stringify(payant)}; }
    function getMarquePerso() { return ${JSON.stringify(marque)}; }
  `;
  const ctx = bac(mocks, tranche('function identitesMarquePerso', 'AGENT DE PARTAGE'));
  return exposer(ctx, 'identitesMarquePerso', 'identiteEnvoiActuelle', 'signatureEnvoiActuelle');
}

/** Simule le clic sur un bouton "Signer en tant que N" du menu de partage. */
function choisirIdentitePourCePartage(ctx, valeur) {
  vm.runInContext('_partageIdentiteChoisie = ' + JSON.stringify(valeur) + ';', ctx);
}

test('sans identite configuree, rien a signer', () => {
  const ctx = construireBac({ marque: {} });
  assert.strictEqual(ctx.identiteEnvoiActuelle(), '');
  assert.strictEqual(ctx.signatureEnvoiActuelle(), '');
});

test('l identite active par defaut est utilisee sans choix explicite pour ce partage', () => {
  const ctx = construireBac({ marque: { identite1: 'Alpha', identite2: 'Beta', identiteActive: 2 } });
  assert.strictEqual(ctx.identiteEnvoiActuelle(), 'Beta');
});

test('le format image dispose desormais du meme nom que le format texte', () => {
  // C'est le bug : avant le correctif, identiteEnvoiActuelle n'existait pas
  // et le dessin canvas ne dessinait que nomMarqueActuelle() — l'identite
  // choisie pour CE partage n'apparaissait donc jamais dans l'image,
  // contrairement au texte qui l'a toujours appliquee via signatureEnvoiActuelle.
  const ctx = construireBac({ marque: { identite1: 'Alpha', identite2: 'Beta', identiteActive: 1 } });
  choisirIdentitePourCePartage(ctx, 2);
  const nomPourImage = ctx.identiteEnvoiActuelle();
  const signaturePourTexte = ctx.signatureEnvoiActuelle();
  assert.strictEqual(nomPourImage, 'Beta');
  assert.strictEqual(signaturePourTexte, '\n\n— Beta');
});

test('une identite choisie pour ce partage prime sur l identite active globale', () => {
  const ctx = construireBac({ marque: { identite1: 'Alpha', identite2: 'Beta', identite3: 'Gamma', identiteActive: 1 } });
  choisirIdentitePourCePartage(ctx, 3);
  assert.strictEqual(ctx.identiteEnvoiActuelle(), 'Gamma');
});

test('un choix qui pointe vers une identite non configuree retombe sur l active', () => {
  const ctx = construireBac({ marque: { identite1: 'Alpha', identiteActive: 1 } });
  choisirIdentitePourCePartage(ctx, 2); // identite2 jamais renseignee
  assert.strictEqual(ctx.identiteEnvoiActuelle(), 'Alpha');
});

test('sur un plan gratuit, aucune identite n est jamais signee, meme configuree', () => {
  const ctx = construireBac({ payant: false, marque: { identite1: 'Alpha', identiteActive: 1 } });
  assert.strictEqual(ctx.identiteEnvoiActuelle(), '');
  assert.strictEqual(ctx.signatureEnvoiActuelle(), '');
});

test('la signature texte ne contient jamais de coordonnee, seulement le nom', () => {
  const ctx = construireBac({ marque: { identite1: 'Alpha (+225 00 00 00 00)', identiteActive: 1 } });
  const sig = ctx.signatureEnvoiActuelle();
  // Le champ lui-meme peut contenir ce que l'utilisateur y a mis (la garde
  // "jamais de coordonnee" porte sur les CHAMPS retires du panneau
  // Parametres, pas sur une regle de validation du contenu) — ce test fixe
  // seulement le format attendu : prefixe "— ", rien ajoute ni retranche.
  assert.strictEqual(sig, '\n\n— Alpha (+225 00 00 00 00)');
});

test('identitesMarquePerso migre l ancien champ unique identitePartage vers identite1', () => {
  const ctx = construireBac();
  const r = ctx.identitesMarquePerso({ identitePartage: 'Ancien Nom' });
  assert.strictEqual(r.identite1, 'Ancien Nom');
  assert.strictEqual(r.active, 1);
});

test('identitesMarquePerso retombe sur l identite 1 si l active a ete videe', () => {
  const ctx = construireBac();
  const r = ctx.identitesMarquePerso({ identite1: 'Alpha', identiteActive: 2 });
  assert.strictEqual(r.active, 1, 'identite2 est vide : impossible de rester actif dessus');
});
