# SENTINEL — Application mobile
## Veille intelligente · Afrique de l'Ouest

Stack : React Native + Expo · Supabase · Firebase · CinetPay/Wave

---

## Structure du projet

```
sentinel-app/
├── app/
│   ├── _layout.tsx              # Racine navigation
│   ├── (auth)/login.tsx         # Connexion / Inscription + essai 72h
│   ├── (app)/
│   │   ├── _layout.tsx          # Navigation par onglets
│   │   ├── feed.tsx             # Flux temps réel + filtres + alertes
│   │   ├── map.tsx              # Carte alertes (plan Starter+)
│   │   ├── archive.tsx          # Recherche historique (plan Mensuel+)
│   │   ├── reports.tsx          # Rapports DOCX/PDF (plan Mensuel+)
│   │   ├── article.tsx          # Détail d'un article
│   │   └── profile.tsx          # Profil + abonnements + paramètres
│   ├── notifications.tsx        # Liste des notifications utilisateur
│   └── admin/index.tsx          # Panneau admin (yorot225@gmail.com)
├── lib/
│   ├── supabase.ts              # Client Supabase + helpers
│   ├── sentinel-api.ts          # Connexion moteur SENTINEL
│   └── notifications.ts         # Notifications locales (alertes critiques,
│                                 # écran verrouillé) — voir limites dans le code
├── hooks/useAuth.ts             # Hook auth + droits d'accès
├── constants/theme.ts           # Couleurs + plans + constantes
├── .env.example                 # Variables d'environnement à copier en .env
└── supabase/
    ├── config.toml               # Config CLI Supabase
    └── migrations/                # Schéma base de données (versionné)
```

---

## Installation

```bash
cp .env.example .env   # puis renseignez les valeurs (voir Configuration ci-dessous)
npm install
npx expo start
```

L'app lit sa configuration depuis les variables d'environnement `EXPO_PUBLIC_*`
(chargées automatiquement par Expo depuis `.env`, jamais commité). Sans
`EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`, l'app refuse de
démarrer avec une erreur explicite ; sans `EXPO_PUBLIC_SENTINEL_API_URL`,
chaque écran retombe silencieusement sur des données de démo.

---

## Configuration

### 1. Supabase

1. Créez un projet sur https://supabase.com
2. Appliquez le schéma :
   - via la CLI : `npx supabase link --project-ref VOTRE_PROJET` puis
     `npx supabase db push` (depuis `app/sentinel-app/`) ;
   - ou copiez-collez `supabase/migrations/20260629000000_initial_schema.sql`
     dans l'éditeur SQL du projet.
3. Activez l'authentification email dans Auth > Providers
4. Renseignez `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   dans `.env` (Paramètres du projet > API)

### 2. Moteur SENTINEL (backend d'agrégation)

Ce moteur (flux RSS, scoring de fiabilité, alertes, carte, archives) n'est
pas encore hébergé : la logique d'agrégation existe aujourd'hui uniquement
côté client dans `web/SENTINEL_Surete_Web.html`. Pour l'app mobile, il faut
l'exposer comme une API REST hébergée séparément (VPS + Flask/FastAPI/Node),
puis renseigner dans `.env` :

```
EXPO_PUBLIC_SENTINEL_API_URL=https://votre-serveur.com/api
EXPO_PUBLIC_SENTINEL_API_KEY=votre_cle_interne
```

Endpoints requis :
- GET  /feed         — Flux articles paginé
- GET  /alerts       — Alertes actives
- GET  /map          — Points cartographiques
- POST /history/search — Recherche historique SQLite FTS5
- GET  /stats        — Statistiques moteur
- POST /reports/generate — Génération rapport DOCX/PDF
- GET  /trends       — Tendances et sources

### 3. Admin

L'email `yorot225@gmail.com` est automatiquement défini comme administrateur
via le trigger SQL `set_admin_role()`. Le panneau admin est accessible
depuis Profile > Panneau administrateur.

### 4. Paiement (CinetPay / Wave)

Intégrez CinetPay pour les paiements FCFA :
- Site : https://cinetpay.com
- SDK React Native disponible : @cinetpay/react-native
- Webhook Supabase pour confirmation de paiement

---

## Plans et tarifs

| Formule      | Durée    | Prix FCFA | Prix EUR | Fonctionnalités |
|-------------|----------|-----------|----------|-----------------|
| Essai       | 72h      | 0         | 0        | 50 articles, lecture seule |
| Starter     | 7 jours  | 2 500     | 4€       | Flux + alertes + carte |
| Mensuel     | 30 jours | 7 500     | 12€      | Tout + rapports 2 ans archives |
| Trimestriel | 90 jours | 18 000    | 27€      | Tout + 5 ans archives (-20%) |
| Annuel      | 365 jours| 55 000    | 84€      | Tout + 10 ans + API (-39%) |
| Institution | 1 an     | 150 000   | 230€     | 10 utilisateurs + tout |

---

## Gestion des accès par l'admin

L'admin (yorot225@gmail.com) peut depuis le panneau :

1. **Accorder un accès** : saisir email + choisir plan → fonction SQL `admin_grant_access()`
2. **Révoquer un accès** : bouton ban → fonction SQL `admin_revoke_access()`
3. **Renouveler** : ré-ouvrir le formulaire avec l'email pré-rempli
4. **Consulter les stats** : revenus estimés, répartition par plan
5. **Voir les droits** : matrice des fonctionnalités par formule

Tout est journalisé dans la table `audit_log`.

---

## Build et déploiement

```bash
# Installer EAS CLI
npm install -g eas-cli
eas login

# Configurer le projet
eas build:configure

# Build Android (APK ou AAB)
eas build --platform android

# Build iOS (nécessite compte Apple Developer)
eas build --platform ios

# Soumettre aux stores
eas submit --platform android
eas submit --platform ios
```

---

## Sécurité

- Row Level Security (RLS) activée sur toutes les tables Supabase
- Admin auto-détecté par email via trigger SQL
- Tokens JWT Supabase pour chaque requête API
- Accès révocable instantanément par l'admin
- Audit log de toutes les actions admin
- Données stockées localement via expo-secure-store
