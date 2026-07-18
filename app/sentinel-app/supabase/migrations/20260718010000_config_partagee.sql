-- ============================================================
-- SENTINEL — Configuration partagée (web) : identifiants EmailJS
--
-- Bug corrigé : getEmailjsCfg()/saveEmailjsCfg() (SENTINEL_Surete_Web.html)
-- ne lisaient/écrivaient QUE le localStorage du navigateur courant. Un
-- administrateur configurant EmailJS depuis son propre poste ne rendait
-- donc l'envoi automatique (activation de compte, "mot de passe oublié")
-- fonctionnel QUE sur CE poste précis — tout autre visiteur (y compris
-- l'administrateur lui-même sur un autre appareil) tombait systématiquement
-- sur "EmailJS non configuré", aucun email n'était jamais réellement
-- transmis, quelle que soit la configuration enregistrée ailleurs.
--
-- Les identifiants EmailJS (Service ID / Template ID / Public Key) sont
-- conçus par EmailJS pour être exposés côté client (voir emailjs.com) —
-- mêmes compromis d'exposition que collecte_partagee/connexions_log :
-- aucune donnée personnelle ou secrète n'y transite.
--
-- Une seule ligne vivante (id fixe 'global') : simple UPSERT à chaque
-- enregistrement depuis Paramètres > Code d'activation par email.
--
-- Appliquer via `npx supabase db push` (app/sentinel-app/) ou copier-coller
-- dans l'éditeur SQL du projet Supabase, à la suite de 20260718000000.
-- ============================================================

CREATE TABLE config_partagee (
  id          TEXT PRIMARY KEY,
  emailjs     JSONB,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE config_partagee ENABLE ROW LEVEL SECURITY;

CREATE POLICY "config_partagee_select" ON config_partagee
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "config_partagee_insert" ON config_partagee
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "config_partagee_update" ON config_partagee
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
