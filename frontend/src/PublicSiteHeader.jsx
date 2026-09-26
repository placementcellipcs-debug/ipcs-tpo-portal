import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowRight, List, X } from '@phosphor-icons/react';
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
      <Link className="portal-login-button" to="/login" onClick={() => setMenuOpen(false)}>Staff access <ArrowRight size={17} weight="bold" /></Link>
    </header>
  );
}
