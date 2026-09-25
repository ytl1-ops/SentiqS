import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseUrl = process.env.PREVIEW_URL || 'http://127.0.0.1:5173';
const outputDir = process.env.CAPTURE_DIR || './captures/design';

const palettes = {
  'sentinel-night': {
    background: '#081018',
    panel: '#0f172a',
    panelAlt: '#111c2e',
    border: '#334155',
    text: '#e2e8f0',
    muted: '#94a3b8',
    accent: '#22d3ee',
    accentSoft: '#67e8f9',
  },
  'graphite-cyan': {
    background: '#111315',
    panel: '#1b1f23',
    panelAlt: '#252b31',
    border: '#3f4a54',
    text: '#f1f5f9',
    muted: '#a7b0ba',
    accent: '#5eead4',
    accentSoft: '#99f6e4',
  },
  'light-command': {
    background: '#edf2f7',
    panel: '#ffffff',
    panelAlt: '#f8fafc',
    border: '#cbd5e1',
    text: '#0f172a',
    muted: '#475569',
    accent: '#0e7490',
    accentSoft: '#0891b2',
  },
};

const routes = [
  { name: 'home', path: '/' },
  { name: 'login', path: '/login' },
  { name: 'dashboard', path: '/dashboard' },
];

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile', width: 390, height: 844 },
];

function paletteCss(palette) {
  return `
    :root {
      --preview-background: ${palette.background};
      --preview-panel: ${palette.panel};
      --preview-panel-alt: ${palette.panelAlt};
      --preview-border: ${palette.border};
      --preview-text: ${palette.text};
      --preview-muted: ${palette.muted};
      --preview-accent: ${palette.accent};
      --preview-accent-soft: ${palette.accentSoft};
    }
    html, body, #root { background: var(--preview-background) !important; color: var(--preview-text) !important; }
    .bg-sentiqs-gray-bg, main, section { background-color: var(--preview-background) !important; }
    .bg-white, .dark .bg-white, .bg-slate-900\/70 { background-color: var(--preview-panel) !important; }
    .dark\\:bg-sentiqs-crisis-panel, .dark\\:bg-sentiqs-crisis-surface, .dark\\:bg-sentiqs-crisis-surface-alt { background-color: var(--preview-panel) !important; }
    .border-gray-100, .border-gray-200, .border-sentiqs-gray-border, .border-slate-700, .border-slate-800\\/80 { border-color: var(--preview-border) !important; }
    .text-sentiqs-navy, .text-gray-900, .text-gray-800, .text-white { color: var(--preview-text) !important; }
    .text-sentiqs-gray-text, .text-gray-500, .text-gray-600, .text-slate-400, .text-slate-500 { color: var(--preview-muted) !important; }
    .bg-sentiqs-navy, .bg-sentiqs-blue, .bg-cyan-400 { background-color: var(--preview-accent) !important; }
    .text-sentiqs-blue, .text-cyan-300, .text-cyan-200 { color: var(--preview-accent-soft) !important; }
    input, select { background-color: var(--preview-panel-alt) !important; color: var(--preview-text) !important; border-color: var(--preview-border) !important; }
    button:hover { filter: brightness(1.08); }
  `;
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

try {
  for (const [paletteName, palette] of Object.entries(palettes)) {
    for (const viewport of viewports) {
      for (const route of routes) {
        const page = await browser.newPage({ viewport });
        await page.goto(`${baseUrl}${route.path}`, { waitUntil: 'networkidle', timeout: 60000 });
        await page.addStyleTag({ content: paletteCss(palette) });
        await page.waitForTimeout(500);
        const file = `${outputDir}/${paletteName}-${viewport.name}-${route.name}.png`;
        await page.screenshot({ path: file, fullPage: true });
        console.log(`Capture OK: ${file} (${page.url()})`);
        await page.close();
      }
    }
  }
} finally {
  await browser.close();
}
