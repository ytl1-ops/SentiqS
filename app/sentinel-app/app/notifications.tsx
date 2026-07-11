import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getNotifications, markNotificationRead, type Notification } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Colors, Spacing, Radius } from '../constants/theme';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const TYPE_ICON: Record<Notification['type'], any> = {
  info: 'information-circle-outline',
  alert: 'warning-outline',
  expiry: 'time-outline',
  system: 'settings-outline',
};

const TYPE_COLOR: Record<Notification['type'], string> = {
  info: Colors.primary,
  alert: Colors.danger,
  expiry: Colors.warning,
  system: Colors.textSecond,
};

export default function NotificationsScreen() {
  const { profile } = useAuth();
  const router = useRouter();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { loadData(); }, [profile?.id]);

  async function loadData() {
    if (!profile?.id) { setLoading(false); return; }
    setLoading(true);
    try {
      setNotifs(await getNotifications(profile.id));
    } catch {
      setNotifs(DEMO_NOTIFS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [profile?.id]);

  async function handlePress(notif: Notification) {
    if (!notif.is_read) {
      setNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      await markNotificationRead(notif.id).catch(() => {});
    }
  }

  const unreadCount = notifs.filter(n => !n.is_read).length;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={s.headerTitle}>Notifications</Text>
          {unreadCount > 0 && <Text style={s.headerSub}>{unreadCount} non lue{unreadCount > 1 ? 's' : ''}</Text>}
        </View>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} size="large" />
      ) : (
        <FlatList
          data={notifs}
          keyExtractor={n => n.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          contentContainerStyle={{ paddingBottom: 20, flexGrow: 1 }}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="notifications-off-outline" size={36} color={Colors.textMuted} />
              <Text style={s.emptyTxt}>Aucune notification pour le moment.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={[s.card, !item.is_read && s.cardUnread]} onPress={() => handlePress(item)}>
              <View style={[s.iconWrap, { backgroundColor: TYPE_COLOR[item.type] + '1A' }]}>
                <Ionicons name={TYPE_ICON[item.type]} size={18} color={TYPE_COLOR[item.type]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{item.title}</Text>
                {!!item.body && <Text style={s.cardBody} numberOfLines={2}>{item.body}</Text>}
                <Text style={s.cardTime}>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: fr })}</Text>
              </View>
              {!item.is_read && <View style={s.unreadDot} />}
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ── Données démo ──────────────────────────────────────────────
const DEMO_NOTIFS: Notification[] = [
  { id: 'n1', user_id: '', title: 'Alerte sécuritaire critique — CEDEAO', body: "Sommet d'urgence convoqué à Abuja sur la sécurité au Sahel.", type: 'alert', is_read: false, created_at: new Date().toISOString() },
  { id: 'n2', user_id: '', title: 'Votre essai gratuit expire bientôt', body: "Il vous reste 2 jours d'accès. Passez à un abonnement pour continuer.", type: 'expiry', is_read: false, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 'n3', user_id: '', title: 'Nouveau rapport disponible', body: 'Le rapport hebdomadaire SENTINEL est prêt au téléchargement.', type: 'info', is_read: true, created_at: new Date(Date.now() - 86400000).toISOString() },
];

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  header: { backgroundColor: Colors.dark, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 2 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#fff', textAlign: 'center' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', textAlign: 'center', marginTop: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyTxt: { fontSize: 13, color: Colors.textSecond, marginTop: 10, textAlign: 'center' },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  cardUnread: { backgroundColor: Colors.primaryLight },
  iconWrap: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 13, fontWeight: '600', color: Colors.text, marginBottom: 2 },
  cardBody: { fontSize: 12, color: Colors.textSecond, lineHeight: 16, marginBottom: 4 },
  cardTime: { fontSize: 10, color: Colors.textMuted },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary, marginTop: 4 },
});
