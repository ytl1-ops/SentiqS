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

const SEEN_ALERTS_KEY = 'sentinel_seen_alert_ids';
const MAX_SEEN_TRACKED = 200;
const CHANNEL_ID = 'alertes-critiques';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotificationSetup(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Alertes critiques',
      importance: Notifications.AndroidImportance.MAX,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      vibrationPattern: [0, 250, 250, 250],
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

// notifyNewCriticalAlerts(alerts) : declenche une notification locale pour
// chaque alerte de niveau 'critical' jamais notifiee sur cet appareil.
// A appeler apres chaque rafraichissement du flux d'alertes (voir feed.tsx).
export async function notifyNewCriticalAlerts(alerts: SentinelAlert[]): Promise<void> {
  const critiques = alerts.filter(a => a.level === 'critical');
  if (!critiques.length) return;

  const seen = await getSeenAlertIds();
  const nouvelles = critiques.filter(a => !seen.has(a.id));
  if (!nouvelles.length) return;

  const { status } = await Notifications.getPermissionsAsync();
  if (status === 'granted') {
    for (const alert of nouvelles) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🔴 Alerte critique SENTINEL',
          body: alert.title,
          sound: true,
          ...(Platform.OS === 'android' ? { priority: Notifications.AndroidNotificationPriority.MAX } : {}),
          data: { alertId: alert.id },
        },
        // Sur Android, un trigger (meme quasi-immediat) est necessaire pour
        // rattacher la notification au canal 'alertes-critiques' (importance
        // MAX + visibilite ecran verrouille) plutot qu'au canal par defaut.
        trigger: Platform.OS === 'android'
          ? { seconds: 1, channelId: CHANNEL_ID } as Notifications.TimeIntervalTriggerInput
          : null,
      });
    }
  }
  await markAlertsSeen(nouvelles.map(a => a.id));
}
