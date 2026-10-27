// Traduction en français pour le rapport mensuel, faite par Node dans le job.
//
// Passage n° 1142 (27/10/2026) : quinze titres anglais soumis à la chaîne de
// traduction de la page (trFetch, par page.evaluate), zéro traduit, et zéro
// chapô — chacun attendait ses 15 s avant d'abandonner. Dans le navigateur du
// job, les moteurs de la page passent par des relais publics refusés (CORS)
// ou par le traducteur intégré de Chrome, absent sur le runner. Node, lui, a
// le réseau en direct : on appelle les mêmes services gratuits sans relais.
//
// Deux moteurs, dans l'ordre : Google (point d'accès gratuit « gtx »), puis
// MyMemory. Aucun ne demande de clé. Un échec rend null : le texte reste dans
// sa langue avec sa marque « (EN) », et le passage suivant réessaie.

const MAX_CARACTERES = 450;
const DELAI_MS = 12000;

function borne(texte) {
  const t = String(texte || '').replace(/\s+/g, ' ').trim();
  if (t.length <= MAX_CARACTERES) return t;
  const coupe = t.slice(0, MAX_CARACTERES);
  const fin = coupe.lastIndexOf(' ');
  return (fin > 200 ? coupe.slice(0, fin) : coupe) + '…';
}

async function lireJson(fetchFn, url, delaiMs) {
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  const minuteur = ctl ? setTimeout(() => ctl.abort(), delaiMs) : null;
  try {
    const r = await fetchFn(url, { signal: ctl ? ctl.signal : undefined, headers: { 'User-Agent': 'Mozilla/5.0 SentiqS-rapport' } });
    if (!r || !r.ok) return null;
    return await r.json();
  } catch (e) {
    return null;
  } finally {
    if (minuteur) clearTimeout(minuteur);
  }
}

async function viaGoogle(texte, source, fetchFn, delaiMs) {
  const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&tl=fr&sl='
    + encodeURIComponent(source || 'auto') + '&q=' + encodeURIComponent(texte);
  const j = await lireJson(fetchFn, url, delaiMs);
  if (!Array.isArray(j) || !Array.isArray(j[0])) return null;
  const out = j[0].map((seg) => (Array.isArray(seg) ? seg[0] : '')).join('').trim();
  return out || null;
}

async function viaMyMemory(texte, source, fetchFn, delaiMs) {
  if (!source || source === 'auto' || source === 'other') return null; // MyMemory exige la langue source
  const url = 'https://api.mymemory.translated.net/get?langpair=' + encodeURIComponent(source + '|fr')
    + '&q=' + encodeURIComponent(texte);
  const j = await lireJson(fetchFn, url, delaiMs);
  const out = j && j.responseData && typeof j.responseData.translatedText === 'string' ? j.responseData.translatedText.trim() : '';
  // Quota dépassé : MyMemory renvoie un avertissement à la place du texte.
  if (!out || /MYMEMORY WARNING|QUERY LENGTH LIMIT/i.test(out) || Number(j.responseStatus) >= 400) return null;
  return out;
}

const decoder = (s) => s.replace(/&#39;|&#039;/g, '\'').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/**
 * Traduit `texte` (langue `source` : en, pt, ar…) en français.
 * Rend la traduction, ou null si aucun moteur n'a répondu, ou si le moteur a
 * rendu le texte inchangé (il le jugeait déjà en français).
 */
async function traduire(texte, source, opts) {
  const o = opts || {};
  const fetchFn = o.fetchFn || (typeof fetch === 'function' ? fetch : null);
  if (!fetchFn) return null;
  const t = borne(texte);
  if (!t) return null;
  const delaiMs = o.delaiMs || DELAI_MS;
  for (const moteur of [viaGoogle, viaMyMemory]) {
    const out = await moteur(t, source, fetchFn, delaiMs);
    if (out) return out.trim() === t ? null : decoder(out);
  }
  return null;
}

module.exports = { traduire, borne, MAX_CARACTERES };
