# Fiche Play Store de SentiqS — à coller dans la Play Console

Préparée le 13/11/2026. Les champs entre crochets n'existent qu'une fois le
compte développeur créé ; le reste se copie tel quel.

## Fiche principale (Croissance > Présence sur le Store > Fiche principale)

**Nom de l'application** (30 caractères max) :
SentiqS — Veille sûreté Afrique

**Description courte** (80 caractères max) :
Niveaux d'alerte, faits vérifiés et rapports de sûreté sur les 54 pays d'Afrique.

**Description complète** (4 000 caractères max) :

SentiqS est l'outil de veille de sûreté des entreprises qui opèrent en Afrique.
Il lit chaque jour plus de 500 sources ouvertes (presse nationale, agences,
conseils aux voyageurs officiels) et en tire, pour chacun des 54 pays :

• un niveau d'alerte en cinq paliers, avec un indice de confiance qui dit sur
  quoi il repose et de quand date l'information ;
• les faits du jour classés par gravité, recoupés entre sources, et cotés
  « Confirmé », « Probable » ou « Non confirmé » ;
• les faits relus et validés par un analyste, signalés comme tels ;
• une vue Sûreté et une vue Finance sur la même base de faits ;
• les pays sur lesquels l'outil voit mal, affichés plutôt que tus : un pays
  sans actualité n'est pas un pays sans risque ;
• un bulletin quotidien et des rapports exportables en Word, PDF et
  PowerPoint, à votre nom et à votre logo.

Pensé pour les responsables sûreté, les directions des risques et les
analystes, en français et en anglais. La Côte d'Ivoire est suivie en priorité.

SentiqS ne suit aucune personne : pas de localisation, pas de réseaux sociaux
personnels, pas de profilage. Les articles restent chez leurs éditeurs ; SentiqS
en donne le titre, un court extrait et le lien.

Un compte est nécessaire. Essai gratuit, puis abonnement.

**Catégorie** : Actualités et magazines (ou Entreprise)
**Tags** : Actualités, Entreprise
**Adresse e-mail de contact** : [À COMPLÉTER — adresse professionnelle]
**Site web** : https://sentiqs-235ce.web.app
**Règles de confidentialité** : https://sentiqs-235ce.web.app/legal/confidentialite.html

**Éléments graphiques** :
- Icône 512 × 512 : `store/play/icone-512.png`
- Image de présentation 1024 × 500 : `store/play/banniere-1024x500.png`
- Captures téléphone 1080 × 1920 : `store/play/captures/` (au moins deux)

## Contenu de l'application (Règles > Contenu de l'application)

**Accès à l'application** : toutes les fonctionnalités demandent un compte.
Fournir aux examinateurs un compte de test : [À COMPLÉTER — e-mail et mot de
passe d'un compte créé pour Google, au forfait payant].

**Annonces** : non, l'application ne contient pas d'annonces.

**Classification du contenu** : questionnaire IARC, catégorie « Référence,
actualités ou éducation ». L'application présente des actualités de sécurité
(attaques, violences) sous forme de titres et d'extraits, sans image violente
produite par elle.

**Public cible** : 18 ans et plus. Ne s'adresse pas aux enfants.

**Application d'actualités** : oui (déclaration « Actualités » à remplir :
éditeur, coordonnées, sources).

**Sécurité des données** :

| Question | Réponse |
|---|---|
| Collecte ou partage de données | Oui, collecte ; aucun partage avec des tiers |
| Chiffrement en transit | Oui (HTTPS) |
| Suppression des données sur demande | Oui — dans l'app (Paramètres > Supprimer mon compte) et https://sentiqs-235ce.web.app/legal/suppression-compte.html |
| Informations personnelles : adresse e-mail | Collectée — gestion du compte, obligatoire |
| Informations personnelles : nom | Collecté — gestion du compte, facultatif |
| Activité dans l'application : interactions | Collectées — journal des connexions, quota d'exports (sécurité, fonctionnement) |
| Localisation, contacts, photos, identifiants publicitaires | Non collectés |

**Suppression du compte (URL)** :
https://sentiqs-235ce.web.app/legal/suppression-compte.html

## Publication

1. Créer l'application, nom de paquet `com.sentiqs.veille`.
2. Activer la signature d'applications Google Play (par défaut).
3. Actions GitHub > « Application Android » > Run workflow : l'AAB est dans
   les artefacts. Le téléverser en **test fermé**.
4. Copier l'empreinte SHA-256 de la clé de signature (Intégrité de
   l'application > Signature d'application) dans la variable de dépôt
   `TWA_SHA256` ; la prochaine publication du site la met dans
   `assetlinks.json` et l'app s'ouvre sans barre d'adresse.
5. Compte personnel créé après le 13/11/2023 : 12 testeurs pendant 14 jours
   en test fermé avant de pouvoir demander la production.
