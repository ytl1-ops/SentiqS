-- ═══════════════════════════════════════════════════════════════════════════
-- SentiqS Alerts Schema
-- Real-time alert system with escalation and audit trail
-- ═══════════════════════════════════════════════════════════════════════════

-- Enable necessary extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─── Alerts Table ──────────────────────────────────────────────────────────
create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  country text not null,
  region text,
  title text not null,
  description text,
  severity text not null check (severity in ('CRITIQUE', 'ÉLEVÉ', 'MODÉRÉ', 'STABLE')),
  category text not null check (category in ('SÉCURITÉ', 'HUMANITAIRE', 'POLITIQUE', 'ÉCONOMIE')),
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED', 'ESCALATED')),
  location_lat numeric,
  location_lng numeric,
  location_city text,
  source_url text,
  source_type text check (source_type in ('RSS', 'TWITTER', 'NEWS', 'GOVERNMENT')),
  priority int check (priority >= 1 and priority <= 100),
  channels text[] default '{}',
  tags text[] default '{}',
  related_alerts uuid[] default '{}',
  assigned_to uuid references auth.users(id) on delete set null,
  acknowledged_at timestamptz,
  acknowledged_by uuid references auth.users(id) on delete set null,
  escalation_level int not null default 0 check (escalation_level >= 0 and escalation_level <= 3),
  next_escalation_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  detected_at timestamptz default now(),
  updated_at timestamptz not null default now()
);

-- ─── Alert Rules Table ─────────────────────────────────────────────────────
create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  enabled boolean not null default true,
  condition jsonb not null default '{}',
  actions jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, name)
);

-- ─── Alert Audit Log ──────────────────────────────────────────────────────
create table if not exists public.alert_audit_log (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('CREATED', 'ACKNOWLEDGED', 'RESOLVED', 'ESCALATED', 'ASSIGNED', 'UNASSIGNED')),
  reason text,
  old_status text,
  new_status text,
  old_escalation_level int,
  new_escalation_level int,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ─── Alert Notification Queue ──────────────────────────────────────────────
create table if not exists public.alert_notifications (
  id uuid primary key default gen_random_uuid(),
  alert_id uuid not null references public.alerts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null check (channel in ('PUSH', 'EMAIL', 'SMS', 'WEBHOOK', 'IN_APP')),
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED', 'ACKNOWLEDGED')),
  sent_at timestamptz,
  acknowledged_at timestamptz,
  error_message text,
  retry_count int default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── Indexes ───────────────────────────────────────────────────────────────
create index on public.alerts(user_id, status, created_at desc);
create index on public.alerts(assigned_to, status);
create index on public.alerts(escalation_level) where escalation_level > 0;
create index on public.alerts(country, status);
create index on public.alerts(severity);
create index on public.alerts(created_at desc);
create index on public.alert_rules(user_id, enabled);
create index on public.alert_audit_log(alert_id);
create index on public.alert_audit_log(user_id);
create index on public.alert_notifications(user_id, status, created_at desc);
create index on public.alert_notifications(alert_id);

-- ─── Row Level Security ────────────────────────────────────────────────────
alter table public.alerts enable row level security;
alter table public.alert_rules enable row level security;
alter table public.alert_audit_log enable row level security;
alter table public.alert_notifications enable row level security;

-- Users can see their own alerts
create policy "Users can view their own alerts" on public.alerts
  for select
  using (auth.uid() = user_id or auth.uid() = assigned_to or
         (select role from public.profiles where id = auth.uid()) in ('ADMIN', 'MANAGER'));

-- Users can update their own alerts
create policy "Users can update their alerts" on public.alerts
  for update
  using (auth.uid() = assigned_to or
         (select role from public.profiles where id = auth.uid()) = 'ADMIN');

-- Users can view their own rules
create policy "Users can view their own alert rules" on public.alert_rules
  for select
  using (auth.uid() = user_id);

-- Users can manage their own rules
create policy "Users can manage their alert rules" on public.alert_rules
  for update
  using (auth.uid() = user_id);

-- ─── Triggers ──────────────────────────────────────────────────────────────

-- Update updated_at timestamp
create or replace function public.update_alert_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger update_alerts_timestamp
  before update on public.alerts
  for each row
  execute function public.update_alert_timestamp();

create trigger update_alert_rules_timestamp
  before update on public.alert_rules
  for each row
  execute function public.update_alert_timestamp();

create trigger update_alert_notifications_timestamp
  before update on public.alert_notifications
  for each row
  execute function public.update_alert_timestamp();

-- Log alert changes to audit_log
create or replace function public.log_alert_change()
returns trigger as $$
begin
  if (tg_op = 'UPDATE') then
    insert into public.alert_audit_log (
      alert_id,
      user_id,
      action,
      old_status,
      new_status,
      old_escalation_level,
      new_escalation_level,
      metadata
    ) values (
      new.id,
      auth.uid(),
      case
        when new.status != old.status and new.status = 'ACKNOWLEDGED' then 'ACKNOWLEDGED'
        when new.status != old.status and new.status = 'RESOLVED' then 'RESOLVED'
        when new.escalation_level > old.escalation_level then 'ESCALATED'
        when new.assigned_to != old.assigned_to then 'ASSIGNED'
        else 'UPDATED'
      end,
      old.status,
      new.status,
      old.escalation_level,
      new.escalation_level,
      jsonb_build_object(
        'changed_at', now(),
        'by_user', auth.uid()
      )
    );
  elsif (tg_op = 'INSERT') then
    insert into public.alert_audit_log (
      alert_id,
      user_id,
      action,
      new_status,
      metadata
    ) values (
      new.id,
      new.user_id,
      'CREATED',
      new.status,
      jsonb_build_object('created_at', now())
    );
  end if;
  return new;
end;
$$ language plpgsql;

create trigger log_alert_changes
  after insert or update on public.alerts
  for each row
  execute function public.log_alert_change();

-- ─── Views ────────────────────────────────────────────────────────────────

-- Active alerts summary
create or replace view public.alerts_summary as
select
  country,
  severity,
  count(*) as count,
  count(case when escalation_level > 0 then 1 end) as escalated,
  count(case when status = 'ACKNOWLEDGED' then 1 end) as acknowledged,
  max(created_at) as latest_alert
from public.alerts
where status = 'ACTIVE'
group by country, severity;

-- Unacknowledged critical alerts
create or replace view public.critical_unacknowledged_alerts as
select *
from public.alerts
where status = 'ACTIVE'
  and severity = 'CRITIQUE'
  and acknowledged_at is null
order by created_at desc;

-- ─── Sample Data (for testing) ────────────────────────────────────────────
-- Uncomment to load test data
/*
insert into public.alerts (
  user_id, country, title, description, severity, category, priority, status, channels
) values
  (auth.uid(), 'Mali', 'Affrontements signalés à Gao', 'Incidents sécuritaires près de la frontière', 'CRITIQUE', 'SÉCURITÉ', 95, 'ACTIVE', '{PUSH,EMAIL}'),
  (auth.uid(), 'Kenya', 'Mouvement social annoncé', 'Mobilisation dans le secteur portuaire', 'ÉLEVÉ', 'POLITIQUE', 75, 'ACTIVE', '{PUSH}'),
  (auth.uid(), 'Sénégal', 'Hausse des prix alimentaires', 'Augmentation constatée sur plusieurs marchés', 'MODÉRÉ', 'ÉCONOMIE', 45, 'ACTIVE', '{EMAIL}');
*/
