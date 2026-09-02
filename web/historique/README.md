# Archive des niveaux d'alerte

Écrit par le job de collecte planifiée — voir `scripts/lib/historique.js`.

| Fichier | Contenu |
|---|---|
| `AAAA-MM-JJ.json` | l'instantané des 54 niveaux ce jour-là, ~5 Ko |
| `serie.json` | les 90 derniers jours, compactés ; c'est ce que la page télécharge |
| `dernier-signale.json` | le dernier niveau **annoncé** par pays, pour ne pas réémettre une alerte déjà partie |

**`serie.json` est versionné vide dès le départ, et c'est délibéré.** La page
le télécharge à chaque ouverture du tableau de bord ; sans ce fichier, chaque
visite produisait un 404 en console — assez pour faire échouer le test de
fumée, ce qui est précisément arrivé sur la PR #35. Une série vide n'affiche
aucune trajectoire, ce qui est le bon comportement tant qu'il n'y a pas deux
relevés.

Ne pas modifier ces fichiers à la main : ils sont réécrits par le job, et une
saisie manuelle ferait passer une trajectoire inventée pour une mesure.
