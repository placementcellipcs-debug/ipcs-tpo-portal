import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeSlash, CircleNotch } from '@phosphor-icons/react';
import axios from 'axios';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setStatus({ type: 'error', message: 'Please enter official email and password.' });
      return;
    }

    setLoading(true);
    setStatus({ type: 'info', message: 'Authenticating Officer...' });

    try {
      // Send login data to your Node.js backend
      const response = await axios.post('https://ipcs-tpo-portal.onrender.com/api/auth/login', {
        email,
        password
      });

      if (response.data.success) {
        setStatus({ type: '', message: '' });
        
        // 1. Save the TPO data to the browser's local storage
        localStorage.setItem('tpoData', JSON.stringify(response.data.tpo));
        
        // 2. Redirect the user to the Dashboard page
        navigate('/dashboard');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || 'Server connection failed.';
      setStatus({ type: 'error', message: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="brand-logo-container">
          <img 
            src="https://lh3.googleusercontent.com/d/1VqmH9-l2lBHErJPW1tCjtCu-SrTEMPtN" 
            alt="IPCS Global Logo" 
            className="auth-logo-img" 
          />
        </div>
        
        <h2 style={{ textAlign: 'center', margin: '0 0 6px 0', fontSize: '1.6rem' }}>Placement Officer</h2>
        <p style={{ color: '#38bdf8', fontWeight: '600', fontSize: '0.85rem', textAlign: 'center', marginTop: 0, marginBottom: '2rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Secure Access Portal
        </p>

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Official Email ID</label>
            <input 
              type="email" 
              placeholder="tpo@ipcsglobal.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="pwd-wrapper">
              <input 
                type={showPassword ? "text" : "password"} 
                placeholder="Enter password" 
                style={{ paddingRight: '40px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <span className="pwd-toggle" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeSlash size={20} /> : <Eye size={20} />}
              </span>
            </div>
          </div>

          <button type="submit" className="btn-action" style={{ marginTop: '1rem' }} disabled={loading}>
            {loading ? <CircleNotch size={20} className="ph-spin" /> : "Access Dashboard →"}
          </button>
        </form>

        {status.message && (
          <div className={`alert alert-${status.type}`}>
            {status.message}
          </div>
        )}
      </div>
    </div>
  );
}