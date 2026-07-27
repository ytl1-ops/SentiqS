import { useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import ShareModal from '@/components/feature/ShareModal';

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

const CAT_COLOR: Record<RealArticle['cat'], string> = {
  securite: 'bg-red-50 text-red-700 border-red-200',
  politique: 'bg-blue-50 text-blue-700 border-blue-200',
  humanitaire: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  economique: 'bg-orange-50 text-orange-700 border-orange-200',
  sport: 'bg-gray-50 text-gray-700 border-gray-200',
  culture: 'bg-purple-50 text-purple-700 border-purple-200',
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

  useEffect(() => {
    let cancelled = false;
    // Lit le cache RSS partage reel (collecte_partagee, id='global') — le
    // meme chemin qu'un visiteur ordinaire de web/SentiqS_Web.html avant de
    // lancer sa propre collecte. Aucune donnee fictive : liste vide + message
    // explicite si le cache est absent/vide, jamais d'article invente.
    supabase
      .from('collecte_partagee')
      .select('articles, updated_at')
      .eq('id', 'global')
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
        } else if (data?.articles) {
          setFeeds(data.articles as RealArticle[]);
          setCacheAge(data.updated_at as string);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const categoryColor = (cat: RealArticle['cat']) => CAT_COLOR[cat] || 'bg-gray-50 text-gray-700 border-gray-200';

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
          <h1 className="text-lg font-bold text-sentiqs-navy">{t('dashboard.feeds')}</h1>
          <p className="text-xs text-sentiqs-gray-text mt-0.5">
            {loading
              ? 'Chargement des actualités réelles…'
              : `${filteredFeeds.length} actualité${filteredFeeds.length !== 1 ? 's' : ''} — cache partagé ${cacheAge ? `mis à jour le ${new Date(cacheAge).toLocaleString('fr-FR')}` : 'indisponible'}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${viewMode === 'list' ? 'bg-sentiqs-navy text-white' : 'bg-white border border-gray-200 text-sentiqs-gray-text hover:border-gray-300'}`}
          >
            <i className="ri-list-check" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-colors ${viewMode === 'grid' ? 'bg-sentiqs-navy text-white' : 'bg-white border border-gray-200 text-sentiqs-gray-text hover:border-gray-300'}`}
          >
            <i className="ri-layout-grid-line" />
          </button>
        </div>
      </div>

      {/* Filters bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap">
        <div className="flex items-center bg-white border border-gray-200 rounded-lg px-3 py-1.5 flex-1 min-w-[200px]">
          <i className="ri-search-line text-sentiqs-gray-text text-sm mr-2" />
          <input
            type="text"
            placeholder="Rechercher un flux..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-transparent text-xs text-sentiqs-navy placeholder:text-gray-400 focus:outline-none w-full"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors whitespace-nowrap ${
              categoryFilter === 'all'
                ? 'bg-sentiqs-navy text-white border-sentiqs-navy'
                : 'bg-white text-sentiqs-gray-text border-gray-200 hover:border-gray-300'
            }`}
          >
            Toutes
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold border transition-colors whitespace-nowrap ${
                categoryFilter === cat
                  ? 'bg-sentiqs-navy text-white border-sentiqs-navy'
                  : 'bg-white text-sentiqs-gray-text border-gray-200 hover:border-gray-300'
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
          <div className="w-6 h-6 border-2 border-sentiqs-navy/30 border-t-sentiqs-navy rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="py-12 text-center text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg">
          Impossible de lire le cache d'actualités partagé : {error}
        </div>
      ) : filteredFeeds.length === 0 ? (
        <div className="py-12 text-center text-sentiqs-gray-text text-xs">
          {feeds.length === 0
            ? "Aucune actualité dans le cache partagé pour l'instant (collecte_partagee vide ou indisponible)."
            : 'Aucune actualité ne correspond à ces filtres.'}
        </div>
      ) : viewMode === 'list' ? (
        <div className="bg-white rounded-lg border border-gray-100 divide-y divide-gray-50">
          {filteredFeeds.map((feed) => (
            <div key={feed.id} className="px-5 py-4 hover:bg-gray-50/50 transition-colors">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-lg bg-sentiqs-navy/5 flex items-center justify-center">
                    <i className="ri-article-line text-sentiqs-navy text-sm" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-sentiqs-navy leading-relaxed">{feed.title}</p>
                  <div className="flex items-center gap-3 mt-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${categoryColor(feed.cat)}`}>
                      {CAT_LABEL[feed.cat]}
                    </span>
                    <span className="text-[10px] text-sentiqs-gray-text font-medium">{feed.crosses?.[0] ?? feed.primary ?? '—'}</span>
                    <span className="text-[10px] text-sentiqs-gray-text">{feed.cy}</span>
                    <span className="text-[10px] text-sentiqs-gray-text">{formatTime(feed.pubDate)}</span>
                  </div>
                </div>
                <button type="button" onClick={() => { setShareTarget({ id: feed.id, title: feed.title }); setShareModalOpen(true); }} className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-sentiqs-gray-text hover:text-sentiqs-navy transition-colors">
                  <i className="ri-share-forward-line text-sm" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredFeeds.map((feed) => (
            <div key={feed.id} className="bg-white rounded-lg border border-gray-100 p-4 hover:border-gray-200 transition-colors">
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-lg bg-sentiqs-navy/5 flex items-center justify-center">
                  <i className="ri-article-line text-sentiqs-navy text-sm" />
                </div>
                <button type="button" onClick={() => { setShareTarget({ id: feed.id, title: feed.title }); setShareModalOpen(true); }} className="w-6 h-6 flex items-center justify-center text-sentiqs-gray-text hover:text-sentiqs-navy transition-colors">
                  <i className="ri-share-forward-line text-sm" />
                </button>
              </div>
              <p className="text-xs font-medium text-sentiqs-navy leading-relaxed mb-3">{feed.title}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${categoryColor(feed.cat)}`}>
                  {CAT_LABEL[feed.cat]}
                </span>
                <span className="text-[10px] text-sentiqs-gray-text">{feed.cy}</span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                <span className="text-[10px] text-sentiqs-gray-text">{feed.crosses?.[0] ?? feed.primary ?? '—'}</span>
                <span className="text-[10px] text-sentiqs-gray-text">{formatTime(feed.pubDate)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}