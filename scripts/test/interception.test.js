// Teste l'interception des proxys par le job planifie : c'est elle qui porte
// la conformite robots.txt, le throttle et l'User-Agent identifiable. Une
// requete qui lui echappe part vers un proxy public, sans aucun de ces
// garde-fous — c'etait le cas de rss2json.
const test = require('node:test');
const assert = require('node:assert');
const { creerIntercepteur, PROXY_PREFIXES, PREFIXES_NEUTRALISES } =
  require('../lib/interception-proxy-directe');

// Fausse route Playwright : enregistre ce que l'intercepteur a decide.
function fausseRoute(url) {
  const journal = { action: null, options: null };
  return {
    journal,
    request: () => ({ url: () => url }),
    continue: () => { journal.action = 'continue'; },
    fulfill: (o) => { journal.action = 'fulfill'; journal.options = o; },
  };
}

const fetchOk = async (cible) => ({ ok: true, texte: `<rss><item>${cible}</item></rss>` });

test('un flux passant par un proxy CORS est servi par fetch direct', async () => {
  const { interceptionProxyDirecte, stats } = creerIntercepteur({ fetchFn: fetchOk });
  const r = fausseRoute('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://exemple.org/rss'));
  await interceptionProxyDirecte(r);
  assert.strictEqual(r.journal.action, 'fulfill');
  assert.strictEqual(stats.direct_ok, 1);
  assert.match(r.journal.options.body, /exemple\.org\/rss/);
});

test('rss2json est refusé et non imité', async () => {
  const { interceptionProxyDirecte, stats } = creerIntercepteur({ fetchFn: fetchOk });
  const r = fausseRoute('https://api.rss2json.com/v1/api.json?rss_url=https%3A%2F%2Fexemple.org%2Frss');
  await interceptionProxyDirecte(r);
  assert.strictEqual(r.journal.action, 'fulfill');
  assert.strictEqual(r.journal.options.status, 503,
    'un refus explicite fait basculer l\'application sur un proxy intercepté');
  assert.strictEqual(stats.neutralise, 1);
  assert.strictEqual(stats.direct_ok, 0);
});

test('un échec de fetch direct laisse passer vers le vrai proxy', async () => {
  const fetchKo = async () => ({ ok: false });
  const { interceptionProxyDirecte, stats } = creerIntercepteur({ fetchFn: fetchKo });
  const r = fausseRoute('https://api.allorigins.win/raw?url=' + encodeURIComponent('https://exemple.org/rss'));
  await interceptionProxyDirecte(r);
  assert.strictEqual(r.journal.action, 'continue', 'jamais de dégradation : on retombe sur le proxy réel');
  assert.strictEqual(stats.repli_proxy, 1);
});

test("une URL étrangère aux proxys n'est pas touchée", async () => {
  const { interceptionProxyDirecte } = creerIntercepteur({ fetchFn: fetchOk });
  const r = fausseRoute('https://fonts.googleapis.com/css2?family=Inter');
  await interceptionProxyDirecte(r);
  assert.strictEqual(r.journal.action, 'continue');
});

test('la forme allorigins_get est restituée en JSON enveloppé', async () => {
  const { interceptionProxyDirecte } = creerIntercepteur({ fetchFn: fetchOk });
  const r = fausseRoute('https://api.allorigins.win/get?url=' + encodeURIComponent('https://exemple.org/rss'));
  await interceptionProxyDirecte(r);
  const corps = JSON.parse(r.journal.options.body);
  assert.ok(typeof corps.contents === 'string', 'ce proxy renvoie {contents: …}');
});

test('toute réponse fabriquée porte l\'en-tête CORS', async () => {
  const { interceptionProxyDirecte } = creerIntercepteur({ fetchFn: fetchOk });
  for (const p of PROXY_PREFIXES) {
    const r = fausseRoute(p.prefix + encodeURIComponent('https://exemple.org/rss'));
    await interceptionProxyDirecte(r);
    if (r.journal.action !== 'fulfill') continue;
    const entetes = Object.fromEntries(
      Object.entries(r.journal.options.headers).map(([k, v]) => [k.toLowerCase(), v])
    );
    assert.strictEqual(entetes['access-control-allow-origin'], '*',
      `sans cet en-tête, le fetch de la page échouerait malgré l'interception (${p.prefix})`);
  }
});

test('aucun préfixe ne figure à la fois dans les deux listes', () => {
  const collision = PROXY_PREFIXES.filter((p) =>
    PREFIXES_NEUTRALISES.some((n) => p.prefix.startsWith(n)));
  assert.deepStrictEqual(collision, [], 'un proxy ne peut pas être à la fois intercepté et refusé');
});
