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
    <div className="login-page-bg">
      <header className="login-header">
        <img src="https://lh3.googleusercontent.com/d/1VqmH9-l2lBHErJPW1tCjtCu-SrTEMPtN" alt="IPCS Logo" className="login-header-logo" />
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
              <img src="https://lh3.googleusercontent.com/d/1VqmH9-l2lBHErJPW1tCjtCu-SrTEMPtN" alt="IPCS Logo" style={{ height: '35px', marginBottom: '15px' }} />
              <h2 style={{ margin: 0, color: '#fff', fontSize: '1.4rem' }}>Welcome Back</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '5px' }}>Sign in to the Placement Ecosystem</p>
            </div>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px' }}>OFFICIAL EMAIL</label>
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
                <label style={{ display: 'block', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 'bold', marginBottom: '8px' }}>PASSWORD</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  required 
                  placeholder="••••••••"
                  className="login-input"
                />
              </div>

              {error && <div className="login-error">{error}</div>}

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
  );
}