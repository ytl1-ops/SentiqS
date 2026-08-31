# SentiqS — état réel des fonctionnalités

Ce document distingue ce qui **tourne en production** de ce qui existe **en code
non déployé**. La version précédente présentait les quatre briques ci-dessous
comme « Production Ready » alors que rien ne les exécute : l'écart s'est vu au
premier prospect qui a demandé une démonstration.

Révision de référence : voir `git log`. Périmètre : ce qui est servi depuis
`web/` par GitHub Pages.

---

## En production

Servi aux utilisateurs à chaque visite, sur `web/SentiqS_Web.html`.

| Fonctionnalité | État | Où |
|---|---|---|
| Collecte RSS — 495 sources, 54 pays | opérationnelle | `doCollect`, `proxyFetch` |
| Classification en 4 axes (sécurité, humanitaire, politique, économique) | opérationnelle | `classify` |
| Filtrage anti-hallucination (date réelle, < 12 h, source identifiée) | opérationnelle | `antiHalluFilter` |
| Niveau de posture par pays (5 niveaux) + mesures opérationnelles | opérationnelle | `getNivKey`, `MESURES` |
| Corrélations entre pays sur la fenêtre temps réel | opérationnelle, réservée aux rapports | `_corrBuildSignaux` |
| Exports Word, PDF, PowerPoint, Excel, CSV | opérationnels | `exportWord`, `exportPDF`, … |
| Agenda sûreté, main courante, fiches pays | opérationnelles | modules de l'interface |
| Bilingue français / anglais, y compris exports | opérationnel | `L()`, `i18n` |
| Authentification Supabase, rôles serveur | opérationnelle | migration `profiles_auth` |
| Cache de collecte partagé, rafraîchi toutes les 30 min | opérationnel | `collecte-planifiee.yml` |
| Alertes par e-mail et SMS | configurables | panneau Paramètres |

## Écrit mais non déployé

Le code existe et se lit, mais **aucun processus ne l'exécute** : `backend/` n'a
ni `package.json`, ni dépendances déclarées, et n'est référencé nulle part.
Ne pas présenter ces points comme disponibles.

| Brique | Où | Ce qui manque pour l'activer |
|---|---|---|
| Serveur d'alertes temps réel (WebSocket) | `backend/alerts/alert-server.js` | hébergement, manifeste, Redis |
| API publique et clés d'accès | `backend/api/` | hébergement, gestion des clés |
| Intégrations Slack, Jira, webhooks | `backend/api/integration-service.ts` | hébergement, comptes tiers |
| Rapports planifiés envoyés par e-mail | `backend/reports/` | hébergement, SMTP |
| Tableau de bord React (Vite) | `webapp/` | décision de déploiement (voir ci-dessous) |
| Application mobile Expo | `app/sentinel-app/` | `eas.json`, dossier `assets/` absent |
| Tableau de bord nouvelle génération | `archive/tableau-de-bord-v2/` | répertoires `hooks/`, `utils/`, `mocks/` manquants |

## Non commencé

À traiter avant toute facturation.

- Application des droits d'abonnement côté serveur — les quotas vivent
  aujourd'hui dans le navigateur.
- Encaissement (Stripe n'est pas branché).
- Mentions légales, conditions générales de vente, politique de
  confidentialité, page RGPD.
- Nom de domaine propre.
- Sauvegarde et restauration de la base.

---

## Deux architectures en parallèle

`web/` est en production ; `webapp/` est construite, typée et lintée par la CI
mais n'est **jamais déployée** — `gh-pages-deploy.yml` publie `web/`. Tant que
cet arbitrage n'est pas tranché, toute correction se paie deux fois.

## Vérifier soi-même

```bash
npm test                              # tests du moteur de collecte
node scripts/verifier-syntaxe-html.js # JavaScript inline de production
node scripts/verifier-couverture-proxys.js
node scripts/verifier-accessibilite.js
```
