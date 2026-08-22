import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { CircleNotch, Eye, EyeSlash, WarningCircle } from '@phosphor-icons/react';

export default function Login() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (localStorage.getItem('tpoData')) navigate('/');
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post('https://ipcs-tpo-portal.onrender.com/api/auth/login', { 
        email: loginId, 
        password 
      });
      if (response.data.success) {
        localStorage.setItem('tpoData', JSON.stringify(response.data.tpo));
        navigate('/');
      }
    } catch (err) {
      // Bulletproof error catching so it never fails silently again
      setError(err.response?.data?.message || err.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1523', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '420px', backgroundColor: '#161e2e', borderRadius: '16px', padding: '40px 30px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid #1e293b' }}>
        
        {/* 🚨 RESTORED ORIGINAL LOGO & DESIGN */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '15px' }}>
            {/* Standard IPCS Logo Design */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '35px', height: '35px', borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold', fontSize: '18px' }}>
                I
              </div>
              <h2 style={{ fontSize: '1.8rem', margin: 0, color: '#fff', letterSpacing: '1px' }}>IPCS <span style={{ color: '#38bdf8', fontWeight: 300 }}>GLOBAL</span></h2>
            </div>
          </div>
          <h2 style={{ color: '#fff', fontSize: '1.5rem', margin: '0 0 5px 0' }}>Placement Officer</h2>
          <div style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Secure Access Portal</div>
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px 15px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <WarningCircle size={20} weight="fill" style={{ minWidth: '20px' }} /> <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase' }}>
              Login ID
            </label>
            <input 
              type="text" 
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              style={{ width: '100%', padding: '12px 15px', backgroundColor: '#0f1523', border: '1px solid #38bdf8', borderRadius: '8px', color: '#fff', fontSize: '1rem', outline: 'none', transition: 'border 0.2s' }}
              placeholder="e.g., RTH_DM or email"
              required
            />
          </div>

          <div style={{ marginBottom: '30px', position: 'relative' }}>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase' }}>
              Password
            </label>
            <input 
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: '12px 15px', backgroundColor: '#0f1523', border: '1px solid #1e293b', borderRadius: '8px', color: '#fff', fontSize: '1rem', outline: 'none' }}
              placeholder="••••••••"
              required
            />
            <div 
              style={{ position: 'absolute', right: '15px', top: '38px', cursor: 'pointer', color: 'var(--text-muted)' }}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading}
            style={{ width: '100%', padding: '14px', backgroundColor: '#38bdf8', color: '#0f1523', border: 'none', borderRadius: '8px', fontSize: '1rem', fontWeight: 'bold', cursor: loading ? 'not-allowed' : 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', transition: 'background 0.2s' }}
          >
            {loading ? <CircleNotch size={20} className="ph-spin" /> : 'Access Dashboard →'}
          </button>
        </form>

      </div>
    </div>
  );
}