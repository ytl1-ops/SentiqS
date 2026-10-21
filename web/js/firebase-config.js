// ═══════════════════════════════════════════════════════════════════════════
//  SentiqS — configuration web PUBLIQUE du projet Firebase
//
//  Tant que cet objet vaut null, l'application reste sur Supabase, exactement
//  comme avant : rien ne change pour l'utilisateur. Dès qu'il est rempli, la
//  connexion, les comptes et le journal des connexions passent par Firebase
//  (voir web/js/firebase.js et FIREBASE.md).
//
//  Ces valeurs ne sont PAS des secrets : Firebase les destine à être lues par
//  n'importe quel navigateur (« Paramètres du projet > Vos applications >
//  Configuration du SDK »). La protection des données est portée par les
//  règles Firestore (firebase/firestore.rules), jamais par ces valeurs. Le
//  compte de service des workflows, lui, est un secret : il ne vit que dans
//  les secrets GitHub Actions, jamais ici.
// ═══════════════════════════════════════════════════════════════════════════
//
//  Projet « SentiqS » (sentiqs-235ce), créé le 21/10/2026, plan Spark. Remettre
//  null ici suffit à revenir à Supabase pour la connexion.
window.SENTIQ_FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCig0xMaVB0YOv4zuYeQeGfTgCuw3ETR4c',
  authDomain: 'sentiqs-235ce.firebaseapp.com',
  projectId: 'sentiqs-235ce',
  appId: '1:281714171549:web:c15bb3211bd6e2d9cdfe74',
};
