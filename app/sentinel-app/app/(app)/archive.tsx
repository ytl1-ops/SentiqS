import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, ActivityIndicator, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { searchHistory, type Article } from '../../lib/sentinel-api';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const PRESETS = [
  'Crise sécuritaire Sahel 2023',
  'Insécurité alimentaire Niger 2022',
  "Coup d'état Burkina 2022",
  'Coup d\'état Niger 2023',
  'Élections Bénin 2021',
  'COVID-19 Afrique de l\'Ouest 2020',
  'Retrait MINUSMA Mali 2023',
  'Alliance États du Sahel 2024',
];

export default function ArchiveScreen() {
  const { subscription, canViewArchive, isAdmin } = useAuth();
  const [query, setQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('2020-01-01');
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('');
  const [country, setCountry] = useState('');
  const [results, setResults] = useState<Article[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const archiveYears = isAdmin ? 10 : (subscription?.plan_features?.archive_years ?? 0);
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - archiveYears);

  async function handleSearch(q?: string) {
    const searchQuery = q || query;
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await searchHistory({
        query: searchQuery.trim(),
        date_from: dateFrom,
        date_to: dateTo,
        category: category || undefined,
        country: country || undefined,
        limit: 30,
      });
      setResults(res.articles);
      setTotal(res.total);
    } catch {
      // Données démo
      setResults(DEMO_HISTORY.filter(a =>
        a.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        a.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      ));
      setTotal(results.length);
    } finally {
      setLoading(false);
    }
  }

  if (!canViewArchive && !isAdmin) {
    return (
      <SafeAreaView style={[s.safe, { justifyContent: 'center', alignItems: 'center', padding: 24 }]}>
        <Ionicons name="time-outline" size={48} color={Colors.textMuted} />
        <Text style={s.upgradeTitle}>Archives non incluses</Text>
        <Text style={s.upgradeSub}>Les archives historiques sont disponibles à partir du plan Mensuel.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Recherche historique</Text>
        <Text style={s.headerSub}>{archiveYears} an{archiveYears > 1 ? 's' : ''} d'archives · SQLite FTS5</Text>
      </View>

      <ScrollView stickyHeaderIndices={[0]} showsVerticalScrollIndicator={false}>
        <View style={s.searchZone}>
          <View style={s.searchRow}>
            <TextInput
              style={s.searchInput}
              value={query}
              onChangeText={setQuery}
              placeholder="Ex : crise alimentaire Niger 2024..."
              placeholderTextColor={Colors.textMuted}
              onSubmitEditing={() => handleSearch()}
              returnKeyType="search"
            />
            <TouchableOpacity style={s.searchBtn} onPress={() => handleSearch()}>
              <Ionicons name="search" size={18} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={s.dateRow}>
            <View style={s.dateField}>
              <Text style={s.dateLabel}>De</Text>
              <TextInput
                style={s.dateInput}
                value={dateFrom}
                onChangeText={setDateFrom}
                placeholder="AAAA-MM-JJ"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
            <View style={s.dateField}>
              <Text style={s.dateLabel}>À</Text>
              <TextInput
                style={s.dateInput}
                value={dateTo}
                onChangeText={setDateTo}
                placeholder="AAAA-MM-JJ"
                placeholderTextColor={Colors.textMuted}
              />
            </View>
          </View>

          <Text style={s.presetsLabel}>Suggestions rapides</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.presetsRow}>
              {PRESETS.map(p => (
                <TouchableOpacity key={p} style={s.preset} onPress={() => { setQuery(p); handleSearch(p); }}>
                  <Text style={s.presetText}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {loading && <ActivityIndicator color={Colors.primary} style={{ margin: 32 }} />}

        {!loading && searched && (
          <View style={s.resultsHeader}>
            <Text style={s.resultsCount}>{total} résultat{total > 1 ? 's' : ''} pour « {query} »</Text>
          </View>
        )}

        {!loading && results.map(article => (
          <View key={article.id} style={s.resultCard}>
            <View style={s.resultMeta}>
              <View style={s.dateBadge}>
                <Ionicons name="calendar-outline" size={11} color={Colors.textMuted} />
                <Text style={s.dateBadgeTxt}>{format(new Date(article.published_at), 'd MMM yyyy', { locale: fr })}</Text>
              </View>
              <Text style={s.resultSrc}>{article.source}</Text>
              <View style={[s.relBadge, { backgroundColor: article.reliability_score >= 85 ? Colors.successBg : Colors.warningBg }]}>
                <Text style={[s.relTxt, { color: article.reliability_score >= 85 ? Colors.success : Colors.warning }]}>
                  {article.reliability_score}%
                </Text>
              </View>
            </View>
            <Text style={s.resultTitle}>{article.title}</Text>
            <Text style={s.resultSummary} numberOfLines={2}>{article.summary}</Text>
            <View style={s.resultFooter}>
              <View style={s.resultTags}>
                {article.tags.slice(0, 3).map(t => (
                  <View key={t} style={s.tag}><Text style={s.tagTxt}>{t}</Text></View>
                ))}
              </View>
              <TouchableOpacity style={s.srcLink}>
                <Text style={s.srcLinkTxt}>Source</Text>
                <Ionicons name="open-outline" size={11} color={Colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        {!loading && searched && results.length === 0 && (
          <View style={s.empty}>
            <Ionicons name="search-outline" size={36} color={Colors.textMuted} />
            <Text style={s.emptyTxt}>Aucun résultat pour cette recherche.</Text>
            <Text style={s.emptySubTxt}>Essayez des mots-clés plus généraux.</Text>
          </View>
        )}
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const DEMO_HISTORY: Article[] = [
  { id: 'h1', title: "Coup d'État au Burkina Faso — Lt-col Ibrahim Traoré", summary: "Renversement du régime de Damiba le 30 septembre 2022.", source: 'AFP', source_url: 'https://afp.com', reliability_score: 99, category: 'politics', tags: ['Burkina','Coup d\'état','2022'], country: 'BF', published_at: '2022-09-30T00:00:00Z', is_verified: true, cross_check_count: 5, cross_check_sources: [], is_flagged: false },
  { id: 'h2', title: "Coup d'État au Niger — Garde présidentielle renverse Bazoum", summary: "Le général Tiani prend le pouvoir le 26 juillet 2023.", source: 'AFP · RFI', source_url: 'https://rfi.fr', reliability_score: 98, category: 'politics', tags: ['Niger','Coup d\'état','2023'], country: 'NE', published_at: '2023-07-26T00:00:00Z', is_verified: true, cross_check_count: 4, cross_check_sources: [], is_flagged: false },
  { id: 'h3', title: 'CEDEAO : sanctions sévères contre le Mali', summary: "Fermeture des frontières et gel des avoirs suite au second coup d'État.", source: 'CEDEAO', source_url: 'https://ecowas.int', reliability_score: 96, category: 'politics', tags: ['CEDEAO','Mali','Sanctions'], country: 'ML', published_at: '2022-01-09T00:00:00Z', is_verified: true, cross_check_count: 3, cross_check_sources: [], is_flagged: false },
  { id: 'h4', title: 'FAO : 4,2 millions personnes Phase 3+ insécurité alimentaire Niger 2022', summary: "Rapport Cadre Harmonisé — période de soudure juin-août 2022.", source: 'FAO', source_url: 'https://fao.org', reliability_score: 97, category: 'food', tags: ['FAO','Niger','Alimentation'], country: 'NE', published_at: '2022-06-15T00:00:00Z', is_verified: true, cross_check_count: 3, cross_check_sources: [], is_flagged: false },
  { id: 'h5', title: 'Élections présidentielles au Bénin : Talon réélu dès le 1er tour', summary: "Patrice Talon recueille 86,3% des voix selon la CENA.", source: 'BBC Afrique', source_url: 'https://bbc.com/afrique', reliability_score: 95, category: 'politics', tags: ['Bénin','Élections','2021'], country: 'BJ', published_at: '2021-04-11T00:00:00Z', is_verified: true, cross_check_count: 4, cross_check_sources: [], is_flagged: false },
  { id: 'h6', title: 'Alliance des États du Sahel (AES) — formalisation de la confédération', summary: "Le Mali, Burkina Faso et Niger officialisent leur alliance lors du sommet de Niamey.", source: 'AFP', source_url: 'https://afp.com', reliability_score: 95, category: 'politics', tags: ['AES','Sahel','2024'], country: 'NE', published_at: '2024-07-06T00:00:00Z', is_verified: true, cross_check_count: 3, cross_check_sources: [], is_flagged: false },
];

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  header: { backgroundColor: Colors.dark, paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  searchZone: { backgroundColor: Colors.white, padding: 14, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  searchInput: { flex: 1, borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: Colors.text, backgroundColor: Colors.surface },
  searchBtn: { backgroundColor: Colors.primary, borderRadius: Radius.md, paddingHorizontal: 14, justifyContent: 'center', alignItems: 'center' },
  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  dateField: { flex: 1 },
  dateLabel: { fontSize: 10, color: Colors.textSecond, marginBottom: 3 },
  dateInput: { borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 7, fontSize: 12, color: Colors.text, backgroundColor: Colors.surface },
  presetsLabel: { fontSize: 10, color: Colors.textMuted, fontWeight: '500', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  presetsRow: { flexDirection: 'row', gap: 6, paddingBottom: 2 },
  preset: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.full, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.surface },
  presetText: { fontSize: 11, color: Colors.textSecond },
  resultsHeader: { padding: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  resultsCount: { fontSize: 12, color: Colors.textSecond, fontWeight: '500' },
  resultCard: { backgroundColor: Colors.white, padding: 12, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  resultMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 5 },
  dateBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: Colors.surface, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2 },
  dateBadgeTxt: { fontSize: 10, color: Colors.textMuted },
  resultSrc: { fontSize: 10, fontWeight: '600', color: Colors.textSecond },
  relBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  relTxt: { fontSize: 10, fontWeight: '600' },
  resultTitle: { fontSize: 13, fontWeight: '500', color: Colors.text, lineHeight: 18, marginBottom: 4 },
  resultSummary: { fontSize: 11, color: Colors.textSecond, lineHeight: 16, marginBottom: 7 },
  resultFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultTags: { flexDirection: 'row', gap: 4, flex: 1, flexWrap: 'wrap' },
  tag: { paddingHorizontal: 6, paddingVertical: 2, backgroundColor: Colors.surface, borderRadius: 4, borderWidth: 0.5, borderColor: Colors.border },
  tagTxt: { fontSize: 10, color: Colors.textMuted },
  srcLink: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  srcLinkTxt: { fontSize: 11, color: Colors.primary },
  empty: { alignItems: 'center', padding: 40 },
  emptyTxt: { fontSize: 14, fontWeight: '500', color: Colors.text, marginTop: 12, textAlign: 'center' },
  emptySubTxt: { fontSize: 12, color: Colors.textSecond, marginTop: 4, textAlign: 'center' },
  upgradeTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginTop: 12, textAlign: 'center' },
  upgradeSub: { fontSize: 13, color: Colors.textSecond, textAlign: 'center', marginTop: 6 },
});
