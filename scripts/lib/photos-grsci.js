// Photos des faits marquants du rapport GRSCI (demande du 23/10/2026).
//
// Un PowerPoint ou un Word ne pointe pas vers une adresse : il embarque des
// octets. Le job de collecte, lui, a le réseau (le navigateur de la page est
// bridé par la CSP, pas Node) : il télécharge l'image que la SOURCE publie
// avec son article — celle de son flux, sinon son aperçu Open Graph — et le
// document la reproduit avec le nom du site et le lien vers l'article.
//
// Règles :
// - jamais d'image de remplacement : pas de photo, pas de cadre (même règle
//   que le Flux depuis le 23/10/2026) ;
// - JPEG ou PNG seulement (ce que lisent Word, PowerPoint et LibreOffice sans
//   conversion ; un WebP est écarté plutôt que mal rendu) ;
// - une vignette trop petite (icône, pixel de suivi) n'illustre rien ;
// - plafond de poids : le rapport circule par e-mail.
const PHOTO_MAX_OCTETS = 1500000;
const PAGE_MAX_OCTETS = 1500000;
const DELAI_MS = 10000;
const LARGEUR_MIN = 240;
const HAUTEUR_MIN = 140;

/** Format et dimensions d'une image JPEG ou PNG, ou null. */
function dimensionsImage(buf) {
  if (!buf || buf.length < 24) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
    return { type: 'png', w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xFF) { i++; continue; }
      const m = buf[i + 1];
      if (m === 0xD8 || m === 0x01 || (m >= 0xD0 && m <= 0xD7)) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      // SOF0..SOF15, sauf DHT (C4), JPG (C8) et DAC (CC).
      if (m >= 0xC0 && m <= 0xCF && m !== 0xC4 && m !== 0xC8 && m !== 0xCC) {
        return { type: 'jpg', w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
      }
      i += 2 + len;
    }
  }
  return null;
}

function urlSure(u) {
  return typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(u) ? u : null;
}

async function lireLimite(rep, max) {
  const lu = [];
  let n = 0;
  for await (const morceau of rep.body) {
    n += morceau.length;
    if (n > max) return null;
    lu.push(Buffer.from(morceau));
  }
  return Buffer.concat(lu);
}

async function telecharger(url, max, fetchFn) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), DELAI_MS);
  try {
    const rep = await (fetchFn || fetch)(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SentiqS-GRSCI/1.0)', Accept: '*/*' } });
    if (!rep.ok || !rep.body) return null;
    const lg = Number(rep.headers.get('content-length') || 0);
    if (lg > max) return null;
    return await lireLimite(rep, max);
  } catch (e) {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** L'image d'aperçu déclarée par la page d'un article (og:image, twitter:image). */
function imageDeclaree(html, base) {
  const s = String(html || '').slice(0, 400000);
  const motifs = [
    /<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image(?::src)?)["']/i,
  ];
  for (const re of motifs) {
    const m = re.exec(s);
    if (m) {
      try { return urlSure(new URL(m[1].replace(/&amp;/g, '&'), base).href); } catch (e) { /* adresse illisible */ }
    }
  }
  return null;
}

async function chargerPhoto(url, fetchFn) {
  const u = urlSure(url);
  if (!u) return null;
  const data = await telecharger(u, PHOTO_MAX_OCTETS, fetchFn);
  const dim = dimensionsImage(data);
  if (!dim || dim.w < LARGEUR_MIN || dim.h < HAUTEUR_MIN) return null;
  return Object.assign({ data }, dim);
}

function domaine(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return null; }
}

/**
 * Pose `photo` ({ data, type, w, h, credit, lien }) sur chacun des faits
 * marquants qui en ont une, et rien sur les autres. L'image du flux d'abord,
 * puis l'aperçu Open Graph de chaque article du fait (un fait repris par
 * plusieurs médias a plusieurs chances d'être illustré). L'adresse trouvée
 * est gardée dans `img` pour que le cumul évite de relire la page demain.
 */
async function illustrer(faits, fetchFn) {
  let n = 0;
  for (const f of faits || []) {
    const candidats = [];
    if (urlSure(f.img)) candidats.push({ img: f.img, lien: (f.liens && f.liens[0] && f.liens[0].url) || f.url });
    for (const l of (f.liens && f.liens.length ? f.liens : (f.url ? [{ url: f.url }] : []))) candidats.push({ page: l.url });
    for (const c of candidats) {
      let img = c.img;
      let lien = c.lien || c.page;
      if (!img && c.page && /^https?:\/\//.test(c.page)) {
        const html = await telecharger(c.page, PAGE_MAX_OCTETS, fetchFn);
        img = html ? imageDeclaree(html.toString('utf8'), c.page) : null;
      }
      if (!img) continue;
      const p = await chargerPhoto(img, fetchFn);
      if (!p) continue;
      f.img = f.img || img;
      f.photo = Object.assign(p, { credit: domaine(lien) || domaine(img), lien: lien || null });
      n++;
      break;
    }
  }
  return n;
}

module.exports = { dimensionsImage, imageDeclaree, chargerPhoto, illustrer, PHOTO_MAX_OCTETS };
