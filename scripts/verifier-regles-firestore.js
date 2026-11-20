#!/usr/bin/env node
// Règles Firestore éprouvées sur l'émulateur (audit du 15/11/2026). Les tests
// de forme (scripts/test/firebase.test.js) lisent le texte des règles ; ceux-ci
// les EXÉCUTENT : forfait et essai contrôlés côté serveur, compte suspendu,
// configuration partagée. Vus échouer sur les règles d'avant (5 cas sur 16).
//
// Lancé en CI (job « regles-firestore » de webapp-ci.yml) par :
//   npx firebase emulators:exec --only firestore --project demo-sentiqs \
//     "node scripts/verifier-regles-firestore.js"
// Dépendances installées à la volée par le job (@firebase/rules-unit-testing,
// firebase, firebase-tools) : rien n'entre dans package.json.
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const fs = require('fs');
const { doc, getDoc, setDoc, deleteDoc } = require('firebase/firestore');
(async () => {
  const env = await initializeTestEnvironment({ projectId: 'demo-sentiqs', firestore: { rules: fs.readFileSync(require('path').join(__dirname, '..', 'firebase', 'firestore.rules'), 'utf8'), host: '127.0.0.1', port: Number(process.env.PORT_FIRESTORE || 8085) } });
  const iso = (msAgo) => new Date(Date.now() - msAgo).toISOString();
  const jour = (dAgo) => new Date(Date.now() - dAgo * 864e5).toISOString().slice(0, 10);
  const profils = {
    essai: { status: 'active', role: 'user', data: { plan: 'gratuit', createdAt: iso(3600e3) } },
    echu: { status: 'active', role: 'user', data: { plan: 'gratuit', createdAt: iso(6 * 864e5) } },
    limite: { status: 'active', role: 'user', data: { plan: 'gratuit', createdAt: iso(3 * 864e5) } },
    paye: { status: 'active', role: 'user', data: { plan: 'pro', createdAt: iso(60 * 864e5) } },
    prolonge: { status: 'active', role: 'user', data: { plan: 'gratuit', createdAt: iso(60 * 864e5), accesJusquau: jour(-3) } },
    coupe: { status: 'active', role: 'user', data: { plan: 'pro', createdAt: iso(1 * 864e5), accesJusquau: jour(2) } },
    ancien: { status: 'active', role: 'user', data: { plan: 'gratuit' } },
    suspendu: { status: 'suspended', role: 'user', data: { plan: 'pro' } },
    admin: { status: 'active', role: 'admin', data: {} },
  };
  await env.withSecurityRulesDisabled(async (c) => {
    const db = c.firestore();
    for (const [uid, p] of Object.entries(profils)) await setDoc(doc(db, 'profiles', uid), Object.assign({ id: uid, email: uid + '@x.org' }, p));
    await setDoc(doc(db, 'collecte_partagee', 'global'), { nb: 1 });
    await setDoc(doc(db, 'config_partagee', 'global'), { emailjs: {} });
  });
  const ctx = (uid) => env.authenticatedContext(uid, { email: uid + '@x.org', email_verified: true }).firestore();
  const res = [];
  const t = async (nom, attendu, p) => { try { await (attendu ? assertSucceeds(p) : assertFails(p)); res.push('ok   ' + nom); } catch (e) { res.push('FAIL ' + nom + ' : ' + e.message); } };
  await t('essai en cours lit le cache', true, getDoc(doc(ctx('essai'), 'collecte_partagee', 'global')));
  await t('essai échu (6 j) ne lit pas', false, getDoc(doc(ctx('echu'), 'collecte_partagee', 'global')));
  await t('essai de 3 j (dans la marge du jour) lit', true, getDoc(doc(ctx('limite'), 'collecte_partagee', 'global')));
  await t('forfait payant lit', true, getDoc(doc(ctx('paye'), 'collecte_partagee', 'global')));
  await t('accès prolongé par l admin lit', true, getDoc(doc(ctx('prolonge'), 'collecte_partagee', 'global')));
  await t('accès coupé par l admin ne lit pas', false, getDoc(doc(ctx('coupe'), 'collecte_partagee', 'global')));
  await t('profil ancien sans date lit', true, getDoc(doc(ctx('ancien'), 'collecte_partagee', 'global')));
  await t('suspendu ne lit pas', false, getDoc(doc(ctx('suspendu'), 'collecte_partagee', 'global')));
  await t('admin lit', true, getDoc(doc(ctx('admin'), 'collecte_partagee', 'global')));
  await t('sans compte ne lit pas', false, getDoc(doc(env.unauthenticatedContext().firestore(), 'collecte_partagee', 'global')));
  await t('suspendu ne supprime pas son profil', false, deleteDoc(doc(ctx('suspendu'), 'profiles', 'suspendu')));
  await t('actif supprime son profil', true, deleteDoc(doc(ctx('echu'), 'profiles', 'echu')));
  await t('config lue par un compte', true, getDoc(doc(ctx('paye'), 'config_partagee', 'global')));
  await t('config non écrite par un client', false, setDoc(doc(ctx('paye'), 'config_partagee', 'global'), { emailjs: { x: 1 } }));
  await t('config écrite par l admin', true, setDoc(doc(ctx('admin'), 'config_partagee', 'global'), { emailjs: { x: 1 } }));
  await t('client ne se passe pas au forfait pro', false, setDoc(doc(ctx('essai'), 'profiles', 'essai'), Object.assign({ id: 'essai', email: 'essai@x.org' }, profils.essai, { data: { plan: 'pro', createdAt: profils.essai.data.createdAt } })));
  // Traductions partagées (20/11/2026).
  const empreinte = (c, src) => require('crypto').createHash('sha256').update(c + '\n' + src).digest('hex');
  const trad = (uid, o) => Object.assign({ c: 'fr', s: 'Gunmen attack police post', t: 'Des hommes armés attaquent un poste de police', uid, at: new Date() }, o || {});
  const k1 = empreinte('fr', 'Gunmen attack police post');
  await t('traduction rangée par un compte actif', true, setDoc(doc(ctx('paye'), 'traductions', k1), trad('paye')));
  await t('traduction relue par un autre compte', true, getDoc(doc(ctx('essai'), 'traductions', k1)));
  await t('traduction non réécrite', false, setDoc(doc(ctx('essai'), 'traductions', k1), trad('essai', { t: 'Fausse traduction' })));
  await t('traduction non relue sans accès en cours', false, getDoc(doc(ctx('coupe'), 'traductions', k1)));
  await t('traduction non rangée par un suspendu', false, setDoc(doc(ctx('suspendu'), 'traductions', empreinte('fr', 'x y z')), trad('suspendu', { s: 'x y z' })));
  await t('traduction non rangée sous la clé d un autre texte', false, setDoc(doc(ctx('paye'), 'traductions', empreinte('fr', 'autre texte')), trad('paye', { s: 'Gunmen kill five' })));
  await t('traduction non rangée au nom d un autre', false, setDoc(doc(ctx('paye'), 'traductions', empreinte('en', 'Un texte')), trad('essai', { c: 'en', s: 'Un texte' })));
  console.log(res.join('\n'));
  await env.cleanup();
  process.exit(res.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
