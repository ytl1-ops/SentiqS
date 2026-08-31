# Base de données et fonctions Edge

## Où vit quoi

Le dépôt porte deux emplacements Supabase, héritage de l'ordre dans lequel les
chantiers ont été menés :

| Chemin | Contenu |
|---|---|
| `supabase/migrations/` | migrations récentes (juillet-août 2026) |
| `app/sentinel-app/supabase/` | `config.toml`, fonctions Edge, migrations d'origine |

Les migrations des deux dossiers s'appliquent à la **même** instance. La CLI
Supabase se lance depuis `app/sentinel-app/` (c'est là qu'est `config.toml`).

---

## Bascule des écritures partagées vers la fonction Edge

**À faire dans cet ordre.** Inverser les étapes 3 et 1 arrête la collecte.

Cinq tables acceptaient des écritures du rôle `anon` sans condition. La clé
anonyme étant publique par conception — elle est en clair dans
`web/SentiqS_Web.html` — n'importe qui pouvait réécrire le cache servi à tous
les visiteurs. La correction déplace l'écriture vers une fonction Edge qui
détient la clé de service.

### 1. Générer le jeton de publication

```bash
openssl rand -hex 32
```

Ce jeton n'a rien à voir avec l'ancien `COLLECTOR_TOKEN`, qui est public et ne
sert qu'à ouvrir une session lecteur. Ne le commitez jamais.

### 2. Déployer la fonction Edge

Depuis `app/sentinel-app/` :

```bash
supabase functions deploy publier-collecte
supabase secrets set COLLECTEUR_JETON=<le jeton généré>
```

Ou par le tableau de bord : *Edge Functions > Create a new function >
publier-collecte*, coller
`app/sentinel-app/supabase/functions/publier-collecte/index.ts`, puis définir
le secret dans l'onglet *Secrets*.

### 3. Donner le même jeton au job planifié

Dépôt GitHub > *Settings > Secrets and variables > Actions* > `COLLECTEUR_JETON`,
avec **exactement la même valeur**.

### 4. Vérifier que la voie Edge fonctionne

Lancer la collecte à la main (*Actions > Collecte planifiée > Run workflow*) et
vérifier dans les journaux :

- `Jeton de publication injecté : publication via la fonction Edge.`
- puis le contrôle de fraîcheur qui passe au vert.

Tant que ce message n'apparaît pas, **ne passez pas à l'étape suivante** : le
job publie encore par écriture directe.

### 5. Appliquer la migration de verrouillage

```bash
supabase db push          # ou coller le fichier dans l'éditeur SQL
```

Fichier : `supabase/migrations/20260831_verrouillage_ecritures_partagees.sql`.
Elle se termine par un contrôle qui échoue bruyamment s'il reste une politique
d'écriture ouverte à `anon` — elle ne peut donc pas donner l'illusion d'un
verrou posé.

### 6. Vérifier le résultat

Une écriture tentée avec la seule clé anonyme doit être refusée :

```bash
curl -X POST "$SUPABASE_URL/rest/v1/collecte_partagee" \
  -H "apikey: $ANON_KEY" -H "Authorization: Bearer $ANON_KEY" \
  -H "content-type: application/json" \
  -d '{"id":"global","articles":[]}'
# attendu : 401 ou 403, jamais 200/201
```

Et la collecte planifiée suivante doit rester verte.

---

## Retour arrière

Si la collecte s'arrête après l'étape 5, rétablir temporairement l'écriture
anonyme sur la seule table concernée, le temps de corriger :

```sql
create policy "collecte_partagee_insert" on public.collecte_partagee
  for insert to anon, authenticated with check (true);
create policy "collecte_partagee_update" on public.collecte_partagee
  for update to anon, authenticated using (true) with check (true);
```

C'est un retour à l'état vulnérable : à n'utiliser que pour rétablir le
service, et à refermer dès que la fonction Edge répond.

---

## Ce qui change pour les visiteurs

Un visiteur ordinaire ne contribue plus au cache partagé : il n'a pas le jeton.
Sa collecte locale continue de fonctionner pour lui-même, et il lit le cache
comme avant.

C'était déjà l'intention du job planifié — garder le cache frais
*indépendamment* du trafic réel. La panne du 2 au 27 août 2026, où le job a
échoué 25 jours sans que personne le voie, a montré ce que vaut un cache
alimenté au gré des visiteurs : l'alerte d'échec ajoutée au job est ce qui
couvre désormais ce risque.

---

## Autres migrations

| Fichier | Objet |
|---|---|
| `20260831_planification_purges.sql` | planifie les purges de rétention via pg_cron (nécessite l'extension activée) |
| `20260729_admin_settings_schema.sql` | tables du module Paramètres, politiques fondées sur `is_admin()` |
| `20260729_agenda_reports_schema.sql` | agenda et rapports planifiés |
| `20260724_alerts_schema.sql` | alertes et journal d'audit |
