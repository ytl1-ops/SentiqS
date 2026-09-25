# Validation visuelle des palettes

Le script `scripts/screenshot-design-palettes.mjs` produit des captures comparables de la landing page, du login et du dashboard avec trois palettes :

- `sentinel-night` : bleu nuit + cyan, orientée salle de crise ;
- `graphite-cyan` : graphite neutre + turquoise, plus sobre ;
- `light-command` : variante claire pour une utilisation diurne.

Depuis la racine du dépôt :

```bash
npm install --no-save playwright@1
npx playwright install chromium
npm run dev -- --host 127.0.0.1
```

Dans un autre terminal :

```bash
node scripts/screenshot-design-palettes.mjs
```

Les fichiers sont écrits dans `captures/design/`. Pour viser une autre instance :

```bash
PREVIEW_URL=https://ytl1-ops.github.io/SentiqS/SentiqS_Web.html \
node scripts/screenshot-design-palettes.mjs
```

Le dashboard protégé peut rediriger vers `/login` si aucune session Supabase n'est disponible ; le script conserve néanmoins la capture et journalise l'URL réellement affichée.
