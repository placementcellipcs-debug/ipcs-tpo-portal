import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import PublicSiteHeader from './PublicSiteHeader';
import PublicSiteSections from './PublicSiteSections';
import './Login.css';

export default function PublicSitePage({ page }) {
  const location = useLocation();
  useEffect(() => {
    if (location.hash) {
      const id = decodeURIComponent(location.hash.slice(1));
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }
  }, [location.pathname, location.search, location.hash]);

  return (
    <main className="public-portal">
      <div className="portal-glow portal-glow-one" aria-hidden="true" />
      <div className="portal-glow portal-glow-two" aria-hidden="true" />
      <PublicSiteHeader />
      <PublicSiteSections key={`${page}${location.search}`} page={page} />
      <footer className="portal-footer"><span>© IPCS Global</span><span>Learn · Connect · Grow</span></footer>
    </main>
  );
}
