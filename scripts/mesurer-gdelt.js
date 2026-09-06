#!/usr/bin/env node
// Que ramènerait GDELT sur les pays que la veille ne couvre pas ?
//
// POURQUOI CE SCRIPT EXISTE
//
// Mesure du 06/09/2026 : trente pays sur cinquante-quatre n'avaient aucun
// article dans le cache publié. La question posée était : peut-on enrichir
// le signal par des recherches Google ou un autre moteur ?
//
// Réponse mesurée, le même jour : non. Google Custom Search répond 403 sans
// clé, Bing 401 et son API est fermée aux nouveaux clients, Brave 422 avec
// une offre gratuite d'environ deux mille requêtes par mois — très en
// dessous du besoin (54 pays × plusieurs requêtes × sept passages par jour).
// Et surtout, un moteur généraliste renvoie des PAGES, pas des événements
// datés et attribués : il faudrait ensuite aller chercher chaque page, la
// dater, l'attribuer — exactement le scraping que ce dépôt refuse.
//
// GDELT, lui, est fait pour ça : base ouverte de veille médiatique mondiale,
// gratuite, SANS CLÉ, 65 langues, mise à jour tous les quarts d'heure. Une
// requête toutes les cinq secondes suffit très largement au besoin.
//
// CE SCRIPT NE CONSTRUIT RIEN. Il ne touche pas à SRCS, n'ajoute aucune
// source, n'attribue aucune note. Il répond à une seule question : sur les
// pays aveugles, GDELT ramène-t-il quelque chose d'exploitable ? Si la
// réponse est faible, on aura épargné la construction d'un connecteur.
//
// ATTENTION — À LANCER DEPUIS GITHUB ACTIONS. GDELT limite à une requête
// toutes les cinq secondes PAR ADRESSE : depuis un bac à sable dont
// l'adresse est partagée, la limite est atteinte avant la première requête.
//
// Usage : node scripts/mesurer-gdelt.js [CY CY ...]
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const RACINE = path.join(__dirname, '..');
const HTML = fs.readFileSync(process.env.SENTINEL_HTML_PATH || path.join(RACINE, 'web/SentiqS_Web.html'), 'utf8');
const UA = 'SentiqSBot/1.0 (+https://sentiqs.com; veille de surete pour 54 pays d Afrique; contact: yorot225@gmail.com)';
const PAUSE_MS = 6000; // la limite annoncee est de 5 s ; on se donne une marge

// Les domaines que la veille lit deja, pour distinguer ce que GDELT
// APPORTERAIT de ce qu'elle voit deja passer.
const { hotesDuRegistre } = require('./lib/moisson-medias.js');
const ctx = {}; vm.createContext(ctx);
const d = HTML.indexOf('const SRCS=['), f = HTML.indexOf('\n];', d);
vm.runInContext(HTML.slice(d, f) + '\n];this.S = SRCS;', ctx);
const CONNUS = hotesDuRegistre(ctx.S);

// La vraie classify() de la page de production, comme scripts/banc-tri.js.
const { tranche, bac, exposer } = require('./test/_bac.js');
const { classify } = exposer(bac(tranche('const CK_CRIT', '//  FIABILITÉ & ANTI-HALLUCINATION')), 'classify');

// Pays sans aucun article dans le cache publie du 06/09/2026, avec leur nom
// anglais — GDELT indexe en anglais.
const AVEUGLES = {
  AO: 'Angola', BI: 'Burundi', BW: 'Botswana', CG: 'Republic of the Congo', DJ: 'Djibouti',
  EG: 'Egypt', ER: 'Eritrea', ET: 'Ethiopia', GA: 'Gabon', GM: 'Gambia',
  GQ: 'Equatorial Guinea', GW: 'Guinea-Bissau', KM: 'Comoros', LR: 'Liberia', LS: 'Lesotho',
  LY: 'Libya', MG: 'Madagascar', MR: 'Mauritania', MW: 'Malawi', NE: 'Niger',
  RW: 'Rwanda', SC: 'Seychelles', SD: 'Sudan', SL: 'Sierra Leone', SO: 'Somalia',
  SS: 'South Sudan', ST: 'Sao Tome and Principe', TD: 'Chad', TN: 'Tunisia', TZ: 'Tanzania',
  UG: 'Uganda',
};

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

async function interroger(requete) {
  const url = 'https://api.gdeltproject.org/api/v2/doc/doc?query=' + encodeURIComponent(requete)
    + '&mode=artlist&maxrecords=100&format=json&timespan=24h&sort=datedesc';
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) });
    const texte = await r.text();
    if (!r.ok) return { erreur: 'HTTP ' + r.status + ' — ' + texte.slice(0, 90) };
    try { return { articles: (JSON.parse(texte).articles) || [] }; }
    catch (_) { return { erreur: 'réponse non JSON — ' + texte.slice(0, 90) }; }
  } catch (e) { return { erreur: (e && e.message) || 'erreur réseau' }; }
}

(async () => {
  const demandes = process.argv.slice(2).map((a) => a.toUpperCase()).filter((a) => AVEUGLES[a]);
  const cibles = demandes.length ? demandes : Object.keys(AVEUGLES);
  console.log('GDELT — ' + cibles.length + ' pays, fenêtre 24 h, une requête toutes les ' + (PAUSE_MS / 1000) + ' s\n');
  const rapport = {};
  let premier = true;
  for (const cy of cibles) {
    if (!premier) await attendre(PAUSE_MS);
    premier = false;
    // Articles PARLANT du pays, toutes langues, tous pays d'edition.
    const r = await interroger('"' + AVEUGLES[cy] + '"');
    if (r.erreur) { console.log(cy + ' ' + AVEUGLES[cy].padEnd(24) + 'ÉCHEC : ' + r.erreur); rapport[cy] = { erreur: r.erreur }; continue; }
    const arts = r.articles;
    const domaines = new Set(arts.map((a) => (a.domain || '').replace(/^www\./, '').toLowerCase()).filter(Boolean));
    const inconnus = [...domaines].filter((h) => !CONNUS.has(h));
    const langues = new Set(arts.map((a) => a.language).filter(Boolean));
    let alertes = 0;
    for (const a of arts) {
      const t = a.title || '';
      const lvl = classify(t, { cy, cat: 'securite' }, t).lvl;
      if (lvl === 'crit' || lvl === 'high') alertes++;
    }
    rapport[cy] = { pays: AVEUGLES[cy], articles: arts.length, domaines: domaines.size, inconnus: inconnus.length, langues: [...langues], alertes, exemples: arts.slice(0, 3).map((a) => a.title) };
    console.log(cy + ' ' + AVEUGLES[cy].slice(0, 22).padEnd(24)
      + String(arts.length).padStart(4) + ' articles | '
      + String(domaines.size).padStart(3) + ' médias (' + String(inconnus.length).padStart(3) + ' inconnus du registre) | '
      + String(alertes).padStart(3) + ' au-dessus du normal | ' + [...langues].slice(0, 4).join(','));
  }
  fs.writeFileSync(path.join(process.cwd(), 'mesure-gdelt.json'), JSON.stringify(rapport, null, 1));
  const ok = Object.values(rapport).filter((r) => !r.erreur);
  const tot = (f2) => ok.reduce((n, r) => n + f2(r), 0);
  console.log('\n──────────────────────────────────────────────');
  console.log(ok.length + '/' + cibles.length + ' pays interrogés sans erreur');
  console.log('articles sur 24 h        : ' + tot((r) => r.articles));
  console.log('dont au-dessus du normal : ' + tot((r) => r.alertes));
  console.log('pays avec au moins un article : ' + ok.filter((r) => r.articles > 0).length);
  console.log('médias inconnus du registre   : ' + tot((r) => r.inconnus));
  console.log('\nExemples de titres, trois par pays :');
  for (const [cy, r] of Object.entries(rapport)) {
    if (!r.exemples || !r.exemples.length) continue;
    console.log('  ' + cy + ' — ' + r.exemples.map((t) => t.slice(0, 70)).join('\n       '));
  }
})();
