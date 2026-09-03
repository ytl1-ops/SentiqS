// Teste decouvrirFlux() / extraireHead() (scripts/lib/decouverte-flux.js) :
// l'autodiscovery RSS/Atom standard (<link rel="alternate" type="...">
// dans le <head>) utilisée par scripts/verifier-decouverte-flux.js pour
// détecter quand le flux configuré dans SRCS a dérivé de ce que le site
// annonce lui-même aujourd'hui.
const test = require('node:test');
const assert = require('node:assert');
const { decouvrirFlux, extraireHead } = require('../lib/decouverte-flux');

test('trouve un flux RSS standard dans le head', () => {
  const html = '<html><head><link rel="alternate" type="application/rss+xml" href="/feed/" title="Mon flux"></head><body></body></html>';
  assert.deepStrictEqual(decouvrirFlux(html, 'https://exemple.dj/'), [
    { href: 'https://exemple.dj/feed/', type: 'application/rss+xml', titre: 'Mon flux' },
  ]);
});

test('resout un href relatif ET conserve un href deja absolu', () => {
  const html = `<head>
    <link rel="alternate" type="application/rss+xml" href="/rss">
    <link rel="alternate" type="application/atom+xml" href="https://ailleurs.example/atom.xml">
  </head>`;
  const r = decouvrirFlux(html, 'https://exemple.dj/actus/');
  assert.strictEqual(r[0].href, 'https://exemple.dj/rss');
  assert.strictEqual(r[1].href, 'https://ailleurs.example/atom.xml');
});

test('ignore les <link> alternate qui ne sont pas un type de flux (favicon, canonical, css)', () => {
  const html = `<head>
    <link rel="canonical" href="/page">
    <link rel="alternate" hreflang="en" href="/en/page">
    <link rel="stylesheet" type="text/css" href="/style.css">
    <link rel="alternate" type="application/rss+xml" href="/feed">
  </head>`;
  const r = decouvrirFlux(html, 'https://exemple.dj/');
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].href, 'https://exemple.dj/feed');
});

test('ignore les <link> de type flux qui ne sont pas rel=alternate', () => {
  const html = '<head><link rel="self" type="application/rss+xml" href="/feed"></head>';
  assert.deepStrictEqual(decouvrirFlux(html, 'https://exemple.dj/'), []);
});

test('reconnait les trois types de flux (rss, atom, rdf) et conserve l ordre de declaration', () => {
  const html = `<head>
    <link rel="alternate" type="application/rdf+xml" href="/rdf">
    <link rel="alternate" type="application/rss+xml" href="/rss">
    <link rel="alternate" type="application/atom+xml" href="/atom">
  </head>`;
  const r = decouvrirFlux(html, 'https://exemple.dj/');
  assert.deepStrictEqual(r.map((f) => f.type), ['application/rdf+xml', 'application/rss+xml', 'application/atom+xml']);
});

test('un <link> sans href est ignore plutot que de jeter', () => {
  const html = '<head><link rel="alternate" type="application/rss+xml"></head>';
  assert.deepStrictEqual(decouvrirFlux(html, 'https://exemple.dj/'), []);
});

test('un href illisible (URL invalide meme resolu) est ignore plutot que de jeter', () => {
  // "http://[invalide" : crochet IPv6 mal forme, fait bien jeter new URL()
  // (contrairement a une simple chaine relative bizarre, qui se resout
  // sans erreur contre l'URL de base).
  const html = '<head><link rel="alternate" type="application/rss+xml" href="http://[invalide"></head>';
  assert.deepStrictEqual(decouvrirFlux(html, 'https://exemple.dj/'), []);
});

test('ne jette jamais sur du HTML absent, vide, ou sans head', () => {
  assert.deepStrictEqual(decouvrirFlux('', 'https://exemple.dj/'), []);
  assert.deepStrictEqual(decouvrirFlux(undefined, 'https://exemple.dj/'), []);
  assert.deepStrictEqual(decouvrirFlux('<html><body>pas de head ici</body></html>', 'https://exemple.dj/'), []);
});

test('extraireHead retombe sur le debut du document si <head> est absent', () => {
  assert.strictEqual(extraireHead('<html><body>x</body></html>'), '<html><body>x</body></html>');
  assert.strictEqual(extraireHead(''), '');
});

test('extraireHead isole bien le contenu du head, sans deborder sur le body', () => {
  const html = '<head><link rel="alternate" type="application/rss+xml" href="/head-feed"></head><body><link rel="alternate" type="application/rss+xml" href="/body-feed"></body>';
  const r = decouvrirFlux(html, 'https://exemple.dj/');
  assert.strictEqual(r.length, 1);
  assert.strictEqual(r[0].href, 'https://exemple.dj/head-feed');
});
