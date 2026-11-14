// Telegram et WhatsApp pour les bulletins programmés (14/11/2026).
//
// TELEGRAM — gratuit, sans limite pratique à notre échelle. Un robot créé avec
// @BotFather (secret TELEGRAM_BOT_TOKEN). Le consentement est garanti par
// Telegram lui-même : un robot ne peut écrire qu'à une personne qui lui a
// d'abord écrit. Le lien de Paramètres ouvre le robot avec « /start <code> » ;
// le job lit ce message (getUpdates), rattache la conversation au compte dont
// c'est le code, et rien d'autre. « /stop » détache la conversation.
//
// WHATSAPP — l'API WhatsApp Cloud de Meta est la seule voie d'envoi
// automatique autorisée. Elle impose un compte Meta Business, un numéro dédié
// et un MODÈLE de message approuvé par Meta, et Meta facture les messages de
// modèle. Décision du 14/11/2026 : aucun compte côté SentiqS ; chaque
// utilisateur apporte le sien (Paramètres), et ses identifiants, déchiffrés
// par scripts/lib/identifiants-envoi.js, arrivent ici en `cfg`.

const API_TELEGRAM = 'https://api.telegram.org/bot';

function telegramConfig(env) {
  const jeton = String((env || process.env).TELEGRAM_BOT_TOKEN || '').trim();
  return /^\d{5,15}:[A-Za-z0-9_-]{20,60}$/.test(jeton) ? { jeton } : null;
}

async function appelTelegram(cfg, methode, corps, fetchFn) {
  const r = await (fetchFn || fetch)(API_TELEGRAM + cfg.jeton + '/' + methode, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corps || {}),
  });
  const d = await r.json().catch(() => null);
  if (!d || !d.ok) {
    // Le jeton du robot fait partie de l'adresse : il n'est jamais cité.
    throw new Error('Telegram ' + methode + ' refusé (' + ((d && d.description) || ('HTTP ' + r.status)) + ')');
  }
  return d.result;
}

/**
 * Lit les messages reçus par le robot depuis `offset` et en tire les
 * rattachements (« /start <code> ») et les détachements (« /stop »).
 * Rend { offset, rattachements: [{ code, chatId, titre }], arrets: [chatId] }.
 */
function lireCommandes(updates, offsetAvant) {
  let offset = offsetAvant || 0;
  const rattachements = [];
  const arrets = [];
  (updates || []).forEach((u) => {
    if (typeof u.update_id === 'number' && u.update_id >= offset) offset = u.update_id + 1;
    const m = u.message || u.channel_post;
    if (!m || !m.chat || typeof m.text !== 'string') return;
    const t = m.text.trim();
    const chatId = m.chat.id;
    const titre = String(m.chat.title || [m.chat.first_name, m.chat.last_name].filter(Boolean).join(' ') || m.chat.username || 'Telegram').slice(0, 60);
    const start = /^\/start(?:@\w+)?\s+([a-f0-9]{16})\s*$/.exec(t);
    if (start) rattachements.push({ code: start[1], chatId, titre });
    else if (/^\/stop(?:@\w+)?\s*$/.test(t)) arrets.push(chatId);
  });
  return { offset, rattachements, arrets };
}

async function telegramMessage(cfg, chatId, texte, fetchFn) {
  return appelTelegram(cfg, 'sendMessage', { chat_id: chatId, text: String(texte).slice(0, 4096), disable_web_page_preview: true }, fetchFn);
}

/**
 * Un message de modèle WhatsApp. Le modèle à faire approuver par Meta
 * (catégorie « Utilitaire ») porte quatre variables, dans cet ordre :
 *   {{1}} pays · {{2}} niveau · {{3}} nombre de faits notables · {{4}} lien.
 * Voir docs/bulletins-programmes.md.
 */
async function appelWhatsapp(cfg, numero, template, fetchFn) {
  const r = await (fetchFn || fetch)('https://graph.facebook.com/v21.0/' + encodeURIComponent(cfg.numeroId) + '/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + cfg.jeton },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: numero, type: 'template', template }),
  });
  const d = await r.json().catch(() => null);
  // Le message d'erreur de Meta ne contient pas le jeton ; l'appelant le
  // nettoie quand même avant de l'écrire où que ce soit.
  if (!r.ok) throw new Error('WhatsApp refusé (' + ((d && d.error && d.error.message) || ('HTTP ' + r.status)) + ')');
  return d;
}

// La langue du modèle est celle que l'utilisateur a fait approuver
// (cfg.langue) : Meta refuse un modèle demandé dans une autre langue.
async function whatsappModele(cfg, numero, langue, variables, fetchFn) {
  return appelWhatsapp(cfg, numero, { name: cfg.modele, language: { code: cfg.langue || (langue === 'en' ? 'en' : 'fr') },
    components: [{ type: 'body', parameters: variables.map((v) => ({ type: 'text', text: String(v).slice(0, 200) })) }] }, fetchFn);
}

// Essai : le modèle « hello_world » que Meta crée sur tout nouveau compte.
// Il prouve que le jeton, le numéro et le destinataire fonctionnent avant
// même que le modèle du bulletin soit approuvé.
async function whatsappEssai(cfg, numero, fetchFn) {
  return appelWhatsapp(cfg, numero, { name: 'hello_world', language: { code: 'en_US' } }, fetchFn);
}

module.exports = { telegramConfig, appelTelegram, lireCommandes, telegramMessage, whatsappModele, whatsappEssai };
