// Louis, l'agent de veille (22/11/2026) — demande de YORO : « Insère une bulle
// chat pour l'IA, le nom de l'agent IA est Louis ». La bulle ouvre l'assistant
// existant : réponses sourcées ou « introuvable », rien n'est généré.
const test = require('node:test');
const assert = require('node:assert');
const vm = require('node:vm');
const { HTML, tranche } = require('./_bac.js');
const A = require('../../web/js/assistant.js');

test('une bulle flottante ouvre l\'assistant, nommée Louis, traduisible et masquée hors session', () => {
  const b = HTML.match(/<button[^>]*id="louisBulle"[\s\S]*?<\/button>/);
  assert.ok(b, 'bulle absente du HTML');
  assert.match(b[0], /onclick="ouvrirAssistant\(\)"/);
  assert.match(b[0], /aria-haspopup="dialog"/);
  assert.match(b[0], /aria-label="Discuter avec Louis/);
  assert.match(b[0], /data-i18n="louis_bulle"/);
  assert.match(HTML, /louis_bulle:'Louis'[\s\S]*louis_bulle:'Louis'/, 'clé louis_bulle en FR et en EN');
  // Jamais sur l'écran de connexion, ni par-dessus une fenêtre, ni imprimée.
  assert.match(HTML, /body:has\(#authOverlay:not\(\.hidden\)\) \.louis-bulle,html\.as-ouvert \.louis-bulle,html\.fenetre-ouverte \.louis-bulle\{display:none\}/);
  assert.match(HTML, /@media print\{\.louis-bulle\{display:none !important\}\}/);
});

test('la bulle n\'emprunte aucune couleur de gravité : Louis n\'alerte jamais', () => {
  const css = tranche('/* ═══ LOUIS, L\'AGENT DE VEILLE', '/* ═══ FENÊTRES ET NOTIFICATIONS');
  assert.ok(css.includes('.louis-bulle{'), 'tranche vide');
  assert.doesNotMatch(css, /var\(--(r|a|m|j|g)\)|#DC2626|#B91C1C|#CA8A04|#EA580C/i);
});

test('la règle mobile de la bulle est écrite pour l\'écran étroit ET le mode mobile forcé', () => {
  const css = tranche('/* ═══ LOUIS, L\'AGENT DE VEILLE', '/* ═══ FENÊTRES ET NOTIFICATIONS');
  assert.match(css, /html:not\(\.force-web\):not\(\.force-tablette\) \.louis-bulle-txt\{display:none\}/);
  assert.match(css, /html\.force-mobile \.louis-bulle-txt\{display:none\}/);
});

test('la fenêtre s\'appelle Louis et dit « Louis cherche… » pendant une recherche', () => {
  assert.match(HTML, /#asTitre'\)\.textContent = 'Louis';/);
  assert.match(HTML, /Louis cherche dans la base…/);
  assert.match(HTML, /attente: en \? 'Louis is searching…[^']*' : 'Louis cherche…/);
  assert.doesNotMatch(HTML, /'Assistant de veille'|'Monitoring assistant'/);
  // Version hors ligne : pas de recherche web proposée.
  const f = tranche('function _agentRendreWeb(e, i) {', 'function _agentRendreResultat(r) {');
  assert.match(f, /estHorsLigne\(\)\) return '';/);
});

// Fausse page minimale pour exercer la vraie majBulleLouis.
function montage(attente) {
  const el = (id) => ({ id, hidden: true, textContent: '', title: '', attrs: {}, cls: new Set(),
    setAttribute(k, v) { this.attrs[k] = v; }, classList: null });
  const els = { louisBulle: el('louisBulle'), louisEtat: el('louisEtat'), louisPastille: el('louisPastille') };
  els.louisBulle.classList = { toggle: (c, v) => (v ? els.louisBulle.cls.add(c) : els.louisBulle.cls.delete(c)) };
  const racine = new Set();
  const ctx = {
    LANG: 'fr',
    document: { getElementById: (id) => els[id] || null, documentElement: { classList: { contains: (c) => racine.has(c) } } },
    _agentAttente: () => attente.liste,
  };
  vm.createContext(ctx);
  vm.runInContext(tranche('let _louisAttentePrec = null;', 'function rafraichirAssistant() {'), ctx);
  return { ctx, els, racine };
}

test('la bulle compte les recherches en attente, puis annonce la réponse arrivée fenêtre fermée', () => {
  const attente = { liste: [] };
  const { ctx, els, racine } = montage(attente);
  ctx.majBulleLouis();
  assert.strictEqual(els.louisPastille.hidden, true);
  assert.strictEqual(els.louisEtat.textContent, '');
  attente.liste = [{ id: 'a' }, { id: 'b' }];
  ctx.majBulleLouis();
  assert.strictEqual(els.louisEtat.textContent, 'Louis cherche…');
  assert.strictEqual(els.louisPastille.textContent, '2');
  assert.ok(els.louisBulle.cls.has('cherche'));
  attente.liste = [{ id: 'b' }];
  ctx.majBulleLouis();
  assert.strictEqual(els.louisEtat.textContent, 'Louis a répondu');
  assert.strictEqual(els.louisPastille.textContent, '1');
  assert.match(els.louisBulle.attrs['aria-label'], /Louis a répondu/);
  // À l'ouverture, l'annonce est lue : elle s'efface.
  racine.add('as-ouvert');
  ctx.majBulleLouis();
  assert.strictEqual(els.louisEtat.textContent, 'Louis cherche…');
  ctx.LANG = 'en';
  attente.liste = [];
  ctx.majBulleLouis();
  assert.strictEqual(els.louisEtat.textContent, '');
  assert.match(els.louisBulle.attrs['aria-label'], /^Chat with Louis/);
});

test('« Qui est Louis ? » reçoit la présentation de l\'agent, dans les deux langues', () => {
  const ctx = { maintenant: Date.parse('2026-11-22T12:00:00Z'), pays: [], fenetreMs: 36 * 3600000 };
  for (const [question, lg, attendu] of [['Qui est Louis ?', 'fr', /Je suis Louis/], ['Who is Louis?', 'en', /I am Louis/]]) {
    const i = A.interpreterQuestion(question, ctx);
    assert.strictEqual(i.faq, 'assistant', question);
    const r = A.composerReponse(i, {}, lg);
    assert.match(JSON.stringify(r.blocs), attendu);
    assert.match(JSON.stringify(r.blocs), lg === 'fr' ? /introuvable/ : /not found/);
  }
});
