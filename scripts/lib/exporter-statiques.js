'use strict';
// Contenu commun servi en fichiers statiques (22/11/2026, décision déléguée
// par YORO après l'audit de capacité, option 3).
//
// Pourquoi : chaque ouverture de l'appli relisait dans Firestore 300 faits de
// l'agent, 300 entrées d'agenda et les validations — ~640 lectures par
// ouverture pour un quota de 50 000 par jour pour TOUT le projet. Ces trois
// collections sont communes à tous les comptes et ne contiennent rien de
// personnel : le job les écrit en fichiers sous web/agent/, servis par Pages
// et par le CDN, sans quota de lecture.
//
// Ce qui reste protégé : le cache d'actus principal (collecte_partagee),
// toujours réservé aux comptes (verrou du 13/11/2026). Ces fichiers ne
// portent que des faits que l'agent a lui-même recoupés, des événements
// d'agenda datés et les décisions de l'analyste — jamais une adresse.
//
// Les sorties sont DÉTERMINISTES (tri par clé, pas d'horodatage d'export) :
// un passage qui ne change rien ne produit aucun diff, donc aucun commit.

function chaine(v) { return typeof v === 'string' ? v : ''; }

/** Faits de l'agent : le JSON de chaque article, trié par clé. */
function actusPubliques(docs) {
  return (docs || [])
    .filter((d) => d && d.id && chaine(d.data && d.data.article))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((d) => ({ id: String(d.id), article: d.data.article }));
}

/** Agenda de l'agent : le JSON de chaque événement, trié par clé. */
function agendaPublic(docs) {
  return (docs || [])
    .filter((d) => d && d.id && chaine(d.data && d.data.evenement))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((d) => ({ id: String(d.id), evenement: d.data.evenement }));
}

/**
 * Validations de l'analyste : ce que le client voit (« Validé analyste »,
 * « Infirmé »), sans l'adresse de l'analyste — `par` devient « analyste ».
 */
function validationsPubliques(docs) {
  return (docs || [])
    .filter((d) => d && d.data && d.data.cle && d.data.decision && d.data.le)
    .sort((a, b) => (a.data.cle < b.data.cle ? -1 : a.data.cle > b.data.cle ? 1 : 0))
    .map((d) => {
      const v = d.data;
      const o = { cle: String(v.cle), decision: String(v.decision), source: String(v.source), info: String(v.info), par: 'analyste', le: String(v.le) };
      if (typeof v.note === 'string' && v.note) o.note = v.note;
      return o;
    });
}

module.exports = { actusPubliques, agendaPublic, validationsPubliques };
