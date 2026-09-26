import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, List, Moon, Sun, X } from '@phosphor-icons/react';
import ipcsLogo from './ipcs-logo.png';

const links = [
  { label: 'Home', to: '/' },
  { label: 'About Us', to: '/about' },
  { label: 'Placements & Recruiters', to: '/placements' },
  { label: 'Partners', to: '/partners' },
  { label: 'Updates', to: '/updates' }
];

export default function PublicSiteHeader() {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    try { return localStorage.getItem('ipcs-public-theme') === 'dark' ? 'dark' : 'light'; }
    catch { return 'light'; }
  });

  useEffect(() => {
    document.documentElement.dataset.ipcsTheme = theme;
    document.body.style.backgroundColor = theme === 'dark' ? '#081426' : '';
    try { localStorage.setItem('ipcs-public-theme', theme); } catch { /* Theme still applies for this visit. */ }
  }, [theme]);

  return (
    <header className="portal-header">
      <Link className="portal-brand" to="/" aria-label="IPCS Global home" onClick={() => setMenuOpen(false)}>
        <img src={ipcsLogo} alt="IPCS Global" />
      </Link>
      <button className="portal-menu-toggle" type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}>
        {menuOpen ? <X size={20} /> : <List size={21} />}
      </button>
      <nav className={`portal-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
        {links.map(link => {
          const active = link.to === '/' ? pathname === '/' : pathname === link.to || (link.to === '/placements' && pathname.startsWith('/placements')) || (link.to === '/partners' && pathname.startsWith('/partners'));
          const className = `portal-nav-link${active ? ' active' : ''}`;
          return <Link key={link.label} className={className} to={link.to} aria-current={active ? 'page' : undefined} onClick={() => setMenuOpen(false)}>{link.label}</Link>;
        })}
      </nav>
      <div className="portal-header-actions">
        <button className="portal-theme-toggle" type="button" onClick={() => setTheme(value => value === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? <Sun size={18} weight="duotone" /> : <Moon size={18} weight="duotone" />}
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
        <Link className="portal-login-button" to="/login" onClick={() => setMenuOpen(false)}>Staff access <ArrowRight size={17} weight="bold" /></Link>
      </div>
    </header>
  );
}
