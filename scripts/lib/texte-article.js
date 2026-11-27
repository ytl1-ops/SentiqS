// Le début d'un article, pour la Présentation 1 (25/11/2026).
//
// YORO : « donner plus de texte dans l'actu ». Le flux RSS ne donne qu'un chapô
// (292 caractères en médiane sur le cumul de novembre) ; la fiche citait 300
// caractères au plus. Le job lit déjà la page de chaque article illustré pour
// trouver sa photo (photos-grsci.js) : il en garde aussi le DÉBUT, pour une
// citation plus longue.
//
// CE N'EST PAS UNE COPIE DE L'ARTICLE. Au plus TEXTE_MAX_CAR caractères, pris
// dans les premiers paragraphes : une courte citation, entre guillemets,
// attribuée au média, avec le lien vers l'article — le reste se lit chez lui.
// Rien n'est réécrit ni résumé : ce sont les mots du média.
//
// Pur : reçoit du HTML, rend du texte ou null. Testé par
// scripts/test/presentation-texte.test.js.

const TEXTE_MAX_CAR = 650;
// Un paragraphe plus court n'est presque jamais du texte d'article : légende,
// signature, date, bouton, « Lire aussi ».
const PARAGRAPHE_MIN_CAR = 60;
// Ce qui entoure un article sans en être : à ne jamais citer.
const BRUIT_RE = /\b(cookies?|abonnez|abonnement|abonne-?toi|newsletter|inscrivez|inscription|connectez|se connecter|lire aussi|lire la suite|à lire aussi|a lire aussi|voir aussi|read also|read more|also read|subscribe|sign up|log in|advertis|publicit|sponsoris|partager|share this|whatsapp|facebook|twitter|telegram|tous droits|all rights reserved|copyright|javascript|votre navigateur|your browser|commentaires?|comments?|cliquez|click here|téléchargez|download the app|suivez-nous|follow us|rejoignez|join our)\b/i;

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', laquo: '«', raquo: '»', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', hellip: '…', ndash: '–', mdash: '—', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', acirc: 'â', ccedil: 'ç', ocirc: 'ô', icirc: 'î', ucirc: 'û', ugrave: 'ù', euml: 'ë', iuml: 'ï', oelig: 'œ', Eacute: 'É' };
function decoder(t) {
  return String(t)
    .replace(/&#(\d+);/g, (_, n) => { const c = Number(n); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : ' '; })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { const c = parseInt(n, 16); return c > 0 && c < 0x110000 ? String.fromCodePoint(c) : ' '; })
    .replace(/&([a-z]+);/gi, (m, n) => (n in ENTITES ? ENTITES[n] : ' '));
}
// Espaces de largeur nulle, marques de sens, BOM, caractères de contrôle :
// LibreOffice les rend comme une coupure (même nettoyage que nettoyerTitre).
function propre(t) {
  return decoder(String(t).replace(/<[^>]*>/g, ' '))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u2028-\u202E\u2060-\u2069\uFEFF]/g, '')
    .replace(/\s+/g, ' ').trim();
}

/** La description déclarée par la page (og:description, description). */
function descriptionDeclaree(html) {
  const s = String(html || '').slice(0, 400000);
  const motifs = [
    /<meta[^>]+(?:property|name)=["'](?:og:description|description|twitter:description)["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:description|description|twitter:description)["']/i,
  ];
  for (const re of motifs) {
    const m = re.exec(s);
    if (m) { const t = propre(m[1]); if (t.length >= PARAGRAPHE_MIN_CAR) return t; }
  }
  return null;
}

/** Les paragraphes de l'article : dans <article> s'il existe, sinon dans la page. */
function paragraphes(html) {
  let s = String(html || '').slice(0, 1500000)
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg|form|nav|header|footer|aside|figure|figcaption|button|select|iframe)\b[\s\S]*?<\/\1>/gi, ' ');
  const art = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(s);
  if (art && /<p\b/i.test(art[1])) s = art[1];
  const out = [];
  const re = /<p\b[^>]*>([\s\S]*?)<\/p>/gi;
  let m;
  while ((m = re.exec(s)) && out.length < 12) {
    const t = propre(m[1]);
    if (t.length < PARAGRAPHE_MIN_CAR || BRUIT_RE.test(t)) continue;
    // Une ligne de date ou de signature (« Publié le 3 novembre 2026 à 10h ») :
    // peu de mots, beaucoup de chiffres.
    if ((t.match(/\d/g) || []).length > t.length / 4) continue;
    if (out.some((x) => x === t)) continue;
    out.push(t);
  }
  return out;
}

/** Coupe à la fin d'une phrase quand c'est possible, sinon au mot, avec « … ». */
function couperPhrase(t, max) {
  if (t.length <= max) return t;
  const tete = t.slice(0, max);
  const fin = Math.max(tete.lastIndexOf('. '), tete.lastIndexOf('! '), tete.lastIndexOf('? '));
  if (fin > max * 0.55) return tete.slice(0, fin + 1);
  return tete.replace(/\s+\S*$/, '') + ' …';
}

/**
 * Le début de l'article, au plus `max` caractères, ou null. `titre` sert à
 * écarter un paragraphe qui ne fait que le redire.
 */
function extraitArticle(html, titre, max) {
  const limite = max || TEXTE_MAX_CAR;
  const redit = String(titre || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const corps = paragraphes(html).filter((p) => p.toLowerCase() !== redit);
  let t = '';
  for (const p of corps) {
    if (t.length >= limite) break;
    t = t ? t + ' ' + p : p;
  }
  if (t.length < PARAGRAPHE_MIN_CAR * 2) {
    const d = descriptionDeclaree(html);
    if (d && d.length > t.length) t = d;
  }
  return t.length >= PARAGRAPHE_MIN_CAR ? couperPhrase(t, limite) : null;
}

module.exports = { extraitArticle, paragraphes, descriptionDeclaree, couperPhrase, TEXTE_MAX_CAR };
