// Lecture et écriture de documents Firestore par l'API REST, avec le compte de
// service du job (même jeton que scripts/lib/cache-firestore-ecriture.js).
// Sert aux bulletins programmés (14/11/2026) : la programmation est écrite par
// la page, lue et suivie par le job. Un compte de service passe par IAM et
// n'est pas soumis aux règles : c'est ce qui permet d'écrire l'état d'envoi
// (bulletins_etat) qu'aucun navigateur ne peut toucher.

function base(projectId) {
  return 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(projectId) + '/databases/(default)/documents';
}

/** Valeur JS -> valeur typée de l'API REST. */
function versFirestore(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(versFirestore) } };
  if (typeof v === 'object') {
    const fields = {};
    Object.keys(v).forEach((k) => { if (v[k] !== undefined) fields[k] = versFirestore(v[k]); });
    return { mapValue: { fields } };
  }
  return { stringValue: String(v) };
}

/** Valeur typée -> valeur JS. */
function depuisFirestore(c) {
  if (!c || typeof c !== 'object') return null;
  if ('nullValue' in c) return null;
  if ('booleanValue' in c) return !!c.booleanValue;
  if ('integerValue' in c) return Number(c.integerValue);
  if ('doubleValue' in c) return Number(c.doubleValue);
  if ('stringValue' in c) return c.stringValue;
  if ('timestampValue' in c) return c.timestampValue;
  if ('arrayValue' in c) return ((c.arrayValue && c.arrayValue.values) || []).map(depuisFirestore);
  if ('mapValue' in c) return champs((c.mapValue && c.mapValue.fields) || {});
  return null;
}
function champs(fields) {
  const o = {};
  Object.keys(fields || {}).forEach((k) => { o[k] = depuisFirestore(fields[k]); });
  return o;
}

function client(projectId, jeton, fetchFn) {
  const f = fetchFn || fetch;
  const entetes = { Authorization: 'Bearer ' + jeton, 'content-type': 'application/json' };
  const racine = base(projectId);
  async function erreur(r, quoi) {
    const d = await r.json().catch(() => null);
    return new Error(quoi + ' refusé (HTTP ' + r.status + (d && d.error && d.error.message ? ' : ' + d.error.message : '') + ')');
  }
  return {
    /** Le document, ou null s'il n'existe pas. */
    async lire(chemin) {
      const r = await f(racine + '/' + chemin, { headers: entetes });
      if (r.status === 404) return null;
      if (!r.ok) throw await erreur(r, 'lecture de ' + chemin);
      const d = await r.json();
      return champs(d.fields || {});
    },
    /** Tous les documents d'une collection : [{ id, data }]. */
    async lister(collection, max) {
      const out = [];
      let page = '';
      do {
        const r = await f(racine + '/' + collection + '?pageSize=300' + (page ? '&pageToken=' + encodeURIComponent(page) : ''), { headers: entetes });
        if (r.status === 404) return out;
        if (!r.ok) throw await erreur(r, 'liste de ' + collection);
        const d = await r.json();
        (d.documents || []).forEach((doc) => out.push({ id: String(doc.name).split('/').pop(), data: champs(doc.fields || {}) }));
        page = d.nextPageToken || '';
      } while (page && out.length < (max || 5000));
      return out;
    },
    /** Remplace le document entier (création comprise). */
    async ecrire(chemin, objet) {
      const fields = versFirestore(objet).mapValue.fields;
      const r = await f(racine + '/' + chemin, { method: 'PATCH', headers: entetes, body: JSON.stringify({ fields }) });
      if (!r.ok) throw await erreur(r, 'écriture de ' + chemin);
      return true;
    },
  };
}

module.exports = { base, versFirestore, depuisFirestore, champs, client };
