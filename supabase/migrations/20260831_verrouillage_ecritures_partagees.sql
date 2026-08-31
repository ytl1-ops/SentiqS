-- ============================================================
-- Verrouillage des écritures anonymes sur les tables partagées
--
-- ⚠ ORDRE OBLIGATOIRE — voir supabase/README.md
--    1. Déployer la fonction Edge `publier-collecte` et définir son secret
--       COLLECTEUR_JETON.
--    2. Vérifier qu'une publication passe bien par la fonction (le job
--       planifié doit rafraîchir collecte_partagee.updated_at).
--    3. SEULEMENT ENSUITE appliquer cette migration.
--
--    Appliquée avant l'étape 2, elle arrête la collecte : le navigateur
--    n'aurait plus le droit d'écrire, et rien n'aurait pris le relais.
--
-- Ce que corrige cette migration
--
-- Cinq tables acceptaient INSERT et UPDATE du rôle `anon` avec
-- WITH CHECK (true). La clé anonyme étant publique par conception — en
-- clair dans web/SentiqS_Web.html, comme le veut le modèle Supabase — cela
-- revenait à autoriser n'importe qui à réécrire le cache de collecte, la
-- configuration partagée et l'agenda servis à TOUS les visiteurs.
--
-- Le raisonnement d'origine (voir le commentaire de 20260718000000 :
-- « le contenu ici est déjà public, pas de PII ») confond confidentialité
-- et intégrité. Le risque n'était pas la lecture, c'était l'écriture.
--
-- Après cette migration, les écritures passent par la clé de service,
-- détenue seulement par la fonction Edge. La LECTURE reste ouverte : c'est
-- elle qui permet à un visiteur de profiter du cache sans se connecter, et
-- elle ne présente pas le même risque.
--
-- connexions_log fait exception dans l'autre sens : son INSERT anonyme est
-- conservé (un visiteur doit pouvoir journaliser sa connexion) mais sa
-- LECTURE, aujourd'hui ouverte à `anon`, expose les adresses e-mail et les
-- horaires de connexion de tous les comptes — une donnée personnelle
-- lisible par quiconque possède la clé publique. Elle est réservée aux
-- administrateurs.
--
-- Idempotent : chaque politique est supprimée avant d'être recréée.
-- ============================================================

-- ── collecte_partagee ───────────────────────────────────────
-- Écriture réservée à la fonction Edge (clé de service).
drop policy if exists "collecte_partagee_insert" on public.collecte_partagee;
drop policy if exists "collecte_partagee_update" on public.collecte_partagee;

-- Lecture inchangée : le cache doit rester lisible sans compte.
drop policy if exists "collecte_partagee_select" on public.collecte_partagee;
create policy "collecte_partagee_select" on public.collecte_partagee
  for select to anon, authenticated using (true);

-- ── config_partagee ─────────────────────────────────────────
-- Configuration de l'application : écriture réservée aux administrateurs.
drop policy if exists "config_partagee_insert" on public.config_partagee;
drop policy if exists "config_partagee_update" on public.config_partagee;

drop policy if exists "config_partagee_admins" on public.config_partagee;
create policy "config_partagee_admins" on public.config_partagee
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "config_partagee_select" on public.config_partagee;
create policy "config_partagee_select" on public.config_partagee
  for select to anon, authenticated using (true);

-- ── agenda_partagee ─────────────────────────────────────────
-- Alimenté par le job planifié (clé de service) et édité par un
-- administrateur connecté.
drop policy if exists "agenda_partagee_insert" on public.agenda_partagee;
drop policy if exists "agenda_partagee_update" on public.agenda_partagee;

drop policy if exists "agenda_partagee_admins" on public.agenda_partagee;
create policy "agenda_partagee_admins" on public.agenda_partagee
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "agenda_partagee_select" on public.agenda_partagee;
create policy "agenda_partagee_select" on public.agenda_partagee
  for select to anon, authenticated using (true);

-- ── articles_rag ────────────────────────────────────────────
-- Corpus de l'assistant : écriture réservée à la clé de service, lecture
-- conservée (la fonction rag-ask interroge cette table).
drop policy if exists "articles_rag_insert" on public.articles_rag;
drop policy if exists "articles_rag_update" on public.articles_rag;

drop policy if exists "articles_rag_select" on public.articles_rag;
create policy "articles_rag_select" on public.articles_rag
  for select to anon, authenticated using (true);

-- ── connexions_log ──────────────────────────────────────────
-- Insertion anonyme conservée : un visiteur qui se connecte doit pouvoir
-- l'enregistrer. Lecture réservée aux administrateurs : ce journal porte
-- des adresses e-mail et des horaires, donc des données personnelles.
drop policy if exists "connexions_log_select" on public.connexions_log;
create policy "connexions_log_admins_select" on public.connexions_log
  for select to authenticated using (public.is_admin());

-- ── Vérification ────────────────────────────────────────────
-- Après application, aucune de ces tables ne doit plus porter de politique
-- d'écriture ouverte au rôle anon. Ce bloc échoue bruyamment si c'est le
-- cas, plutôt que de laisser croire que le verrou est posé.
do $$
declare
  restantes int;
begin
  select count(*) into restantes
  from pg_policies
  where schemaname = 'public'
    and tablename in ('collecte_partagee','config_partagee','agenda_partagee','articles_rag')
    and cmd in ('INSERT','UPDATE','ALL')
    and 'anon' = any(roles);

  if restantes > 0 then
    raise exception 'Verrouillage incomplet : % politique(s) d''écriture encore ouverte(s) au rôle anon.', restantes;
  end if;

  raise notice 'Écritures anonymes retirées des tables partagées. Les publications passent désormais par la fonction Edge publier-collecte.';
end
$$;
