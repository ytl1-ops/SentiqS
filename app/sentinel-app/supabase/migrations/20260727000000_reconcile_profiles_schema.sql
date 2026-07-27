-- ============================================================
-- Réconciliation du schéma `profiles` — bug préexistant
--
-- Constat : deux migrations antérieures définissent chacune une table
-- `profiles` avec des colonnes incompatibles, sans DROP entre les deux :
--   - 20260629000000_initial_schema.sql : id/email/full_name/role
--     ('admin'|'user')/avatar_url/phone/organization/country/language,
--     plus les tables plans/subscriptions/access_grants/notifications/
--     article_reads/audit_log construites dessus. Utilisée aujourd'hui par
--     app/sentinel-app/lib/supabase.ts (l'app mobile).
--   - 20260718020000_profiles_auth.sql : id/email/role
--     ('admin'|'user'|'reader')/status('active'|'suspended')/data(jsonb).
--     C'est CE schéma que web/SentiqS_Web.html utilise réellement (voir
--     _profilVersUtilisateur/_ouvrirSessionDepuisSupabase) — RLS et
--     triggers anti-escalade de privilèges compris.
--
-- Rejouées dans l'ordre sur une base neuve, ces deux migrations échouent
-- ("relation profiles already exists") — l'historique n'est pas
-- reproductible tel quel. Cette migration ne cherche PAS à trancher quel
-- schéma doit exister (aucun accès à la base réelle depuis cet
-- environnement pour vérifier son état exact), et ne supprime RIEN : elle
-- amène `profiles`, quel que soit son état actuel, vers le schéma
-- réellement utilisé par le site en production (role/status/data),
-- de façon strictement additive — sûre à rejouer sur une base qui contient
-- déjà de vraies lignes utilisateur.
--
-- Ce qui n'est PAS traité ici (décision produit à part, pas un bug de
-- syntaxe) : l'app mobile utilise un modèle commercial normalisé
-- (plans/subscriptions, FCFA/EUR, essai via table dédiée) totalement
-- différent du modèle web (chaîne `plan` libre dans `data`, essai 72h à
-- plat) — si `profiles` réel n'a jamais eu les colonnes de la migration
-- 20260629000000, les fonctions plans/subscriptions/access_grants de
-- l'app mobile tournent aujourd'hui contre des tables orphelines de tout
-- profil valide. Unifier ou non ces deux modèles reste à décider
-- séparément.
-- ============================================================

alter table public.profiles
  add column if not exists status text not null default 'active'
    check (status in ('active','suspended'));

alter table public.profiles
  add column if not exists data jsonb not null default '{}'::jsonb;

-- Elargit la contrainte sur `role` pour couvrir les 3 valeurs reellement
-- utilisees par le site en production (admin/user/reader) — remplace la
-- contrainte quelle que soit sa forme actuelle (nom auto-genere identique
-- dans les deux migrations d'origine : profiles_role_check).
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('admin','user','reader'));
