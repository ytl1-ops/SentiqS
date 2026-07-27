// Port de la classification reelle de web/SentiqS_Web.html (classify(),
// ~L6685-6746, et ses garde-fous sport/culture ~L6098-6227). Memes listes
// de mots-cles, meme logique de niveau/categorie.
//
// Simplification assumee (a completer si besoin) : matchMot() ici saute
// l'etape masquerTermesComposes/TERMES_AMBIGUS_MASQUES du fichier reel
// (un affinage secondaire pour une poignee de termes tres ambigus) — le
// coeur de la detection par limite de mot est conserve a l'identique.
// La detection de PAYS reel (_detecterPaysCoeur, ~54 listes de termes par
// pays) n'est pas portee non plus : cette version utilise directement
// src.cy (le pays declare de la source), qui est deja le comportement de
// repli du code reel quand la detection textuelle n'est pas confiante.

export function normaliserAccents(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function matchMot(texte: string, terme: string): boolean {
  const echappe = terme.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  try {
    return new RegExp('(?:^|[^\\p{L}\\p{N}])' + echappe + '(?:$|[^\\p{L}\\p{N}])', 'iu').test(texte);
  } catch {
    return texte.includes(terme);
  }
}

const EXPRESSIONS_NON_SECURITAIRES = [
  'coup de cœur', 'coup de coeur', 'coup de foudre', 'coup de theatre', 'coup de pouce',
  "coup d'accelerateur", 'coup d accelerateur', 'coup de maitre', "coup d'essai", 'coup d essai',
  'coup de projecteur', "coup d'envoi", 'coup d envoi', 'coup de fil', 'coup de main',
  'siege social', "siege de l'entreprise", 'siege de l entreprise', 'siege regional',
  'explosion des prix', 'explosion demographique', 'explosion de couleurs', 'explosion de joie',
  'explosion de talent', 'explosion des cas',
  'crise de nerfs', 'crise cardiaque', "crise d'angoisse", 'crise d angoisse',
  'combat de boxe', 'combat contre la pauvrete', 'combat contre le paludisme',
  'combat contre le cancer', 'combat contre la faim',
  'deplacement officiel', 'voyage officiel', 'deplacement prive', 'en deplacement pour',
  'menace de disruption', 'menace planer sur le marche',
  'larme', 'larmes de joie', 'aux larmes',
  'prix nobel', 'prix goncourt', 'prix litteraire', 'grand prix litteraire',
];

function neutraliserExpressions(t: string): string {
  let out = t;
  for (const expr of EXPRESSIONS_NON_SECURITAIRES) {
    if (out.includes(expr)) out = out.split(expr).join(' ');
  }
  return out;
}

const SPORT_INTERNATIONAL_KW = [
  'coupe du monde', 'mondial 2026', 'mondial 2030', 'ligue des champions', 'premier league',
  'liga', 'bundesliga', 'serie a', "ballon d'or", 'mercato', 'fifa', 'uefa', 'sélectionneur', 'selectionneur',
  'footballistique', 'footballeur', 'gardien de but', 'attaquant',
  'milieu de terrain', 'roland-garros', 'wimbledon', 'nba', 'formule 1', 'grand prix',
  'jeux olympiques', 'tour de france',
  'real madrid', 'fc barcelone', 'manchester united', 'manchester city', 'psg',
  'paris saint-germain', 'ronaldo', 'lionel messi', 'mbappé', 'mbappe', 'rudi garcia',
  'chelsea', 'arsenal', 'liverpool', 'bayern munich', 'juventus', 'ac milan', 'tottenham',
  'world cup', 'champions league', 'national coach', 'head coach', 'national team',
  'goalkeeper', 'striker', 'midfielder', 'defender', 'football club',
  'transfer window', 'olympic games', 'formula one',
];

const SPORT_CONTENU_KW = [
  ...SPORT_INTERNATIONAL_KW,
  'transfert', 'mercato', "ballon d'or", 'but marque', 'buteur', 'passeur decisif',
  "coup d'envoi", 'coup franc', 'coup de pied arrete', 'carton rouge', 'carton jaune',
  'hors-jeu', 'hors jeu', 'penalty', 'tirs au but', 'seance de tirs au but',
  'prolongation', 'prolongations', 'mort subite', 'explosion de joie',
  'frappe puissante', 'frappe enroulee', 'arbitre', 'var (arbitrage)', 'stade municipal',
  'derby', 'championnat national', 'coupe nationale', "coupe d'afrique", 'can 20',
  'can2026', 'can 2027', 'eliminatoires can', 'eliminatoires mondial', 'selection nationale',
  'les elephants', 'les lions de la teranga', 'les aigles', 'les etalons', 'les leopards',
  'footballeur', 'joueur professionnel', 'entraineur (football)', 'maillot du club',
  'signe pour', 'rejoint le club', 'pret (football)', 'prete au club', 'club anglais',
  'club espagnol', 'club francais', 'championnat anglais', 'championnat espagnol',
  'al-nassr', 'al nassr', 'al-hilal', 'al hilal', 'al-ittihad', 'al ittihad', 'al ahly',
  'al ain', 'inter milan', 'napoli', 'atletico madrid', 'borussia dortmund',
  'west ham', 'newcastle', 'aston villa', 'galatasaray', 'fenerbahce', 'sporting lisbonne',
  'benfica', 'fc porto', 'as monaco', 'olympique lyonnais', 'olympique de marseille',
  'losc lille', 'stade rennais',
  'transfer fee', 'signed for', 'signs for', 'on loan at', 'loaned to', 'joins the club',
  'red card', 'yellow card', 'offside', 'penalty kick', 'penalty shootout', 'extra time',
  'friendly match', 'national squad', 'africa cup of nations', 'afcon', 'world cup qualifiers',
  'the black stars', 'the super eagles', 'the indomitable lions', 'the elephants',
  'the eagles', 'the stallions', 'the leopards', 'the atlas lions', 'the bafana bafana',
  'the harambee stars', 'footballer', 'professional player', 'coach (football)',
  'club jersey', 'english club', 'spanish club',
];

const TRANSFERT_MONTANT_RE = /\d+([.,]\d+)?\s*(m€|m\$|millions?\s+d.?euros?|millions?\s+de\s+dollars|million\s+euros?|million\s+pounds?|million\s+dollars?|£\d|\$\d)/i;
const TRANSFERT_VERBE_KW = [
  'rejoint', "s'engage avec", "s'engage pour", 'signe avec', 'signe un contrat',
  'prete par', 'prete a', 'quitte le club', 'transfere a', 'transfere vers', 'file a',
  'joins', 'signs for', 'signs with', 'signs a contract', 'loaned from', 'loaned to',
  'leaves the club', 'transferred to',
];

function estContenuSportif(t: string): boolean {
  for (const kw of SPORT_CONTENU_KW) if (matchMot(t, kw)) return true;
  if (TRANSFERT_MONTANT_RE.test(t) && TRANSFERT_VERBE_KW.some((v) => matchMot(t, v))) return true;
  return false;
}

const CULTURE_DIVERTISSEMENT_KW = [
  'cinema', 'box-office', 'film primee', 'avant-premiere', 'festival de cannes',
  'festival de musique', 'chanteur', 'chanteuse', 'album musical', 'clip video',
  'concert de', 'tournee musicale', 'fashion week', 'defile de mode', 'styliste',
  'celebrite', 'star du showbiz', 'showbiz', 'vie privee de', 'couple star',
  'mariage de', 'remariage de', 'biopic', 'serie tv', 'emission tele', 'telerealite',
  'oscars du cinema', 'grammy awards', "ballon d'or", 'prix nobel', 'prix goncourt',
  'grand prix litteraire', "festival international du film", 'recompense artistique',
  'trophee des arts', "exposition d'art", 'vernissage', "sortie d'album",
  'box office', 'premiere (film)', 'film festival', 'music festival', 'singer',
  'music album', 'music video', 'fashion show', 'celebrity', 'private life of',
  'engagement of', 'wedding of', 'tv series', 'tv show', 'reality show', 'academy awards',
  'nobel prize', 'art exhibition', 'album release',
];

function estContenuCulturel(t: string): boolean {
  for (const kw of CULTURE_DIVERTISSEMENT_KW) if (matchMot(t, kw)) return true;
  return false;
}

const CK_CRIT = ['attaque', 'attentat', 'enlev', 'enlevement', 'massacre', 'explosion', 'mort', 'tue', 'tues', 'tuee', 'tuees', 'coup d', 'putsch', 'assaut', "prise d'otage", 'prise d otage', 'embuscade', 'incendie', 'frappe', 'drone', 'bombardement', 'meurtre', 'execution', 'genocide'];
const CK_HIGH = ['tension', 'alerte', 'insecurite', 'crise', 'manifestation', 'greve', 'blocus', 'restriction', 'fermeture', 'evacuation', 'deplacement', 'menace', 'avertissement', 'siege', 'offensive', 'combat', 'violence'];
const CK_SEC = ['securite', 'securitaire', 'arme', 'armee', 'militaire', 'terrorisme', 'jihadiste', 'djihadiste', 'jnim', 'aqmi', 'boko', 'bandit', 'enlev', 'fsr', 'm23', 'adf', 'eis', 'al-shabaab', 'groupes armes'];
const CK_HUM = ['alimentaire', 'humanitaire', 'famine', 'soudure', 'refugie', 'deplace', 'deplacement', 'ocha', 'fao', 'malnutrition', 'aide humanitaire', 'cholera', 'ebola', 'epidemie', 'urgence', 'crise alimentaire'];
const CK_POL = ['election', 'president', 'gouvernement', 'parlement', 'constitution', 'loi', 'diplomatique', 'sommet', 'junte', 'transition', 'coup', 'veto', 'sanctions', 'greve', 'manifestation'];
const CK_ECO = ['economie', 'marche', 'prix', 'croissance', 'investissement', 'entreprise', 'commerce', 'port', 'export', 'inflation', 'bceao', 'monnaie'];

const HIGH_BASE_CY = new Set(['BF', 'ML', 'NE', 'CD', 'SS', 'SD', 'CF', 'LY', 'CM', 'MZ', 'SO', 'MG']);
const MOD_BASE_CY = new Set(['NG', 'GN', 'TD', 'ZW', 'RW', 'ET', 'CG', 'TN', 'DZ', 'SL', 'ZA']);

export type Level = 'crit' | 'high' | 'mod' | 'ok';
export type Category = 'securite' | 'humanitaire' | 'politique' | 'economique' | 'sport' | 'culture';

export function classify(txt: string, srcCy: string, srcCat: Category): { lvl: Level; cat: Category } {
  const t = txt.toLowerCase();
  const tAcc = normaliserAccents(t);

  if (estContenuSportif(tAcc)) return { lvl: 'ok', cat: 'sport' };
  if (estContenuCulturel(tAcc)) return { lvl: 'ok', cat: 'culture' };

  const tScan = neutraliserExpressions(tAcc);

  const scores = {
    securite: CK_SEC.filter((k) => matchMot(tScan, k)).length,
    humanitaire: CK_HUM.filter((k) => matchMot(tScan, k)).length,
    politique: CK_POL.filter((k) => matchMot(tScan, k)).length,
    economique: CK_ECO.filter((k) => matchMot(tScan, k)).length,
  };
  let cat: Category = srcCat;
  let mx = 0;
  for (const [c, v] of Object.entries(scores)) {
    if (v > mx) {
      mx = v;
      cat = c as Category;
    }
  }

  const lienSecuriteFaible = scores.securite > 0 || scores.humanitaire > 0;
  const lvl: Level = CK_CRIT.some((k) => matchMot(tScan, k))
    ? 'crit'
    : CK_HIGH.some((k) => matchMot(tScan, k))
      ? 'high'
      : lienSecuriteFaible && HIGH_BASE_CY.has(srcCy)
        ? 'high'
        : lienSecuriteFaible && MOD_BASE_CY.has(srcCy)
          ? 'mod'
          : lienSecuriteFaible
            ? 'mod'
            : 'ok';

  return { lvl, cat };
}
