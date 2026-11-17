// ═══════════════════════════════════════════════════════════════════════════
//  SentiqS — configuration web PUBLIQUE du projet Firebase
//
//  Firebase est le seul fournisseur depuis le 15/11/2026 (Supabase retiré) :
//  connexion, comptes, journal des connexions, cache d'actus, agenda,
//  configuration, paiements déclarés (voir web/js/firebase.js et FIREBASE.md).
//  Remettre null ici rend l'application « service indisponible ».
//
//  Ces valeurs ne sont PAS des secrets : Firebase les destine à être lues par
//  n'importe quel navigateur (« Paramètres du projet > Vos applications >
//  Configuration du SDK »). La protection des données est portée par les
//  règles Firestore (firebase/firestore.rules), jamais par ces valeurs. Le
//  compte de service des workflows, lui, est un secret : il ne vit que dans
//  les secrets GitHub Actions, jamais ici.
// ═══════════════════════════════════════════════════════════════════════════
//
//  Projet « SentiqS » (sentiqs-235ce), créé le 21/10/2026, plan Spark.
window.SENTIQ_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCig0xMaVB0YOv4zuYeQeGfTgCuw3ETR4c',
  authDomain: 'sentiqs-235ce.firebaseapp.com',
  projectId: 'sentiqs-235ce',
  appId: '1:281714171549:web:c15bb3211bd6e2d9cdfe74',
};

// Servie par Firebase Hosting (sentiqs-235ce.web.app), la page fait passer la
// connexion Google par son PROPRE domaine (/__/auth/handler, fourni par
// Hosting). Avec firebaseapp.com, Chrome cloisonne le stockage entre les deux
// domaines : une connexion par redirection (fenêtre surgissante bloquée)
// revient sans session, et l'écran de connexion réapparaît sans message
// (01/11/2026, compte administrateur). Sur GitHub Pages, rien ne change.
(function () {
  var c = window.SENTIQ_FIREBASE_CONFIG;
  var h = typeof location !== 'undefined' ? String(location.hostname || '') : '';
  if (c && (h === c.projectId + '.web.app' || h === c.projectId + '.firebaseapp.com')) c.authDomain = h;
})();
