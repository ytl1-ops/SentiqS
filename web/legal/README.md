# Pages légales — à compléter avant toute facturation

Ces quatre pages (mentions légales, CGV, CGU, confidentialité) sont des **structures**, pas des textes prêts à publier. Chaque
emplacement `[[À COMPLÉTER : …]]` attend une information que seul l'éditeur
connaît, ou une clause qui engage juridiquement et doit être validée.

Je n'ai pas rédigé les clauses opposables : des CGV et une politique de
confidentialité engagent la responsabilité de l'éditeur, et un texte générique
mal ajusté est pire qu'une page absente — il donne l'illusion de la conformité.

## Ce que le droit impose ici

Le service facture en euros, s'adresse à des professionnels et traite des
données personnelles (comptes, e-mails, journal de connexions, journal de
trafic). Trois obligations distinctes en découlent :

| Page | Fondement | Sanction en cas d'absence |
|---|---|---|
| Mentions légales | LCEN, art. 6-III | jusqu'à 75 000 € pour une personne physique |
| Conditions générales de vente | Code de la consommation / Code de commerce | contrat inopposable au client |
| Politique de confidentialité | RGPD, art. 13 et 14 | sanction CNIL |

## Un point qui vous est propre

SentiqS ne se contente pas d'informer : il **recommande des mesures de sûreté**
— évacuation, confinement, suspension de convois. Le périmètre de
responsabilité doit être explicite avant le premier client, pas après un
incident. C'est le seul endroit de ces pages où je recommande formellement de
faire relire par un juriste plutôt que de compléter soi-même : l'emplacement
est signalé dans les CGV.

## Une fois complétées

1. Retirer tous les `[[À COMPLÉTER : …]]` — un contrôle est prévu (voir
   `scripts/verifier-pages-legales.js`).
2. Vérifier que les liens du pied de page pointent bien vers ces pages.
3. Les ajouter à `web/sitemap.xml`.

## Conditions générales d'utilisation (13/11/2026)

`cgu.html` est exigée pour l'application Android (fiche Play Store) et pour
un service réservé aux comptes. Les clauses factuelles sont rédigées (compte
personnel, usages interdits dont le profilage de personnes, droits sur les
contenus des sources, nature de l'information) ; restent à compléter l'essai
gratuit, la suspension d'un compte, la date et le droit applicable.
