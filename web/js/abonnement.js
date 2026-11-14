// Réponse d'un destinataire à un bulletin programmé (14/11/2026).
//
// Lien reçu par e-mail : abonnement.html#oui=<jeton> (« J'accepte ») ou
// #non=<jeton> (« Je refuse » / « Ne plus recevoir »). La page écrit la
// décision dans Firestore (reponses_destinataires/<jeton>), sans compte : les
// règles n'acceptent qu'un jeton de 40 caractères et une décision. Le job
// d'envoi la lit au passage suivant. Une seule langue à l'écran, celle du
// navigateur (français par défaut).
(function () {
  var en = /^en\b/i.test(navigator.language || '');
  var T = en ? {
    titre: 'Security bulletins', attente: 'Saving your answer…',
    oui: 'Thank you: you will receive the bulletins that were scheduled for you. Each one carries a link to stop them.',
    non: 'Done: you will not receive any more bulletins from this sender. Nothing else is needed.',
    lien: 'This link is incomplete. Open it again from the e-mail you received.',
    echec: 'Your answer could not be saved. Please try again in a few minutes.',
    aide: 'SentiqS is a security monitoring tool for Africa.'
  } : {
    titre: 'Bulletins sûreté', attente: 'Enregistrement de votre réponse…',
    oui: 'Merci : vous recevrez les bulletins programmés pour vous. Chacun porte un lien pour les arrêter.',
    non: 'C’est fait : vous ne recevrez plus de bulletin de cet expéditeur. Rien d’autre n’est nécessaire.',
    lien: 'Ce lien est incomplet. Ouvrez-le de nouveau depuis l’e-mail reçu.',
    echec: 'Votre réponse n’a pas pu être enregistrée. Réessayez dans quelques minutes.',
    aide: 'SentiqS est un outil de veille sûreté sur l’Afrique.'
  };
  document.documentElement.lang = en ? 'en' : 'fr';
  var $ = function (id) { return document.getElementById(id); };
  $('titre').textContent = T.titre;
  $('message').textContent = T.attente;
  $('aide').textContent = T.aide;
  var m = /^#(oui|non)=([a-f0-9]{40})$/.exec(String(location.hash || ''));
  // Le jeton quitte la barre d'adresse : il ne doit pas rester dans
  // l'historique ni être partagé par inadvertance.
  try { history.replaceState(null, '', location.pathname); } catch (_) {}
  if (!m) { $('message').textContent = T.lien; $('message').className = 'err'; return; }
  var cfg = window.SENTIQ_FIREBASE_CONFIG || {};
  var url = 'https://firestore.googleapis.com/v1/projects/' + encodeURIComponent(cfg.projectId)
    + '/databases/(default)/documents/reponses_destinataires/' + m[2] + '?key=' + encodeURIComponent(cfg.apiKey || '');
  fetch(url, {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ fields: { decision: { stringValue: m[1] }, le: { stringValue: new Date().toISOString() } } })
  }).then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    $('message').textContent = T[m[1]];
    $('message').className = 'ok';
  }).catch(function () {
    $('message').textContent = T.echec;
    $('message').className = 'err';
  });
})();
