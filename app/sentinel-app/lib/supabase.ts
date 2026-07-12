import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Supabase non configuré : définissez EXPO_PUBLIC_SUPABASE_URL et EXPO_PUBLIC_SUPABASE_ANON_KEY dans .env (voir .env.example)."
  );
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ── Types ────────────────────────────────────────────────────
export type Plan = {
  id: string;
  slug: string;
  name: string;
  duration_days: number;
  price_fcfa: number;
  price_eur: number;
  max_users: number;
  features: {
    articles: number;
    alerts: boolean;
    reports: boolean;
    archive_years: number;
    map: boolean;
    api?: boolean;
    multi_users?: boolean;
  };
  is_active: boolean;
};

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'user';
  avatar_url: string | null;
  phone: string | null;
  organization: string | null;
  country: string;
  language: string;
  created_at: string;
};

export type Subscription = {
  id: string;
  user_id: string;
  plan_id: string;
  status: 'active' | 'expired' | 'revoked' | 'pending';
  started_at: string;
  expires_at: string;
  granted_by: string | null;
  note: string | null;
  plan_slug?: string;
  plan_name?: string;
  plan_features?: Plan['features'];
  plan_price?: number;
  days_remaining?: number;
  user_email?: string;
  user_name?: string;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: 'info' | 'alert' | 'expiry' | 'system';
  is_read: boolean;
  created_at: string;
};

// ── Auth helpers ─────────────────────────────────────────────
export const ADMIN_EMAIL = 'yorot225@gmail.com';

export async function signUp(email: string, password: string, fullName: string) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  if (data.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      email,
      full_name: fullName,
      role: email === ADMIN_EMAIL ? 'admin' : 'user',
    });
  }
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ── Journal des connexions (visibilité admin, tous appareils) ─
// Écrit un horodatage de connexion visible par le panneau Administration
// web, qui n'a pas de session Supabase propre — voir connexions_log
// (migration 20260712010000). Volontairement best-effort : une écriture
// échouée (hors-ligne, etc.) ne doit jamais bloquer la connexion.
export async function logConnexion(profile: { email: string; full_name: string | null; role: string }) {
  try {
    await supabase.from('connexions_log').insert({
      email: profile.email,
      name: profile.full_name,
      role: profile.role,
      platform: 'mobile',
    });
  } catch (_e) {
    // silencieux — le journal de connexion n'est jamais bloquant
  }
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) return null;
  return data;
}

// ── Subscription helpers ─────────────────────────────────────
export async function getCurrentSubscription(userId: string): Promise<Subscription | null> {
  const { data, error } = await supabase
    .from('current_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('expires_at', { ascending: false })
    .limit(1)
    .single();
  if (error) return null;
  return data;
}

export async function getPlans(): Promise<Plan[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('is_active', true)
    .order('price_fcfa');
  if (error) return [];
  return data;
}

export async function startTrial(userId: string): Promise<void> {
  const { data: plan } = await supabase
    .from('plans')
    .select('id, duration_days')
    .eq('slug', 'trial')
    .single();
  if (!plan) throw new Error('Plan essai introuvable');

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + plan.duration_days * 24);

  const { error } = await supabase.from('subscriptions').insert({
    user_id: userId,
    plan_id: plan.id,
    expires_at: expiresAt.toISOString(),
    status: 'active',
  });
  if (error) throw error;
}

// ── Admin helpers ─────────────────────────────────────────────
export async function adminGrantAccess(
  userEmail: string,
  planSlug: string,
  adminId: string,
  note?: string
): Promise<string> {
  const { data, error } = await supabase.rpc('admin_grant_access', {
    p_user_email: userEmail,
    p_plan_slug: planSlug,
    p_admin_id: adminId,
    p_note: note || null,
  });
  if (error) throw error;
  return data;
}

export async function adminRevokeAccess(subscriptionId: string, adminId: string) {
  const { error } = await supabase.rpc('admin_revoke_access', {
    p_subscription_id: subscriptionId,
    p_admin_id: adminId,
  });
  if (error) throw error;
}

export async function getAllSubscriptions(): Promise<Subscription[]> {
  const { data, error } = await supabase
    .from('current_subscriptions')
    .select('*')
    .order('expires_at', { ascending: true });
  if (error) return [];
  return data;
}

export async function getAllUsers(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .neq('role', 'admin')
    .order('created_at', { ascending: false });
  if (error) return [];
  return data;
}

// ── Notifications ─────────────────────────────────────────────
export async function getNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) return [];
  return data;
}

export async function markNotificationRead(notifId: string) {
  await supabase.from('notifications').update({ is_read: true }).eq('id', notifId);
}

// ── Article read counter (trial limit) ───────────────────────
export async function trackArticleRead(userId: string, articleId: string, subscriptionId?: string) {
  await supabase.from('article_reads').insert({
    user_id: userId,
    article_id: articleId,
    subscription_id: subscriptionId || null,
  });
}

export async function getArticleReadCount(userId: string, since: string): Promise<number> {
  const { count } = await supabase
    .from('article_reads')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('read_at', since);
  return count || 0;
}
