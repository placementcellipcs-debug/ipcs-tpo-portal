import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { CircleNotch } from '@phosphor-icons/react';

export default function Login() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // 🚨 Waits up to 60 seconds for Render to wake up safely
      const res = await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/auth/login', { 
        email: loginId, 
        password: password 
      }, { timeout: 60000 });
      
      if (res.data.success) {
        localStorage.setItem('tpoData', JSON.stringify(res.data.tpo || res.data.tpoData));
        navigate('/dashboard');
      } else {
        setError(res.data.message || 'Login failed. Please check your credentials.');
        setLoading(false); 
      }
    } catch (err) {
      console.error("Login Error:", err);
      setError(err.response?.data?.message || 'Waking up secure server... Please try clicking Sign In again.');
      setLoading(false);
    }
  };

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', fontFamily: 'Inter, sans-serif' }}>
      
      {/* HEADER LOGO */}
      <header style={{ position: 'absolute', top: 0, left: 0, width: '100%', padding: '30px 40px' }}>
        <img src="https://lh3.googleusercontent.com/d/1VqmH9-l2lBHErJPW1tCjtCu-SrTEMPtN" alt="IPCS Logo" style={{ height: '35px' }} />
      </header>

      {/* MAIN CONTENT GRID */}
      <div style={{ width: '100%', maxWidth: '1200px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', padding: '0 40px', alignItems: 'center' }}>
        
        {/* LEFT SIDE: COPY & BRANDING */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#00d8ff', boxShadow: '0 0 10px #00d8ff' }}></div>
            <h2 style={{ fontStyle: 'italic', fontWeight: 900, letterSpacing: '2px', fontSize: '1.8rem', margin: 0, color: '#fff' }}>
              TALEN<span style={{ color: '#00d8ff' }}>Z</span>O
            </h2>
          </div>
          <div style={{ fontSize: '0.7rem', color: '#00d8ff', marginBottom: '30px', letterSpacing: '1px', marginLeft: '18px' }}>
            Connecting talent with opportunity
          </div>

          <h1 style={{ fontSize: '3.5rem', fontWeight: 800, color: '#fff', lineHeight: '1.1', margin: '0 0 25px 0' }}>
            Unlock Global Tech<br/>
            <span style={{ color: '#00d8ff' }}>Careers with IPCS</span>
          </h1>

          <p style={{ color: '#94a3b8', fontSize: '1.05rem', lineHeight: '1.6', maxWidth: '90%' }}>
            IPCS Global connects future-ready talent in Industrial Automation, Embedded Systems, IoT, and Digital Tech with leading blue-chip global firms. Experience zero-barrier career transitions.
          </p>
        </div>

        {/* RIGHT SIDE: STATIC LOGIN FORM */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: '100%', maxWidth: '420px', background: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px', padding: '40px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
            
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
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '14px', borderRadius: '10px', outline: 'none', fontSize: '0.9rem' }}
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
                  style={{ width: '100%', background: '#1e293b', border: '1px solid #334155', color: '#fff', padding: '14px', borderRadius: '10px', outline: 'none', fontSize: '0.9rem' }}
                />
              </div>

              {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(239,68,68,0.3)' }}>{error}</div>}

              <button 
                type="submit" 
                disabled={loading}
                style={{ width: '100%', background: '#3b82f6', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '10px' }}
              >
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