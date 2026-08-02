// Utilitaire audio pour les alertes critiques
// Utilise l'API Web Audio pour générer des sons sans fichiers externes

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  // Réveiller le contexte s'il est suspendu (politique autoplay des navigateurs)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

/**
 * Joue un son de notification d'alerte critique :
 * motif à 3 bips rapides ascendants — distinctif mais pas agressif.
 * Le motif : bip grave → bip médium → bip aigu, espacés de 120ms, chaque bip durant 100ms.
 */
export function playCriticalAlertSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Fréquences des 3 bips (montée progressive)
    const frequencies = [880, 1100, 1320]; // A5 → C#6 → E6
    const bipDuration = 0.1;  // 100ms par bip
    const bipGap = 0.12;      // 120ms entre chaque début de bip

    frequencies.forEach((freq, index) => {
      const startTime = now + index * bipGap;

      // Oscillateur — onde sinusoïdale pure
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      // Enveloppe de gain — attaque rapide, decay doux
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.3, startTime + 0.008);    // attaque 8ms
      gain.gain.setValueAtTime(0.3, startTime + 0.04);              // plateau 32ms
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + bipDuration); // decay

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + bipDuration);
    });
  } catch {
    // Silencieux si l'API audio n'est pas disponible (ex: Node SSR)
  }
}

/**
 * Joue un bip simple pour les alertes non-critiques (plus discret).
 * Un seul bip medium à 1000Hz, 80ms.
 */
export function playSimpleBeep(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1000, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.2, now + 0.005);
    gain.gain.setValueAtTime(0.2, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.08);
  } catch {
    // Silencieux
  }
}

// Préchauffer le contexte audio au premier clic utilisateur
// (les navigateurs exigent une interaction utilisateur avant de jouer du son)
let contextPreheated = false;

export function preheatAudioContext(): void {
  if (contextPreheated) return;
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    contextPreheated = true;
  } catch {
    // Silencieux
  }
}