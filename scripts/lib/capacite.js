// Modèle de capacité (22/11/2026) : ce que 50 000 utilisateurs coûtent en
// quotas du plan gratuit. Les tailles sont MESURÉES sur les fichiers du dépôt,
// pas supposées ; les comportements (combien de lectures par ouverture) sont
// ceux du code de la page, relevés à la main et nommés ici pour qu'un
// changement de code se répercute dans un seul endroit.
//
// Quotas (documentation officielle, plan Spark et GitHub Pages) :
const QUOTAS = {
  firestore_lectures_jour: 50000,
  firestore_ecritures_jour: 20000,
  hosting_spark_mo_jour: 360,        // transfert Hosting Spark
  pages_go_mois: 100,                // limite conseillée GitHub Pages (souple)
  codes_email_jour: 100,             // Gmail via Apps Script, compte gratuit
};

// Lectures Firestore d'une ouverture de l'appli par un utilisateur connecté.
const LECTURES = {
  profil: 1,                 // profil du compte
  essai: 1,                  // essais/{adresse}
  annonce_cache: 1,          // annonce du cache d'actus
  morceaux_cache: 2,         // morceaux relus quand le cache a changé (≈ tous les 3-5 h)
  validations: 40,           // collection `validations` lue en entier (ordre de grandeur : décisions du pilote)
  actus_agent: 300,          // _listerFirestore(actus, 300), relu toutes les 30 min
  agenda_agent: 300,         // idem, agenda
  agenda_partage: 1,
};

function calculer(o) {
  o = o || {};
  const n = o.utilisateurs || 50000;
  const ouvertures = o.ouverturesParJour || 1.5;      // ouvertures par utilisateur actif et par jour
  const actifsJour = Math.round(n * (o.partActifs || 0.2)); // 20 % d'actifs un jour donné
  const minutes = o.minutesParOuverture || 10;        // durée moyenne de session
  const statique = !!o.contenuStatique;
  // Relectures périodiques pendant une session : annonce toutes les ~15 min, agent toutes les 30 min.
  const relectAgent = Math.max(1, Math.floor(minutes / 30));
  // Seuls le profil et l'essai restent des lectures de base : ils sont propres
  // à chaque compte. Cache d'actus, agenda, validations et faits de l'agent
  // sont communs à tous : servis en fichiers statiques, ils ne coûtent plus rien.
  let parOuverture = LECTURES.profil + LECTURES.essai;
  if (!statique) {
    parOuverture += LECTURES.annonce_cache + LECTURES.morceaux_cache * 0.3 + LECTURES.agenda_partage
      + LECTURES.validations + (LECTURES.actus_agent + LECTURES.agenda_agent) * relectAgent;
  }
  const octetsPage = o.octetsPage || 730 * 1024;      // mesuré : html gz + scripts gz
  const colds = actifsJour * ouvertures * (o.partFroides || 0.15);
  const lignes = {
    firestore_lectures_jour: { besoin: Math.round(actifsJour * ouvertures * parOuverture), quota: QUOTAS.firestore_lectures_jour },
    hosting_spark_mo_jour: { besoin: Math.round(colds * octetsPage / 1048576), quota: QUOTAS.hosting_spark_mo_jour },
    pages_go_mois: { besoin: +(colds * 30 * octetsPage / 1073741824).toFixed(1), quota: QUOTAS.pages_go_mois },
    codes_email_jour: { besoin: Math.round(n * (o.partInscriptionsJour || 0.01)), quota: QUOTAS.codes_email_jour },
  };
  return { actifsJour, lectures_par_ouverture: Math.round(parOuverture * 10) / 10, lignes };
}

module.exports = { QUOTAS, LECTURES, calculer };
