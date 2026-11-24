# Créer une adresse e-mail dédiée à SentiqS (gratuit)

Le site ne publie plus aucune adresse : on écrit à l'éditeur par le
formulaire « Nous contacter ». Il reste utile d'avoir **une adresse à part**,
au nom de SentiqS plutôt qu'à son nom personnel, pour répondre à ces
messages et s'inscrire aux services tiers.

Cette adresse ne peut être créée que par l'éditeur lui-même : la création
d'un compte de messagerie demande son identité et une vérification par
téléphone.

## Option 1 — Gmail (gratuit, 5 minutes)

1. Ouvrir https://accounts.google.com/signup dans une fenêtre privée.
2. Choisir « Pour mon travail ou mon entreprise ».
3. Nom : `SentiqS`, prénom : `Contact`. Adresse proposée : par exemple
   `sentiqs.contact@gmail.com` ou `contact.sentiqs@gmail.com`.
4. Vérifier avec un numéro de téléphone, puis activer la validation en deux
   étapes (Gérer votre compte Google > Sécurité).

## Option 2 — Outlook.com (gratuit)

https://signup.live.com, même démarche (`sentiqs.contact@outlook.com`).

## Option 3 — une adresse à votre domaine (plus tard)

Avec un nom de domaine (environ 10 € par an, par exemple `sentiqs.com`),
un service de redirection gratuit (ImprovMX, Cloudflare Email Routing)
renvoie `contact@sentiqs.com` vers l'adresse Gmail ci-dessus. C'est le
format le plus professionnel ; il n'est pas nécessaire pour démarrer.

## Où l'utiliser une fois créée

| Usage | Où |
|---|---|
| Répondre aux messages du formulaire | Paramètres & Administration > Messages de contact, bouton « Répondre » (ouvre la messagerie) : envoyer depuis la nouvelle adresse |
| Demande d'accès ReliefWeb (`appname` de l'agent Louis) | formulaire https://apidoc.reliefweb.int/parameters#appname |
| Quota de traduction MyMemory (5 000 → 50 000 caractères par jour) | secret GitHub `MYMEMORY_EMAIL` (Settings > Secrets and variables > Actions) |
| Compte Google Play Console, Firebase, GitHub | comme adresse de contact de l'éditeur |

**Ne pas la mettre dans le code du site** : une adresse publiée attire le
spam, et le formulaire suffit. Un test (`scripts/test/contact.test.js`)
refuse l'adresse personnelle de l'éditeur dans les fichiers servis.
