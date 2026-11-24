# Pages légales — complétées le 22/11/2026

Les cinq pages (mentions légales, CGU, CGV, confidentialité, suppression du
compte) ne portent plus aucun `[[À COMPLÉTER : …]]` et sont indexées
(`index,follow`). `scripts/verifier-pages-legales.js` le vérifie à chaque PR.

## Ce qui a été écrit, et sur quelle base

- **Éditeur** : SentiqS, responsable de la publication YORO Tchéssiéhi.
- **Ce qui n'est pas connu n'est pas inventé** : immatriculation, adresse
  postale et numéro fiscal sont dits « en cours » ou « communiqués sur
  demande via le formulaire de contact ». À remplacer par les vraies valeurs
  dès qu'elles existent.
- **Aucune adresse e-mail n'est publiée.** Tout contact (questions,
  facturation, droits RGPD : accès, rectification, suppression, export, et
  retrait de contenus) passe par le formulaire « Nous contacter »
  (`SentiqS_Web.html#contact`, ou `#contact=<objet>`). Les messages sont dans
  Firestore (`messages_contact`), lus par l'administrateur seul.
- **Inventaire des données** : tiré des règles Firestore réelles, région
  `europe-west1` (Belgique), authentification Google (États-Unis, DPF et
  clauses contractuelles types).
- **Choix à faire valider par l'éditeur** (écrits de façon prudente) : droit
  ivoirien et tribunaux d'Abidjan ; responsabilité plafonnée aux sommes
  payées sur trois mois ; prolongation égale à toute interruption de plus de
  72 h ; service réservé aux professionnels, donc sans droit de rétractation.

## Ce qui reste recommandé

Une relecture par un juriste avant le premier client payant, en particulier
le périmètre de responsabilité : SentiqS recommande des mesures de sûreté
(évacuation, confinement, suspension de convois).

## Mettre à jour

Le texte français fait foi. Toute phrase ajoutée doit avoir son entrée dans
`web/js/dico-site-en.js` : `scripts/test/langue-site.test.js` refuse une
phrase légale sans traduction.
