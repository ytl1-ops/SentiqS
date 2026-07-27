-- ============================================================
-- SENTINEL — Authentification réelle (Supabase Auth) + profils partagés
--
-- Remplace le système local (sentinel_users_v1, codes d'accès générés,
-- localStorage par appareil — jamais partagé entre appareils, jamais
-- vérifié côté serveur) par une identité réelle : Supabase Auth gère les
-- comptes email+mot de passe (auth.users, mots de passe hashés côté
-- serveur, sessions JWT réelles, réinitialisation par e-mail envoyée par
-- Supabase lui-même). Cette table `profiles` porte les données propres à
-- l'application (rôle, statut, plan, organisation...) que Supabase Auth ne
-- gère pas — jointe à auth.users par id, partagée entre TOUS les appareils
-- (corrige au passage le fait que les comptes n'étaient auparavant jamais
-- partagés entre appareils, y compris pour l'administrateur lui-même).
--
-- `data` en JSONB (même esprit que collecte_partagee/config_partagee) :
-- tous les champs secondaires (name, plan, organisation, zonePrioritaire,
-- accesJusquau, paiement, echeance, dlQuotaOverride, planSouhaite...) y
-- vivent en forme libre, sans migration de schéma à chaque nouveau champ —
-- seuls role/status sortent en colonnes dédiées, nécessaires aux politiques
-- RLS ci-dessous.
--
-- Sécurité :
--  - role est TOUJOURS déterminé côté serveur à la création (trigger
--    before insert) — jamais fait confiance à ce que le client envoie.
--    Seule l'adresse ADMIN_EMAIL reçoit le rôle admin automatiquement.
--  - Un utilisateur ne peut jamais changer son propre role/status en
--    modifiant son profil (trigger before update) — seul un admin le peut.
--  - Lecture : chacun voit son propre profil ; un admin voit tout le monde
--    (nécessaire pour les écrans "Utilisateurs enregistrés"/"Gestion
--    clientèle").
--
-- Appliquer via `npx supabase db push` (app/sentinel-app/) ou copier-coller
-- dans l'éditeur SQL du projet Supabase, à la suite de 20260718010000.
-- ============================================================

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin','user','reader')),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended')),
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- is_admin() : SECURITY DEFINER pour éviter la récursion RLS (une politique
-- sur profiles ne peut pas interroger profiles directement sans passer par
-- une fonction qui contourne temporairement RLS).
CREATE OR REPLACE FUNCTION is_admin() RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- role/status toujours determines cote serveur — jamais par la valeur
-- envoyee par le client a l'inscription. Seule ADMIN_EMAIL recoit 'admin'.
CREATE OR REPLACE FUNCTION profiles_before_insert() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'yorot225@gmail.com' THEN
    NEW.role := 'admin';
  ELSE
    NEW.role := 'user';
  END IF;
  NEW.status := 'active';
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_profiles_before_insert
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_before_insert();

-- Un utilisateur non-admin qui modifie SON PROPRE profil (ex. changer sa
-- zone prioritaire) ne peut jamais en profiter pour changer son propre
-- role/status au passage — seul un admin agissant sur un AUTRE profil le peut.
CREATE OR REPLACE FUNCTION profiles_before_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    NEW.role := OLD.role;
    NEW.status := OLD.status;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_profiles_before_update
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION profiles_before_update();

CREATE POLICY "profiles_select_own_or_admin" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin());

CREATE POLICY "profiles_insert_own" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own_or_admin" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR is_admin())
  WITH CHECK (id = auth.uid() OR is_admin());

CREATE POLICY "profiles_delete_admin_only" ON profiles
  FOR DELETE TO authenticated
  USING (is_admin());
