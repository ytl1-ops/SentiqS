-- ============================================================
-- Application des droits d'abonnement CÔTÉ SERVEUR
--
-- Aujourd'hui, tout le paywall vit dans le navigateur : le plan de
-- l'utilisateur, le quota de son forfait et le compteur de téléchargements
-- sont lus et écrits dans localStorage (`sentinel_dl_quota_v1`,
-- `sentinel_dl_stats`, la liste des comptes). Vider le stockage du site
-- remet le quota à zéro ; éditer une valeur suffit à passer au forfait
-- Entreprise. Aucune vérification serveur ne s'y oppose, alors que la
-- grille tarifaire affiche 290 €/mois.
--
-- Cette migration pose le socle : une table de téléchargements que le
-- client ne peut pas écrire, et deux fonctions qui calculent le droit à
-- partir de l'abonnement réel. L'application de ce droit se fait dans la
-- fonction Edge `autoriser-export` (voir supabase/README.md), seule
-- détentrice de la clé de service.
--
-- Le pont entre identité et abonnement passe par l'adresse e-mail :
--   auth.users → profiles.email → subscribers.email → user_subscriptions
--   → subscription_plans.download_limit
-- C'est le schéma existant ; on ne le refait pas, on l'exploite.
--
-- Idempotent : tables et politiques créées si absentes, fonctions
-- remplacées.
-- ============================================================

-- ── Journal des téléchargements ─────────────────────────────
-- Remplace `sentinel_dl_stats` (localStorage). Aucune politique
-- d'insertion n'est créée : seule la clé de service écrit ici, ce qui rend
-- le compteur infalsifiable depuis le navigateur.
create table if not exists public.telechargements (
  id          bigint primary key generated always as identity,
  user_id     uuid not null references auth.users (id) on delete cascade,
  email       text not null,
  format      text not null,
  nom         text,
  created_at  timestamptz not null default now()
);

create index if not exists telechargements_user_idx
  on public.telechargements (user_id, created_at desc);

alter table public.telechargements enable row level security;

-- Chacun consulte sa propre consommation (affichage « il vous reste N »).
drop policy if exists "telechargements_lecture_propre" on public.telechargements;
create policy "telechargements_lecture_propre" on public.telechargements
  for select to authenticated using (user_id = auth.uid());

-- Un administrateur voit tout (panneau Téléchargements par abonnement).
drop policy if exists "telechargements_lecture_admin" on public.telechargements;
create policy "telechargements_lecture_admin" on public.telechargements
  for select to authenticated using (public.is_admin());

-- ── Résolution du forfait d'un utilisateur ──────────────────
-- Renvoie la limite mensuelle de téléchargements, ou NULL pour illimité.
-- SECURITY DEFINER : traverse subscribers/user_subscriptions/plans, que
-- l'utilisateur n'a pas à pouvoir lire directement.
create or replace function public.limite_telechargements(uid uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  courriel text;
  limite   int;
  est_admin boolean;
begin
  select email into courriel from public.profiles where id = uid;
  if courriel is null then
    return 0; -- pas de profil : aucun droit
  end if;

  -- L'administrateur n'est jamais limité (comportement actuel conservé).
  select exists (select 1 from public.profiles where id = uid and role = 'admin')
    into est_admin;
  if est_admin then
    return null;
  end if;

  select p.download_limit into limite
  from public.subscribers s
  join public.user_subscriptions us on us.subscriber_id = s.id
  join public.subscription_plans p on p.id = us.plan_id
  where lower(s.email) = lower(courriel)
    and us.status = 'active'
    and (us.end_date is null or us.end_date >= current_date)
  order by p.download_limit desc nulls first
  limit 1;

  -- Aucun abonnement actif : forfait gratuit. La valeur vit dans la table
  -- des plans si un plan « Gratuit » y figure, sinon on retombe sur 5,
  -- valeur qui était codée en dur côté client (DL_QUOTA_DEFAUT).
  if limite is null then
    select p.download_limit into limite
    from public.subscription_plans p
    where lower(p.name) in ('gratuit', 'free')
    limit 1;
  end if;

  return coalesce(limite, 5);
end;
$$;

-- ── Consommation restante sur la période en cours ────────────
-- Période = mois calendaire courant, cohérent avec un forfait mensuel.
-- Renvoie NULL pour illimité.
create or replace function public.telechargements_restants(uid uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  limite   int;
  consommes int;
begin
  limite := public.limite_telechargements(uid);
  if limite is null then
    return null; -- illimité
  end if;

  select count(*) into consommes
  from public.telechargements
  where user_id = uid
    and created_at >= date_trunc('month', now());

  return greatest(0, limite - consommes);
end;
$$;

-- Lecture autorisée pour l'utilisateur connecté : l'interface affiche le
-- solde. L'ÉCRITURE du journal reste hors de sa portée, c'est ce qui
-- compte.
grant execute on function public.limite_telechargements(uuid) to authenticated;
grant execute on function public.telechargements_restants(uuid) to authenticated;

do $$
begin
  raise notice 'Socle des quotas serveur en place. Déployez la fonction Edge autoriser-export pour que le droit soit réellement appliqué.';
end
$$;
