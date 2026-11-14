// Sélecteur FR/EN des pages hors appli (accueil, pages légales).
//
// Même moteur (js/langue.js) et même choix mémorisé (localStorage
// sentinel_lang) que l'appli : passer en anglais sur l'accueil puis se
// connecter ouvre l'appli en anglais, et inversement. Avant le 21/10/2026 ces
// pages n'existaient qu'en français, sans aucun moyen d'en changer.
(function () {
  'use strict';
  if (typeof SentiqLangue === 'undefined') return;

  // Les étiquettes de colonnes des tableaux empilés sur mobile (pages légales)
  // sont lues par CSS dans data-l : le moteur ne traduit pas cet attribut,
  // on le fait ici en gardant le français d'origine pour le retour.
  function etiquettesColonnes(lang) {
    var cellules = document.querySelectorAll('[data-l]');
    for (var i = 0; i < cellules.length; i++) {
      var c = cellules[i];
      if (!c.hasAttribute('data-l-fr')) c.setAttribute('data-l-fr', c.getAttribute('data-l'));
      var fr = c.getAttribute('data-l-fr');
      c.setAttribute('data-l', lang === 'en' ? SentiqLangue.traduire(fr) : fr);
    }
  }

  function appliquer(lang) {
    lang = lang === 'en' ? 'en' : 'fr';
    document.documentElement.lang = lang;
    SentiqLangue.activer(lang);
    etiquettesColonnes(lang);
    var boutons = document.querySelectorAll('.lang-btn[data-lang]');
    for (var i = 0; i < boutons.length; i++) {
      var on = boutons[i].getAttribute('data-lang') === lang;
      boutons[i].classList.toggle('on', on);
      boutons[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }

  // Accueil (14/11/2026, référencement) : une adresse par langue, index.html
  // en français et en.html en anglais, pour que les moteurs de recherche
  // indexent les deux (hreflang). Ces deux pages déclarent leur langue
  // (window.SENTIQ_LANGUE_PAGE, écrit par scripts/generer-seo.js) ; changer
  // de langue y mène à l'autre adresse. Les pages légales n'en déclarent
  // pas et gardent la traduction sur place.
  var PAGES_LANGUE = { fr: 'index.html', en: 'en.html' };
  var languePage = window.SENTIQ_LANGUE_PAGE === 'en' ? 'en' : (window.SENTIQ_LANGUE_PAGE === 'fr' ? 'fr' : null);

  function allerVers(lang) {
    try { window.location.href = PAGES_LANGUE[lang] + (window.location.hash || ''); } catch (_) {}
  }

  if (languePage) {
    var memorise = null;
    try { memorise = window.localStorage.getItem(SentiqLangue.CLE_STOCKAGE); } catch (_) {}
    if (languePage === 'fr' && memorise === 'en') {
      // Choix explicite d'un visiteur venu une première fois en anglais. Un
      // robot n'a rien en mémoire : il reste sur la page française.
      try { window.location.replace(PAGES_LANGUE.en + (window.location.hash || '')); return; } catch (_) {}
    }
    // Arriver sur une adresse de langue vaut choix (lien partagé, résultat
    // de recherche) : l'appli s'ouvrira dans la même langue.
    SentiqLangue.memoriser(languePage);
  }

  window.choisirLangueSite = function (lang) {
    lang = lang === 'en' ? 'en' : 'fr';
    SentiqLangue.memoriser(lang);
    if (languePage && lang !== languePage) { allerVers(lang); return; }
    appliquer(lang);
  };

  function demarrer() {
    appliquer(languePage || SentiqLangue.lireChoix());
    document.addEventListener('click', function (ev) {
      var b = ev.target && ev.target.closest && ev.target.closest('.lang-btn[data-lang]');
      if (b) window.choisirLangueSite(b.getAttribute('data-lang'));
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer);
  else demarrer();
})();
