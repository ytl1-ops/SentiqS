# Agent Skills du dépôt

Installés le 26/11/2026 à la demande de YORO, depuis
[anthropics/skills](https://github.com/anthropics/skills), commit
`e4bb5d960d87126ff3b3a8af1a104b7db67560ba` (16/11/2026). Licence Apache 2.0
(fichier `LICENSE.txt` de chaque skill). Copiés tels quels, sans modification :
pour les mettre à jour, recopier le dossier depuis un commit plus récent et
relire le `SKILL.md`.

| Skill | Pourquoi il est là |
|---|---|
| `pptx` | La Présentation 1 et les exports PowerPoint sont faits avec pptxgenjs ; le skill porte ses pièges (couleurs, `&` non échappé) et un validateur XML. |
| `docx` | Exports Word et version Word de la Présentation 1 (docx-js) : largeurs de tableau en DXA, rendu LibreOffice pour relire. |
| `pdf` | Lire, découper, vérifier les PDF produits (rapport mensuel, exports). |
| `webapp-testing` | Piloter la page dans Playwright pour vérifier une modification sur le DOM rendu. |
| `frontend-design` | Principes de mise en page pour l'accueil et l'interface. |

**Les règles du projet priment.** `CLAUDE.md` l'emporte sur un skill en cas
de désaccord : direction « Bleu nuit », couleurs de gravité intouchables,
rapports générés à la demande et jamais modifiés sans demande, Chromium
sans `playwright install`, vérification avant/après des exports.

**Écartés après lecture** : les skills communautaires « OSINT » et
« red team » trouvés sur GitHub (reconnaissance offensive, validateurs
d'identifiants) n'ont pas leur place dans un outil de veille ; `xlsx`,
`skill-creator` et les skills de création graphique n'apportent rien au
travail courant ici.

Relu avant installation : chaque `SKILL.md`, et les scripts (aucun appel
réseau ; `office/soffice.py` compile en local une petite cale C pour que
LibreOffice fonctionne quand les sockets Unix sont bloqués).
