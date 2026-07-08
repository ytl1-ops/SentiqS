-- ============================================================
-- SENTINEL — Schéma Supabase complet
-- À exécuter dans l'éditeur SQL de votre projet Supabase
-- ============================================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── TABLE PLANS ──────────────────────────────────────────────
CREATE TABLE plans (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug          TEXT UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  duration_days INTEGER NOT NULL,       -- 0 = illimité
  price_fcfa    INTEGER NOT NULL,       -- 0 = gratuit
  price_eur     NUMERIC(6,2),
  max_users     INTEGER DEFAULT 1,      -- Institution = 10
  features      JSONB DEFAULT '{}',
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO plans (slug, name, duration_days, price_fcfa, price_eur, max_users, features) VALUES
  ('trial',        'Essai gratuit',  1,   0,      0,    1,  '{"articles":50,"alerts":false,"reports":false,"archive_years":0,"map":false}'),
  ('starter',      'Starter',        7,   2500,   4,    1,  '{"articles":-1,"alerts":true,"reports":false,"archive_years":0,"map":true}'),
  ('monthly',      'Mensuel',        30,  7500,   12,   1,  '{"articles":-1,"alerts":true,"reports":true,"archive_years":2,"map":true}'),
  ('quarterly',    'Trimestriel',    90,  18000,  27,   1,  '{"articles":-1,"alerts":true,"reports":true,"archive_years":5,"map":true}'),
  ('annual',       'Annuel',         365, 55000,  84,   1,  '{"articles":-1,"alerts":true,"reports":true,"archive_years":10,"map":true,"api":true}'),
  ('institution',  'Institution',    365, 150000, 230,  10, '{"articles":-1,"alerts":true,"reports":true,"archive_years":10,"map":true,"api":true,"multi_users":true}');

-- ── TABLE PROFILES ───────────────────────────────────────────
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT UNIQUE NOT NULL,
  full_name     TEXT,
  role          TEXT DEFAULT 'user' CHECK (role IN ('admin','user')),
  avatar_url    TEXT,
  phone         TEXT,
  organization  TEXT,
  country       TEXT DEFAULT 'BJ',
  language      TEXT DEFAULT 'fr',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Admin auto-set
CREATE OR REPLACE FUNCTION set_admin_role()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.email = 'yorot225@gmail.com' THEN
    NEW.role := 'admin';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_admin
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_admin_role();

-- ── TABLE SUBSCRIPTIONS ──────────────────────────────────────
CREATE TABLE subscriptions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  plan_id       UUID NOT NULL REFERENCES plans(id),
  status        TEXT DEFAULT 'active' CHECK (status IN ('active','expired','revoked','pending')),
  started_at    TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  granted_by    UUID REFERENCES profiles(id),     -- admin qui a accordé
  payment_ref   TEXT,                              -- référence paiement CinetPay/Wave
  payment_method TEXT,
  note          TEXT,
  auto_renew    BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Vue abonnement actif courant par utilisateur
CREATE VIEW current_subscriptions AS
SELECT
  s.*,
  p.slug       AS plan_slug,
  p.name       AS plan_name,
  p.features   AS plan_features,
  p.price_fcfa AS plan_price,
  p.max_users  AS plan_max_users,
  pr.email     AS user_email,
  pr.full_name AS user_name,
  EXTRACT(DAY FROM (s.expires_at - NOW())) AS days_remaining
FROM subscriptions s
JOIN plans p ON s.plan_id = p.id
JOIN profiles pr ON s.user_id = pr.id
WHERE s.status = 'active'
  AND s.expires_at > NOW();

-- ── TABLE ACCESS_GRANTS ──────────────────────────────────────
-- L'admin peut octroyer un accès direct (sans paiement)
CREATE TABLE access_grants (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  granted_to    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  granted_by    UUID NOT NULL REFERENCES profiles(id),
  plan_id       UUID NOT NULL REFERENCES plans(id),
  starts_at     TIMESTAMPTZ DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  reason        TEXT,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── TABLE NOTIFICATIONS ──────────────────────────────────────
CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  body          TEXT,
  type          TEXT DEFAULT 'info' CHECK (type IN ('info','alert','expiry','system')),
  is_read       BOOLEAN DEFAULT FALSE,
  data          JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── TABLE ARTICLE_READS ──────────────────────────────────────
-- Comptage articles lus (pour limite essai 50 articles)
CREATE TABLE article_reads (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  article_id    TEXT NOT NULL,
  read_at       TIMESTAMPTZ DEFAULT NOW(),
  subscription_id UUID REFERENCES subscriptions(id)
);

-- ── TABLE AUDIT_LOG ──────────────────────────────────────────
CREATE TABLE audit_log (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id      UUID REFERENCES profiles(id),
  action        TEXT NOT NULL,
  target_type   TEXT,
  target_id     UUID,
  details       JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── FONCTIONS UTILITAIRES ────────────────────────────────────

-- Vérifier si un user a accès actif
CREATE OR REPLACE FUNCTION has_active_subscription(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = p_user_id
      AND status = 'active'
      AND expires_at > NOW()
  ) OR EXISTS (
    SELECT 1 FROM access_grants
    WHERE granted_to = p_user_id
      AND is_active = TRUE
      AND expires_at > NOW()
  );
END;
$$ LANGUAGE plpgsql;

-- Créer abonnement depuis admin
CREATE OR REPLACE FUNCTION admin_grant_access(
  p_user_email TEXT,
  p_plan_slug  TEXT,
  p_admin_id   UUID,
  p_note       TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_plan_id UUID;
  v_plan_days INTEGER;
  v_sub_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM profiles WHERE email = p_user_email;
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Utilisateur % introuvable', p_user_email; END IF;

  SELECT id, duration_days INTO v_plan_id, v_plan_days FROM plans WHERE slug = p_plan_slug AND is_active = TRUE;
  IF v_plan_id IS NULL THEN RAISE EXCEPTION 'Plan % introuvable', p_plan_slug; END IF;

  UPDATE subscriptions SET status = 'revoked'
  WHERE user_id = v_user_id AND status = 'active';

  INSERT INTO subscriptions (user_id, plan_id, expires_at, granted_by, note, status)
  VALUES (v_user_id, v_plan_id, NOW() + (v_plan_days || ' days')::INTERVAL, p_admin_id, p_note, 'active')
  RETURNING id INTO v_sub_id;

  INSERT INTO audit_log (actor_id, action, target_type, target_id, details)
  VALUES (p_admin_id, 'grant_access', 'subscription', v_sub_id,
          jsonb_build_object('plan', p_plan_slug, 'user', p_user_email, 'note', p_note));

  RETURN v_sub_id;
END;
$$ LANGUAGE plpgsql;

-- Révoquer accès
CREATE OR REPLACE FUNCTION admin_revoke_access(p_subscription_id UUID, p_admin_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE subscriptions SET status = 'revoked' WHERE id = p_subscription_id;
  INSERT INTO audit_log (actor_id, action, target_type, target_id)
  VALUES (p_admin_id, 'revoke_access', 'subscription', p_subscription_id);
END;
$$ LANGUAGE plpgsql;

-- Expirer automatiquement les abonnements
CREATE OR REPLACE FUNCTION expire_subscriptions()
RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
  UPDATE subscriptions SET status = 'expired'
  WHERE status = 'active' AND expires_at < NOW();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ── RLS (Row Level Security) ─────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_reads ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "users_own_profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "admin_all_profiles" ON profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Subscriptions
CREATE POLICY "users_own_subs" ON subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "admin_all_subs" ON subscriptions FOR ALL USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Notifications
CREATE POLICY "users_own_notifs" ON notifications FOR ALL USING (user_id = auth.uid());

-- Article reads
CREATE POLICY "users_own_reads" ON article_reads FOR ALL USING (user_id = auth.uid());

-- ── INDEX ────────────────────────────────────────────────────
CREATE INDEX idx_subs_user_status ON subscriptions(user_id, status);
CREATE INDEX idx_subs_expires ON subscriptions(expires_at) WHERE status = 'active';
CREATE INDEX idx_notifs_user ON notifications(user_id, is_read);
CREATE INDEX idx_reads_user ON article_reads(user_id, read_at);

-- ── TRIGGER updated_at ───────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
