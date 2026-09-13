import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { CircleNotch } from '@phosphor-icons/react';
import { API_BASE } from './apiConfig'; 

export default function Login() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [showIntro, setShowIntro] = useState(false);
  const [videoOpacity, setVideoOpacity] = useState(1);

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
        setShowIntro(true);
      } else {
        setError(res.data.message || 'Login failed. Please check your credentials.');
        setLoading(false); 
      }
    } catch (err) {
      console.error("Login Error:", err);
      setError(err.response?.data?.message || 'Server connection failed. Please check your internet and try again.');
      setLoading(false);
    }
  };

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
          muted
          playsInline 
          onTimeUpdate={(e) => {
            if (e.target.duration - e.target.currentTime <= 1) {
              setVideoOpacity(0);
            }
          }}
          onEnded={() => navigate('/dashboard')} 
          onError={(e) => navigate('/dashboard')}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scale(1.08)' }}
        />
      </div>
    );
  }

  return (
    <>
      {/* 🚨 INJECTED CSS: Bypasses Vercel caching and forces perfect mobile rendering */}
      <style>{`
        .login-page-bg {
          min-height: 100vh;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #020617;
          font-family: 'Inter', sans-serif;
          padding: 20px;
          box-sizing: border-box;
          overflow-x: hidden;
        }
        .login-header {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          padding: 30px 40px;
          box-sizing: border-box;
        }
        .login-split-container {
          width: 100%;
          max-width: 1200px;
          display: flex;
          flex-direction: row;
          gap: 60px;
          align-items: center;
          justify-content: space-between;
          z-index: 10;
        }
        .login-left-side { flex: 1; }
        .login-right-side {
          flex: 1;
          display: flex;
          justify-content: flex-end;
        }
        .login-hero-title {
          font-size: 3.5rem;
          font-weight: 800;
          color: #fff;
          line-height: 1.1;
          margin: 0 0 25px 0;
        }
        .login-hero-text {
          color: #94a3b8;
          font-size: 1.05rem;
          line-height: 1.6;
          max-width: 90%;
        }
        .login-card {
          width: 100%;
          max-width: 420px;
          background: #0f172a;
          border: 1px solid #1e293b;
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 25px 50px rgba(0,0,0,0.5);
          box-sizing: border-box;
        }
        .login-input {
          width: 100%;
          background: #1e293b;
          border: 1px solid #334155;
          color: #fff;
          padding: 14px;
          border-radius: 10px;
          outline: none;
          font-size: 0.9rem;
          box-sizing: border-box;
        }
        .login-input:focus { border-color: #38bdf8; }
        .login-btn {
          width: 100%;
          background: #3b82f6;
          color: #fff;
          border: none;
          padding: 14px;
          border-radius: 10px;
          font-size: 1rem;
          font-weight: bold;
          cursor: pointer;
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
          margin-top: 10px;
          transition: 0.2s;
        }
        .login-btn:hover:not(:disabled) { background: #2563eb; }
        
        /* 📱 MOBILE OVERRIDE */
        @media (max-width: 768px) {
          .login-page-bg {
            padding: 100px 20px 40px 20px;
            align-items: flex-start;
          }
          .login-header {
            padding: 20px;
            display: flex;
            justify-content: center;
          }
          .login-split-container {
            flex-direction: column;
            gap: 40px;
            margin-top: 20px;
          }
          .login-right-side { justify-content: center; }
          .login-hero-title {
            font-size: 2.2rem;
            text-align: center;
          }
          .login-left-side {
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .login-hero-text { text-align: center; max-width: 100%; }
          .login-card { padding: 30px 20px; }
        }
      `}</style>

      <div className="login-page-bg">
        <header className="login-header">
          {/* 🚨 HARDCODED IMAGE HEIGHT TO PREVENT SCREEN STRETCHING */}
          <img src="https://lh3.googleusercontent.com/d/1VqmH9-l2lBHErJPW1tCjtCu-SrTEMPtN" alt="IPCS Logo" style={{ height: '35px', maxWidth: '100%', objectFit: 'contain' }} />
        </header>

        <div className="login-split-container">
          
          <div className="login-left-side">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00d8ff', boxShadow: '0 0 10px #00d8ff' }}></div>
              <h2 style={{ fontStyle: 'italic', fontWeight: 900, letterSpacing: '2px', fontSize: '1.8rem', margin: 0, color: '#fff' }}>
                TALEN<span style={{ color: '#00d8ff' }}>Z</span>O
              </h2>
            </div>
            <div style={{ fontSize: '0.7rem', color: '#00d8ff', marginBottom: '30px', letterSpacing: '1px', marginLeft: '18px' }}>
              Connecting talent with opportunity
            </div>

            <h1 className="login-hero-title">
              Unlock Global Tech<br/>
              <span style={{ color: '#00d8ff' }}>Careers with IPCS</span>
            </h1>

            <p className="login-hero-text">
              IPCS Global connects future-ready talent in Industrial Automation, Embedded Systems, IoT, and Digital Tech with leading blue-chip global firms. Experience zero-barrier career transitions.
            </p>
          </div>

          <div className="login-right-side">
            <div className="login-card">
              
              <div style={{ textAlign: 'center', marginBottom: '30px' }}>
                {/* 🚨 HARDCODED IMAGE HEIGHT TO PREVENT SCREEN STRETCHING */}
                <img src="https://lh3.googleusercontent.com/d/1VqmH9-l2lBHErJPW1tCjtCu-SrTEMPtN" alt="IPCS Logo" style={{ height: '35px', maxWidth: '100%', objectFit: 'contain', marginBottom: '15px' }} />
                <h2 style={{ margin: 0, color: '#fff', fontSize: '1.4rem' }}>Welcome Back</h2>
                <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '5px' }}>Sign in to the Placement Ecosystem</p>
              </div>

              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', textAlign: 'left' }}>OFFICIAL EMAIL</label>
                  <input 
                    type="text" 
                    value={loginId} 
                    onChange={(e) => setLoginId(e.target.value)} 
                    required 
                    placeholder="name@ipcsglobal.com"
                    className="login-input"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px', textAlign: 'left' }}>PASSWORD</label>
                  <input 
                    type="password" 
                    value={password} 
                    onChange={(e) => setPassword(e.target.value)} 
                    required 
                    placeholder="••••••••"
                    className="login-input"
                  />
                </div>

                {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)' }}>{error}</div>}

                <button type="submit" disabled={loading} className="login-btn">
                  {loading ? <><CircleNotch size={20} className="ph-spin" /> Authenticating...</> : 'Sign In'}
                </button>
              </form>

              <div style={{ textAlign: 'center', marginTop: '25px', color: '#64748b', fontSize: '0.75rem' }}>
                Secured by IPCS IT Infrastructure
              </div>

            </div>
          </div>

        </div>
      </div>
    </>
  );
}