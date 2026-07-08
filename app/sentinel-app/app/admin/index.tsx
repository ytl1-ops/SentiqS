import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  TextInput, FlatList, Alert, Modal, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  getAllUsers, getAllSubscriptions, adminGrantAccess, adminRevokeAccess,
  type Profile, type Subscription,
} from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, Radius, PLANS_CONFIG } from '../../constants/theme';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';

type AdminTab = 'users' | 'stats' | 'access';

export default function AdminScreen() {
  const { profile, isAdmin } = useAuth();
  const router = useRouter();

  const [tab, setTab] = useState<AdminTab>('users');
  const [users, setUsers] = useState<Profile[]>([]);
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchUser, setSearchUser] = useState('');

  // Grant modal
  const [modalVisible, setModalVisible] = useState(false);
  const [grantEmail, setGrantEmail] = useState('');
  const [grantPlan, setGrantPlan] = useState('monthly');
  const [grantNote, setGrantNote] = useState('');
  const [granting, setGranting] = useState(false);

  useEffect(() => {
    if (!isAdmin) { router.replace('/(app)/feed'); return; }
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [u, s] = await Promise.all([getAllUsers(), getAllSubscriptions()]);
      setUsers(u);
      setSubs(s);
    } catch {
      setUsers(DEMO_USERS);
      setSubs(DEMO_SUBS);
    } finally {
      setLoading(false);
    }
  }

  async function handleGrant() {
    if (!grantEmail.trim()) { Alert.alert('Email requis'); return; }
    if (!profile?.id) return;
    setGranting(true);
    try {
      await adminGrantAccess(grantEmail.trim(), grantPlan, profile.id, grantNote || undefined);
      Alert.alert('Accès accordé', `Abonnement ${grantPlan} créé pour ${grantEmail}.`);
      setModalVisible(false);
      setGrantEmail(''); setGrantNote(''); setGrantPlan('monthly');
      await loadData();
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setGranting(false);
    }
  }

  async function handleRevoke(sub: Subscription) {
    Alert.alert(
      'Révoquer l\'accès',
      `Révoquer l\'abonnement de ${sub.user_email || sub.user_id} ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Révoquer', style: 'destructive',
          onPress: async () => {
            try {
              await adminRevokeAccess(sub.id, profile!.id);
              await loadData();
            } catch (e: any) { Alert.alert('Erreur', e.message); }
          }
        }
      ]
    );
  }

  const filteredSubs = subs.filter(s =>
    searchUser
      ? (s.user_email || '').toLowerCase().includes(searchUser.toLowerCase()) ||
        (s.user_name || '').toLowerCase().includes(searchUser.toLowerCase())
      : true
  );

  const statsData = {
    total: users.length + subs.length,
    active: subs.filter(s => (s.days_remaining ?? 0) > 0).length,
    expiring: subs.filter(s => (s.days_remaining ?? 0) <= 3 && (s.days_remaining ?? 0) >= 0).length,
    revenue: subs.reduce((acc, s) => acc + (s.plan_price || 0), 0),
  };

  const planBreakdown = PLANS_CONFIG.map(p => ({
    ...p,
    count: subs.filter(s => s.plan_slug === p.slug).length,
    revenue: subs.filter(s => s.plan_slug === p.slug).length * (
      p.slug === 'trial' ? 0 : p.slug === 'starter' ? 2500 : p.slug === 'monthly' ? 7500 :
      p.slug === 'quarterly' ? 18000 : p.slug === 'annual' ? 55000 : 150000
    ),
  }));
  const maxRevenue = Math.max(...planBreakdown.map(p => p.revenue), 1);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Panneau administrateur</Text>
          <Text style={s.headerSub}>yorot225@gmail.com</Text>
        </View>
        <TouchableOpacity onPress={loadData}>
          <Ionicons name="refresh-outline" size={20} color="rgba(255,255,255,0.7)" />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {(['users', 'stats', 'access'] as AdminTab[]).map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabTxt, tab === t && s.tabTxtActive]}>
              {t === 'users' ? 'Utilisateurs' : t === 'stats' ? 'Statistiques' : 'Droits d\'accès'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator style={{ margin: 40 }} color={Colors.primary} size="large" />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>

          {/* ── TAB USERS ── */}
          {tab === 'users' && (
            <>
              <View style={s.searchRow}>
                <Ionicons name="search-outline" size={15} color={Colors.textMuted} style={{ marginRight: 5 }} />
                <TextInput
                  style={s.searchInput}
                  value={searchUser}
                  onChangeText={setSearchUser}
                  placeholder="Rechercher un utilisateur..."
                  placeholderTextColor={Colors.textMuted}
                />
              </View>

              <View style={s.summary}>
                {[
                  { n: statsData.total, l: 'Utilisateurs', c: Colors.primary },
                  { n: statsData.active, l: 'Actifs', c: Colors.success },
                  { n: statsData.expiring, l: 'Expirent bientôt', c: Colors.warning },
                ].map(st => (
                  <View key={st.l} style={s.summaryItem}>
                    <Text style={[s.summaryN, { color: st.c }]}>{st.n}</Text>
                    <Text style={s.summaryL}>{st.l}</Text>
                  </View>
                ))}
              </View>

              {filteredSubs.map(sub => {
                const days = sub.days_remaining ?? 0;
                const expired = days <= 0;
                const expiring = days > 0 && days <= 3;
                return (
                  <View key={sub.id} style={s.userRow}>
                    <View style={[s.userAv, { backgroundColor: expired ? Colors.dangerBg : expiring ? Colors.warningBg : Colors.primaryLight }]}>
                      <Text style={[s.userAvTxt, { color: expired ? Colors.danger : expiring ? Colors.warning : Colors.primary }]}>
                        {(sub.user_name || sub.user_email || '??').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                    <View style={s.userInfo}>
                      <Text style={s.userName}>{sub.user_name || 'Utilisateur'}</Text>
                      <Text style={s.userEmail}>{sub.user_email}</Text>
                      <View style={s.userPlanRow}>
                        <View style={[s.planPill, { backgroundColor: expired ? Colors.dangerBg : Colors.primaryLight }]}>
                          <Text style={[s.planPillTxt, { color: expired ? Colors.danger : Colors.primary }]}>{sub.plan_name}</Text>
                        </View>
                        <Text style={[s.userDays, { color: expired ? Colors.danger : expiring ? Colors.warning : Colors.success }]}>
                          {expired ? 'Expiré' : `${days}j restants`}
                        </Text>
                      </View>
                    </View>
                    <View style={s.userActions}>
                      <TouchableOpacity style={s.actionBtn} onPress={() => {
                        setGrantEmail(sub.user_email || '');
                        setModalVisible(true);
                      }}>
                        <Ionicons name="refresh-outline" size={15} color={Colors.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.actionBtn, { borderColor: Colors.dangerBg }]} onPress={() => handleRevoke(sub)}>
                        <Ionicons name="ban-outline" size={15} color={Colors.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}

              <TouchableOpacity style={s.addBtn} onPress={() => setModalVisible(true)}>
                <Ionicons name="person-add-outline" size={16} color={Colors.primary} />
                <Text style={s.addBtnTxt}>Ajouter un utilisateur</Text>
              </TouchableOpacity>
            </>
          )}

          {/* ── TAB STATS ── */}
          {tab === 'stats' && (
            <View style={{ padding: 14 }}>
              <View style={s.revenueCard}>
                <Text style={s.revenueTitle}>Revenus estimés ce mois</Text>
                <Text style={s.revenueTotal}>{statsData.revenue.toLocaleString('fr-FR')} FCFA</Text>
              </View>
              <Text style={s.sectionTitle}>Répartition par plan</Text>
              {planBreakdown.map(p => (
                <View key={p.slug} style={s.planStat}>
                  <View style={s.planStatHead}>
                    <Text style={s.planStatName}>{p.name}</Text>
                    <Text style={s.planStatCount}>{p.count} utilisateur{p.count > 1 ? 's' : ''}</Text>
                    <Text style={s.planStatRevenue}>{p.revenue.toLocaleString('fr-FR')} F</Text>
                  </View>
                  <View style={s.planStatTrack}>
                    <View style={[s.planStatFill, { width: `${Math.round(p.revenue / maxRevenue * 100)}%` as any, backgroundColor: p.color }]} />
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* ── TAB ACCESS ── */}
          {tab === 'access' && (
            <View style={{ padding: 14 }}>
              <Text style={s.sectionTitle}>Droits d'accès par formule</Text>
              {PLANS_CONFIG.map(p => {
                const feats = [
                  p.slug === 'trial' ? '50 articles max' : 'Articles illimités',
                  p.slug === 'trial' || p.slug === 'starter' ? 'Pas d\'alertes push' : 'Alertes push',
                  p.slug === 'monthly' || p.slug === 'quarterly' || p.slug === 'annual' || p.slug === 'institution' ? 'Rapports DOCX/PDF' : 'Pas de rapports',
                  p.slug === 'trial' || p.slug === 'starter' ? 'Pas d\'archives' :
                  p.slug === 'monthly' ? 'Archives 2 ans' :
                  p.slug === 'quarterly' ? 'Archives 5 ans' : 'Archives 10 ans',
                  p.slug === 'institution' ? '10 utilisateurs' : '1 utilisateur',
                ];
                return (
                  <View key={p.slug} style={[s.accessCard, { borderLeftColor: p.color, borderLeftWidth: 3 }]}>
                    <View style={s.accessHead}>
                      <Text style={s.accessName}>{p.name}</Text>
                      <Text style={[s.accessPrice, { color: p.color }]}>{p.price}</Text>
                    </View>
                    <View style={s.accessFeats}>
                      {feats.map(f => (
                        <View key={f} style={s.accessFeat}>
                          <Ionicons
                            name={f.startsWith('Pas') ? 'close-circle-outline' : 'checkmark-circle-outline'}
                            size={13}
                            color={f.startsWith('Pas') ? Colors.textMuted : Colors.success}
                          />
                          <Text style={s.accessFeatTxt}>{f}</Text>
                        </View>
                      ))}
                    </View>
                    <TouchableOpacity
                      style={s.grantPlanBtn}
                      onPress={() => { setGrantPlan(p.slug); setModalVisible(true); }}
                    >
                      <Text style={s.grantPlanBtnTxt}>Accorder cet accès</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── GRANT ACCESS MODAL ── */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={s.modalBg}>
          <View style={s.modal}>
            <View style={s.modalHead}>
              <Text style={s.modalTitle}>Accorder un accès</Text>
              <TouchableOpacity onPress={() => { setModalVisible(false); setGrantEmail(''); }}>
                <Ionicons name="close" size={20} color={Colors.textSecond} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 400 }}>
              <View style={s.modalBody}>
                <View style={s.field}>
                  <Text style={s.fieldLabel}>Email de l'utilisateur *</Text>
                  <TextInput
                    style={s.fieldInput}
                    value={grantEmail}
                    onChangeText={setGrantEmail}
                    placeholder="utilisateur@exemple.com"
                    placeholderTextColor={Colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={s.field}>
                  <Text style={s.fieldLabel}>Formule d'accès *</Text>
                  <View style={s.planBtns}>
                    {PLANS_CONFIG.map(p => (
                      <TouchableOpacity
                        key={p.slug}
                        style={[s.planBtn, grantPlan === p.slug && s.planBtnActive]}
                        onPress={() => setGrantPlan(p.slug)}
                      >
                        <Text style={[s.planBtnName, grantPlan === p.slug && s.planBtnNameActive]}>{p.name}</Text>
                        <Text style={[s.planBtnPrice, grantPlan === p.slug && s.planBtnPriceActive]}>{p.duration}</Text>
                        <Text style={[s.planBtnPrice, grantPlan === p.slug && s.planBtnPriceActive]}>{p.price}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={s.field}>
                  <Text style={s.fieldLabel}>Note interne (optionnel)</Text>
                  <TextInput
                    style={[s.fieldInput, { height: 60, textAlignVertical: 'top' }]}
                    value={grantNote}
                    onChangeText={setGrantNote}
                    placeholder="Ex : partenaire FAO, journaliste, ONG..."
                    placeholderTextColor={Colors.textMuted}
                    multiline
                  />
                </View>
              </View>
            </ScrollView>

            <View style={s.modalFoot}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={s.cancelBtnTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.confirmBtn} onPress={handleGrant} disabled={granting}>
                {granting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={s.confirmBtnTxt}>Créer l'accès</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Démo data ──────────────────────────────────────────────────
const DEMO_USERS: Profile[] = [
  { id: '1', email: 'amadou.maiga@ong.ml', full_name: 'Amadou Maiga', role: 'user', avatar_url: null, phone: null, organization: 'ONG Sahel', country: 'ML', language: 'fr', created_at: '2026-05-01' },
  { id: '2', email: 'fatou.kone@gmail.com', full_name: 'Fatou Koné', role: 'user', avatar_url: null, phone: null, organization: null, country: 'CI', language: 'fr', created_at: '2026-06-27' },
  { id: '3', email: 'ibrahim.bah@press.gn', full_name: 'Ibrahim Bah', role: 'user', avatar_url: null, phone: null, organization: 'Presse Guinée', country: 'GN', language: 'fr', created_at: '2026-04-01' },
  { id: '4', email: 'admin@terrafood.org', full_name: 'ONG TerraFood', role: 'user', avatar_url: null, phone: null, organization: 'TerraFood', country: 'SN', language: 'fr', created_at: '2026-01-15' },
];

const DEMO_SUBS: Subscription[] = [
  { id: 's1', user_id: '1', plan_id: 'p3', status: 'active', started_at: '2026-06-01', expires_at: '2026-07-15', granted_by: null, note: null, plan_slug: 'monthly', plan_name: 'Mensuel', plan_price: 7500, days_remaining: 17, user_email: 'amadou.maiga@ong.ml', user_name: 'Amadou Maiga' },
  { id: 's2', user_id: '2', plan_id: 'p1', status: 'active', started_at: '2026-06-27', expires_at: '2026-06-28', granted_by: null, note: null, plan_slug: 'trial', plan_name: 'Essai gratuit', plan_price: 0, days_remaining: 0, user_email: 'fatou.kone@gmail.com', user_name: 'Fatou Koné' },
  { id: 's3', user_id: '3', plan_id: 'p3', status: 'active', started_at: '2026-05-20', expires_at: '2026-06-20', granted_by: null, note: null, plan_slug: 'monthly', plan_name: 'Mensuel', plan_price: 7500, days_remaining: -8, user_email: 'ibrahim.bah@press.gn', user_name: 'Ibrahim Bah' },
  { id: 's4', user_id: '4', plan_id: 'p6', status: 'active', started_at: '2026-01-15', expires_at: '2027-01-15', granted_by: null, note: 'Partenaire institutionnel', plan_slug: 'institution', plan_name: 'Institution', plan_price: 150000, days_remaining: 201, user_email: 'admin@terrafood.org', user_name: 'ONG TerraFood' },
];

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  header: { backgroundColor: Colors.dark, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 15, fontWeight: '700', color: '#fff' },
  headerSub: { fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 1 },
  tabs: { flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  tab: { flex: 1, paddingVertical: 11, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: Colors.primary },
  tabTxt: { fontSize: 11, color: Colors.textSecond, fontWeight: '500' },
  tabTxtActive: { color: Colors.primary },
  searchRow: { flexDirection: 'row', alignItems: 'center', margin: 12, backgroundColor: Colors.white, borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.md, paddingHorizontal: 10, paddingVertical: 8 },
  searchInput: { flex: 1, fontSize: 13, color: Colors.text },
  summary: { flexDirection: 'row', backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.border, marginBottom: 4 },
  summaryItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRightWidth: 0.5, borderRightColor: Colors.border },
  summaryN: { fontSize: 20, fontWeight: '700' },
  summaryL: { fontSize: 9, color: Colors.textMuted, marginTop: 2 },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: Colors.white, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  userAv: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  userAvTxt: { fontSize: 13, fontWeight: '700' },
  userInfo: { flex: 1, minWidth: 0 },
  userName: { fontSize: 13, fontWeight: '500', color: Colors.text },
  userEmail: { fontSize: 10, color: Colors.textMuted, marginTop: 1 },
  userPlanRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 },
  planPill: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  planPillTxt: { fontSize: 10, fontWeight: '600' },
  userDays: { fontSize: 10, fontWeight: '500' },
  userActions: { flexDirection: 'row', gap: 6 },
  actionBtn: { width: 30, height: 30, borderRadius: 8, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 14, padding: 13, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primary, borderStyle: 'dashed', backgroundColor: Colors.primaryLight, justifyContent: 'center' },
  addBtnTxt: { fontSize: 13, color: Colors.primary, fontWeight: '500' },
  revenueCard: { backgroundColor: Colors.dark, borderRadius: Radius.lg, padding: 20, alignItems: 'center', marginBottom: 16 },
  revenueTitle: { fontSize: 12, color: 'rgba(255,255,255,0.6)' },
  revenueTotal: { fontSize: 28, fontWeight: '700', color: '#fff', marginTop: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 4 },
  planStat: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: 12, borderWidth: 0.5, borderColor: Colors.border, marginBottom: 8 },
  planStatHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  planStatName: { fontSize: 12, fontWeight: '500', color: Colors.text, flex: 1 },
  planStatCount: { fontSize: 11, color: Colors.textSecond, marginRight: 10 },
  planStatRevenue: { fontSize: 12, fontWeight: '600', color: Colors.primary },
  planStatTrack: { height: 5, borderRadius: 3, backgroundColor: Colors.surface },
  planStatFill: { height: 5, borderRadius: 3 },
  accessCard: { backgroundColor: Colors.white, borderRadius: Radius.md, padding: 12, borderWidth: 0.5, borderColor: Colors.border, marginBottom: 8, borderLeftWidth: 3 },
  accessHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  accessName: { fontSize: 13, fontWeight: '600', color: Colors.text },
  accessPrice: { fontSize: 12, fontWeight: '600' },
  accessFeats: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  accessFeat: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  accessFeatTxt: { fontSize: 11, color: Colors.textSecond },
  grantPlanBtn: { paddingVertical: 7, borderRadius: Radius.sm, borderWidth: 0.5, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.surface },
  grantPlanBtnTxt: { fontSize: 11, color: Colors.textSecond, fontWeight: '500' },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: Colors.white, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl, overflow: 'hidden' },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 0.5, borderBottomColor: Colors.border },
  modalTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  modalBody: { padding: 16 },
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, color: Colors.textSecond, fontWeight: '500', marginBottom: 5 },
  fieldInput: { borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, padding: 10, fontSize: 13, color: Colors.text, backgroundColor: Colors.surface },
  planBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  planBtn: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: Radius.sm, borderWidth: 0.5, borderColor: Colors.border, backgroundColor: Colors.surface, minWidth: '30%', alignItems: 'center' },
  planBtnActive: { backgroundColor: Colors.primaryLight, borderColor: Colors.primary },
  planBtnName: { fontSize: 11, fontWeight: '600', color: Colors.text },
  planBtnNameActive: { color: Colors.primary },
  planBtnPrice: { fontSize: 9, color: Colors.textMuted, marginTop: 2 },
  planBtnPriceActive: { color: Colors.primary },
  modalFoot: { flexDirection: 'row', gap: 10, padding: 16, borderTopWidth: 0.5, borderTopColor: Colors.border },
  cancelBtn: { flex: 1, paddingVertical: 12, borderRadius: Radius.md, borderWidth: 0.5, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.surface },
  cancelBtnTxt: { fontSize: 13, color: Colors.textSecond },
  confirmBtn: { flex: 2, paddingVertical: 12, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center' },
  confirmBtnTxt: { fontSize: 13, fontWeight: '600', color: '#fff' },
});
