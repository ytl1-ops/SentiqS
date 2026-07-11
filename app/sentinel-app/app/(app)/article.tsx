import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getArticleById, type Article } from '../../lib/sentinel-api';
import { Colors, Spacing, Radius } from '../../constants/theme';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { DEMO_ARTICLES } from './feed';
import { DEMO_HISTORY } from './archive';

const CATEGORY_LABEL: Record<string, string> = {
  security: 'Sécurité', food: 'Alimentaire', economy: 'Économie',
  politics: 'Politique', health: 'Santé', environment: 'Environnement',
};

const RELIABILITY_COLOR = (score: number) => {
  if (score >= 85) return Colors.success;
  if (score >= 60) return Colors.warning;
  return Colors.danger;
};

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadArticle(); }, [id]);

  async function loadArticle() {
    if (!id) return;
    setLoading(true);
    try {
      setArticle(await getArticleById(id));
    } catch {
      const demo = [...DEMO_ARTICLES, ...DEMO_HISTORY].find(a => a.id === id);
      setArticle(demo ?? null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Article</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={Colors.primary} size="large" />
      ) : !article ? (
        <View style={s.empty}>
          <Ionicons name="alert-circle-outline" size={36} color={Colors.textMuted} />
          <Text style={s.emptyTxt}>Article introuvable.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: Spacing.lg }} showsVerticalScrollIndicator={false}>
          <View style={s.metaRow}>
            <View style={s.catBadge}>
              <Text style={s.catBadgeTxt}>{CATEGORY_LABEL[article.category] || article.category}</Text>
            </View>
            <View style={[s.relBadge, { backgroundColor: article.reliability_score >= 85 ? Colors.successBg : article.reliability_score >= 60 ? Colors.warningBg : Colors.dangerBg }]}>
              <Ionicons name="shield-checkmark-outline" size={11} color={RELIABILITY_COLOR(article.reliability_score)} />
              <Text style={[s.relTxt, { color: RELIABILITY_COLOR(article.reliability_score) }]}>{article.reliability_score}% fiable</Text>
            </View>
          </View>

          <Text style={s.title}>{article.title}</Text>

          <View style={s.sourceRow}>
            <Text style={s.source}>{article.source}</Text>
            <Text style={s.dot}>·</Text>
            <Text style={s.date}>{format(new Date(article.published_at), "d MMMM yyyy 'à' HH:mm", { locale: fr })}</Text>
          </View>

          {article.is_flagged && (
            <View style={s.flagBox}>
              <Ionicons name="warning-outline" size={16} color={Colors.warning} />
              <Text style={s.flagTxt}>{article.flag_reason || "Information non vérifiée — à recouper avec une autre source."}</Text>
            </View>
          )}

          {article.is_verified && (
            <View style={s.verifiedBox}>
              <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
              <Text style={s.verifiedTxt}>Recoupé avec {article.cross_check_count} source{article.cross_check_count > 1 ? 's' : ''} indépendante{article.cross_check_count > 1 ? 's' : ''}.</Text>
            </View>
          )}

          <Text style={s.summary}>{article.summary}</Text>

          {article.tags.length > 0 && (
            <View style={s.tagsRow}>
              {article.tags.map(t => (
                <View key={t} style={s.tag}><Text style={s.tagTxt}>{t}</Text></View>
              ))}
            </View>
          )}

          {article.cross_check_sources.length > 0 && (
            <View style={s.crossZone}>
              <Text style={s.sectionLabel}>Sources croisées</Text>
              {article.cross_check_sources.map(src => (
                <View key={src.name} style={s.crossRow}>
                  <Ionicons
                    name={src.confirmed ? 'checkmark-circle' : 'help-circle-outline'}
                    size={14}
                    color={src.confirmed ? Colors.success : Colors.textMuted}
                  />
                  <Text style={s.crossName}>{src.name}</Text>
                </View>
              ))}
            </View>
          )}

          {!!article.source_url && (
            <TouchableOpacity style={s.srcBtn} onPress={() => Linking.openURL(article.source_url)}>
              <Text style={s.srcBtnTxt}>Lire la source originale</Text>
              <Ionicons name="open-outline" size={15} color="#fff" />
            </TouchableOpacity>
          )}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  header: { backgroundColor: Colors.dark, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn: { padding: 2 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  empty: { alignItems: 'center', padding: 40 },
  emptyTxt: { fontSize: 13, color: Colors.textSecond, marginTop: 10 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  catBadge: { backgroundColor: Colors.primaryLight, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  catBadgeTxt: { fontSize: 10, fontWeight: '600', color: Colors.primary },
  relBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  relTxt: { fontSize: 10, fontWeight: '600' },
  title: { fontSize: 19, fontWeight: '700', color: Colors.text, lineHeight: 26, marginBottom: 8 },
  sourceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 },
  source: { fontSize: 12, fontWeight: '600', color: Colors.textSecond },
  dot: { fontSize: 12, color: Colors.textMuted },
  date: { fontSize: 12, color: Colors.textMuted },
  flagBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: Colors.warningBg, borderRadius: Radius.md, padding: 12, marginBottom: 12 },
  flagTxt: { flex: 1, fontSize: 12, color: Colors.warning, lineHeight: 17 },
  verifiedBox: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: Colors.successBg, borderRadius: Radius.md, padding: 12, marginBottom: 12 },
  verifiedTxt: { flex: 1, fontSize: 12, color: Colors.success, lineHeight: 17 },
  summary: { fontSize: 14, color: Colors.text, lineHeight: 22, marginBottom: 16 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, backgroundColor: Colors.white, borderRadius: Radius.sm, borderWidth: 0.5, borderColor: Colors.border },
  tagTxt: { fontSize: 11, color: Colors.textSecond },
  crossZone: { marginBottom: 16 },
  sectionLabel: { fontSize: 10, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  crossRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.white, borderRadius: Radius.sm, padding: 10, marginBottom: 6, borderWidth: 0.5, borderColor: Colors.border },
  crossName: { fontSize: 12, color: Colors.text },
  srcBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.primary, borderRadius: Radius.lg, padding: 14 },
  srcBtnTxt: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
