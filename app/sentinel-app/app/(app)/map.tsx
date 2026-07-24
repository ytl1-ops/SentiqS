import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getMapPoints, isDemoMode, type MapPoint } from '../../lib/sentinel-api';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, Radius, COUNTRIES_CEDEAO } from '../../constants/theme';

const TYPES = [
  { key: 'all', label: 'Tout', icon: 'apps-outline' as const },
  { key: 'security', label: 'Sécurité', icon: 'shield-outline' as const },
  { key: 'food', label: 'Alimentaire', icon: 'restaurant-outline' as const },
  { key: 'economy', label: 'Économie', icon: 'trending-up-outline' as const },
];

const SEVERITY_COLOR: Record<MapPoint['severity'], string> = {
  critical: Colors.danger,
  high: Colors.warning,
  medium: '#D97706',
  low: Colors.success,
};

const SEVERITY_BG: Record<MapPoint['severity'], string> = {
  critical: Colors.dangerBg,
  high: Colors.warningBg,
  medium: Colors.warningBg,
  low: Colors.successBg,
};

const SEVERITY_RANK: Record<MapPoint['severity'], number> = {
  critical: 3, high: 2, medium: 1, low: 0,
};

const SEVERITY_LABEL: Record<MapPoint['severity'], string> = {
  critical: 'Critique', high: 'Élevé', medium: 'Modéré', low: 'Faible',
};

const TYPE_ICON: Record<MapPoint['type'], any> = {
  security: 'shield-outline',
  food: 'restaurant-outline',
  economy: 'trending-up-outline',
};

export default function MapScreen() {
  const { canViewMap, isAdmin } = useAuth();
  const [points, setPoints] = useState<MapPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('all');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(isDemoMode());

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      setPoints(await getMapPoints());
      setIsDemo(false);
    } catch {
      setPoints(DEMO_POINTS);
      setIsDemo(true);
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(
    () => points.filter(p => type === 'all' || p.type === type),
    [points, type]
  );

  const byCountry = useMemo(() => {
    const groups: Record<string, MapPoint[]> = {};
    for (const p of filtered) {
      (groups[p.country] ||= []).push(p);
    }
    return Object.entries(groups)
      .map(([country, pts]) => ({
        country,
        points: pts,
        maxSeverity: pts.reduce<MapPoint['severity']>(
          (max, p) => (SEVERITY_RANK[p.severity] > SEVERITY_RANK[max] ? p.severity : max),
          'low'
        ),
      }))
      .sort((a, b) => SEVERITY_RANK[b.maxSeverity] - SEVERITY_RANK[a.maxSeverity]);
  }, [filtered]);

  const criticalCount = filtered.filter(p => p.severity === 'critical').length;
  const selectedPoints = selectedCountry ? byCountry.find(g => g.country === selectedCountry)?.points ?? [] : [];

  if (!canViewMap && !isAdmin) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Ionicons name="map-outline" size={48} color={Colors.textMuted} />
        <Text style={s.upgradeTitle}>Carte non incluse</Text>
        <Text style={s.upgradeSub}>La cartographie des risques est disponible à partir du plan Mensuel.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <View style={s.headerTitleRow}>
          <Text style={s.headerTitle}>Carte des risques</Text>
          {isDemo && (
            <View style={s.demoDot}>
              <Text style={s.demoText}>Démo</Text>
            </View>
          )}
        </View>
        <Text style={s.headerSub}>Afrique de l'Ouest · surveillance géospatiale</Text>
      </View>

      <View style={s.statsRow}>
        <View style={s.statItem}><Text style={s.statN}>{filtered.length}</Text><Text style={s.statL}>Points actifs</Text></View>
        <View style={s.statItem}><Text style={[s.statN, { color: Colors.danger }]}>{criticalCount}</Text><Text style={s.statL}>Critiques</Text></View>
        <View style={s.statItem}><Text style={s.statN}>{byCountry.length}</Text><Text style={s.statL}>Pays touchés</Text></View>
      </View>

      <FlatList
        data={TYPES}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingVertical: 8 }}
        keyExtractor={i => i.key}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[s.typeChip, type === item.key && s.typeChipActive]}
            onPress={() => { setType(item.key); setSelectedCountry(null); }}
              accessibilityRole="button"
              accessibilityLabel={`Filtrer par ${item.label}`}
              accessibilityState={{ selected: type === item.key }}
          >
            <Ionicons name={item.icon} size={13} color={type === item.key ? Colors.primary : Colors.textSecond} />
            <Text style={[s.typeText, type === item.key && s.typeTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        )}
      />

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} size="large" />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
          <View style={s.legendRow}>
            {(['critical', 'high', 'medium', 'low'] as const).map(sev => (
              <View key={sev} style={s.legendItem}>
                <View style={[s.legendDot, { backgroundColor: SEVERITY_COLOR[sev] }]} />
                <Text style={s.legendTxt}>{SEVERITY_LABEL[sev]}</Text>
              </View>
            ))}
          </View>

          <View style={s.grid}>
            {byCountry.map(({ country, points: pts, maxSeverity }) => {
              const countryInfo = COUNTRIES_CEDEAO.find(c => c.code === country);
              const isSelected = selectedCountry === country;
              return (
                <TouchableOpacity
                  key={country}
                  style={[s.countryCard, { borderColor: SEVERITY_COLOR[maxSeverity] }, isSelected && s.countryCardSelected]}
                  onPress={() => setSelectedCountry(isSelected ? null : country)}
accessibilityRole="button"
                  accessibilityLabel={`${countryInfo?.name ?? country}, ${pts.length} signalaux, sévérité ${SEVERITY_LABEL[maxSeverity]}`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <View style={[s.countryDot, { backgroundColor: SEVERITY_COLOR[maxSeverity] }]} />
                  <Text style={s.countryName} numberOfLines={1}>{countryInfo?.name ?? country}</Text>
                  <Text style={s.countryCount}>{pts.length} signal{pts.length > 1 ? 'aux' : ''}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {byCountry.length === 0 && (
            <View style={s.empty}>
              <Ionicons name="checkmark-circle-outline" size={36} color={Colors.textMuted} />
              <Text style={s.emptyTxt}>Aucun signal actif pour ce filtre.</Text>
            </View>
          )}

          {selectedCountry && (
            <View style={s.detailZone}>
              <Text style={s.detailTitle}>
                {COUNTRIES_CEDEAO.find(c => c.code === selectedCountry)?.name ?? selectedCountry}
              </Text>
              {selectedPoints.map(p => (
                <View key={p.id} style={s.pointCard}>
                  <View style={[s.pointBadge, { backgroundColor: SEVERITY_BG[p.severity] }]}>
                    <Ionicons name={TYPE_ICON[p.type]} size={14} color={SEVERITY_COLOR[p.severity]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.pointTitle}>{p.title}</Text>
                    <Text style={[s.pointSeverity, { color: SEVERITY_COLOR[p.severity] }]}>{SEVERITY_LABEL[p.severity]}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// ── Données démo ──────────────────────────────────────────────
const DEMO_POINTS: MapPoint[] = [
  { id: 'p1', lat: 12.65, lng: -8.0, title: "Attaque signalée région de Mopti", type: 'security', severity: 'critical', country: 'ML' },
  { id: 'p2', lat: 13.5, lng: 2.1, title: 'Insécurité alimentaire Zinder', type: 'food', severity: 'high', country: 'NE' },
  { id: 'p3', lat: 12.37, lng: -1.53, title: 'Tensions frontalières signalées', type: 'security', severity: 'high', country: 'BF' },
  { id: 'p4', lat: 9.08, lng: 8.68, title: 'Fluctuation monétaire naira', type: 'economy', severity: 'medium', country: 'NG' },
  { id: 'p5', lat: 6.37, lng: 2.42, title: "Campagne anacarde en cours", type: 'economy', severity: 'low', country: 'BJ' },
  { id: 'p6', lat: 9.5, lng: -0.5, title: 'Vigilance zones frontalières nord', type: 'security', severity: 'medium', country: 'GH' },
];

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  header: { backgroundColor: Colors.dark, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  demoDot: { backgroundColor: 'rgba(245,158,11,0.18)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3 },
  demoText: { fontSize: 10, color: '#f59e0b', fontWeight: '700', letterSpacing: 0.5 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  statsRow: { flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRightWidth: 0.5, borderRightColor: Colors.border },
  statN: { fontSize: 15, fontWeight: '600', color: Colors.text },
  statL: { fontSize: 9, color: Colors.textMuted, marginTop: 1 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.white, marginRight: 6 },
  typeChipActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  typeText: { fontSize: 11, color: Colors.textSecond },
  typeTextActive: { color: Colors.primary, fontWeight: '500' },
  legendRow: { flexDirection: 'row', gap: 14, paddingHorizontal: Spacing.lg, paddingBottom: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendTxt: { fontSize: 10, color: Colors.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.md, gap: 8 },
  countryCard: { width: '30%', backgroundColor: Colors.white, borderRadius: Radius.md, borderWidth: 1.5, padding: 10, alignItems: 'center', gap: 4 },
  countryCardSelected: { backgroundColor: Colors.primaryLight },
  countryDot: { width: 10, height: 10, borderRadius: 5 },
  countryName: { fontSize: 11, fontWeight: '600', color: Colors.text, textAlign: 'center' },
  countryCount: { fontSize: 9, color: Colors.textMuted },
  empty: { alignItems: 'center', padding: 40 },
  emptyTxt: { fontSize: 13, color: Colors.textSecond, marginTop: 10, textAlign: 'center' },
  detailZone: { marginTop: 16, paddingHorizontal: Spacing.md },
  detailTitle: { fontSize: 13, fontWeight: '700', color: Colors.text, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  pointCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: Colors.white, borderRadius: Radius.md, padding: 10, marginBottom: 6, borderWidth: 0.5, borderColor: Colors.border },
  pointBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  pointTitle: { fontSize: 12, fontWeight: '500', color: Colors.text, marginBottom: 2 },
  pointSeverity: { fontSize: 10, fontWeight: '600' },
  upgradeTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: 12, textAlign: 'center' },
  upgradeSub: { fontSize: 13, color: Colors.textSecond, textAlign: 'center', marginTop: 6 },
});
