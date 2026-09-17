import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CircleNotch, Eye, EyeSlash, WarningCircle, ShieldCheck } from '@phosphor-icons/react';
import { API_BASE } from './apiConfig';

export default function Login() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 🚨 AUTO-REDIRECT: If a user is already logged in, skip the login page
  useEffect(() => {
    const tpoData = localStorage.getItem('tpoData');
    if (tpoData) {
      try {
        const parsed = JSON.parse(tpoData);
        const userRole = String(parsed.role || '').toUpperCase();
        const isSuperAdmin = parsed.accessType === 'superadmin';
        
        // Route Branch Asset Managers to their silo
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

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await axios.post(`${API_BASE}/api/auth/login`, formData);
      
      if (res.data.success) {
        // Securely save the session token and user profile
        localStorage.setItem('tpoData', JSON.stringify(res.data.tpo));
        
        const userRole = String(res.data.tpo.role || '').toUpperCase();
        const isSuperAdmin = res.data.tpo.accessType === 'superadmin';

        // 🚨 SMART ROUTING: Send users to their correct workspace
        if (userRole === 'BRANCH ASSET MANAGER' && !isSuperAdmin) {
          navigate('/assets/dashboard');
        } else {
          navigate('/dashboard');
        }
      }
    } catch (err) {
      // Catch backend 401s, 503s, or network errors
      setError(err.response?.data?.message || 'Invalid login credentials or server error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-wrapper">
      
      {/* Absolute positioned header for the logo */}
      <div className="login-header">
        <img 
          src="https://lh3.googleusercontent.com/d/1VqmH9-l2lBHErJPW1tCjtCu-SrTEMPtN" 
          alt="IPCS Logo" 
          className="login-header-logo" 
        />
      </div>

      <div className="login-split-container">
        
        <div className="login-left-side">
          <div className="security-badge">
            <ShieldCheck size={20} color="#38bdf8" weight="fill" />
            <span>Encrypted Connection</span>
          </div>
          <h1 className="login-hero-title">IPCS Global<br/>Enterprise Portal</h1>
          <p className="login-hero-text">
            Secure authentication for Placement Officers, Trainers, Asset Managers, and Administrative Personnel.
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
              <p style={{ color: '#94a3b8', fontSize: '0.95rem', margin: '5px 0 0 0' }}>Sign in to continue</p>
            </div>

            {error && (
              <div className="login-error">
                <WarningCircle size={20} weight="fill" /> 
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div>
                <label className="login-label">Email Address / Login ID</label>
                <input 
                  type="text" 
                  name="email" 
                  className="login-input" 
                  placeholder="Enter your official email or ID"
                  value={formData.email} 
                  onChange={handleInputChange} 
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
                    placeholder="Enter your password"
                    value={formData.password} 
                    onChange={handleInputChange} 
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
          </div>
        </div>

      </div>

      {/* 🎨 SELF-CONTAINED CSS TO PREVENT LAYOUT BREAKING */}
      <style>{`
        .login-wrapper {
          min-height: 100vh;
          width: 100vw;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #020617; /* Deep slate background */
          background-image: radial-gradient(circle at top right, rgba(56, 189, 248, 0.05), transparent 40%),
                            radial-gradient(circle at bottom left, rgba(168, 85, 247, 0.05), transparent 40%);
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
          height: 40px; /* 🚨 FIXES THE GIANT LOGO ISSUE */
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
          background: rgba(56, 189, 248, 0.1);
          border: 1px solid rgba(56, 189, 248, 0.2);
          color: #38bdf8;
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 20px;
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
          color: #94a3b8;
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
          background: rgba(15, 23, 42, 0.8);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 40px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 
                      0 0 40px rgba(56, 189, 248, 0.1); /* Subtle blue glow */
          box-sizing: border-box;
        }

        .login-label {
          display: block;
          font-size: 0.8rem;
          font-weight: 700;
          color: #94a3b8;
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
        .login-input:focus { border-color: #38bdf8; background: rgba(0, 0, 0, 0.5); box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1); }

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
          background: #38bdf8;
          color: #0f172a;
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
          background: #0284c7;
          color: #fff;
          transform: translateY(-2px);
          box-shadow: 0 10px 20px -10px rgba(56, 189, 248, 0.6);
        }

        .login-btn:disabled {
          background: #1e293b;
          color: #64748b;
          cursor: not-allowed;
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

        /* 📱 RESPONSIVE ADJUSTMENTS */
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