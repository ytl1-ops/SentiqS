import { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  Alert, Switch, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../../hooks/useAuth';
import { Colors, Spacing, Radius, PLANS_CONFIG } from '../../constants/theme';
import { startTrial } from '../../lib/supabase';
import { format, differenceInDays } from 'date-fns';
import { fr } from 'date-fns/locale';
import { getRappelsWhatsappConfig, enregistrerEtProgrammerRappels } from '../../lib/rappelsWhatsapp';

export default function ProfileScreen() {
  const { profile, subscription, isAdmin, signOut, refreshSubscription } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [notifs, setNotifs] = useState(true);

  // Rappels d'envoi WhatsApp programmes — equivalent mobile natif de la
  // section de meme nom cote web (voir lib/rappelsWhatsapp.ts).
  const [rappelActif, setRappelActif] = useState(false);
  const [rappelNumero, setRappelNumero] = useState('');
  const [rappelHeures, setRappelHeures] = useState('');
  const [rappelMsg, setRappelMsg] = useState('');
  const [rappelSaving, setRappelSaving] = useState(false);

  useEffect(() => {
    getRappelsWhatsappConfig().then(cfg => {
      setRappelActif(cfg.actif);
      setRappelNumero(cfg.numero);
      setRappelHeures(cfg.heures.join(', '));
    });
  }, []);

  async function handleSaveRappels() {
    setRappelSaving(true);
    try {
      const cfg = await enregistrerEtProgrammerRappels({ actif: rappelActif, numero: rappelNumero, heures: rappelHeures });
      setRappelHeures(cfg.heures.join(', '));
      setRappelMsg(cfg.actif && cfg.heures.length ? 'Rappels programmés.' : 'Enregistré.');
    } catch (e: any) {
      setRappelMsg('Échec : ' + (e?.message || String(e)));
    } finally {
      setRappelSaving(false);
      setTimeout(() => setRappelMsg(''), 2500);
    }
  }

  async function handleSignOut() {
    Alert.alert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Déconnexion', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
    ]);
  }

  const daysLeft = subscription?.expires_at
    ? Math.max(0, differenceInDays(new Date(subscription.expires_at), new Date()))
    : 0;
  const progressPct = subscription
    ? Math.max(0, Math.min(100, (daysLeft / (subscription.plan_features ? 30 : 1)) * 100))
    : 0;

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : profile?.email?.slice(0, 2).toUpperCase() || '??';

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
            {isAdmin && (
              <View style={s.adminBadge}><Ionicons name="shield-checkmark" size={12} color="#fff" /></View>
            )}
          </View>
          <Text style={s.name}>{profile?.full_name || 'Utilisateur'}</Text>
          <Text style={s.email}>{profile?.email}</Text>
          {isAdmin && <View style={s.adminPill}><Text style={s.adminPillTxt}>Administrateur</Text></View>}
        </View>

        {/* Subscription card */}
        {subscription ? (
          <View style={s.subCard}>
            <View style={s.subTop}>
              <View>
                <Text style={s.subName}>{subscription.plan_name}</Text>
                <Text style={s.subExp}>
                  Expire le {format(new Date(subscription.expires_at), 'd MMMM yyyy', { locale: fr })}
                </Text>
              </View>
              <View style={s.subDays}>
                <Text style={s.subDaysN}>{daysLeft}</Text>
                <Text style={s.subDaysL}>jours</Text>
              </View>
            </View>
            <View style={s.subProgress}>
              <View style={[s.subFill, { width: `${progressPct}%` as any, backgroundColor: daysLeft < 5 ? Colors.danger : Colors.success }]} />
            </View>
            {/* Features */}
            <View style={s.features}>
              {[
                { icon: 'newspaper-outline', label: 'Articles', val: subscription.plan_features?.articles === -1 ? 'Illimité' : String(subscription.plan_features?.articles || 50) },
                { icon: 'warning-outline', label: 'Alertes', val: subscription.plan_features?.alerts ? 'Oui' : 'Non' },
                { icon: 'document-text-outline', label: 'Rapports', val: subscription.plan_features?.reports ? 'Oui' : 'Non' },
                { icon: 'time-outline', label: 'Archives', val: `${subscription.plan_features?.archive_years || 0} an${(subscription.plan_features?.archive_years || 0) > 1 ? 's' : ''}` },
              ].map(f => (
                <View key={f.label} style={s.featureItem}>
                  <Ionicons name={f.icon as any} size={14} color={Colors.textSecond} />
                  <Text style={s.featureLabel}>{f.label}</Text>
                  <Text style={s.featureVal}>{f.val}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={s.noSubCard}>
            <Ionicons name="lock-closed-outline" size={32} color={Colors.textMuted} />
            <Text style={s.noSubTitle}>Aucun abonnement actif</Text>
            <Text style={s.noSubSub}>Choisissez une formule pour accéder à SENTINEL.</Text>
          </View>
        )}

        {/* Plans */}
        <Text style={s.sectionTitle}>Choisir une formule</Text>
        <View style={s.plansGrid}>
          {PLANS_CONFIG.map(plan => (
            <TouchableOpacity
              key={plan.slug}
              style={[s.planCard, subscription?.plan_slug === plan.slug && s.planCardActive]}
              onPress={() => Alert.alert(
                plan.name,
                `${plan.price}\nDurée : ${plan.duration}\n\nPaiement via CinetPay / Wave (bientôt disponible)`,
                [{ text: 'Fermer' }]
              )}
            >
              {plan.badge && (
                <View style={[s.planBadge, { backgroundColor: plan.color + '22' }]}>
                  <Text style={[s.planBadgeTxt, { color: plan.color }]}>{plan.badge}</Text>
                </View>
              )}
              {subscription?.plan_slug === plan.slug && (
                <View style={s.currentBadge}><Text style={s.currentBadgeTxt}>Actuel</Text></View>
              )}
              <Text style={s.planName}>{plan.name}</Text>
              <Text style={s.planDur}>{plan.duration}</Text>
              <Text style={[s.planPrice, { color: plan.slug === 'trial' ? Colors.success : Colors.text }]}>
                {plan.price}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Settings */}
        <Text style={s.sectionTitle}>Paramètres</Text>
        <View style={s.settingsCard}>
          <View style={s.settingRow}>
            <Ionicons name="notifications-outline" size={18} color={Colors.textSecond} />
            <Text style={s.settingLabel}>Notifications alertes</Text>
            <Switch
              value={notifs}
              onValueChange={setNotifs}
              accessibilityLabel="Notifications alertes"
              trackColor={{ true: Colors.primary }}
              style={{ marginLeft: 'auto' }}
            />
          </View>
          <View style={[s.settingRow, { borderTopWidth: 0.5, borderTopColor: Colors.border }]}>
            <Ionicons name="globe-outline" size={18} color={Colors.textSecond} />
            <Text style={s.settingLabel}>Langue</Text>
            <Text style={s.settingVal}>Français</Text>
          </View>
          {isAdmin && (
            <TouchableOpacity
              style={[s.settingRow, { borderTopWidth: 0.5, borderTopColor: Colors.border }]}
              onPress={() => router.push('/admin')}
            >
              <Ionicons name="settings-outline" size={18} color={Colors.primary} />
              <Text style={[s.settingLabel, { color: Colors.primary }]}>Panneau administrateur</Text>
              <Ionicons name="chevron-forward" size={14} color={Colors.primary} style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          )}
        </View>

        {/* Rappels d'envoi WhatsApp programmés */}
        <Text style={s.sectionTitle}>Rappels d'envoi WhatsApp programmés</Text>
        <View style={s.settingsCard}>
          <Text style={s.rappelIntro}>
            Aux heures choisies, une notification propose de générer le rapport de Synthèse
            analytique et de l'envoyer via WhatsApp — le fichier est joint réellement (partage
            natif) si l'appareil le permet, sinon la conversation s'ouvre avec un message prêt
            et le PDF déjà téléchargé, à joindre manuellement.
          </Text>
          <View style={s.settingRow}>
            <Ionicons name="logo-whatsapp" size={18} color={Colors.success} />
            <Text style={s.settingLabel}>Activer les rappels</Text>
            <Switch
              value={rappelActif}
              onValueChange={setRappelActif}
              accessibilityLabel="Activer les rappels"
              trackColor={{ true: Colors.primary }}
              style={{ marginLeft: 'auto' }}
            />
          </View>
          <View style={[s.rappelField, { borderTopWidth: 0.5, borderTopColor: Colors.border }]}>
            <Text style={s.rappelLabel}>Numéro WhatsApp (avec indicatif pays)</Text>
            <TextInput
              style={s.rappelInput}
              value={rappelNumero}
              onChangeText={setRappelNumero}
              placeholder="Ex. 2250747974398"
              placeholderTextColor={Colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>
          <View style={[s.rappelField, { borderTopWidth: 0.5, borderTopColor: Colors.border }]}>
            <Text style={s.rappelLabel}>Heures (HH:MM, séparées par virgule)</Text>
            <TextInput
              style={s.rappelInput}
              value={rappelHeures}
              onChangeText={setRappelHeures}
              placeholder="Ex. 06:00, 16:30, 20:30"
              placeholderTextColor={Colors.textMuted}
            />
          </View>
          <TouchableOpacity style={s.rappelSaveBtn} onPress={handleSaveRappels} disabled={rappelSaving}>
            {rappelSaving ? <ActivityIndicator color="#fff" size="small" /> : (
              <>
                <Ionicons name="save-outline" size={15} color="#fff" />
                <Text style={s.rappelSaveTxt}>Enregistrer les rappels</Text>
              </>
            )}
          </TouchableOpacity>
          {!!rappelMsg && <Text style={s.rappelMsg}>{rappelMsg}</Text>}
        </View>

        <TouchableOpacity style={s.signOutBtn} onPress={handleSignOut}
          accessibilityRole="button"
          accessibilityLabel="Se déconnecter"
        >
          <Ionicons name="log-out-outline" size={18} color={Colors.danger} />
          <Text style={s.signOutTxt}>Déconnexion</Text>
        </TouchableOpacity>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  header: { backgroundColor: Colors.dark, alignItems: 'center', paddingTop: 24, paddingBottom: 28, paddingHorizontal: 16 },
  avatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  avatarText: { fontSize: 22, fontWeight: '700', color: '#fff' },
  adminBadge: { position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: 11, backgroundColor: Colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: Colors.dark },
  name: { fontSize: 17, fontWeight: '600', color: '#fff' },
  email: { fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  adminPill: { marginTop: 8, backgroundColor: Colors.dangerBg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.full },
  adminPillTxt: { fontSize: 11, color: Colors.danger, fontWeight: '600' },
  subCard: { margin: 14, backgroundColor: Colors.white, borderRadius: Radius.lg, padding: 14, borderWidth: 0.5, borderColor: Colors.border },
  subTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 },
  subName: { fontSize: 15, fontWeight: '600', color: Colors.text },
  subExp: { fontSize: 11, color: Colors.textSecond, marginTop: 2 },
  subDays: { alignItems: 'center', backgroundColor: Colors.successBg, borderRadius: 10, padding: 8, minWidth: 52 },
  subDaysN: { fontSize: 22, fontWeight: '700', color: Colors.success },
  subDaysL: { fontSize: 9, color: Colors.success },
  subProgress: { height: 5, borderRadius: 3, backgroundColor: Colors.surface, marginBottom: 12 },
  subFill: { height: 5, borderRadius: 3 },
  features: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  featureItem: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.surface, borderRadius: Radius.sm, paddingHorizontal: 8, paddingVertical: 4 },
  featureLabel: { fontSize: 10, color: Colors.textSecond },
  featureVal: { fontSize: 10, fontWeight: '600', color: Colors.text },
  noSubCard: { margin: 14, backgroundColor: Colors.white, borderRadius: Radius.lg, padding: 24, borderWidth: 0.5, borderColor: Colors.border, alignItems: 'center' },
  noSubTitle: { fontSize: 15, fontWeight: '600', color: Colors.text, marginTop: 8 },
  noSubSub: { fontSize: 12, color: Colors.textSecond, textAlign: 'center', marginTop: 4 },
  sectionTitle: { fontSize: 11, fontWeight: '600', color: Colors.textMuted, textTransform: 'uppercase', letterSpacing: 0.6, marginLeft: 14, marginBottom: 8, marginTop: 6 },
  plansGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 14, marginBottom: 8 },
  planCard: { width: '47%', backgroundColor: Colors.white, borderRadius: Radius.md, padding: 12, borderWidth: 0.5, borderColor: Colors.border },
  planCardActive: { borderColor: Colors.primary, borderWidth: 1.5 },
  planBadge: { alignSelf: 'flex-start', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginBottom: 4 },
  planBadgeTxt: { fontSize: 9, fontWeight: '600' },
  currentBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: Colors.primary, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  currentBadgeTxt: { fontSize: 8, color: '#fff', fontWeight: '600' },
  planName: { fontSize: 12, fontWeight: '600', color: Colors.text },
  planDur: { fontSize: 10, color: Colors.textMuted, marginTop: 2 },
  planPrice: { fontSize: 13, fontWeight: '700', marginTop: 6 },
  settingsCard: { marginHorizontal: 14, backgroundColor: Colors.white, borderRadius: Radius.lg, overflow: 'hidden', borderWidth: 0.5, borderColor: Colors.border, marginBottom: 10 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 13 },
  settingLabel: { fontSize: 13, color: Colors.text, flex: 1 },
  settingVal: { fontSize: 12, color: Colors.textSecond },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 14, padding: 13, backgroundColor: Colors.dangerBg, borderRadius: Radius.md },
  signOutTxt: { fontSize: 14, fontWeight: '500', color: Colors.danger },
  rappelIntro: { fontSize: 11, color: Colors.textSecond, lineHeight: 16, padding: 13 },
  rappelField: { padding: 13 },
  rappelLabel: { fontSize: 10, color: Colors.textMuted, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 },
  rappelInput: { borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, color: Colors.text, backgroundColor: Colors.surface },
  rappelSaveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, margin: 13, marginTop: 3, padding: 11, backgroundColor: Colors.success, borderRadius: Radius.md },
  rappelSaveTxt: { fontSize: 13, fontWeight: '600', color: '#fff' },
  rappelMsg: { fontSize: 11, color: Colors.textSecond, textAlign: 'center', paddingBottom: 10 },
});
