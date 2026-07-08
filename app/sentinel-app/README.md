# SENTINEL — Application mobile
## Veille intelligente · Afrique de l'Ouest

Stack : React Native + Expo · Supabase · Firebase · CinetPay/Wave

---

## Structure du projet

```
sentinel-app/
├── app/
│   ├── _layout.tsx              # Racine navigation
│   ├── (auth)/login.tsx         # Connexion / Inscription + essai 24h
│   ├── (app)/
│   │   ├── _layout.tsx          # Navigation par onglets
│   │   ├── feed.tsx             # Flux temps réel + filtres + alertes
│   │   ├── map.tsx              # Carte alertes (plan Starter+)
│   │   ├── archive.tsx          # Recherche historique (plan Mensuel+)
│   │   ├── reports.tsx          # Rapports DOCX/PDF (plan Mensuel+)
│   │   └── profile.tsx          # Profil + abonnements + paramètres
│   └── admin/index.tsx          # Panneau admin (yorot225@gmail.com)
├── lib/
│   ├── supabase.ts              # Client Supabase + helpers
│   └── sentinel-api.ts          # Connexion moteur Python SENTINEL
├── hooks/useAuth.ts             # Hook auth + droits d'accès
├── constants/theme.ts           # Couleurs + plans + constantes
└── supabase/schema.sql          # Schéma base de données complet
```

---

## Installation

```bash
npm install
npx expo start
```

---

## Configuration

### 1. Supabase

1. Créez un projet sur https://supabase.com
2. Exécutez `supabase/schema.sql` dans l'éditeur SQL
3. Activez l'authentification email dans Auth > Providers
4. Copiez l'URL et la clé anon dans `lib/supabase.ts` :

```typescript
const SUPABASE_URL = 'https://VOTRE_PROJET.supabase.co';
const SUPABASE_ANON_KEY = 'VOTRE_ANON_KEY';
```

### 2. Moteur SENTINEL (backend Python)

Hébergez le moteur SENTINEL Python sur un VPS (DigitalOcean, Hetzner, etc.)
Exposez une API REST Flask/FastAPI et renseignez l'URL dans `lib/sentinel-api.ts` :

```typescript
const SENTINEL_API_URL = 'https://votre-serveur.com/api';
const SENTINEL_API_KEY = 'VOTRE_CLE_API_INTERNE';
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
| Essai       | 24h      | 0         | 0        | 50 articles, lecture seule |
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
