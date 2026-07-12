-- ============================================================
-- SENTINEL — Journal des connexions (web + mobile)
--
-- Objectif : permettre au panneau Administration de voir QUI s'est
-- réellement connecté, depuis QUEL appareil (web/mobile), quel que soit
-- l'appareil utilisé par la personne. Avant cette table, chaque appareil
-- (localStorage web, AsyncStorage mobile) ne connaissait que ses propres
-- connexions — un admin ouvrant l'app web ne voyait jamais les connexions
-- faites depuis le téléphone d'un autre utilisateur.
--
-- Appliquer via `npx supabase db push` (app/sentinel-app/) ou copier-coller
-- dans l'éditeur SQL du projet Supabase, à la suite de 20260629000000.
-- ============================================================

CREATE TABLE connexions_log (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email       TEXT NOT NULL,
  name        TEXT,
  role        TEXT,
  platform    TEXT NOT NULL CHECK (platform IN ('web','mobile')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_connexions_email      ON connexions_log(email);
CREATE INDEX idx_connexions_created_at ON connexions_log(created_at DESC);

ALTER TABLE connexions_log ENABLE ROW LEVEL SECURITY;

-- Écriture : ouverte à anon ET authenticated. L'app web (SENTINEL_Surete_Web.html)
-- n'a pas de session Supabase réelle (son authentification reste locale,
-- volontairement — voir doLogin()) : elle n'écrit donc qu'avec la clé anon.
-- Un simple journal d'horodatage de connexion n'a pas besoin d'être protégé
-- en écriture au-delà de ça.
CREATE POLICY "connexions_log_insert" ON connexions_log
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Lecture : ouverte à anon ET authenticated, pour la même raison — le
-- panneau Administration web n'a pas de session Supabase pour restreindre
-- la lecture au seul rôle admin comme le fait la table `profiles`.
-- Compromis assumé : quiconque possède la clé anon publique (déjà exposée
-- côté client dans les deux apps) peut lire ce journal (email/nom/rôle/
-- horodatage de connexion) — un niveau d'exposition comparable à celui déjà
-- accepté pour l'annuaire utilisateurs affiché localement dans l'app.
CREATE POLICY "connexions_log_select" ON connexions_log
  FOR SELECT TO anon, authenticated USING (true);
