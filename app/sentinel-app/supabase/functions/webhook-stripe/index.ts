// ============================================================
// SentiqS — Webhook Stripe, fonction Edge
//
// Seule source de vérité pour accorder ou retirer un abonnement. Le retour
// de navigation après paiement ne prouve rien : n'importe qui peut ouvrir
// l'URL de succès. Un abonnement n'est enregistré que sur un événement
// SIGNÉ par Stripe.
//
// Vérification de signature faite à la main (HMAC-SHA256 sur
// `timestamp.corps`, comparaison à temps constant, fenêtre de 5 minutes
// contre le rejeu) plutôt qu'avec le SDK Stripe : une dépendance de moins
// à auditer, pour une trentaine de lignes.
//
// Événements traités :
//  - checkout.session.completed          → abonnement actif
//  - customer.subscription.deleted       → abonnement annulé
//  - invoice.payment_failed              → abonnement suspendu
//
// Secrets à définir (Edge Functions > webhook-stripe > Secrets) :
//  - STRIPE_WEBHOOK_SECRET : « whsec_… », donné par Stripe à la création
//    du point de terminaison.
//
// ⚠ Cette fonction doit être déployée SANS vérification de JWT
// (`--no-verify-jwt`) : Stripe n'envoie pas de jeton Supabase. C'est la
// signature qui authentifie l'appel, et elle est vérifiée ci-dessous.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TOLERANCE_S = 300; // 5 minutes

function hexVersOctets(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

function egalesTempsConstant(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

async function signatureValide(corps: string, entete: string, secret: string): Promise<boolean> {
  // En-tête de la forme : t=1700000000,v1=abc...,v1=def...
  const parties = Object.create(null) as Record<string, string[]>;
  for (const morceau of entete.split(',')) {
    const [cle, valeur] = morceau.split('=');
    if (!cle || !valeur) continue;
    (parties[cle] ||= []).push(valeur);
  }
  const horodatage = parties['t']?.[0];
  const signatures = parties['v1'] || [];
  if (!horodatage || signatures.length === 0) return false;

  // Fenêtre anti-rejeu : une requête signée hier ne doit pas être rejouable.
  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(horodatage));
  if (!Number.isFinite(age) || age > TOLERANCE_S) return false;

  const cle = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const attendue = new Uint8Array(
    await crypto.subtle.sign('HMAC', cle, new TextEncoder().encode(`${horodatage}.${corps}`)),
  );

  return signatures.some((s) => {
    try { return egalesTempsConstant(attendue, hexVersOctets(s)); } catch { return false; }
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 });

  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET absent : tout événement est refusé.');
    return new Response('Webhook non configuré', { status: 501 });
  }

  const corps = await req.text();
  const entete = req.headers.get('stripe-signature') || '';
  if (!(await signatureValide(corps, entete, secret))) {
    // Ne pas détailler la raison : un attaquant n'a pas à savoir s'il a
    // échoué sur l'horodatage ou sur la signature.
    return new Response('Signature invalide', { status: 400 });
  }

  let evenement: { type?: string; data?: { object?: Record<string, unknown> } };
  try { evenement = JSON.parse(corps); } catch { return new Response('JSON invalide', { status: 400 }); }

  const service = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const objet = evenement.data?.object || {};
  const meta = (objet.metadata || {}) as Record<string, string>;

  try {
    if (evenement.type === 'checkout.session.completed') {
      const email = meta.email || (objet.customer_email as string) || '';
      const planId = Number(meta.plan_id);
      if (!email || !Number.isFinite(planId)) {
        console.error('Événement sans email ou plan exploitable — ignoré.');
        return new Response('ok', { status: 200 });
      }

      // L'abonné est rattaché par e-mail, comme le reste du schéma.
      const { data: abonne } = await service
        .from('subscribers').select('id').ilike('email', email).maybeSingle();

      let abonneId = abonne?.id;
      if (!abonneId) {
        const { data: cree, error } = await service.from('subscribers')
          .insert({ name: email.split('@')[0], email, subscription_tier: 'Essentiel' })
          .select('id').single();
        if (error) throw error;
        abonneId = cree.id;
      }

      // Les abonnements actifs précédents sont clos : un compte ne porte
      // qu'un forfait courant.
      await service.from('user_subscriptions')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('subscriber_id', abonneId).eq('status', 'active');

      const { error } = await service.from('user_subscriptions').insert({
        subscriber_id: abonneId, plan_id: planId, status: 'active',
      });
      if (error) throw error;

      console.log(`Abonnement actif pour ${email} (plan ${planId}).`);
    }

    if (evenement.type === 'customer.subscription.deleted' ||
        evenement.type === 'invoice.payment_failed') {
      const email = meta.email || (objet.customer_email as string) || '';
      if (email) {
        const nouveau = evenement.type === 'invoice.payment_failed' ? 'pending' : 'cancelled';
        const { data: abonne } = await service
          .from('subscribers').select('id').ilike('email', email).maybeSingle();
        if (abonne?.id) {
          await service.from('user_subscriptions')
            .update({ status: nouveau, updated_at: new Date().toISOString() })
            .eq('subscriber_id', abonne.id).eq('status', 'active');
          console.log(`Abonnement de ${email} passé à « ${nouveau} ».`);
        }
      }
    }
  } catch (e) {
    console.error('Traitement de l\'événement impossible :', e instanceof Error ? e.message : e);
    // 500 : Stripe réessaiera. Mieux vaut un nouvel essai qu'un abonnement
    // payé mais jamais enregistré.
    return new Response('Erreur de traitement', { status: 500 });
  }

  return new Response('ok', { status: 200 });
});
