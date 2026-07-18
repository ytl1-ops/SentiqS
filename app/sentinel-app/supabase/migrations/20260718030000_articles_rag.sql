-- ============================================================
-- SENTINEL — Index de recherche pour l'Assistant IA (RAG)
--
-- Objectif : permettre à l'Assistant IA (voir supabase/functions/rag-ask
-- et poserQuestionAssistant() dans web/SENTINEL_Surete_Web.html) de
-- répondre aux questions des utilisateurs en s'appuyant UNIQUEMENT sur
-- les articles réellement collectés (retrieval), jamais sur la
-- connaissance générale du modèle seule — évite les réponses inventées
-- sur des événements récents que le modèle ne peut pas connaître.
--
-- Table normalisée à part (plutôt que d'interroger le JSONB de
-- collecte_partagee directement) : la recherche plein texte Postgres
-- (tsvector/GIN) a besoin de colonnes indexables, pas d'un tableau JSON
-- unique. Alimentée par le même flux client que collecte_partagee
-- (voir publierArticlesRagPartages(), appelée juste après une collecte
-- réussie) — best-effort, jamais bloquant.
--
-- Recherche plein texte (pas d'embeddings vectoriels) : évite la
-- dépendance à un second fournisseur d'API (embeddings) rien que pour
-- l'indexation — la génération de réponse (Anthropic) reste le seul
-- appel LLM payant. Peut évoluer vers pgvector + embeddings plus tard
-- si la pertinence de la recherche plein texte s'avère insuffisante.
--
-- Appliquer via `npx supabase db push` (app/sentinel-app/) ou copier-coller
-- dans l'éditeur SQL du projet Supabase, à la suite de 20260718020000.
-- ============================================================

CREATE TABLE articles_rag (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  summary     TEXT NOT NULL DEFAULT '',
  source      TEXT,
  link        TEXT,
  cy          TEXT,
  category    TEXT,
  pub_date    TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('french', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('french', coalesce(summary, '')), 'B')
  ) STORED
);

CREATE INDEX articles_rag_search_idx ON articles_rag USING GIN (search_vector);
CREATE INDEX articles_rag_pub_date_idx ON articles_rag (pub_date DESC);

ALTER TABLE articles_rag ENABLE ROW LEVEL SECURITY;

-- Mêmes compromis d'exposition que collecte_partagee (20260718000000) :
-- contenu déjà public (actualités RSS), pas de PII. Lecture/écriture
-- ouvertes à anon+authenticated pour que la synchronisation cliente
-- (best-effort, comme publierCollectePartagee) fonctionne sans friction.
-- La fonction Edge rag-ask, elle, interroge cette table avec la clé de
-- service (contourne RLS), donc ces politiques ne conditionnent QUE la
-- synchronisation, jamais la qualité des réponses de l'assistant.
CREATE POLICY "articles_rag_select" ON articles_rag
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "articles_rag_insert" ON articles_rag
  FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "articles_rag_update" ON articles_rag
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- Purge automatique des articles trop anciens (au-delà de la fenêtre
-- utile pour un assistant d'actualité sûreté) — évite une croissance
-- illimitée de la table au fil des collectes répétées. À appeler
-- périodiquement (ex. pg_cron, ou manuellement) — PAS à chaque requête
-- de l'assistant (voir rechercher_articles_rag ci-dessous, qui filtre
-- déjà par fraîcheur sans supprimer aucune ligne).
CREATE OR REPLACE FUNCTION purger_articles_rag_perimes() RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM articles_rag WHERE pub_date IS NOT NULL AND pub_date < NOW() - INTERVAL '14 days';
$$;

-- rechercher_articles_rag(requete, limite) : recherche plein texte classee
-- par pertinence (ts_rank), restreinte aux articles des 10 derniers jours
-- (fenetre utile pour un assistant d'actualite surete, evite de citer un
-- article perime meme s'il correspond textuellement). Fonction dediee
-- (plutot qu'une requete construite cote Edge Function) : parametree
-- nativement par Postgres (aucun risque d'injection), appelable via RPC
-- avec la cle anon/authenticated ou la cle de service indifferemment.
CREATE OR REPLACE FUNCTION rechercher_articles_rag(requete TEXT, limite INT DEFAULT 8)
RETURNS TABLE (
  id TEXT, title TEXT, summary TEXT, source TEXT, link TEXT,
  cy TEXT, category TEXT, pub_date TIMESTAMPTZ, rang REAL
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT id, title, summary, source, link, cy, category, pub_date,
         ts_rank(search_vector, websearch_to_tsquery('french', requete)) AS rang
  FROM articles_rag
  WHERE search_vector @@ websearch_to_tsquery('french', requete)
    AND (pub_date IS NULL OR pub_date > NOW() - INTERVAL '10 days')
  ORDER BY rang DESC
  LIMIT limite;
$$;

-- Repli utilise par la fonction Edge quand la recherche plein texte ne
-- trouve aucun resultat (question trop generale, vocabulaire different
-- des articles...) : les articles les plus recents plutot qu'un ecran
-- vide, avec un avertissement explicite au modele qu'ils ne sont pas
-- forcement pertinents (voir supabase/functions/rag-ask).
CREATE OR REPLACE FUNCTION articles_rag_plus_recents(limite INT DEFAULT 8)
RETURNS TABLE (
  id TEXT, title TEXT, summary TEXT, source TEXT, link TEXT,
  cy TEXT, category TEXT, pub_date TIMESTAMPTZ
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT id, title, summary, source, link, cy, category, pub_date
  FROM articles_rag
  ORDER BY pub_date DESC NULLS LAST
  LIMIT limite;
$$;

GRANT EXECUTE ON FUNCTION rechercher_articles_rag(TEXT, INT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION articles_rag_plus_recents(INT) TO anon, authenticated, service_role;
