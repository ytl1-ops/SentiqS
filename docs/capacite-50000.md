# Capacité : 50 000 utilisateurs sur le plan gratuit (22/11/2026)

`node scripts/capacite-50000.js` imprime le tableau ; le modèle est dans
`scripts/lib/capacite.js` (hypothèses : 20 % d'actifs par jour, 1,5 ouverture,
15 % d'ouvertures à froid, page de 730 Ko).

| Ressource | Quota gratuit | Besoin à 50 000 | Verdict |
|---|---:|---:|---|
| Lectures Firestore / jour | 50 000 | 9,7 M (état actuel) → 30 000 si le contenu commun est statique | **casse** aujourd'hui |
| Hosting Spark (miroir web.app) / jour | 360 Mo | ~1,6 Go | **casse** : le miroir ne sert que de secours |
| GitHub Pages / mois | ~100 Go (souple) | ~47 Go | tient |
| Codes de connexion par e-mail / jour | 100 (Gmail), 5 liens (Firebase) | ~500 inscriptions | **casse** : Google / mot de passe |

Cause n° 1 : la page relit, par utilisateur et toutes les 30 min, 300 documents
d'actus de l'agent + 300 d'agenda + la collection des validations
(`_listerFirestore`, `chargerValidations`). Un seul utilisateur en consomme ~640
par ouverture : le quota du jour part avec ~80 utilisateurs.

Fait dans cette passe : copie locale servie quand Firestore refuse (plus de
collecte de 560 sources par visiteur), pause de 10 min après un refus,
validations relues 1 fois par heure et onglet visible seulement, en-têtes de
cache Hosting (js 5 min, assets 7 jours, historique 5 min).

À décider : servir cache, agenda, validations et faits de l'agent en fichiers
statiques (le job les écrit déjà) — mais un fichier statique est public, ce qui
lève le verrou « actus réservées aux comptes » du 13/11/2026. Palier payant si
besoin : Firebase Blaze (paiement à l'usage, lectures ~0,03 $ les 100 000).
