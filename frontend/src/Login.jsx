import { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { CircleNotch, Eye, EyeSlash, WarningCircle, ShieldCheck } from '@phosphor-icons/react';
import { API_BASE } from './apiConfig'; 

export default function Login() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  // Video Intro State
  const [showIntro, setShowIntro] = useState(false);
  const [videoOpacity, setVideoOpacity] = useState(1);

  // 🚨 AUTO-REDIRECT: If already logged in
  useEffect(() => {
    const tpoData = localStorage.getItem('tpoData');
    if (tpoData) {
      try {
        const parsed = JSON.parse(tpoData);
        const userRole = String(parsed.role || '').toUpperCase();
        const isSuperAdmin = parsed.accessType === 'superadmin';
        
        if (userRole === 'BRANCH ASSET MANAGER' && !isSuperAdmin) {
          navigate('/assets/dashboard');
        } else {
          navigate('/dashboard');
        }
      } catch (e) {
        localStorage.removeItem('tpoData');
      }
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await axios.post(`${API_BASE}/api/auth/login`, { 
        email: loginId, 
        password: password 
      });
      
      if (res.data.success) {
        localStorage.setItem('tpoData', JSON.stringify(res.data.tpo || res.data.tpoData));
        
        const userRole = String((res.data.tpo || res.data.tpoData).role || '').toUpperCase();
        const isSuperAdmin = (res.data.tpo || res.data.tpoData).accessType === 'superadmin';

        // Trigger video intro ONLY for academic/TPO portal, bypass for Asset Managers
        if (userRole === 'BRANCH ASSET MANAGER' && !isSuperAdmin) {
          navigate('/assets/dashboard');
        } else {
          setShowIntro(true);
        }
      } else {
        setError(res.data.message || 'Login failed. Please check your credentials.');
        setLoading(false); 
      }
    } catch (err) {
      console.error("Login Error:", err);
      setError(err.response?.data?.message || 'Server connection failed. Please try again.');
      setLoading(false);
    }
  };

  // 🚨 CINEMATIC VIDEO INTRO OVERLAY
  if (showIntro) {
    return (
      <div style={{ 
        position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', 
        zIndex: 99999, backgroundColor: '#000000', display: 'flex', 
        alignItems: 'center', justifyContent: 'center',
        opacity: videoOpacity, 
        transition: 'opacity 1s ease-in-out' 
      }}>
        <video 
          src="/Intro.mp4" 
          autoPlay 
          playsInline 
          onTimeUpdate={(e) => {
            if (e.target.duration - e.target.currentTime <= 1) {
              setVideoOpacity(0);
            }
          }}
          onEnded={() => navigate('/dashboard')} 
          onError={(e) => {
            console.error("Video failed to load. Skipping to dashboard.", e);
            navigate('/dashboard'); 
          }}
          style={{ 
            width: '100%', height: '100%', objectFit: 'cover',
            transform: 'scale(1.08)' 
          }}
        />
      </div>
    );
  }

  // 🚨 PREMIUM INDIGO/PURPLE LOGIN UI
  return (
    <div className="login-wrapper">
      
      <header className="login-header">
        <img src="https://lh3.googleusercontent.com/d/1VqmH9-l2lBHErJPW1tCjtCu-SrTEMPtN" alt="IPCS Logo" className="login-header-logo" />
      </header>

      <div className="login-split-container">
        
        <div className="login-left-side">
          <div className="security-badge">
            <ShieldCheck size={20} color="#a855f7" weight="fill" />
            <span>Encrypted Connection</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b5cf6', boxShadow: '0 0 10px #8b5cf6' }}></div>
            <h2 style={{ fontStyle: 'italic', fontWeight: 900, letterSpacing: '2px', fontSize: '1.6rem', margin: 0, color: '#fff' }}>
              TALEN<span style={{ color: '#a855f7' }}>Z</span>O
            </h2>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#a855f7', marginBottom: '25px', letterSpacing: '1px', marginLeft: '18px', textTransform: 'uppercase', fontWeight: 'bold' }}>
            Connecting talent with opportunity
          </div>

          <h1 className="login-hero-title">
            Unlock Global Tech<br/>
            <span style={{ color: '#a855f7' }}>Careers with IPCS</span>
          </h1>

          <p className="login-hero-text">
            IPCS Global connects future-ready talent in Industrial Automation, Embedded Systems, IoT, and Digital Tech with leading blue-chip global firms. Experience zero-barrier career transitions.
          </p>
        </div>

        <div className="login-right-side">
          <div className="login-card">
            
            <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
              <img 
                src="https://lh3.googleusercontent.com/d/1bHpUfH_578DmfityB9cOgFNYhbBGdG9J" 
                alt="Talenzo Logo" 
                style={{ height: '35px', marginBottom: '15px' }} 
              />
              <h2 style={{ color: '#fff', fontSize: '1.5rem', margin: 0, fontWeight: 800 }}>Welcome Back</h2>
              <p style={{ color: '#8b949e', fontSize: '0.95rem', margin: '5px 0 0 0' }}>Sign in to the Placement Ecosystem</p>
            </div>

            {error && (
              <div className="login-error">
                <WarningCircle size={20} weight="fill" /> 
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div>
                <label className="login-label">Official Email / Login ID</label>
                <input 
                  type="text" 
                  name="email" 
                  className="login-input" 
                  placeholder="name@ipcsglobal.com"
                  value={loginId} 
                  onChange={(e) => { setLoginId(e.target.value); setError(''); }} 
                  required 
                />
              </div>

              <div>
                <label className="login-label">Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? "text" : "password"} 
                    name="password" 
                    className="login-input" 
                    placeholder="••••••••"
                    value={password} 
                    onChange={(e) => { setPassword(e.target.value); setError(''); }} 
                    required 
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPassword(!showPassword)}
                    className="password-toggle-btn"
                  >
                    {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="login-btn" disabled={loading}>
                {loading ? <CircleNotch size={24} className="ph-spin" /> : 'Authenticate & Secure Login'}
              </button>
              
            </form>

            <div style={{ textAlign: 'center', marginTop: '25px', color: '#475569', fontSize: '0.75rem', fontWeight: 'bold' }}>
              Secured by IPCS IT Infrastructure
            </div>
          </div>
        </div>

      </div>

      <style>{`
        .login-wrapper {
          min-height: 100vh;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #09090e; 
          background-image: radial-gradient(circle at top right, rgba(139, 92, 246, 0.05), transparent 40%),
                            radial-gradient(circle at bottom left, rgba(99, 102, 241, 0.05), transparent 40%);
          font-family: 'Inter', sans-serif;
          padding: 20px;
          box-sizing: border-box;
          position: relative;
          overflow: hidden;
        }

        .login-header {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          padding: 30px 50px;
          box-sizing: border-box;
          z-index: 10;
        }

        .login-header-logo {
          height: 40px;
          width: auto;
          object-fit: contain;
        }

        .login-split-container {
          width: 100%;
          max-width: 1100px;
          display: flex;
          flex-direction: row;
          gap: 60px;
          align-items: center;
          justify-content: space-between;
          z-index: 5;
        }

        .login-left-side {
          flex: 1.2;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
        }

        .security-badge {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(168, 85, 247, 0.1);
          border: 1px solid rgba(168, 85, 247, 0.2);
          color: #a855f7;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 25px;
        }

        .login-hero-title {
          font-size: 3.5rem;
          font-weight: 900;
          color: #fff;
          line-height: 1.1;
          margin: 0 0 20px 0;
          letter-spacing: -1px;
        }

        .login-hero-text {
          color: #8b949e;
          font-size: 1.1rem;
          line-height: 1.6;
          max-width: 85%;
          margin: 0;
        }

        .login-right-side {
          flex: 1;
          display: flex;
          justify-content: flex-end;
        }

        .login-card {
          width: 100%;
          max-width: 420px;
          background: rgba(18, 18, 31, 0.8);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 
                      0 0 40px rgba(139, 92, 246, 0.15); 
          box-sizing: border-box;
        }

        .login-label {
          display: block;
          font-size: 0.8rem;
          font-weight: 700;
          color: #8b949e;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .login-input {
          width: 100%;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #fff;
          padding: 14px 16px;
          border-radius: 12px;
          outline: none;
          font-size: 1rem;
          transition: all 0.3s ease;
          box-sizing: border-box;
        }

        .login-input::placeholder { color: #475569; }
        .login-input:focus { border-color: #8b5cf6; background: rgba(0, 0, 0, 0.5); box-shadow: 0 0 0 3px rgba(139, 92, 246, 0.1); }

        .password-toggle-btn {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #64748b;
          cursor: pointer;
          display: flex;
          padding: 4px;
          transition: color 0.2s;
        }
        .password-toggle-btn:hover { color: #cbd5e1; }

        .login-btn {
          width: 100%;
          background: linear-gradient(135deg, #6366f1, #a855f7);
          color: #ffffff;
          border: none;
          padding: 16px;
          border-radius: 12px;
          font-size: 1rem;
          font-weight: 800;
          cursor: pointer;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          margin-top: 10px;
          transition: all 0.3s ease;
        }

        .login-btn:hover:not(:disabled) {
          opacity: 0.9;
          transform: translateY(-2px);
          box-shadow: 0 10px 20px -10px rgba(139, 92, 246, 0.6);
        }

        .login-btn:disabled {
          background: #1e293b;
          color: #64748b;
          cursor: not-allowed;
          box-shadow: none;
          transform: none;
        }

        .login-error {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.3);
          padding: 12px 15px;
          border-radius: 10px;
          margin-bottom: 1.5rem;
          font-size: 0.85rem;
          font-weight: bold;
          line-height: 1.4;
        }

        @media (max-width: 900px) {
          .login-split-container {
            flex-direction: column;
            gap: 40px;
            justify-content: center;
          }
          .login-left-side {
            align-items: center;
            text-align: center;
          }
          .login-hero-title { font-size: 2.8rem; }
          .login-hero-text { max-width: 100%; }
          .login-right-side { justify-content: center; width: 100%; }
        }

        @media (max-width: 480px) {
          .login-header { padding: 20px; text-align: center; }
          .login-header-logo { height: 30px; }
          .login-hero-title { font-size: 2.2rem; }
          .login-card { padding: 30px 20px; border-radius: 20px; }
        }
      `}</style>
    </div>
  );
}