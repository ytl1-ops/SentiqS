-- ============================================================
-- SENTINEL — Agent AGENDA : persistance partagée des événements détectés
--
-- Problème corrigé : le module Agenda (web/SENTINEL_Surete_Web.html)
-- détecte déjà automatiquement des événements calendaires (colloques,
-- sommets, élections, travaux, manifestations...) dans les articles
-- collectés, sans distinction géographique — les 54 pays sont couverts de
-- la même façon (voir EVENT_PLANIFIE_KW/typeEvenementDetecte). Mais ce
-- résultat n'était visible que tant que l'article source restait dans ALL
-- (< 12h, voir estRecentReel) — au-delà, l'article part vers HISTORIQUE,
-- qui ne conserve pas les champs nécessaires pour reconstruire une entrée
-- Agenda. La fenêtre de 7 jours voulue pour l'Agenda (AGENDA_MAX_AGE)
-- n'était donc jamais réellement atteinte : un événement détecté restait
-- visible moins d'une demi-journée, quel que soit le nombre de collectes
-- effectuées ensuite.
--
-- Cette table persiste chaque événement détecté INDÉPENDAMMENT du sort de
-- l'article source dans ALL — même principe que articles_rag pour le RAG.
-- Alimentée après chaque collecte réussie (voir publierAgendaPartagee())
-- et par le job planifié (.github/workflows/collecte-planifiee.yml,
-- ~toutes les 30 min) qui couvre à lui seul les 54 pays sans dépendre
-- qu'un visiteur ait la page ouverte au bon moment.
--
-- Table normalisée (comme articles_rag) plutôt qu'un blob JSONB unique
-- (comme collecte_partagee) : chaque événement a son propre cycle de vie
-- (upsert par id, expiration individuelle), pas un instantané remplacé en
-- bloc à chaque collecte.
--
-- Appliquer via `npx supabase db push` (app/sentinel-app/) ou copier-coller
-- dans l'éditeur SQL du projet Supabase, à la suite de 20260718030000.
-- ============================================================

CREATE TABLE agenda_partagee (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  texte       TEXT NOT NULL DEFAULT '',
  agenda_type TEXT NOT NULL DEFAULT 'securite',
  niveau      TEXT,
  cy          TEXT,
  source      TEXT,
  link        TEXT,
  pub_date    TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX agenda_partagee_pub_date_idx ON agenda_partagee (pub_date DESC);
CREATE INDEX agenda_partagee_cy_idx ON agenda_partagee (cy);

ALTER TABLE agenda_partagee ENABLE ROW LEVEL SECURITY;

-- Mêmes compromis d'exposition que collecte_partagee/articles_rag
-- (20260718000000/20260718030000) : contenu déjà public (actualités RSS),
-- pas de PII. Lecture/écriture ouvertes à anon+authenticated pour que la
-- synchronisation cliente (best-effort, comme publierAgendaPartagee)
-- fonctionne sans friction.
CREATE POLICY "agenda_partagee_select" ON agenda_partagee
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "agenda_partagee_insert" ON agenda_partagee
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "agenda_partagee_update" ON agenda_partagee
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Purge automatique des événements trop anciens — légèrement au-delà de la
-- fenêtre d'affichage utile (AGENDA_MAX_AGE, 7 jours côté client) pour
-- laisser une marge, sans faire grossir la table indéfiniment au fil des
-- collectes répétées (~48 collectes/jour via le job planifié). À appeler
-- périodiquement (ex. pg_cron, ou manuellement) — jamais à chaque lecture.
CREATE OR REPLACE FUNCTION purger_agenda_partagee_perimes() RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM agenda_partagee WHERE pub_date IS NOT NULL AND pub_date < NOW() - INTERVAL '10 days';
$$;
