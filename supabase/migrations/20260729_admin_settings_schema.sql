-- ═══════════════════════════════════════════════════════════════════════════
-- SentiqS — Schéma du module Paramètres (admin)
--
-- Crée les 6 tables attendues par webapp/src/pages/dashboard/settings :
--   alert_channels, subscribers, subscription_plans, user_subscriptions,
--   traffic_logs, payment_configs
--
-- Les panneaux React typent les identifiants en `number` : on utilise donc
-- des clés bigint identity, pas des uuid.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Helpers ───────────────────────────────────────────────────────────────

-- Vérifie que l'appelant est administrateur. En security definer pour éviter
-- la récursion RLS sur public.profiles.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── Abonnés ───────────────────────────────────────────────────────────────
create table if not exists public.subscribers (
  id bigint primary key generated always as identity,
  name text not null,
  email text not null unique,
  phone text,
  country text,
  subscription_tier text not null default 'Essentiel'
    check (subscription_tier in ('Essentiel', 'Professionnel', 'Enterprise')),
  status text not null default 'actif'
    check (status in ('actif', 'inactif', 'suspendu')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscribers_created_at_idx on public.subscribers (created_at desc);
create index if not exists subscribers_status_idx on public.subscribers (status);

-- ─── Plans d'abonnement ────────────────────────────────────────────────────
create table if not exists public.subscription_plans (
  id bigint primary key generated always as identity,
  name text not null unique,
  price numeric(10, 2) not null default 0 check (price >= 0),
  currency text not null default 'EUR',
  billing_cycle text not null default 'monthly'
    check (billing_cycle in ('monthly', 'quarterly', 'yearly')),
  features jsonb not null default '[]'::jsonb,
  download_limit int not null default 0 check (download_limit >= 0),
  max_alerts_per_day int not null default 0 check (max_alerts_per_day >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists subscription_plans_price_idx on public.subscription_plans (price);

-- ─── Abonnements utilisateurs ──────────────────────────────────────────────
-- Les clés étrangères sont indispensables : le panneau Abonnements utilise
-- l'imbrication PostgREST `subscribers(name, email)` / `subscription_plans(name)`,
-- qui ne fonctionne que s'il existe une contrainte de clé étrangère.
create table if not exists public.user_subscriptions (
  id bigint primary key generated always as identity,
  subscriber_id bigint not null references public.subscribers (id) on delete cascade,
  plan_id bigint not null references public.subscription_plans (id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'expired', 'cancelled', 'pending')),
  start_date date not null default current_date,
  end_date date,
  auto_renew boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create index if not exists user_subscriptions_subscriber_idx on public.user_subscriptions (subscriber_id);
create index if not exists user_subscriptions_plan_idx on public.user_subscriptions (plan_id);
create index if not exists user_subscriptions_created_at_idx on public.user_subscriptions (created_at desc);

-- ─── Canaux d'alerte SMS / WhatsApp / Email ────────────────────────────────
create table if not exists public.alert_channels (
  id bigint primary key generated always as identity,
  name text not null,
  channel_type text not null default 'sms'
    check (channel_type in ('sms', 'whatsapp', 'email')),
  phone text,
  email text,
  is_active boolean not null default true,
  alert_severities jsonb not null default '["critical", "high"]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- un canal email a besoin d'un email, un canal sms/whatsapp d'un téléphone
  check (
    (channel_type = 'email' and email is not null)
    or (channel_type in ('sms', 'whatsapp') and phone is not null)
  )
);

create index if not exists alert_channels_created_at_idx on public.alert_channels (created_at desc);
create index if not exists alert_channels_active_idx on public.alert_channels (is_active) where is_active;

-- ─── Journal de trafic ─────────────────────────────────────────────────────
-- `timestamp` est le nom de colonne attendu par TrafficPanel (order by timestamp).
create table if not exists public.traffic_logs (
  id bigint primary key generated always as identity,
  page_path text not null,
  country text,
  region text,
  ip_hash text,
  user_agent text,
  referrer text,
  duration_seconds int check (duration_seconds >= 0),
  "timestamp" timestamptz not null default now()
);

create index if not exists traffic_logs_timestamp_idx on public.traffic_logs ("timestamp" desc);
create index if not exists traffic_logs_country_idx on public.traffic_logs (country);

-- ─── Configuration des paiements ───────────────────────────────────────────
create table if not exists public.payment_configs (
  id bigint primary key generated always as identity,
  provider text not null unique,
  display_name text not null,
  is_active boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  supported_currencies jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_configs_created_at_idx on public.payment_configs (created_at desc);

-- ─── Triggers updated_at ───────────────────────────────────────────────────
drop trigger if exists touch_subscribers on public.subscribers;
create trigger touch_subscribers before update on public.subscribers
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_subscription_plans on public.subscription_plans;
create trigger touch_subscription_plans before update on public.subscription_plans
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_user_subscriptions on public.user_subscriptions;
create trigger touch_user_subscriptions before update on public.user_subscriptions
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_alert_channels on public.alert_channels;
create trigger touch_alert_channels before update on public.alert_channels
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_payment_configs on public.payment_configs;
create trigger touch_payment_configs before update on public.payment_configs
  for each row execute function public.touch_updated_at();

-- ─── Row Level Security ────────────────────────────────────────────────────
-- Le module Paramètres est réservé aux administrateurs : seul le rôle 'admin'
-- de public.profiles peut lire et écrire, à deux exceptions près documentées
-- plus bas (catalogue des plans, insertion des visites).
alter table public.subscribers          enable row level security;
alter table public.subscription_plans   enable row level security;
alter table public.user_subscriptions   enable row level security;
alter table public.alert_channels       enable row level security;
alter table public.traffic_logs         enable row level security;
alter table public.payment_configs      enable row level security;

drop policy if exists "admins manage subscribers" on public.subscribers;
create policy "admins manage subscribers" on public.subscribers
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage user_subscriptions" on public.user_subscriptions;
create policy "admins manage user_subscriptions" on public.user_subscriptions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage alert_channels" on public.alert_channels;
create policy "admins manage alert_channels" on public.alert_channels
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "admins manage payment_configs" on public.payment_configs;
create policy "admins manage payment_configs" on public.payment_configs
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Le catalogue des plans alimente aussi la grille tarifaire publique :
-- lecture ouverte, écriture réservée aux administrateurs.
drop policy if exists "plans are publicly readable" on public.subscription_plans;
create policy "plans are publicly readable" on public.subscription_plans
  for select to anon, authenticated using (true);

drop policy if exists "admins manage subscription_plans" on public.subscription_plans;
create policy "admins manage subscription_plans" on public.subscription_plans
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Les visites sont enregistrées depuis le navigateur (visiteur non connecté
-- inclus) mais ne sont relisables que par un administrateur.
drop policy if exists "anyone can log a visit" on public.traffic_logs;
create policy "anyone can log a visit" on public.traffic_logs
  for insert to anon, authenticated with check (true);

drop policy if exists "admins read traffic_logs" on public.traffic_logs;
create policy "admins read traffic_logs" on public.traffic_logs
  for select to authenticated using (public.is_admin());

drop policy if exists "admins delete traffic_logs" on public.traffic_logs;
create policy "admins delete traffic_logs" on public.traffic_logs
  for delete to authenticated using (public.is_admin());

-- ─── Données de référence ──────────────────────────────────────────────────
-- Plans et fournisseurs de paiement : référentiel, pas des données de démo.
insert into public.subscription_plans (name, price, currency, billing_cycle, features, download_limit, max_alerts_per_day)
values
  ('Essentiel', 49.00, 'EUR', 'monthly',
   '["Veille quotidienne", "3 pays suivis", "Alertes email"]'::jsonb, 10, 20),
  ('Professionnel', 149.00, 'EUR', 'monthly',
   '["Veille temps réel", "15 pays suivis", "Alertes SMS et WhatsApp", "Rapports hebdomadaires"]'::jsonb, 100, 200),
  ('Enterprise', 499.00, 'EUR', 'monthly',
   '["Couverture illimitée", "Alertes multicanal", "Rapports sur mesure", "Accès API", "Support dédié"]'::jsonb, 1000, 2000)
on conflict (name) do nothing;

insert into public.payment_configs (provider, display_name, is_active, supported_currencies)
values
  ('stripe',        'Carte bancaire (Stripe)', false, '["EUR", "USD", "XOF"]'::jsonb),
  ('paypal',        'PayPal',                  false, '["EUR", "USD"]'::jsonb),
  ('bank_transfer', 'Virement bancaire',       false, '["EUR", "XOF"]'::jsonb),
  ('mobile_money',  'Mobile Money',            false, '["XOF", "XAF"]'::jsonb)
on conflict (provider) do nothing;
