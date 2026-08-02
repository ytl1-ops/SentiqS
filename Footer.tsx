/**
 * Format un timestamp ISO en texte relatif ("il y a 5 min", "3h ago", etc.)
 */
export function formatTimeSince(iso: string, locale: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const isFr = locale.startsWith('fr');

  if (diffMin < 1) return isFr ? "À l'instant" : 'Just now';
  if (diffMin < 60) return isFr ? `Il y a ${diffMin} min` : `${diffMin} min ago`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return isFr ? `Il y a ${diffH}h` : `${diffH}h ago`;

  return (
    d.toLocaleDateString(isFr ? 'fr-FR' : 'en-US', { day: '2-digit', month: 'short' }) +
    ' ' +
    d.toLocaleTimeString(isFr ? 'fr-FR' : 'en-US', { hour: '2-digit', minute: '2-digit' })
  );
}

/**
 * Format un timestamp ISO en date + heure absolue (ex: "12 mars 14:30", "Mar 12, 14:30").
 * @param iso Timestamp ISO
 * @param locale Locale (ex: 'fr', 'en-US')
 * @param includeYear Si true, ajoute l'année (ex: "12 mars 2025 14:30")
 */
export function formatDateTime(iso: string, locale: string, includeYear = false): string {
  const d = new Date(iso);
  const isFr = locale.startsWith('fr');
  const loc = isFr ? 'fr-FR' : 'en-US';
  const dateOpts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' };
  if (includeYear) dateOpts.year = 'numeric';
  return d.toLocaleDateString(loc, dateOpts) + ' ' + d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
}