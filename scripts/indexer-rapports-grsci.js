// Reconstruit web/rapports/GRSCI/index.json à partir des fichiers présents
// (appelé par le workflow après la conversion en PDF). Voir reconstruireIndex.
const path = require('node:path');
const { reconstruireIndex } = require('./lib/rapport-grsci');
const racine = process.env.RACINE_RAPPORTS_GRSCI || path.join(__dirname, '..', 'web', 'rapports', 'GRSCI');
const r = reconstruireIndex(racine);
console.log('index GRSCI : ' + r.map((x) => x.mois + ' [' + x.formats.join(',') + ']').join(', '));
