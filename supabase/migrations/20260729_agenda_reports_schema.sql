-- ═══════════════════════════════════════════════════════════════════════════
-- SentiqS — Agenda et Rapports
--
-- Ces deux vues du tableau de bord ne se dérivent d'aucune donnée amont :
-- l'agenda porte des événements d'organisation (réunions, exercices, audits)
-- et les rapports sont des livrables produits par la cellule d'analyse. La
-- collecte RSS ne peut ni les inventer ni les déduire — il leur faut donc
-- de vraies tables, alimentées par les utilisateurs.
--
-- Les valeurs autorisées reprennent exactement celles que les pages
-- attendent (typeConfig d'agenda/page.tsx, filtres de reports/page.tsx).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── Agenda ────────────────────────────────────────────────────────────────
create table if not exists public.agenda_events (
  id bigint primary key generated always as identity,
  date date not null,
  title text not null,
  type text not null default 'meeting' check (
    type in ('meeting', 'exercise', 'conference', 'audit', 'briefing', 'training', 'deadline', 'mission')
  ),
  priority text not null default 'medium'
    check (priority in ('critical', 'high', 'medium', 'low')),
  -- « 10:00 » et « 1h30 » : la vue les affiche tels quels, sans arithmétique.
  time text,
  duration text,
  location text,
  country text,
  organizer text,
  participants int check (participants >= 0),
  description text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agenda_events_date_idx on public.agenda_events (date);
create index if not exists agenda_events_type_idx on public.agenda_events (type);

-- ─── Rapports ──────────────────────────────────────────────────────────────
create table if not exists public.reports (
  id bigint primary key generated always as identity,
  title text not null,
  type text not null default 'monthly' check (
    type in ('correlation', 'monthly', 'risk', 'executive', 'quarterly', 'data')
  ),
  format text not null default 'pdf' check (format in ('pdf', 'xlsx', 'csv', 'docx')),
  region text,
  countries jsonb not null default '[]'::jsonb,
  alert_count int not null default 0 check (alert_count >= 0),
  corr_count int not null default 0 check (corr_count >= 0),
  status text not null default 'generating' check (status in ('generating', 'ready', 'failed')),
  -- Taille lisible (« 2,4 Mo »), renseignée à la fin de la génération.
  size text,
  author text,
  summary text,
  -- Chemin dans Supabase Storage ; nul tant que le rapport n'est pas prêt.
  file_path text,
  generated_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reports_generated_at_idx on public.reports (generated_at desc);
create index if not exists reports_status_idx on public.reports (status);
create index if not exists reports_type_idx on public.reports (type);

-- ─── Triggers updated_at ───────────────────────────────────────────────────
-- public.touch_updated_at() est créée par 20260729_admin_settings_schema.sql.
drop trigger if exists touch_agenda_events on public.agenda_events;
create trigger touch_agenda_events before update on public.agenda_events
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_reports on public.reports;
create trigger touch_reports before update on public.reports
  for each row execute function public.touch_updated_at();

-- ─── Row Level Security ────────────────────────────────────────────────────
-- Agenda et rapports sont le plan de travail commun de la cellule : tout
-- utilisateur connecté les consulte, seuls les admins les modifient.
alter table public.agenda_events enable row level security;
alter table public.reports       enable row level security;

drop policy if exists "authenticated read agenda" on public.agenda_events;
create policy "authenticated read agenda" on public.agenda_events
  for select to authenticated using (true);

drop policy if exists "admins manage agenda" on public.agenda_events;
create policy "admins manage agenda" on public.agenda_events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "authenticated read reports" on public.reports;
create policy "authenticated read reports" on public.reports
  for select to authenticated using (true);

drop policy if exists "admins manage reports" on public.reports;
create policy "admins manage reports" on public.reports
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ─── Stockage des rapports ─────────────────────────────────────────────────
-- Bucket privé : reports.file_path y pointe, et le téléchargement passe par
-- une URL signée (voir handleDownload dans pages/dashboard/reports/page.tsx).
insert into storage.buckets (id, name, public)
values ('reports', 'reports', false)
on conflict (id) do nothing;

drop policy if exists "authenticated read report files" on storage.objects;
create policy "authenticated read report files" on storage.objects
  for select to authenticated using (bucket_id = 'reports');

drop policy if exists "admins write report files" on storage.objects;
create policy "admins write report files" on storage.objects
  for all to authenticated
  using (bucket_id = 'reports' and public.is_admin())
  with check (bucket_id = 'reports' and public.is_admin());
