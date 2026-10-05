import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import ShareModal from '@/components/feature/ShareModal';
import { doCollect, type CollecteProgress } from '@/lib/collecte/doCollect';

// Forme reelle d'un article dans collecte_partagee.articles (voir
// parseRSS/parseJSON dans web/SentiqS_Web.html) — seuls les champs
// affiches ici sont types, le reste de l'objet reel est ignore.
interface RealArticle {
  id: string;
  title: string;
  cy: string;
  cat: 'securite' | 'politique' | 'humanitaire' | 'economique' | 'sport' | 'culture';
  pubDate: number;
  crosses?: string[];
  primary?: string;
}

const CAT_LABEL: Record<RealArticle['cat'], string> = {
  securite: 'Sécurité',
  politique: 'Politique',
  humanitaire: 'Humanitaire',
  economique: 'Économie',
  sport: 'Sport',
  culture: 'Culture',
};

// Pastille d'eyebrow (point colore devant "CATEGORIE · Pays"), pas un badge
// plein — direction Ground News du 05/10/2026, voir CLAUDE.md.
const CAT_DOT: Record<RealArticle['cat'], string> = {
  securite: 'bg-red-500',
  politique: 'bg-indigo-500',
  humanitaire: 'bg-orange-500',
  economique: 'bg-teal-500',
  sport: 'bg-slate-500',
  culture: 'bg-violet-500',
};

export default function FeedsPage() {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ id: string; title: string } | null>(null);
  const [feeds, setFeeds] = useState<RealArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheAge, setCacheAge] = useState<string | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [collecteProgress, setCollecteProgress] = useState<CollecteProgress | null>(null);
  const [collecteError, setCollecteError] = useState<string | null>(null);

  const loadFromCache = useCallback(async () => {
    // Lit le cache RSS partage reel (collecte_partagee, id='global') — le
    // meme chemin qu'un visiteur ordinaire de web/SentiqS_Web.html avant de
    // lancer sa propre collecte. Aucune donnee fictive : liste vide + message
    // explicite si le cache est absent/vide, jamais d'article invente.
    const { data, error: err } = await supabase
      .from('collecte_partagee')
      .select('articles, updated_at')
      .eq('id', 'global')
      .maybeSingle();
    if (err) {
      setError(err.message);
    } else if (data?.articles) {
      setFeeds(data.articles as RealArticle[]);
      setCacheAge(data.updated_at as string);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadFromCache();
  }, [loadFromCache]);

  // Lance une vraie collecte contre les 495 sources reelles (voir
  // src/lib/collecte/) puis recharge le Flux depuis le cache partage mis a
  // jour. Peut prendre du temps (jusqu'a plusieurs dizaines de secondes,
  // comme sur le site reel) — la progression (sources traitees/total,
  // succes/erreurs) est affichee pendant l'operation.
  const handleActualiser = useCallback(async () => {
    setCollecting(true);
    setCollecteError(null);
    setCollecteProgress(null);
    try {
      const { publication } = await doCollect((p) => setCollecteProgress(p));
      if (publication.ok === false) {
        setCollecteError(publication.raison);
      }
      await loadFromCache();
    } catch (e) {
      setCollecteError(e instanceof Error ? e.message : 'Erreur inconnue pendant la collecte.');
    } finally {
      setCollecting(false);
    }
  }, [loadFromCache]);

  const categories = useMemo(() => {
    const cats = new Set(feeds.map((f) => f.cat));
    return Array.from(cats);
  }, [feeds]);

  const filteredFeeds = useMemo(() => {
    let list = [...feeds];
    if (categoryFilter !== 'all') list = list.filter((f) => f.cat === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) => f.title.toLowerCase().includes(q) || (f.crosses?.[0] ?? f.primary ?? '').toLowerCase().includes(q) || f.cy.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0));
    return list;
  }, [feeds, search, categoryFilter]);

  const formatTime = (pubDate: number) => {
    if (!pubDate) return '—';
    const d = new Date(pubDate);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  };

  const categoryDot = (cat: RealArticle['cat']) => CAT_DOT[cat] || 'bg-slate-500';

  return (
    <div className="space-y-5">
      {/* Share Modal */}
      {shareTarget && (
        <ShareModal
          open={shareModalOpen}
          onClose={() => { setShareModalOpen(false); setShareTarget(null); }}
          itemTitle={shareTarget.title}
          itemType={`Flux ${shareTarget.id}`}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-50">{t('dashboard.feeds')}</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {loading
              ? 'Chargement des actualités réelles…'
              : `${filteredFeeds.length} actualité${filteredFeeds.length !== 1 ? 's' : ''} — cache partagé ${cacheAge ? `mis à jour le ${new Date(cacheAge).toLocaleString('fr-FR')}` : 'indisponible'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleActualiser}
            disabled={collecting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#d9a85c] text-[#17181c] hover:bg-[#c99b4e] transition-colors disabled:opacity-60 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {collecting ? (
              <span className="w-3.5 h-3.5 border-2 border-[#17181c]/30 border-t-[#17181c] rounded-full animate-spin" />
            ) : (
              <i className="ri-refresh-line" />
            )}
            Actualiser
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${viewMode === 'list' ? 'bg-[#d9a85c] text-[#17181c]' : 'bg-[#1e1f24] border border-white/[0.08] text-slate-400 hover:border-white/20'}`}
          >
            <i className="ri-list-check" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${viewMode === 'grid' ? 'bg-[#d9a85c] text-[#17181c]' : 'bg-[#1e1f24] border border-white/[0.08] text-slate-400 hover:border-white/20'}`}
          >
            <i className="ri-layout-grid-line" />
          </button>
        </div>
      </div>

      {collecting && collecteProgress && (
        <div className="bg-[#d9a85c]/[0.06] border border-[#d9a85c]/20 rounded-lg px-3 py-2 text-[11px] text-[#e9cda0] flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#d9a85c] animate-pulse flex-shrink-0" />
          Collecte en cours : {collecteProgress.traitees}/{collecteProgress.total} sources ({collecteProgress.ok} ok, {collecteProgress.erreurs} en échec) — {collecteProgress.articlesTrouves} actualités trouvées
        </div>
      )}
      {collecteError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2 text-[11px] text-red-400">
          La collecte a rencontré un problème : {collecteError}
        </div>
      )}

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <div className="flex items-center bg-[#1e1f24] border border-white/[0.08] rounded-lg px-3 py-1.5 flex-1 min-w-[200px]">
          <i className="ri-search-line text-slate-500 text-sm mr-2" />
          <input
            type="text"
            placeholder="Rechercher un flux..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none w-full"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-full text-[10px] font-semibold border transition-colors whitespace-nowrap ${
              categoryFilter === 'all'
                ? 'bg-[#d9a85c] text-[#17181c] border-[#d9a85c]'
                : 'bg-[#1e1f24] text-slate-300 border-white/[0.08] hover:border-white/20'
            }`}
          >
            Toutes
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-semibold border transition-colors whitespace-nowrap ${
                categoryFilter === cat
                  ? 'bg-[#d9a85c] text-[#17181c] border-[#d9a85c]'
                  : 'bg-[#1e1f24] text-slate-300 border-white/[0.08] hover:border-white/20'
              }`}
            >
              {CAT_LABEL[cat]}
            </button>
          ))}
        </div>
      </div>

      {/* Feeds content */}
      {loading ? (
        <div className="py-16 flex justify-center">
          <div className="w-6 h-6 border-2 border-[#d9a85c]/30 border-t-[#d9a85c] rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="py-12 text-center text-red-400 text-xs bg-red-500/10 border border-red-500/30 rounded-lg">
          Impossible de lire le cache d'actualités partagé : {error}
        </div>
      ) : filteredFeeds.length === 0 ? (
        <div className="py-12 text-center text-slate-400 text-xs">
          {feeds.length === 0
            ? "Aucune actualité dans le cache partagé pour l'instant (collecte_partagee vide ou indisponible)."
            : 'Aucune actualité ne correspond à ces filtres.'}
        </div>
      ) : viewMode === 'list' ? (
        <div className="divide-y divide-white/[0.06]">
          {filteredFeeds.map((feed) => (
            <div key={feed.id} className="py-4">
              {/* Eyebrow — categorie, pays, heure */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${categoryDot(feed.cat)}`} />
                <span className="text-[10.5px] font-semibold tracking-[0.04em] text-slate-400 uppercase truncate">
                  {CAT_LABEL[feed.cat]}{feed.cy ? ` · ${feed.cy}` : ''}
                </span>
                <span className="ml-auto text-[10px] text-slate-500 whitespace-nowrap flex-shrink-0">{formatTime(feed.pubDate)}</span>
              </div>
              <div className="flex items-start gap-3">
                <p className="flex-1 min-w-0 text-[15px] font-bold text-slate-50 leading-snug">{feed.title}</p>
                <button type="button" onClick={() => { setShareTarget({ id: feed.id, title: feed.title }); setShareModalOpen(true); }} className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-slate-500 hover:text-[#d9a85c] transition-colors">
                  <i className="ri-share-forward-line text-sm" />
                </button>
              </div>
              {(feed.crosses?.[0] ?? feed.primary) && (
                <p className="text-[10px] text-slate-500 mt-1.5">{feed.crosses?.[0] ?? feed.primary}</p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredFeeds.map((feed) => (
            <div key={feed.id} className="bg-[#17181c] rounded-lg border border-white/[0.08] p-4 hover:border-white/20 transition-colors">
              <div className="flex items-center gap-2 mb-2.5">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${categoryDot(feed.cat)}`} />
                <span className="text-[10px] font-semibold tracking-[0.04em] text-slate-400 uppercase truncate">
                  {CAT_LABEL[feed.cat]}{feed.cy ? ` · ${feed.cy}` : ''}
                </span>
                <button type="button" onClick={() => { setShareTarget({ id: feed.id, title: feed.title }); setShareModalOpen(true); }} className="ml-auto flex-shrink-0 w-6 h-6 flex items-center justify-center text-slate-500 hover:text-[#d9a85c] transition-colors">
                  <i className="ri-share-forward-line text-sm" />
                </button>
              </div>
              <p className="text-[14px] font-bold text-slate-50 leading-snug mb-3">{feed.title}</p>
              <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                <span className="text-[10px] text-slate-500">{feed.crosses?.[0] ?? feed.primary ?? '—'}</span>
                <span className="text-[10px] text-slate-500">{formatTime(feed.pubDate)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}