// ============================================================
// SentiqS — Quels médias couvrent réellement chaque pays
//
// POURQUOI CE FICHIER EXISTE
//
// Mesure du 06/09/2026 : treize pays n'ont qu'une seule source capable de
// faire monter un niveau d'alerte (score >= 70, voir getLiveAlertEvents dans
// web/SentiqS_Web.html) — SS BI CG ER GM GW SL GQ KM LS SZ MZ LY. Pour ces
// pays, une source qui se tait douze heures suffit à rendre la veille
// aveugle. La question posée était : peut-on aller chercher davantage de
// médias, pays par pays ?
//
// Première tentative, abandonnée : les annuaires encyclopédiques. Wikidata
// ne référence, avec site officiel déclaré, qu'un média pour le Soudan du
// Sud, un pour les Comores, un pour le Congo-Brazzaville — et AUCUN pour
// l'Érythrée, le Burundi, la Sierra Leone, la Guinée équatoriale. Les pays
// les moins couverts par la veille sont aussi les moins documentés par les
// bases ouvertes : l'annuaire reproduit exactement l'angle mort qu'il
// s'agissait de combler.
//
// Ce que fait ce module à la place : mesurer la couverture RÉELLE. Chaque
// article d'un flux Google News nomme le média qui l'a publié
// (<source url="...">). Rejouer les requêtes Google News DÉJÀ PRÉSENTES
// dans le registre SRCS, pays par pays, donne donc la liste des médias qui
// parlent effectivement de ce pays, et à quelle fréquence — sans annuaire,
// sans scraping, et sans rien inventer.
//
// POURQUOI REJOUER LES REQUÊTES DU REGISTRE PLUTÔT QUE D'EN COMPOSER
//
// Piège rencontré en construisant cette mesure, qui a coûté une passe
// entière : composer la requête avec le nom français du pays alors que
// l'édition Google News interrogée est anglophone ou lusophone ne ramène
// presque rien. « Afrique du Sud » sur l'édition ZA:en donnait 18 articles,
// « South Africa » en donne 161 ; « Soudan du Sud » 7, « South Sudan » 161 ;
// « Gambie » 4, « The Gambia » 148. Vingt-cinq pays sur cinquante-quatre
// étaient concernés, et la mesure avait l'air de fonctionner — elle
// concluait simplement que ces pays étaient peu couverts.
//
// Les requêtes du registre, elles, sont déjà écrites dans la langue de leur
// édition. Les reprendre telles quelles supprime la classe d'erreur au lieu
// de la contourner.
//
// CE QUE CETTE MESURE NE DÉCIDE PAS
//
// Rien. Elle produit des candidats, pas des sources. Le score de fiabilité
// d'un média est un jugement éditorial (voir CLAUDE.md, cliquet de
// scripts/verifier-redondance-sources.js : le compteur descend « en évaluant
// éditorialement de nouvelles sources, jamais en leur attribuant un score au
// jugé »). Ce module compte des occurrences ; il ne note personne.
// ============================================================

// extraireMedias(xml) : [{hote, nom}] pour chaque <source url="..."> du flux,
// dans l'ordre du flux (un média qui publie trois articles apparaît trois
// fois — c'est l'appelant qui agrège). L'hôte est normalisé sans « www. »,
// comme les hôtes du registre, sinon le même média compterait deux fois.
function extraireMedias(xml) {
  const sortie = [];
  for (const m of String(xml || '').matchAll(/<source\s+url="([^"]+)"[^>]*>([\s\S]*?)<\/source>/g)) {
    let hote;
    try { hote = new URL(m[1]).hostname.replace(/^www\./, '').toLowerCase(); } catch (_) { continue; }
    sortie.push({ hote, nom: m[2].replace(/<!\[CDATA\[|\]\]>/g, '').trim() });
  }
  return sortie;
}

// hotesDuRegistre(SRCS) : tous les domaines que la veille lit déjà.
//
// Deux formes à couvrir, et oublier la seconde ferait « découvrir » des
// médias déjà lus : le domaine du site (champs url/rss) ET le domaine cité
// dans une requête « site:exemple.org » d'un flux Google News — cette
// deuxième forme est celle de plusieurs dizaines d'entrées du registre.
function hotesDuRegistre(SRCS) {
  const hotes = new Set();
  for (const s of SRCS || []) {
    for (const champ of [s.url, s.rss, s.site]) {
      if (!champ) continue;
      try { hotes.add(new URL(champ).hostname.replace(/^www\./, '').toLowerCase()); } catch (_) { /* champ non-URL */ }
    }
    const cite = /site(?:%3A|:)([a-z0-9.-]+\.[a-z]{2,})/i.exec(s.rss || '');
    if (cite) hotes.add(cite[1].replace(/^www\./, '').toLowerCase());
  }
  return hotes;
}

// requetesGoogleNews(SRCS, cy) : les flux Google News THÉMATIQUES du pays.
//
// Les requêtes « site:exemple.org » sont écartées : elles ne ramènent qu'un
// média, déjà connu par construction. Ce sont les requêtes thématiques
// (« <Pays> sécurité », « conseil des ministres <Pays> »...) qui font
// apparaître des médias que le registre ne lit pas.
function requetesGoogleNews(SRCS, cy) {
  return (SRCS || [])
    .filter((s) => s.cy === cy && /news\.google\.com\/rss\/search/.test(s.rss || '') && !/q=site(?:%3A|:)/i.test(s.rss))
    .map((s) => s.rss);
}

// agreger(medias, hotesConnus) : [{hote, nom, n, deja}] trié du plus présent
// au moins présent. `deja` dit si le registre lit déjà ce domaine.
function agreger(medias, hotesConnus) {
  const parHote = new Map();
  for (const m of medias || []) {
    if (!parHote.has(m.hote)) parHote.set(m.hote, { hote: m.hote, nom: m.nom, n: 0, deja: !!(hotesConnus && hotesConnus.has(m.hote)) });
    parHote.get(m.hote).n++;
  }
  return [...parHote.values()].sort((a, b) => b.n - a.n || a.hote.localeCompare(b.hote));
}

// candidats(agrege, minOccurrences) : les médias inconnus du registre vus au
// moins minOccurrences fois.
//
// Le seuil existe parce qu'un média vu une seule fois sur une semaine ne dit
// rien : sur la moisson du 06/09/2026, 1405 domaines inconnus apparaissaient
// au moins une fois, 572 au moins deux fois. La reprise d'une dépêche par un
// site sans lien avec le pays produit exactement une occurrence.
function candidats(agrege, minOccurrences) {
  const seuil = Number.isFinite(minOccurrences) ? minOccurrences : 2;
  return (agrege || []).filter((m) => !m.deja && m.n >= seuil);
}

module.exports = { extraireMedias, hotesDuRegistre, requetesGoogleNews, agreger, candidats };
