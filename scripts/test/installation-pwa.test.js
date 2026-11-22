// Installation sans Play Store (22/11/2026) : le bouton n'existe qu'une fois
// que le navigateur propose l'installation.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { HTML } = require('./_bac.js');

test('le bouton est masqué par défaut, montré par beforeinstallprompt, masqué après installation', () => {
  assert.match(HTML, /id="installerAppBtn" hidden/);
  const debut = HTML.indexOf("// Installation de l'application sans le Play Store");
  assert.ok(debut > 0);
  const code = HTML.slice(debut, HTML.indexOf('</script>', debut));
  const ecoute = {};
  const bouton = { hidden: true };
  let invite = 0;
  const window = { addEventListener: (n, f) => { ecoute[n] = f; } };
  vm.runInNewContext(code, { window, document: { getElementById: () => bouton } });
  window.installerApplication(); // sans invitation : rien
  assert.strictEqual(invite, 0);
  ecoute.beforeinstallprompt({ preventDefault() {}, prompt() { invite++; } });
  assert.strictEqual(bouton.hidden, false);
  window.installerApplication();
  assert.strictEqual(invite, 1);
  assert.strictEqual(bouton.hidden, true);
});
