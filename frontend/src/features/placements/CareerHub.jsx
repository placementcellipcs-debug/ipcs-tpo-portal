import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowSquareOut, ArrowsClockwise, BookmarkSimple, MagnifyingGlass, Newspaper, WarningCircle } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { formatPortalDate, formatPortalTime } from '../../utils/dateFormat';
import { API_BASE } from '../../services/apiConfig';
import './CareerHub.css';

const SAVED_KEY = 'ipcs-career-hub-saved';
const readSaved = key => {
  try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch { return []; }
};

export default function CareerHub() {
  const staffEmail = (() => {
    try { return JSON.parse(localStorage.getItem('tpoData') || '{}').email || 'staff'; } catch { return 'staff'; }
  })();
  const savedKey = `${SAVED_KEY}:${staffEmail.toLowerCase()}`;
  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [saved, setSaved] = useState(() => readSaved(savedKey));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshedAt, setRefreshedAt] = useState('');

  const loadFeed = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axios.get(`${API_BASE}/api/career-hub`);
      if (!response.data?.success) throw new Error(response.data?.message || 'The feed could not be loaded.');
      setCategories(response.data.categories || []);
      setItems(response.data.items || []);
      setRefreshedAt(response.data.refreshedAt || '');
    } catch (loadError) {
      setError(loadError.response?.data?.message || loadError.message || 'Industry updates are temporarily unavailable.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadFeed(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadFeed]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter(item => (activeCategory === 'all' || activeCategory === 'saved' || item.category === activeCategory) && (!query || [item.title, item.summary, item.source, item.categoryLabel].some(value => String(value || '').toLowerCase().includes(query))));
  }, [activeCategory, items, search]);

  const toggleSaved = item => {
    setSaved(current => {
      const next = current.includes(item.id) ? current.filter(id => id !== item.id) : [...current, item.id];
      try { localStorage.setItem(savedKey, JSON.stringify(next)); } catch { /* Saved state remains in memory for this session. */ }
      return next;
    });
  };

  const showSaved = activeCategory === 'saved';
  const visibleItems = showSaved ? filteredItems.filter(item => saved.includes(item.id)) : filteredItems;

  return <Layout>
    <main className="career-hub-page">
      <section className="career-hub-hero">
        <div className="career-hub-orbit career-hub-orbit-one" aria-hidden="true" /><div className="career-hub-orbit career-hub-orbit-two" aria-hidden="true" />
        <span className="career-hub-eyebrow"><Newspaper size={15} weight="fill" /> NEWS &amp; BLOG</span>
        <h1>News &amp; Blog</h1>
        <p>Practical reads across technology, industry, careers, workplace culture, and the evolving world of work.</p>
        <div className="career-hub-meta"><span>{items.length} updates</span><span>Updated {refreshedAt ? formatPortalTime(refreshedAt) : 'when you open the hub'}</span></div>
      </section>

      <section className="career-hub-feed" aria-label="News and blog updates">
        <div className="career-hub-toolbar">
          <div className="career-hub-heading"><span>THE LATEST</span><h2>Explore the feed</h2></div>
          <label className="career-hub-search"><MagnifyingGlass size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search topics, companies, and skills" aria-label="Search industry updates" /></label>
          <button className="career-hub-refresh" type="button" onClick={loadFeed} disabled={loading}><ArrowsClockwise size={17} className={loading ? 'career-spin' : ''} /> Refresh</button>
        </div>

        <div className="career-hub-chips" role="tablist" aria-label="Filter the feed">
          <button type="button" role="tab" aria-selected={activeCategory === 'all'} className={activeCategory === 'all' ? 'active' : ''} onClick={() => setActiveCategory('all')}>For you</button>
          <button type="button" role="tab" aria-selected={activeCategory === 'saved'} className={activeCategory === 'saved' ? 'active' : ''} onClick={() => setActiveCategory('saved')}>Saved · {saved.length}</button>
          {categories.map(category => <button key={category.key} type="button" role="tab" aria-selected={activeCategory === category.key} className={activeCategory === category.key ? 'active' : ''} onClick={() => setActiveCategory(category.key)}>{category.label}</button>)}
        </div>

        {error && <div className="career-hub-message" role="alert"><WarningCircle size={19} />{error}<button type="button" onClick={loadFeed}>Try again</button></div>}
        {loading && !items.length ? <div className="career-hub-loading" role="status"><span /><span /><span />Bringing together current industry updates…</div>
          : !visibleItems.length ? <div className="career-hub-empty"><Newspaper size={28} /><b>{showSaved ? 'No saved reads yet' : 'No updates found'}</b><span>{showSaved ? 'Save a useful article and it will be here.' : 'Try another topic or clear your search.'}</span></div>
            : <div className="career-hub-grid">{visibleItems.map(item => <article className="career-post-card" key={item.id}>
              <div className="career-post-meta"><span className={`career-post-category category-${item.color}`}>{item.categoryLabel}</span><time>{item.publishedAt ? formatPortalDate(item.publishedAt) : 'Recent'}</time></div>
              <h3>{item.title}</h3>
              {item.summary && <p>{item.summary}</p>}
              <div className="career-post-footer"><span>{item.source || 'Industry update'}</span><div><button className={`career-bookmark ${saved.includes(item.id) ? 'saved' : ''}`} type="button" onClick={() => toggleSaved(item)} aria-label={saved.includes(item.id) ? 'Remove saved article' : 'Save article'} title={saved.includes(item.id) ? 'Remove saved article' : 'Save article'}><BookmarkSimple size={19} weight={saved.includes(item.id) ? 'fill' : 'regular'} /></button><a href={item.link} target="_blank" rel="noopener noreferrer">Read source <ArrowSquareOut size={16} /></a></div></div>
            </article>)}</div>}
        {!loading && items.length > 0 && <div className="career-hub-footnote">Updates are summarized from public news feeds. Open the publisher source for the complete article.</div>}
      </section>
    </main>
  </Layout>;
}
