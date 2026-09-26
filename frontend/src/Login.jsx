import { useEffect, useState } from 'react';
import axios from 'axios';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, CircleNotch, Compass, UsersThree } from '@phosphor-icons/react';
import { API_BASE } from './apiConfig';
import './Login.css';
import PublicSiteHeader from './PublicSiteHeader';

const getLandingPath = account => {
  const role = String(account?.role || '').toUpperCase();
  const isSuperAdmin = String(account?.accessType || '').toLowerCase() === 'superadmin';
  if (role === 'BRANCH ASSET MANAGER' && !isSuperAdmin) return '/assets';
  if (isSuperAdmin || role.includes('SYSTEM ADMIN') || role.includes('GENERAL MANAGER') || role.includes('ZONAL PLACEMENT HEAD') || role === 'TECHNICAL HEAD') return '/admin-command';
  return '/dashboard';
};

export default function Login() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const isLoginPage = pathname === '/login';

  const navigateToLanding = () => {
    try { navigate(getLandingPath(JSON.parse(localStorage.getItem('tpoData') || '{}'))); }
    catch { navigate('/dashboard'); }
  };

  const [showIntro, setShowIntro] = useState(false);
  const [videoOpacity, setVideoOpacity] = useState(1);

  useEffect(() => {
    const tpoData = localStorage.getItem('tpoData');
    if (!tpoData) return;
    try {
      const parsed = JSON.parse(tpoData);
      navigate(getLandingPath(parsed));
    } catch {
      localStorage.removeItem('tpoData');
    }
  }, [navigate]);


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
      const landingPath = getLandingPath(account);

      if (landingPath === '/assets') {
        navigate(landingPath);
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
          className="login-intro-video"
          autoPlay
          playsInline
          controls={false}
          preload="auto"
          aria-label="IPCS Global introduction"
          onTimeUpdate={(event) => {
            if (event.target.duration - event.target.currentTime <= 1) setVideoOpacity(0);
          }}
          onEnded={navigateToLanding}
          onError={navigateToLanding}
        />
      </div>
    );
  }

  return (
    <main className="public-portal">
      <div className="portal-glow portal-glow-one" aria-hidden="true" />
      <div className="portal-glow portal-glow-two" aria-hidden="true" />

      <PublicSiteHeader />

      <AnimatePresence mode="wait">
        {!isLoginPage ? (
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
                <Link className="portal-primary-button" to="/placements">Explore placements <ArrowRight size={19} weight="bold" /></Link>
                <Link className="portal-secondary-button" to="/placements#recruiter-partnerships"><UsersThree size={19} /> Recruiter partnerships</Link>
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
              <Link className="login-back" to="/"><ArrowLeft size={18} /> Back to home</Link>
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

      <footer className="portal-footer"><span>© IPCS Global</span><span>Learn · Connect · Grow</span></footer>
    </main>
  );
}
