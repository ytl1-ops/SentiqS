// Utilitaire pour générer un favicon avec badge de notification
// Utilise l'API Canvas pour dessiner un favicon dynamique

const BASE_TITLE = 'SentiqS — Veille Sûreté Afrique';

let originalFaviconHref: string | null = null;
let currentLink: HTMLLinkElement | null = null;

function getOrCreateFaviconLink(): HTMLLinkElement {
  if (currentLink) return currentLink;

  // Chercher le link favicon existant
  let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'icon';
    link.type = 'image/png';
    document.head.appendChild(link);
  }

  // Sauvegarder le href original
  if (!originalFaviconHref) {
    originalFaviconHref = link.href;
  }

  currentLink = link;
  return link;
}

/**
 * Dessine un favicon avec un badge de notification.
 * @param count - Nombre d'alertes non lues (0 = pas de badge)
 */
export function setFaviconBadge(count: number): void {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Fond : carré arrondi sombre (style SentiqS)
  ctx.beginPath();
  ctx.roundRect(2, 2, 28, 28, 5);
  ctx.fillStyle = '#0A192F';
  ctx.fill();

  // Texte "S" central
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 18px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('S', 16, 16);

  if (count > 0) {
    // Badge rouge en bas à droite
    const badgeX = 24;
    const badgeY = 24;
    const badgeRadius = 10;

    // Cercle rouge
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#EF4444';
    ctx.fill();

    // Bordure blanche fine
    ctx.beginPath();
    ctx.arc(badgeX, badgeY, badgeRadius, 0, Math.PI * 2);
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Chiffre
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 9px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const displayCount = count > 99 ? '99+' : String(count);
    // Ajuster la taille si 2 chiffres
    if (displayCount.length >= 2) {
      ctx.font = 'bold 7px Inter, sans-serif';
    }
    if (displayCount.length >= 3) {
      ctx.font = 'bold 6px Inter, sans-serif';
    }
    ctx.fillText(displayCount, badgeX, badgeY);
  }

  // Appliquer comme favicon
  const link = getOrCreateFaviconLink();
  link.href = canvas.toDataURL('image/png');
}

/**
 * Restaure le favicon original (sans badge).
 */
export function resetFavicon(): void {
  const link = getOrCreateFaviconLink();
  if (originalFaviconHref) {
    link.href = originalFaviconHref;
  }
}

/**
 * Met à jour le titre de l'onglet avec le compteur d'alertes.
 * @param count - Nombre d'alertes non lues (0 = titre normal)
 */
export function setTabTitle(count: number): void {
  if (count > 0) {
    document.title = `(${count}) ⚠ ${BASE_TITLE}`;
  } else {
    document.title = BASE_TITLE;
  }
}