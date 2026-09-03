-- ============================================================
-- Correctif de sécurité sur quotas_cote_serveur (20260831)
--
-- Déployé le 03/09/2026 sur le projet de production, puis remonté ici pour
-- que le dépôt reste la source de vérité si ces migrations sont rejouées
-- ailleurs (nouvel environnement, restauration).
--
-- PostgreSQL accorde EXECUTE à PUBLIC par défaut à la création d'une
-- fonction : `grant execute ... to authenticated` seul ne retire rien à
-- `anon`. L'audit de sécurité Supabase lancé juste après le déploiement de
-- la migration quotas_cote_serveur l'a confirmé : un appelant anonyme
-- pouvait appeler limite_telechargements(uid)/telechargements_restants(uid)
-- avec N'IMPORTE QUEL uid et lire le quota d'un autre compte. Pas une
-- donnée critique en soi, mais contraire à l'intention explicite du
-- commentaire d'origine (« Lecture autorisée pour l'utilisateur
-- connecté ») — et le genre d'écart qui s'accumule si on ne le corrige pas
-- au moment où il est vu.
--
-- Idempotent : REVOKE/GRANT sur une fonction existante ne fait rien s'ils
-- ont déjà été appliqués.
-- ============================================================

revoke execute on function public.limite_telechargements(uuid) from public;
revoke execute on function public.telechargements_restants(uuid) from public;
revoke execute on function public.limite_telechargements(uuid) from anon;
revoke execute on function public.telechargements_restants(uuid) from anon;
grant execute on function public.limite_telechargements(uuid) to authenticated;
grant execute on function public.telechargements_restants(uuid) to authenticated;
