# Fiches pays SentiqS -- generation (Point 3 du plan SEO)

## Regle de securite (a lire avant toute contribution)

Ce dossier ne doit **jamais** contenir de contenu securitaire invente ou approximatif. SentiqS est un outil d'aide a la decision pour des entreprises (YMYL -- Your Money Your Life) : une erreur factuelle sur un risque terroriste, criminel ou social peut avoir des consequences reelles pour les clients B2B.

Avant de creer un fichier `data/pays/<slug>.json` :

1. Rassemblez des sources fiables et verifiables (diplomatie francaise/belge/canadienne, US OSAC, Crisis24, presse locale reconnue, rapports d'ONG serieuses).
2. Redigez le contenu a partir de ces sources, sans extrapolation.
3. Listez les URLs des sources utilisees dans le champ `sources` (obligatoire, jamais vide).
4. Faites relire le contenu par une personne humaine avant publication.

Le script `scripts/generate-country-fiche.js` refuse de generer une fiche si le champ `sources` est vide ou si un champ requis manque.

## Fonctionnement

1. Creer `data/pays/<slug>.json` en suivant `data/pays/schema.json` (voir `data/pays/ghana.json` comme exemple, extrait de la fiche Ghana deja publiee).
2. Lancer : `node scripts/generate-country-fiche.js <slug>`
3. Le fichier `web/pays/<slug>.html` est genere a partir du gabarit `scripts/templates/fiche-country.template.html`.
4. Ajouter manuellement l'entree dans `sitemap.xml` et dans `web/pays/index.html`.

## Checklist des 45 pays restants (9/54 deja publies : Burkina Faso, Cote d'Ivoire, Ghana, Guinee, Liberia, Mali, Nigeria, Senegal, Togo)

| Pays | Slug prevu | ISO2 | Statut |
|---|---|---|---|
| Algerie | `algerie` | DZ | ☐ a faire |
| Angola | `angola` | AO | ☐ a faire |
| Benin | `benin` | BJ | ☐ a faire |
| Botswana | `botswana` | BW | ☐ a faire |
| Burundi | `burundi` | BI | ☐ a faire |
| Cameroun | `cameroun` | CM | ☐ a faire |
| Cap-Vert | `cap-vert` | CV | ☐ a faire |
| Centrafrique | `centrafrique` | CF | ☐ a faire |
| Comores | `comores` | KM | ☐ a faire |
| Congo-Brazzaville | `congo-brazzaville` | CG | ☐ a faire |
| RD Congo | `rdc` | CD | ☐ a faire |
| Djibouti | `djibouti` | DJ | ☐ a faire |
| Egypte | `egypte` | EG | ☐ a faire |
| Erythree | `erythree` | ER | ☐ a faire |
| Eswatini | `eswatini` | SZ | ☐ a faire |
| Ethiopie | `ethiopie` | ET | ☐ a faire |
| Gabon | `gabon` | GA | ☐ a faire |
| Gambie | `gambie` | GM | ☐ a faire |
| Guinee-Bissau | `guinee-bissau` | GW | ☐ a faire |
| Guinee equatoriale | `guinee-equatoriale` | GQ | ☐ a faire |
| Kenya | `kenya` | KE | ☐ a faire |
| Lesotho | `lesotho` | LS | ☐ a faire |
| Libye | `libye` | LY | ☐ a faire |
| Madagascar | `madagascar` | MG | ☐ a faire |
| Malawi | `malawi` | MW | ☐ a faire |
| Maroc | `maroc` | MA | ☐ a faire |
| Maurice | `maurice` | MU | ☐ a faire |
| Mauritanie | `mauritanie` | MR | ☐ a faire |
| Mozambique | `mozambique` | MZ | ☐ a faire |
| Namibie | `namibie` | NA | ☐ a faire |
| Niger | `niger` | NE | ☐ a faire |
| Nigeria | `nigeria` | NG | publiee (source France Diplomatie) |
| Ouganda | `ouganda` | UG | ☐ a faire |
| Rwanda | `rwanda` | RW | ☐ a faire |
| Sao Tome-et-Principe | `sao-tome-et-principe` | ST | ☐ a faire |
| Senegal | `senegal` | SN | publiee (source France Diplomatie) |
| Seychelles | `seychelles` | SC | ☐ a faire |
| Sierra Leone | `sierra-leone` | SL | ☐ a faire |
| Somalie | `somalie` | SO | ☐ a faire |
| Soudan | `soudan` | SD | ☐ a faire |
| Soudan du Sud | `soudan-du-sud` | SS | ☐ a faire |
| Tanzanie | `tanzanie` | TZ | ☐ a faire |
| Tchad | `tchad` | TD | ☐ a faire |
| Togo | `togo` | TG | publiee (source France Diplomatie) |
| Tunisie | `tunisie` | TN | ☐ a faire |
| Zambie | `zambie` | ZM | ☐ a faire |
| Zimbabwe | `zimbabwe` | ZW | ☐ a faire |
| Afrique du Sud | `afrique-du-sud` | ZA | ☐ a faire |

Chaque ligne passe a "fait" uniquement lorsque le fichier `data/pays/<slug>.json` correspondant existe, est rempli avec des sources verifiees, et que la fiche a ete generee et relue.
