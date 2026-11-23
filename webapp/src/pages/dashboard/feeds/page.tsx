import { useState, useMemo, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import ShareModal from '@/components/feature/ShareModal';

interface RealArticle {
  id: string;
  title: string;
  cy: string;
  cat: 'securite' | 'politique' | 'humanitaire' | 'economique' | 'sport' | 'culture';
  pubDate: number;
  crosses?: string[];
  primary?: string;
  tr?: { fr?: { t?: string; s?: string }; en?: { t?: string; s?: string } };
  langue?: 'fr' | 'en' | 'pt' | 'ar' | 'es' | 'other';
}

const CAT_LABEL: Record<RealArticle['cat'], string> = { securite: 'Sécurité', politique: 'Politique', humanitaire: 'Humanitaire', economique: 'Économie', sport: 'Sport', culture: 'Culture' };
const CAT_DOT: Record<RealArticle['cat'], string> = { securite: 'bg-red-500', politique: 'bg-indigo-500', humanitaire: 'bg-orange-500', economique: 'bg-teal-500', sport: 'bg-slate-500', culture: 'bg-violet-500' };

export default function FeedsPage() {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<{ id: string; title: string } | null>(null);
  const [feeds, setFeeds] = useState<RealArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cacheAge, setCacheAge] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadFromCache = useCallback(async () => {
    const { data, error: err } = await supabase.from('collecte_partagee').select('articles, updated_at').eq('id', 'global').maybeSingle();
    if (err) setError(err.message);
    else if (data?.articles) { setFeeds(data.articles as RealArticle[]); setCacheAge(data.updated_at as string); }
    setLoading(false);
  }, []);

  useEffect(() => { loadFromCache(); }, [loadFromCache]);

  const targetLang = i18n.language?.startsWith('fr') ? 'fr' : 'en';
  const languageFeeds = useMemo(() => feeds.filter((feed) => {
    if (feed.langue === targetLang) return true;
    return !!(targetLang === 'fr' ? feed.tr?.fr?.t : feed.tr?.en?.t);
  }), [feeds, targetLang]);

  const categories = useMemo(() => Array.from(new Set(languageFeeds.map((f) => f.cat))), [languageFeeds]);

  const filteredFeeds = useMemo(() => {
    let list = [...languageFeeds];
    if (categoryFilter !== 'all') list = list.filter((f) => f.cat === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.title.toLowerCase().includes(q) || (f.crosses?.[0] ?? f.primary ?? '').toLowerCase().includes(q) || f.cy.toLowerCase().includes(q));
    }
    list.sort((a, b) => (b.pubDate || 0) - (a.pubDate || 0));
    return list;
  }, [languageFeeds, search, categoryFilter]);

  const titleForLang = useCallback((feed: RealArticle) => targetLang === 'en' ? (feed.tr?.en?.t || feed.title) : (feed.tr?.fr?.t || feed.title), [targetLang]);
  const handleActualiser = useCallback(async () => { setRefreshing(true); try { await loadFromCache(); } finally { setRefreshing(false); } }, [loadFromCache]);
  const formatTime = (pubDate: number) => { if (!pubDate) return '—'; const d = new Date(pubDate); const loc = targetLang === 'fr' ? 'fr-FR' : 'en-US'; return d.toLocaleDateString(loc, { day: '2-digit', month: 'short' }) + ' ' + d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' }); };

  return (
    <div className="space-y-5">
      {shareTarget && <ShareModal open={shareModalOpen} onClose={() => { setShareModalOpen(false); setShareTarget(null); }} itemTitle={shareTarget.title} itemType={`Flux ${shareTarget.id}`} />}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"><div><h1 className="text-lg font-bold text-slate-50">{t('dashboard.feeds')}</h1><p className="text-xs text-slate-400 mt-0.5">{loading ? (targetLang === 'fr' ? 'Chargement des actualités réelles…' : 'Loading real news…') : `${filteredFeeds.length} actualité${filteredFeeds.length !== 1 ? 's' : ''}`}</p></div><div className="flex items-center gap-2"><button type="button" onClick={handleActualiser} disabled={refreshing} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[#d9a85c] text-[#17181c] disabled:opacity-60"><i className="ri-refresh-line" />{targetLang === 'fr' ? 'Actualiser' : 'Refresh'}</button></div></div>
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center flex-wrap"><div className="flex items-center bg-[#1e1f24] border border-white/[0.08] rounded-lg px-3 py-1.5 flex-1 min-w-[200px]"><i className="ri-search-line text-slate-500 text-sm mr-2" /><input type="text" placeholder={targetLang === 'fr' ? 'Rechercher un flux...' : 'Search feed...'} value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none w-full" /></div><div className="flex gap-2 flex-wrap"><button type="button" onClick={() => setCategoryFilter('all')} className="px-3 py-1.5 rounded-full text-[10px] font-semibold border bg-[#1e1f24] text-slate-300 border-white/[0.08]">{targetLang === 'fr' ? 'Toutes' : 'All'}</button>{categories.map((cat) => <button key={cat} type="button" onClick={() => setCategoryFilter(cat)} className="px-3 py-1.5 rounded-full text-[10px] font-semibold border bg-[#1e1f24] text-slate-300 border-white/[0.08]">{targetLang === 'fr' ? CAT_LABEL[cat] : cat}</button>)}</div></div>
      {loading ? <div className="py-16 flex justify-center"><div className="w-6 h-6 border-2 border-[#d9a85c]/30 border-t-[#d9a85c] rounded-full animate-spin" /></div> : error ? <div className="py-12 text-center text-red-400 text-xs">Impossible de lire le cache d'actualités partagé : {error}</div> : filteredFeeds.length === 0 ? <div className="py-12 text-center text-slate-400 text-xs">{targetLang === 'fr' ? 'Aucune actualité française disponible.' : 'No English news available.'}</div> : viewMode === 'list' ? <div className="divide-y divide-white/[0.06]">{filteredFeeds.map((feed) => <div key={feed.id} className="py-4"><div className="flex items-center gap-2 mb-1.5"><span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${CAT_DOT[feed.cat]}`} /><span className="text-[10.5px] font-semibold tracking-[0.04em] text-slate-400 uppercase truncate">{targetLang === 'fr' ? CAT_LABEL[feed.cat] : feed.cat}{feed.cy ? ` · ${feed.cy}` : ''}</span><span className="ml-auto text-[10px] text-slate-500">{formatTime(feed.pubDate)}</span></div><div className="flex items-start gap-3"><p className="flex-1 min-w-0 text-[15px] font-bold text-slate-50 leading-snug">{titleForLang(feed)}</p><button type="button" onClick={() => { setShareTarget({ id: feed.id, title: titleForLang(feed) }); setShareModalOpen(true); }} className="w-6 h-6 text-slate-500"><i className="ri-share-forward-line text-sm" /></button></div></div>)}</div> : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">{filteredFeeds.map((feed) => <div key={feed.id} className="bg-[#17181c] rounded-lg border border-white/[0.08] p-4"><p className="text-[14px] font-bold text-slate-50 leading-snug">{titleForLang(feed)}</p></div>)}</div>}
    </div>
  );
}
