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
  const [isLoginView, setIsLoginView] = useState(false);
  
  // 🚨 SUCCESS VIDEO TRANSITION STATE
  const [showVideoTransition, setShowVideoTransition] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const res = await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/auth/login', { 
        email: loginId, 
        password: password 
      });
      
      if (res.data.success) {
        localStorage.setItem('tpoData', JSON.stringify(res.data.tpo));
        
        // 🚨 TRIGGER FULL-SCREEN VIDEO TRANSITION
        setShowVideoTransition(true);
        
        // Wait 4 seconds for the video to play, then teleport to dashboard
        setTimeout(() => {
          navigate('/dashboard');
        }, 4000); 
        
      } else {
        setError(res.data.message || 'Login failed. Please check your credentials.');
        setLoading(false); 
      }
    } catch (err) {
      console.error("Login Error:", err);
      setError(err.response?.data?.message || 'Server is waking up. Please wait 10 seconds and try again.');
      setLoading(false);
    }
  };

  return (
    <>
      {/* 🚨 SUCCESS VIDEO TRANSITION OVERLAY */}
      {showVideoTransition && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 99999, backgroundColor: '#020617', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <video 
            autoPlay muted playsInline 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          >
            <source src="/bg-video.mp4" type="video/mp4" />
          </video>
        </div>
      )}

      {/* MAIN LOGIN PAGE BACKGROUND */}
      <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden', background: 'radial-gradient(circle at top left, #0f172a, #020617)', fontFamily: 'Inter, sans-serif' }}>
        
        {/* 🚨 RESTORED RELIABLE IPCS LOGO */}
        <header style={{ position: 'absolute', top: 0, left: 0, width: '100%', padding: '30px 40px', zIndex: 20 }}>
          <img src="https://lh3.googleusercontent.com/d/1VqmH9-l2lBHErJPW1tCjtCu-SrTEMPtN" alt="IPCS Logo" style={{ height: '35px' }} />
        </header>

        {/* MAIN CONTENT GRID */}
        <div style={{ position: 'relative', zIndex: 20, width: '100%', height: '100%', maxWidth: '1300px', margin: '0 auto', display: 'flex', alignItems: 'center', padding: '0 40px' }}>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '60px', width: '100%', alignItems: 'center' }}>
            
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

              {/* BUTTON TOGGLES THE SLIDE VIEW */}
              {!isLoginView && (
                <button 
                  onClick={() => setIsLoginView(true)}
                  style={{ background: 'linear-gradient(90deg, #0ea5e9, #00d8ff)', color: '#fff', border: 'none', padding: '14px 35px', borderRadius: '30px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 10px 25px rgba(0, 216, 255, 0.4)', transition: 'transform 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-3px)'}
                  onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  Login / Signup &gt;
                </button>
              )}
            </div>

            {/* RIGHT SIDE: ANIMATED CONTAINER */}
            <div style={{ position: 'relative', height: '450px', width: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              
              {/* VIEW 1: HIRING DASHBOARD STATS */}
              <div style={{ 
                position: 'absolute', 
                width: '100%', 
                maxWidth: '420px', 
                background: 'rgba(15, 23, 42, 0.6)', 
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '24px', 
                padding: '35px', 
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isLoginView ? 'translateX(-100px)' : 'translateX(0)',
                opacity: isLoginView ? 0 : 1,
                pointerEvents: isLoginView ? 'none' : 'auto'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#3b82f6', color: '#fff', padding: '10px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Lightning size={20} weight="fill" />
                    </div>
                    <div>
                      <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '1.1rem' }}>Hiring Dashboard</div>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Realtime Campus Intake</div>
                    </div>
                  </div>
                  <div style={{ border: '1px solid #10b981', color: '#10b981', fontSize: '0.65rem', fontWeight: 'bold', padding: '4px 10px', borderRadius: '12px', letterSpacing: '0.5px' }}>ACTIVE STAGE</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ color: '#38bdf8' }}><Users size={24} weight="fill"/></div>
                    <div><div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '3px' }}>TOTAL STUDENTS HIRED</div><div style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 'bold' }}>1.5 M+</div></div>
                  </div>

                  <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ color: '#8b5cf6' }}><Buildings size={24} weight="fill"/></div>
                    <div><div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '3px' }}>ENTERPRISE RECRUITERS</div><div style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 'bold' }}>25 K+</div></div>
                  </div>

                  <div style={{ background: 'rgba(30, 41, 59, 0.5)', padding: '20px', borderRadius: '16px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ color: '#f59e0b' }}><Medal size={24} weight="fill"/></div>
                    <div><div style={{ color: '#94a3b8', fontSize: '0.7rem', fontWeight: 'bold', marginBottom: '3px' }}>PRESENCE ACROSS COUNTRIES</div><div style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 'bold' }}>50 +</div></div>
                  </div>
                </div>
              </div>

              {/* VIEW 2: LOGIN FORM */}
              <div style={{ 
                position: 'absolute', 
                width: '100%', 
                maxWidth: '420px', 
                background: 'rgba(15, 23, 42, 0.8)', 
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '24px', 
                padding: '40px', 
                boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
                transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isLoginView ? 'translateX(0)' : 'translateX(100px)',
                opacity: isLoginView ? 1 : 0,
                pointerEvents: isLoginView ? 'auto' : 'none'
              }}>
                
                {/* BACK BUTTON */}
                <div 
                  onClick={() => setIsLoginView(false)} 
                  style={{ position: 'absolute', top: '20px', left: '20px', color: '#94a3b8', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px', transition: '0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                  onMouseLeave={e => e.currentTarget.style.color = '#94a3b8'}
                >
                  &lt; Back
                </div>

                <div style={{ textAlign: 'center', marginBottom: '30px', marginTop: '10px' }}>
                  {/* 🚨 RESTORED RELIABLE IPCS LOGO */}
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
                      style={{ width: '100%', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '14px', borderRadius: '10px', outline: 'none', fontSize: '0.9rem' }}
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
                      style={{ width: '100%', background: 'rgba(30, 41, 59, 0.5)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '14px', borderRadius: '10px', outline: 'none', fontSize: '0.9rem' }}
                    />
                  </div>

                  {error && <div style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '10px', borderRadius: '8px' }}>{error}</div>}

                  <button 
                    type="submit" 
                    disabled={loading || showVideoTransition}
                    style={{ width: '100%', background: '#3b82f6', color: '#fff', border: 'none', padding: '14px', borderRadius: '10px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '10px', transition: 'background 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.background = '#2563eb'}
                    onMouseLeave={e => e.currentTarget.style.background = '#3b82f6'}
                  >
                    {(loading || showVideoTransition) ? <><CircleNotch size={20} className="ph-spin" /> Authenticating...</> : 'Sign In'}
                  </button>
                </form>

                <div style={{ textAlign: 'center', marginTop: '25px', color: '#64748b', fontSize: '0.75rem' }}>
                  Secured by IPCS IT Infrastructure
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
      </div>
    </>
  );
}