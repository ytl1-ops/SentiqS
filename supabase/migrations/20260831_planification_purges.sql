-- ============================================================
-- Planification des purges de retention
--
-- purger_articles_rag_perimes() et purger_agenda_partagee_perimes() existent
-- 20260718030000 et 20260719000000, avec la meme note dans les deux
-- fichiers : « a appeler periodiquement (ex. pg_cron) ». Ce rendez-vous n'a
-- jamais ete pris — les tables grossissent donc sans limite depuis leur
-- creation, et rien ne le signale.
--
-- pg_cron est disponible sur Supabase mais son extension doit etre activee
-- une fois depuis le tableau de bord (Database > Extensions) ; on ne tente
-- donc pas de la creer ici, ou la migration echouerait faute de privileges.
-- Le bloc ci-dessous ne planifie que si l'extension est presente, et reste
-- sans effet sinon : la migration passe dans les deux cas, et il suffit de
-- la rejouer apres activation.
--
-- Idempotent : la planification est retiree avant d'etre reposee, donc
-- rejouer ce fichier ne cree jamais de doublon de tache.
-- ============================================================

do $$
declare
  a_pg_cron boolean;
begin
  select exists (select 1 from pg_extension where extname = 'pg_cron') into a_pg_cron;

  if not a_pg_cron then
    raise notice 'pg_cron absent : purges NON planifiees. Activez l''extension (Database > Extensions) puis rejouez cette migration.';
    return;
  end if;

  -- Articles RAG : volume le plus fort (chaque collecte en publie).
  -- 03h05 UTC, hors des pics de collecte.
  perform cron.unschedule('purge_articles_rag')
    where exists (select 1 from cron.job where jobname = 'purge_articles_rag');
  perform cron.schedule('purge_articles_rag', '5 3 * * *', 'select public.purger_articles_rag_perimes()');

  -- Agenda partage : volume plus faible, une fois par semaine suffit.
  perform cron.unschedule('purge_agenda_partagee')
    where exists (select 1 from cron.job where jobname = 'purge_agenda_partagee');
  perform cron.schedule('purge_agenda_partagee', '20 3 * * 0', 'select public.purger_agenda_partagee_perimes()');

  raise notice 'Purges planifiees : articles_rag (quotidien 03h05 UTC), agenda_partagee (hebdomadaire dimanche 03h20 UTC).';
end
$$;
