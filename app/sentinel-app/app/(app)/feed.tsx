import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, ActivityIndicator, TextInput, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { getLiveFeed, getActiveAlerts, getEngineStats, type Article, type Alert as SentinelAlert, type Stats } from '../../lib/sentinel-api';
import { trackArticleRead, getArticleReadCount } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const CATEGORIES = [
  { key: 'all', label: 'Tout' },
  { key: 'security', label: 'Sécurité' },
  { key: 'food', label: 'Alimentaire' },
  { key: 'economy', label: 'Économie' },
  { key: 'politics', label: 'Politique' },
  { key: 'health', label: 'Santé' },
  { key: 'environment', label: 'Environnement' },
];

const RELIABILITY_COLOR = (score: number) => {
  if (score >= 85) return Colors.success;
  if (score >= 60) return Colors.warning;
  return Colors.danger;
};

const CATEGORY_DOT: Record<string, string> = {
  security: Colors.danger,
  food: Colors.warning,
  economy: Colors.success,
  politics: Colors.primary,
  health: '#8B5CF6',
  environment: '#059669',
};

export default function FeedScreen() {
  const { profile, subscription, hasAccess, articlesLimit } = useAuth();
  const router = useRouter();

  const [articles, setArticles] = useState<Article[]>([]);
  const [alerts, setAlerts] = useState<SentinelAlert[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [articlesRead, setArticlesRead] = useState(0);

  useEffect(() => { loadData(); }, [category]);
  useEffect(() => {
    if (subscription?.started_at && articlesLimit > 0) {
      getArticleReadCount(profile!.id, subscription.started_at).then(setArticlesRead);
    }
  }, [subscription]);

  async function loadData(reset = true) {
    if (!hasAccess) return;
    if (reset) setLoading(true);
    try {
      const [feedRes, alertRes, statsRes] = await Promise.all([
        getLiveFeed({ page: 1, limit: 20, category: category === 'all' ? undefined : category }),
        getActiveAlerts(),
        getEngineStats(),
      ]);
      setArticles(feedRes.articles);
      setTotal(feedRes.total);
      setPage(1);
      setAlerts(alertRes.slice(0, 3));
      setStats(statsRes);
    } catch {
      // Données de démo si API non disponible
      setArticles(DEMO_ARTICLES);
      setAlerts(DEMO_ALERTS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  const onRefresh = useCallback(() => { setRefreshing(true); loadData(); }, [category]);

  async function loadMore() {
    if (loadingMore || articles.length >= total) return;
    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const res = await getLiveFeed({ page: nextPage, limit: 20, category: category === 'all' ? undefined : category });
      setArticles(prev => [...prev, ...res.articles]);
      setPage(nextPage);
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleArticlePress(article: Article) {
    if (articlesLimit > 0 && articlesRead >= articlesLimit) {
      Alert.alert(
        'Limite atteinte',
        `Votre essai gratuit est limité à ${articlesLimit} articles. Passez à un abonnement pour un accès illimité.`,
        [
          { text: 'Plus tard', style: 'cancel' },
          { text: 'Voir les offres', onPress: () => router.push('/profile') },
        ]
      );
      return;
    }
    if (profile?.id && subscription?.id) {
      await trackArticleRead(profile.id, article.id, subscription.id);
      setArticlesRead(prev => prev + 1);
    }
    // Naviguer vers le détail
    router.push({ pathname: '/(app)/article', params: { id: article.id } });
  }

  const filtered = articles.filter(a =>
    search ? a.title.toLowerCase().includes(search.toLowerCase()) : true
  );

  if (!hasAccess) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Ionicons name="lock-closed-outline" size={48} color={Colors.textMuted} />
        <Text style={{ fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: 12, textAlign: 'center' }}>Accès requis</Text>
        <Text style={{ fontSize: 14, color: Colors.textSecond, textAlign: 'center', marginTop: 6 }}>Votre abonnement a expiré ou n'est pas actif.</Text>
        <TouchableOpacity style={[s.btn, { marginTop: 20 }]} onPress={() => router.push('/profile')}>
          <Text style={s.btnTxt}>Voir les offres</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>SENTINEL</Text>
          <Text style={s.headerSub}>Afrique de l'Ouest · Flux temps réel</Text>
        </View>
        <View style={s.headerRight}>
          {stats && (
            <View style={s.liveDot}>
              <View style={s.livePulse} />
              <Text style={s.liveText}>Live</Text>
            </View>
          )}
          <TouchableOpacity onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={22} color={Colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Stats strip */}
      {stats && (
        <View style={s.statsRow}>
          <View style={s.statItem}><Text style={s.statN}>{stats.sources_count.toLocaleString('fr-FR')}</Text><Text style={s.statL}>Sources</Text></View>
          <View style={s.statItem}><Text style={[s.statN, { color: Colors.success }]}>{stats.avg_reliability}%</Text><Text style={s.statL}>Fiabilité</Text></View>
          <View style={s.statItem}><Text style={[s.statN, { color: Colors.danger }]}>{stats.alerts_active}</Text><Text style={s.statL}>Alertes</Text></View>
          <View style={s.statItem}><Text style={[s.statN, { color: Colors.warning }]}>{stats.fake_news_blocked}</Text><Text style={s.statL}>Infox bloquées</Text></View>
        </View>
      )}

      {/* Trial limit bar */}
      {articlesLimit > 0 && (
        <View style={s.trialBar}>
          <Text style={s.trialTxt}>{articlesRead}/{articlesLimit} articles · Essai</Text>
          <View style={s.trialTrack}><View style={[s.trialFill, { width: `${Math.min(100, articlesRead / articlesLimit * 100)}%` as any }]} /></View>
        </View>
      )}

      {/* Search */}
      <View style={s.searchRow}>
        <Ionicons name="search-outline" size={16} color={Colors.textMuted} style={{ marginRight: 6 }} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher..."
          placeholderTextColor={Colors.textMuted}
        />
        {search ? <TouchableOpacity onPress={() => setSearch('')}><Ionicons name="close-circle" size={16} color={Colors.textMuted} /></TouchableOpacity> : null}
      </View>

      {/* Categories */}
      <FlatList
        data={CATEGORIES}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingVertical: 6 }}
        keyExtractor={i => i.key}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.catChip, category === item.key && s.catChipActive]}
            onPress={() => setCategory(item.key)}
          >
            <Text style={[s.catText, category === item.key && s.catTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Alerts banners */}
      {alerts.map(alert => (
        <View key={alert.id} style={[s.alertBanner, { backgroundColor: alert.level === 'critical' ? Colors.dangerBg : Colors.warningBg }]}>
          <Ionicons name="warning-outline" size={14} color={alert.level === 'critical' ? Colors.danger : Colors.warning} />
          <Text style={[s.alertText, { color: alert.level === 'critical' ? Colors.danger : Colors.warning }]} numberOfLines={1}>
            {alert.title}
          </Text>
          <Text style={[s.alertSrc, { color: alert.level === 'critical' ? Colors.danger : Colors.warning }]}>
            {alert.reliability_score}%
          </Text>
        </View>
      ))}

      {/* Feed */}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} size="large" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={a => a.id}
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
          contentContainerStyle={{ paddingBottom: 20 }}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={Colors.primary} style={{ margin: 16 }} /> : null}
          renderItem={({ item: article }) => (
            <TouchableOpacity style={s.articleCard} onPress={() => handleArticlePress(article)}>
              <View style={s.articleLeft}>
                <View style={[s.categoryDot, { backgroundColor: CATEGORY_DOT[article.category] || Colors.primary }]} />
              </View>
              <View style={s.articleBody}>
                <Text style={s.articleTitle} numberOfLines={2}>{article.title}</Text>
                <Text style={s.articleSummary} numberOfLines={1}>{article.summary}</Text>
                <View style={s.articleMeta}>
                  <Text style={s.articleSrc}>{article.source}</Text>
                  <View style={[s.relBadge, { backgroundColor: article.reliability_score >= 85 ? Colors.successBg : article.reliability_score >= 60 ? Colors.warningBg : Colors.dangerBg }]}>
                    <Text style={[s.relText, { color: RELIABILITY_COLOR(article.reliability_score) }]}>{article.reliability_score}%</Text>
                  </View>
                  {article.is_verified && (
                    <View style={s.verifiedBadge}>
                      <Ionicons name="checkmark-circle" size={11} color={Colors.success} />
                      <Text style={s.verifiedText}>{article.cross_check_count} src</Text>
                    </View>
                  )}
                  {article.is_flagged && (
                    <View style={s.flagBadge}>
                      <Text style={s.flagText}>⚠ Non vérifié</Text>
                    </View>
                  )}
                  <Text style={s.articleTime}>
                    {format(new Date(article.published_at), 'HH:mm', { locale: fr })}
                  </Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

// ── Données démo ──────────────────────────────────────────────
export const DEMO_ARTICLES: Article[] = [
  { id: '1', title: "Sommet CEDEAO d'urgence convoqué à Abuja — 2 juillet 2026", summary: "Les chefs d'État se réuniront en session extraordinaire sur la sécurité au Sahel.", source: 'AFP · RFI', source_url: 'https://rfi.fr', reliability_score: 95, category: 'security', tags: ['CEDEAO','Sahel'], country: 'NG', published_at: new Date().toISOString(), is_verified: true, cross_check_count: 4, cross_check_sources: [], is_flagged: false },
  { id: '2', title: 'FAO : 7,4 millions de personnes en insécurité alimentaire sévère', summary: 'Projection pour la période de soudure août 2026 dans le Liptako-Gourma.', source: 'FAO · ReliefWeb', source_url: 'https://fao.org', reliability_score: 97, category: 'food', tags: ['FAO','Sahel'], country: 'ML', published_at: new Date(Date.now()-1800000).toISOString(), is_verified: true, cross_check_count: 3, cross_check_sources: [], is_flagged: false },
  { id: '3', title: 'Bénin : la filière anacarde franchit 1 million de tonnes exportées', summary: "Record historique pour la campagne 2025-2026.", source: 'AFP · BBC Afrique', source_url: 'https://bbc.com/afrique', reliability_score: 90, category: 'economy', tags: ['Bénin','Anacarde'], country: 'BJ', published_at: new Date(Date.now()-3600000).toISOString(), is_verified: true, cross_check_count: 3, cross_check_sources: [], is_flagged: false },
  { id: '4', title: 'Rumeur : panne électrique nationale au Burkina Faso', summary: 'Information non confirmée. SENTINEL recommande d\'attendre une 2e source.', source: 'Twitter/X', source_url: 'https://x.com', reliability_score: 32, category: 'politics', tags: ['Burkina','Infox'], country: 'BF', published_at: new Date(Date.now()-7200000).toISOString(), is_verified: false, cross_check_count: 0, cross_check_sources: [], is_flagged: true, flag_reason: 'Aucune source officielle' },
  { id: '5', title: 'ACLED : +34% incidents sécuritaires au Sahel Q2 2026', summary: 'Le rapport trimestriel ACLED documente 447 événements au Burkina, 312 au Mali.', source: 'ACLED', source_url: 'https://acleddata.com', reliability_score: 94, category: 'security', tags: ['ACLED','Sahel'], country: 'BF', published_at: new Date(Date.now()-9000000).toISOString(), is_verified: true, cross_check_count: 2, cross_check_sources: [], is_flagged: false },
];

const DEMO_ALERTS: SentinelAlert[] = [
  { id: 'a1', title: "Sommet CEDEAO d'urgence — Abuja 2 juillet", body: '', level: 'critical', category: 'security', countries: ['NG'], reliability_score: 95, source: 'AFP', created_at: new Date().toISOString() },
  { id: 'a2', title: 'FAO : alerte alimentaire Sahel — 7,4M personnes', body: '', level: 'high', category: 'food', countries: ['ML','BF','NE'], reliability_score: 97, source: 'FAO', created_at: new Date().toISOString() },
];

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  header: { backgroundColor: Colors.dark, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff', letterSpacing: 1.5 },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  liveDot: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  livePulse: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
  liveText: { fontSize: 10, color: '#ef4444', fontWeight: '600' },
  statsRow: { flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRightWidth: 0.5, borderRightColor: Colors.border },
  statN: { fontSize: 15, fontWeight: '600', color: Colors.text },
  statL: { fontSize: 9, color: Colors.textMuted, marginTop: 1 },
  trialBar: { backgroundColor: Colors.warningBg, paddingHorizontal: 14, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 10 },
  trialTxt: { fontSize: 11, color: Colors.warning, fontWeight: '500', width: 120 },
  trialTrack: { flex: 1, height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.1)' },
  trialFill: { height: 4, borderRadius: 2, backgroundColor: Colors.warning },
  searchRow: { flexDirection: 'row', alignItems: 'center', margin: Spacing.sm, backgroundColor: Colors.white, borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 7 },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text },
  catChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.white, marginRight: 6 },
  catChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  catText: { fontSize: 11, color: Colors.textSecond },
  catTextActive: { color: Colors.primary, fontWeight: '500' },
  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6 },
  alertText: { flex: 1, fontSize: 11, fontWeight: '500' },
  alertSrc: { fontSize: 10, fontWeight: '600' },
  articleCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingHorizontal: 14, paddingVertical: 11, backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  articleLeft: { paddingTop: 5 },
  categoryDot: { width: 8, height: 8, borderRadius: 4 },
  articleBody: { flex: 1 },
  articleTitle: { fontSize: 13, fontWeight: '500', color: Colors.text, lineHeight: 18, marginBottom: 3 },
  articleSummary: { fontSize: 11, color: Colors.textSecond, lineHeight: 16, marginBottom: 5 },
  articleMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 5 },
  articleSrc: { fontSize: 10, color: Colors.textMuted },
  relBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  relText: { fontSize: 10, fontWeight: '600' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  verifiedText: { fontSize: 10, color: Colors.success },
  flagBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3, backgroundColor: Colors.warningBg },
  flagText: { fontSize: 9, color: Colors.warning },
  articleTime: { fontSize: 10, color: Colors.textMuted, marginLeft: 'auto' },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 24, paddingVertical: 12 },
  btnTxt: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
