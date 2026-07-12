import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Alert as SentinelAlert } from './sentinel-api';

// Notifications LOCALES uniquement : programmees directement depuis l'appareil,
// sans serveur. Elles s'affichent sur l'ecran verrouille (canal Android en
// importance MAX + visibilite PUBLIC, comportement par defaut sur iOS une
// fois la permission accordee), mais ne se declenchent que pendant que l'app
// a l'occasion de s'executer (voir notifyNewCriticalAlerts). De vraies
// notifications push (declenchees par un serveur, meme app fermee) demandent
// un backend qui n'existe pas encore pour le moteur SENTINEL.
//
// "Comme Facebook" : ce fichier reproduit ce qui est atteignable avec l'API
// managee d'Expo — regroupement en un seul resume quand plusieurs alertes
// arrivent ensemble (au lieu de spammer une notif par alerte), badge de
// compteur sur l'icone de l'app, couleur d'accent, et regroupement par fil
// sur iOS (threadIdentifier). CE QUI RESTE HORS DE PORTEE sans ejecter du
// workflow managed Expo vers du code natif : vignette/avatar personnalise
// par notification (BigPictureStyle Android), et boutons d'action integres
// a la notification (ex. "Voir" / "Ignorer" sans ouvrir l'app).

const SEEN_ALERTS_KEY = 'sentinel_seen_alert_ids';
const BADGE_COUNT_KEY = 'sentinel_badge_count';
const MAX_SEEN_TRACKED = 200;
const CHANNEL_ID = 'alertes-critiques';
const THREAD_ID = 'sentinel-alertes-critiques';
const ACCENT_CRITICAL = '#991B1B';
const ACCENT_HIGH = '#B45309'; // aligne sur Colors.warning utilise ailleurs dans l'app

type Severite = 'critical' | 'high';
const SEVERITE_META: Record<Severite, { emoji: string; label: string; color: string }> = {
  critical: { emoji: '🔴', label: 'critique', color: ACCENT_CRITICAL },
  high:     { emoji: '🟠', label: 'élevée', color: ACCENT_HIGH },
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function ensureNotificationSetup(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Alertes critiques',
      importance: Notifications.AndroidImportance.MAX,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: ACCENT_CRITICAL,
    });
  }
  const { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') {
    await Notifications.requestPermissionsAsync();
  }
}

async function getSeenAlertIds(): Promise<Set<string>> {
  const raw = await AsyncStorage.getItem(SEEN_ALERTS_KEY);
  return new Set<string>(raw ? JSON.parse(raw) : []);
}

async function markAlertsSeen(ids: string[]): Promise<void> {
  const seen = await getSeenAlertIds();
  ids.forEach(id => seen.add(id));
  const trimmed = Array.from(seen).slice(-MAX_SEEN_TRACKED);
  await AsyncStorage.setItem(SEEN_ALERTS_KEY, JSON.stringify(trimmed));
}

async function bumpBadge(by: number): Promise<void> {
  const raw = await AsyncStorage.getItem(BADGE_COUNT_KEY);
  const count = Math.max(0, (raw ? parseInt(raw, 10) : 0) + by);
  await AsyncStorage.setItem(BADGE_COUNT_KEY, String(count));
  await Notifications.setBadgeCountAsync(count);
}

// clearBadge() : a appeler quand l'utilisateur consulte les alertes dans
// l'app (remet le badge de l'icone a zero, comme ouvrir l'app Facebook).
export async function clearBadge(): Promise<void> {
  await AsyncStorage.setItem(BADGE_COUNT_KEY, '0');
  await Notifications.setBadgeCountAsync(0);
}

function androidTrigger(): Notifications.TimeIntervalTriggerInput | null {
  // Sur Android, un trigger (meme quasi-immediat) est necessaire pour
  // rattacher la notification au canal 'alertes-critiques' (importance MAX +
  // visibilite ecran verrouille) plutot qu'au canal par defaut.
  return Platform.OS === 'android'
    ? ({ seconds: 1, channelId: CHANNEL_ID } as Notifications.TimeIntervalTriggerInput)
    : null;
}

async function notifierPourSeverite(nouvelles: SentinelAlert[], sev: Severite): Promise<void> {
  if (!nouvelles.length) return;
  const meta = SEVERITE_META[sev];
  if (nouvelles.length === 1) {
    const alert = nouvelles[0];
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${meta.emoji} Alerte ${meta.label} SENTINEL`,
        body: alert.title,
        sound: true,
        color: meta.color,
        threadIdentifier: THREAD_ID,
        ...(Platform.OS === 'android' ? { priority: Notifications.AndroidNotificationPriority.MAX } : {}),
        data: { alertId: alert.id },
      },
      trigger: androidTrigger(),
    });
  } else {
    const apercu = nouvelles.slice(0, 2).map(a => a.title).join(' · ');
    const reste = nouvelles.length - 2;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `${meta.emoji} ${nouvelles.length} nouvelles alertes ${meta.label}s SENTINEL`,
        body: reste > 0 ? `${apercu} et ${reste} autre${reste > 1 ? 's' : ''}` : apercu,
        sound: true,
        color: meta.color,
        threadIdentifier: THREAD_ID,
        ...(Platform.OS === 'android' ? { priority: Notifications.AndroidNotificationPriority.MAX } : {}),
        data: { alertIds: nouvelles.map(a => a.id) },
      },
      trigger: androidTrigger(),
    });
  }
}

// notifyNewCriticalAlerts(alerts) : declenche une notification locale pour
// les alertes de niveau 'critical' ET 'high' jamais notifiees sur cet
// appareil (etendu sur demande explicite — auparavant 'critical' seul).
// Comme Facebook regroupe les evenements simultanes ("Alice et 4 autres ont
// commente"), plusieurs nouvelles alertes de MEME severite arrivees en meme
// temps sont regroupees en UNE notification resume plutot que d'en empiler
// une par alerte ; critique et elevee restent notifiees separement (couleur
// et libelle differents). A appeler apres chaque rafraichissement du flux
// (voir feed.tsx). La vibration est deja geree au niveau du canal Android
// (vibrationPattern dans ensureNotificationSetup), pas par appel.
export async function notifyNewCriticalAlerts(alerts: SentinelAlert[]): Promise<void> {
  const pertinentes = alerts.filter(a => a.level === 'critical' || a.level === 'high');
  if (!pertinentes.length) return;

  const seen = await getSeenAlertIds();
  const nouvelles = pertinentes.filter(a => !seen.has(a.id));
  if (!nouvelles.length) return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') {
    await notifierPourSeverite(nouvelles.filter(a => a.level === 'critical'), 'critical');
    await notifierPourSeverite(nouvelles.filter(a => a.level === 'high'), 'high');
    await bumpBadge(nouvelles.length);
  }
  await markAlertsSeen(nouvelles.map(a => a.id));
}
