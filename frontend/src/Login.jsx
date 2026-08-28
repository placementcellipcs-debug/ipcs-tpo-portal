import { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { CircleNotch, Lightning, Users, Buildings, Medal, X } from '@phosphor-icons/react';

export default function Login() {
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/login', { loginId, password });
      if (res.data.success) {
        localStorage.setItem('tpoData', JSON.stringify(res.data.tpoData));
        navigate('/dashboard');
      } else {
        setError(res.data.message || 'Login failed');
      }
    } catch (err) {
      setError('An error occurred connecting to the server.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', backgroundColor: '#020617', fontFamily: 'Inter, sans-serif' }}>
      
      {/* 🚨 BACKGROUND VIDEO */}
      <video 
        autoPlay loop muted playsInline 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0 }}
      >
        <source src="https://cdn.pixabay.com/video/2020/05/25/40131-424908077_large.mp4" type="video/mp4" />
      </video>

      {/* OVERLAY */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(2, 6, 23, 0.85)', zIndex: 10 }}></div>

      {/* HEADER LOGO */}
      <header style={{ position: 'absolute', top: 0, left: 0, width: '100%', padding: '30px 40px', zIndex: 20 }}>
        <img src="https://ipcsglobal.com/wp-content/uploads/2023/12/IPCS-Global-Logo-1.png" alt="IPCS Logo" style={{ height: '35px' }} />
      </header>

      {/* MAIN CONTENT GRID */}
      <div style={{ position: 'relative', zIndex: 20, width: '100%', height: '100%', maxWidth: '1300px', margin: '0 auto', display: 'flex', alignItems: 'center', padding: '0 40px' }}>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '60px', width: '100%', alignItems: 'center' }}>
          
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

            <p style={{ color: '#94a3b8', fontSize: '1.05rem', lineHeight: '1.6', marginBottom: '40px', maxWidth: '90%' }}>
              IPCS Global connects future-ready talent in Industrial Automation, Embedded Systems, IoT, and Digital Tech with leading blue-chip global firms. Experience zero-barrier career transitions.
            </p>

            <button 
              onClick={() => setShowModal(true)}
              style={{ background: 'linear-gradient(90deg, #0ea5e9, #00d8ff)', color: '#fff', border: 'none', padding: '14px 35px', borderRadius: '30px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 10px 25px rgba(0, 216, 255, 0.4)', transition: 'transform 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
            >
              Login / Signup &gt;
            </button>
          </div>

          {/* RIGHT SIDE: HIRING DASHBOARD CARD */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px', padding: '35px', width: '100%', maxWidth: '420px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ background: '#3b82f6', color: '#fff', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Lightning size={20} weight="fill" />
                  </div>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1rem' }}>Hiring Dashboard</div>
                    <div style={{ color: '#64748b', fontSize: '0.75rem' }}>Realtime Campus Intake</div>
                  </div>
                </div>
                <div style={{ border: '1px solid #10b981', color: '#10b981', fontSize: '0.65rem', fontWeight: 'bold', padding: '4px 10px', borderRadius: '12px', letterSpacing: '0.5px' }}>
                  ACTIVE STAGE
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ background: '#1e293b', padding: '20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ color: '#38bdf8' }}><Users size={24} weight="fill"/></div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '3px' }}>TOTAL STUDENTS HIRED</div>
                    <div style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 'bold' }}>1.5 M+</div>
                  </div>
                </div>

                <div style={{ background: '#1e293b', padding: '20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ color: '#8b5cf6' }}><Buildings size={24} weight="fill"/></div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '3px' }}>ENTERPRISE RECRUITERS</div>
                    <div style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 'bold' }}>25 K+</div>
                  </div>
                </div>

                <div style={{ background: '#1e293b', padding: '20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ color: '#f59e0b' }}><Medal size={24} weight="fill"/></div>
                  <div>
                    <div style={{ color: '#64748b', fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '3px' }}>PRESENCE ACROSS COUNTRIES</div>
                    <div style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 'bold' }}>50 +</div>
                  </div>
                </div>
              </div>

            </div>
          </div>

        </div>
      </div>

      {/* BOTTOM TICKER */}
      <div style={{ position: 'absolute', bottom: '40px', left: '40px', zIndex: 20, display: 'flex', alignItems: 'center', gap: '15px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '15px', width: 'calc(100% - 80px)' }}>
        <div style={{ color: '#38bdf8' }}><Lightning size={20} weight="fill"/></div>
        <div>
          <div style={{ color: '#00d8ff', fontSize: '0.7rem', fontWeight: 'bold', letterSpacing: '1px', marginBottom: '2px' }}>LIVE HIRING UPDATES</div>
          <div style={{ color: '#fff', fontSize: '0.9rem' }}>Vishnu Kumar got hired as a PLC Programmer.</div>
        </div>
      </div>

      {/* 🚨 THE LOGIN MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          
          <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '24px', padding: '40px', width: '100%', maxWidth: '400px', position: 'relative', boxShadow: '0 25px 50px rgba(0,0,0,0.8)' }}>
            
            <div onClick={() => setShowModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', color: '#64748b', cursor: 'pointer', background: '#1e293b', borderRadius: '50%', padding: '6px' }}>
              <X size={16} weight="bold" />
            </div>

            <div style={{ textAlign: 'center', marginBottom: '30px' }}>
              <img src="https://ipcsglobal.com/wp-content/uploads/2023/12/IPCS-Global-Logo-1.png" alt="IPCS Logo" style={{ height: '35px', marginBottom: '15px' }} />
              <h2 style={{ margin: 0, color: '#fff', fontSize: '1.4rem' }}>Welcome Back</h2>
              <p style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '5px' }}>Sign in to the Placement Ecosystem</p>
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

              {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>{error}</div>}

              {/* 🚨 UPDATED BUTTON WITH AUTHENTICATING TEXT */}
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
      )}
    </div>
  );
}