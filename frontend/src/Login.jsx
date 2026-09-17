import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CircleNotch, Eye, EyeSlash, WarningCircle } from '@phosphor-icons/react';
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
      
      <div className="login-header">
        <img 
          src="https://lh3.googleusercontent.com/d/1VqmH9-l2lBHErJPW1tCjtCu-SrTEMPtN" 
          alt="IPCS Logo" 
          className="login-header-logo" 
        />
      </div>

      <div className="login-split-container">
        
        <div className="login-left-side">
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
                style={{ height: '35px', marginBottom: '10px' }} 
              />
              <h2 style={{ color: '#fff', fontSize: '1.4rem', margin: 0 }}>Welcome Back</h2>
              <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '5px 0 0 0' }}>Sign in to continue</p>
            </div>

            {error && (
              <div className="login-error" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '1.5rem', justifyContent: 'center' }}>
                <WarningCircle size={20} weight="fill" /> {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Email Address / Login ID
                </label>
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
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Password
                </label>
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
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex' }}
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
    </div>
  );
}