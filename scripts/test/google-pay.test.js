// Google Pay dans « Déclarer un paiement » (demande de YORO, 15/11/2026).
// Le bouton est branché en environnement TEST de Google : aucun prestataire
// ni identifiant marchand n'existe encore. Ces tests gardent les trois règles
// de web/js/google-pay.js : pas de bouton sans isReadyToPay, pas de
// production sans configuration complète, jamais d'activation de forfait ni
// d'envoi du jeton depuis le navigateur en test.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const RACINE = path.join(__dirname, '..', '..');
const PAGE = fs.readFileSync(path.join(RACINE, 'web', 'SentiqS_Web.html'), 'utf8');
const MODULE = path.join(RACINE, 'web', 'js', 'google-pay.js');

function charger(pret) {
  delete require.cache[require.resolve(MODULE)];
  const appels = { fetch: 0, requetes: [] };
  globalThis.fetch = async () => { appels.fetch++; return { ok: true }; };
  globalThis.google = { payments: { api: { PaymentsClient: function (o) {
    appels.env = o.environment;
    this.isReadyToPay = async () => ({ result: pret });
    this.createButton = (b) => { appels.bouton = b; return { bouton: true }; };
    this.loadPaymentData = async (r) => { appels.requetes.push(r); return { paymentMethodData: {} }; };
  } } } };
  return { gp: require(MODULE), appels };
}
const conteneur = () => ({ innerHTML: 'x', enfants: [], appendChild(e) { this.enfants.push(e); } });

test('la configuration livrée est en TEST, sans identifiant marchand', () => {
  const { gp } = charger(true);
  assert.strictEqual(gp.CONFIG.environnement, 'TEST');
  assert.strictEqual(gp.CONFIG.identifiantMarchand, '');
  assert.strictEqual(gp.configValide(gp.CONFIG), true);
});

test('la production est refusée tant que la configuration est incomplète', () => {
  const { gp } = charger(true);
  const prod = Object.assign({}, gp.CONFIG, { environnement: 'PRODUCTION' });
  assert.strictEqual(gp.configValide(prod), false, 'passerelle d\'exemple, pas de marchand');
  assert.strictEqual(gp.configValide(Object.assign({}, prod, { identifiantMarchand: 'BCR2', passerelle: 'paystack',
    identifiantPasserelle: 'x', pointEncaissement: 'http://pas-https' })), false);
  assert.strictEqual(gp.configValide(Object.assign({}, prod, { identifiantMarchand: 'BCR2', passerelle: 'paystack',
    identifiantPasserelle: 'x', pointEncaissement: 'https://exemple.test/encaisser' })), true);
  assert.strictEqual(gp.configValide(Object.assign({}, gp.CONFIG, { actif: false })), false);
});

test('la requête de paiement : franc CFA entier, Côte d\'Ivoire, montant du forfait', () => {
  const { gp } = charger(true);
  const r = gp.requetePaiement(gp.CONFIG, { key: 'standard', nom: 'Particulier', prix: 9000 });
  assert.strictEqual(r.transactionInfo.totalPrice, '9000');
  assert.strictEqual(r.transactionInfo.currencyCode, 'XOF');
  assert.strictEqual(r.transactionInfo.countryCode, 'CI');
  assert.strictEqual(r.allowedPaymentMethods[0].tokenizationSpecification.type, 'PAYMENT_GATEWAY');
  assert.strictEqual(gp.requetePaiement(gp.CONFIG, { prix: 0 }), null, 'pas de paiement à zéro');
});

test('pas de bouton si l\'appareil ne sait pas payer', async () => {
  const { gp, appels } = charger(false);
  const c = conteneur();
  assert.strictEqual(await gp.monter(c, { doc: {}, plan: () => ({ prix: 9000 }) }), false);
  assert.strictEqual(appels.bouton, undefined);
  assert.strictEqual(c.enfants.length, 0);
});

test('en TEST, un clic ne débite rien, n\'envoie rien et n\'active rien', async () => {
  const { gp, appels } = charger(true);
  const c = conteneur();
  const etats = [];
  const vu = await gp.monter(c, { doc: {}, langue: 'en', sombre: true, plan: () => ({ key: 'pro', nom: 'Pro', prix: 39000 }),
    surResultat: (e) => etats.push(e), jetonSession: async () => 'jeton' });
  assert.strictEqual(vu, true);
  assert.strictEqual(appels.env, 'TEST');
  assert.strictEqual(appels.bouton.buttonColor, 'white', 'bouton blanc sur fond sombre');
  assert.strictEqual(appels.bouton.buttonLocale, 'en');
  await appels.bouton.onClick();
  await new Promise((r) => setImmediate(r));
  assert.strictEqual(appels.requetes[0].transactionInfo.totalPrice, '39000');
  assert.deepStrictEqual(etats, ['test']);
  assert.strictEqual(appels.fetch, 0, 'le jeton de test ne part nulle part');
});

test('la page charge le module, autorise pay.google.com et n\'écrit aucun forfait', () => {
  assert.ok(PAGE.includes('<script src="js/google-pay.js"></script>'));
  const csp = PAGE.match(/Content-Security-Policy" content="([^"]+)"/)[1];
  for (const d of ['script-src', 'frame-src', 'connect-src']) {
    assert.ok(new RegExp(d + ' [^;]*https://pay\\.google\\.com').test(csp), d);
  }
  const i = PAGE.indexOf('async function majGooglePay()');
  assert.ok(i > 0);
  const corps = PAGE.slice(i, PAGE.indexOf('\nfunction closePaiementDeclare', i));
  assert.ok(!/profiles|paiements_declares|setPlan|\.plan\s*=/.test(corps), 'aucune écriture de forfait côté client');
  assert.ok(/box\.hidden = !affiche/.test(corps), 'bloc masqué si le bouton n\'est pas affiché');
  assert.ok(PAGE.includes('majGooglePay();'), 'appelé à l\'ouverture du panneau');
});

test('les textes Google Pay ont leur traduction anglaise', () => {
  const dico = fs.readFileSync(path.join(RACINE, 'web', 'js', 'dico-en.js'), 'utf8');
  for (const t of ['Payer par carte avec Google Pay', 'ou par Mobile Money', "Mode test : aucun montant n'est débité."]) {
    assert.ok(dico.includes(JSON.stringify(t).slice(0, -1)), t);
  }
});
