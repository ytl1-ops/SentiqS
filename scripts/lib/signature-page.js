'use strict';
// Signature du code de la page (27/11/2026), calculée hors navigateur.
//
// YORO : « Pas à jour ». Le déploiement était bon ; c'est l'onglet ouvert
// (ou l'application installée) qui ne recharge jamais la page : il garde le
// code de la veille aussi longtemps qu'on ne le ferme pas. Le déploiement
// publie donc web/version.json avec cette signature, et la page la compare à
// la sienne (signatureCode(), même calcul : FNV-1a de tous les scripts en
// ligne, ceux qui portent data-src exceptés). Si elles diffèrent, un bandeau
// propose de recharger.
//
// Le calcul doit rester identique à signatureCode() : un écart afficherait le
// bandeau en permanence. test-fumee.js compare les deux sur la vraie page.
function scriptsEnLigne(html) {
  const sans = String(html).replace(/\r\n?/g, '\n').replace(/<!--[\s\S]*?-->/g, (c) => (/<script/i.test(c) ? '' : c));
  const out = [];
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  let m;
  while ((m = re.exec(sans))) {
    const attrs = m[1];
    if (/\bsrc\s*=/i.test(attrs.replace(/\bdata-src\s*=\s*("[^"]*"|'[^']*'|\S+)/gi, ''))) continue;
    if (/\bdata-src\b/i.test(attrs)) continue;
    out.push(m[2]);
  }
  return out;
}
function signaturePage(html) {
  let h = 2166136261;
  for (const t of scriptsEnLigne(html)) {
    for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); }
  }
  return (h >>> 0).toString(36);
}
module.exports = { signaturePage, scriptsEnLigne };
