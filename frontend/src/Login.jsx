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
        email: loginId, // We still send it as 'email' in the payload to the backend
        password 
      });
      if (response.data.success) {
        localStorage.setItem('tpoData', JSON.stringify(response.data.tpo));
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f1523', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '400px', backgroundColor: '#161e2e', borderRadius: '16px', padding: '40px 30px', boxShadow: '0 20px 40px rgba(0,0,0,0.4)', border: '1px solid #1e293b' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h2 style={{ color: '#fff', fontSize: '1.6rem', margin: '0 0 5px 0' }}>IPCS Portal</h2>
          <div style={{ color: '#38bdf8', fontSize: '0.8rem', fontWeight: 'bold', letterSpacing: '1px', textTransform: 'uppercase' }}>Secure Access System</div>
        </div>

        {error && (
          <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '10px 15px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <WarningCircle size={18} weight="fill" /> {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase' }}>
              Login ID
            </label>
            <input 
              type="text" // 🚨 CHANGED FROM 'email' TO 'text'
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              style={{ width: '100%', padding: '12px 15px', backgroundColor: '#0f1523', border: '1px solid #38bdf8', borderRadius: '8px', color: '#fff', fontSize: '1rem', outline: 'none' }}
              placeholder="Enter your Login ID"
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