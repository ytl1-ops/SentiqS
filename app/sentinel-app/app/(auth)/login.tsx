import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { signIn, signUp, startTrial } from '../../lib/supabase';
import { Colors, Spacing, Radius } from '../../constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email || !password) {
      Alert.alert('Champs requis', 'Veuillez saisir votre email et mot de passe.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'login') {
        await signIn(email.trim(), password);
      } else {
        if (!fullName) { Alert.alert('Nom requis', 'Veuillez saisir votre nom.'); return; }
        const data = await signUp(email.trim(), password, fullName.trim());
        if (data.user) {
          await startTrial(data.user.id);
          Alert.alert('Bienvenue !', 'Votre essai gratuit de 24h a démarré.');
        }
      }
    } catch (e: any) {
      Alert.alert('Erreur', e.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView style={s.safe}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={s.header}>
            <View style={s.logoBox}>
              <Text style={s.logoRadar}>◎</Text>
            </View>
            <Text style={s.appName}>SENTINEL</Text>
            <Text style={s.appTagline}>Veille intelligente · Afrique de l'Ouest</Text>
          </View>

          {/* Card */}
          <View style={s.card}>
            {/* Toggle */}
            <View style={s.toggle}>
              <TouchableOpacity
                style={[s.toggleBtn, mode === 'login' && s.toggleActive]}
                onPress={() => setMode('login')}
              >
                <Text style={[s.toggleText, mode === 'login' && s.toggleTextActive]}>Connexion</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.toggleBtn, mode === 'register' && s.toggleActive]}
                onPress={() => setMode('register')}
              >
                <Text style={[s.toggleText, mode === 'register' && s.toggleTextActive]}>Inscription</Text>
              </TouchableOpacity>
            </View>

            {mode === 'register' && (
              <View style={s.field}>
                <Text style={s.label}>Nom complet</Text>
                <TextInput
                  style={s.input}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Prénom Nom"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="words"
                />
              </View>
            )}

            <View style={s.field}>
              <Text style={s.label}>Email</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="vous@exemple.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>

            <View style={s.field}>
              <Text style={s.label}>Mot de passe</Text>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
                autoComplete="password"
              />
            </View>

            <TouchableOpacity style={s.btn} onPress={handleSubmit} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnText}>{mode === 'login' ? 'Se connecter' : 'Créer mon compte'}</Text>
              }
            </TouchableOpacity>

            {mode === 'register' && (
              <View style={s.trialBanner}>
                <Text style={s.trialIcon}>🎁</Text>
                <View>
                  <Text style={s.trialTitle}>Essai gratuit 24h inclus</Text>
                  <Text style={s.trialSub}>50 articles · Flux temps réel · Sans CB</Text>
                </View>
              </View>
            )}
          </View>

          {/* Plans preview */}
          <Text style={s.plansTitle}>Nos abonnements</Text>
          <View style={s.plansGrid}>
            {[
              { name: 'Starter', dur: '7j', price: '2 500 F' },
              { name: 'Mensuel', dur: '30j', price: '7 500 F', popular: true },
              { name: 'Annuel', dur: '1 an', price: '55 000 F' },
            ].map(p => (
              <View key={p.name} style={[s.planCard, p.popular && s.planCardPop]}>
                {p.popular && <Text style={s.planPopBadge}>Populaire</Text>}
                <Text style={[s.planName, p.popular && s.planNamePop]}>{p.name}</Text>
                <Text style={[s.planDur, p.popular && s.planDurPop]}>{p.dur}</Text>
                <Text style={[s.planPrice, p.popular && s.planPricePop]}>{p.price}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.dark },
  scroll: { flexGrow: 1, padding: Spacing.lg },
  header: { alignItems: 'center', paddingVertical: Spacing.xxl },
  logoBox: { width: 64, height: 64, borderRadius: 16, backgroundColor: '#1a3a52', alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md },
  logoRadar: { fontSize: 32, color: '#3a9eff' },
  appName: { fontSize: 28, fontWeight: '700', color: '#fff', letterSpacing: 2 },
  appTagline: { fontSize: 13, color: Colors.textMuted, marginTop: 4 },
  card: { backgroundColor: Colors.white, borderRadius: Radius.lg, padding: Spacing.xl, marginBottom: Spacing.lg },
  toggle: { flexDirection: 'row', backgroundColor: Colors.surface, borderRadius: Radius.md, padding: 3, marginBottom: Spacing.lg },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: Radius.sm - 2, alignItems: 'center' },
  toggleActive: { backgroundColor: Colors.white, borderWidth: 0.5, borderColor: Colors.border },
  toggleText: { fontSize: 13, color: Colors.textSecond },
  toggleTextActive: { color: Colors.text, fontWeight: '500' },
  field: { marginBottom: Spacing.md },
  label: { fontSize: 12, color: Colors.textSecond, marginBottom: 5, fontWeight: '500' },
  input: { borderWidth: 0.5, borderColor: Colors.border, borderRadius: Radius.sm, padding: Spacing.md, fontSize: 14, color: Colors.text, backgroundColor: Colors.surface },
  btn: { backgroundColor: Colors.primary, borderRadius: Radius.md, padding: 14, alignItems: 'center', marginTop: Spacing.sm },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  trialBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: Spacing.md, padding: Spacing.md, backgroundColor: Colors.successBg, borderRadius: Radius.sm },
  trialIcon: { fontSize: 20 },
  trialTitle: { fontSize: 13, fontWeight: '600', color: Colors.success },
  trialSub: { fontSize: 11, color: Colors.success, opacity: 0.8 },
  plansTitle: { fontSize: 13, fontWeight: '600', color: Colors.textMuted, textAlign: 'center', marginBottom: Spacing.sm },
  plansGrid: { flexDirection: 'row', gap: 8 },
  planCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: Radius.md, padding: 10, alignItems: 'center' },
  planCardPop: { backgroundColor: Colors.primary },
  planPopBadge: { fontSize: 9, color: '#fff', backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginBottom: 3 },
  planName: { fontSize: 11, fontWeight: '600', color: '#fff' },
  planNamePop: { color: '#fff' },
  planDur: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  planDurPop: { color: 'rgba(255,255,255,0.8)' },
  planPrice: { fontSize: 11, fontWeight: '700', color: '#fff', marginTop: 4 },
  planPricePop: { color: '#fff' },
});
