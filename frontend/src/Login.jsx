import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CircleNotch, Compass, List, UsersThree, X } from '@phosphor-icons/react';
import { API_BASE } from './apiConfig';
import ipcsLogo from './ipcs-logo.png';
import './Login.css';
import PublicSiteSections from './PublicSiteSections';

export default function Login() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('home');
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const [showIntro, setShowIntro] = useState(false);
  const [videoOpacity, setVideoOpacity] = useState(1);

  useEffect(() => {
    const tpoData = localStorage.getItem('tpoData');
    if (!tpoData) return;
    try {
      const parsed = JSON.parse(tpoData);
      const userRole = String(parsed.role || '').toUpperCase();
      const isSuperAdmin = parsed.accessType === 'superadmin';
      navigate(userRole === 'BRANCH ASSET MANAGER' && !isSuperAdmin ? '/assets/dashboard' : '/dashboard');
    } catch {
      localStorage.removeItem('tpoData');
    }
  }, [navigate]);

  const openLogin = () => {
    setError('');
    setMenuOpen(false);
    setActiveTab('login');
  };

  const showHomeSection = (sectionId) => {
    setActiveTab('home');
    setMenuOpen(false);
    if (sectionId === 'home') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    window.setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  };

  const handleLogin = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API_BASE}/api/auth/login`, { email: loginId, password });
      if (!res.data.success) {
        setError(res.data.message || 'Login failed. Please check your credentials.');
        setLoading(false);
        return;
      }

      const account = res.data.tpo || res.data.tpoData;
      localStorage.setItem('tpoData', JSON.stringify(account));
      const userRole = String(account?.role || '').toUpperCase();
      const isSuperAdmin = account?.accessType === 'superadmin';

      if (userRole === 'BRANCH ASSET MANAGER' && !isSuperAdmin) {
        navigate('/assets/dashboard');
      } else {
        setShowIntro(true);
      }
    } catch (err) {
      console.error('Login Error:', err);
      setError(err.response?.data?.message || 'Server connection failed. Please check your internet and try again.');
      setLoading(false);
    }
  };

  if (showIntro) {
    return (
      <div className="login-intro" style={{ opacity: videoOpacity }}>
        <video
          src="/Intro.mp4"
          autoPlay
          playsInline
          onTimeUpdate={(event) => {
            if (event.target.duration - event.target.currentTime <= 1) setVideoOpacity(0);
          }}
          onEnded={() => navigate('/dashboard')}
          onError={() => navigate('/dashboard')}
        />
      </div>
    );
  }

  return (
    <main className="public-portal">
      <div className="portal-glow portal-glow-one" aria-hidden="true" />
      <div className="portal-glow portal-glow-two" aria-hidden="true" />

      <header className="portal-header">
        <Link className="portal-brand" to="/" aria-label="IPCS Global home" onClick={() => { setActiveTab('home'); setMenuOpen(false); }}>
          <img src={ipcsLogo} alt="IPCS Global" />
        </Link>
        <button className="portal-menu-toggle" type="button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}>
          {menuOpen ? <X size={20} /> : <List size={21} />}
        </button>
        <nav className={`portal-nav${menuOpen ? ' is-open' : ''}`} aria-label="Main navigation">
          <button className={activeTab === 'home' ? 'portal-nav-link active' : 'portal-nav-link'} onClick={() => showHomeSection('home')}>Home</button>
          <a className="portal-nav-link" href="/recruiter?section=mou" target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)}>Recruiter</a>
          <button className="portal-nav-link" onClick={() => showHomeSection('about')}>About Us</button>
          <button className="portal-nav-link" onClick={() => showHomeSection('placement')}>Placements</button>
          <button className="portal-nav-link" onClick={() => showHomeSection('partners')}>Partners</button>
          <button className="portal-nav-link" onClick={() => showHomeSection('updates')}>Updates</button>
        </nav>
        <button className="portal-login-button" onClick={openLogin}>Login <ArrowRight size={17} weight="bold" /></button>
      </header>

      <AnimatePresence mode="wait">
        {activeTab === 'home' ? (
          <motion.section
            key="home"
            id="home"
            className="portal-home"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.42, ease: 'easeOut' }}
          >
            <div className="portal-home-copy">
              <div className="portal-eyebrow"><span /> IPCS Global · Placement Ecosystem</div>
              <h1>Build skills.<br /><span>Shape what’s next.</span></h1>
              <p>Connecting future-ready talent in industrial automation, embedded systems, IoT, and digital technology with opportunities around the world.</p>
              <div className="portal-home-actions">
                <button className="portal-primary-button" onClick={openLogin}>Enter the portal <ArrowRight size={19} weight="bold" /></button>
                <a className="portal-secondary-button" href="/recruiter?section=mou" target="_blank" rel="noreferrer"><UsersThree size={19} /> Recruiter partnerships</a>
              </div>
              <div className="portal-trust-line"><span className="portal-trust-dot" /> Skills, academics, and career opportunities in one place</div>
            </div>

            <div className="portal-visual" aria-label="IPCS career and learning portal overview">
              <div className="portal-visual-orbit orbit-a" />
              <div className="portal-visual-orbit orbit-b" />
              <div className="portal-visual-center"><Compass size={56} weight="thin" /><span>IPCS<br />GLOBAL</span></div>
              <div className="portal-float-card float-learning"><span className="float-icon"><UsersThree size={19} /></span><span><b>Learning</b><small>Practical technical skills</small></span></div>
              <div className="portal-float-card float-careers"><span className="float-icon"><ArrowRight size={19} /></span><span><b>Career pathways</b><small>Connected to opportunity</small></span></div>
              <div className="portal-visual-caption">Learn · Prepare · Progress</div>
            </div>
          </motion.section>
        ) : (
          <motion.section
            key="login"
            className="portal-login-view"
            initial={{ opacity: 0, x: 22 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
          >
            <div className="login-context">
              <button className="login-back" type="button" onClick={() => setActiveTab('home')}><ArrowLeft size={18} /> Back to home</button>
              <div className="portal-eyebrow"><span /> Secure workspace</div>
              <h1>Your work<br /><span>starts here.</span></h1>
              <p>Sign in to continue to IPCS Global’s placement, training, and operations workspace.</p>
            </div>
            <div className="portal-login-card">
              <div className="login-card-heading">
                <span className="login-card-icon"><UsersThree size={21} weight="duotone" /></span>
                <div><h2>Welcome back</h2><p>Sign in to your IPCS account</p></div>
              </div>
              <form onSubmit={handleLogin}>
                <label className="portal-field-label" htmlFor="portal-login-id">Official email</label>
                <input id="portal-login-id" autoComplete="username" type="text" value={loginId} onChange={(event) => setLoginId(event.target.value)} required placeholder="name@ipcsglobal.com" />
                <label className="portal-field-label" htmlFor="portal-password">Password</label>
                <input id="portal-password" autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required placeholder="Enter your password" />
                {error && <div className="portal-login-error" role="alert">{error}</div>}
                <button className="portal-primary-button login-submit" type="submit" disabled={loading}>
                  {loading ? <><CircleNotch size={19} className="ph-spin" /> Signing in…</> : <>Sign in <ArrowRight size={18} weight="bold" /></>}
                </button>
              </form>
              <div className="portal-login-note">Secure access for IPCS Global team members</div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {activeTab === 'home' && <PublicSiteSections onLogin={openLogin} />}

      <footer className="portal-footer"><span>© IPCS Global</span><span>Learn · Connect · Grow</span></footer>
    </main>
  );
}
