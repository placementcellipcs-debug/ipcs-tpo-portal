import { useLocation } from 'react-router-dom';
import PublicSiteHeader from './PublicSiteHeader';
import PublicSiteSections from './PublicSiteSections';
import './Login.css';

export default function PublicSitePage({ page }) {
  const location = useLocation();
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
