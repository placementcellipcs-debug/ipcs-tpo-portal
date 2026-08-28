import { useState } from 'react';
import axios from 'axios';
import { User, LockKey, CircleNotch, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import Layout from './Layout';

export default function Settings() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const isSuperAdmin = tpoData?.accessType === 'superadmin';

  const [activeTab, setActiveTab] = useState('profile');
  const [newPassword, setNewPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (!newPassword) return;
    setIsUpdating(true);
    setMessage('');
    setError('');

    try {
      const res = await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/profile/update-password', {
        email: tpoData.email,
        newPassword: newPassword
      });
      if (res.data.success) {
        setMessage('Password updated successfully. Next time you login, use the new password.');
        setNewPassword('');
      }
    } catch (err) {
      setError('Failed to update password. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Layout>
      {/* 🚨 CUSTOM BACKGROUND WRAPPER */}
      <div style={{ 
        backgroundImage: `linear-gradient(rgba(11, 17, 32, 0.7), rgba(11, 17, 32, 0.95)), url('https://lh3.googleusercontent.com/d/1bHpUfH_578DmfityB9cOgFNYhbBGdG9J')`, 
        backgroundSize: 'cover', 
        backgroundPosition: 'center', 
        backgroundAttachment: 'fixed',
        minHeight: 'calc(100vh - 70px)',
        paddingTop: '30px',
        paddingBottom: '50px',
        margin: '-20px -20px 0 -20px' // Offset layout padding
      }}>
        <div className="page-container" style={{ padding: '0 20px', maxWidth: '1000px', margin: '0 auto', background: 'transparent' }}>
          
          <h1 style={{ fontSize: '2rem', marginBottom: '5px', color: '#fff' }}>Settings</h1>
          <p style={{ color: '#cbd5e1', marginBottom: '30px' }}>Manage your account preferences and configuration</p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px' }}>
            
            {/* SIDEBAR NAVIGATION */}
            <div style={{ flex: '1 1 250px', maxWidth: '300px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button 
                  onClick={() => setActiveTab('profile')}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', background: activeTab === 'profile' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 21, 35, 0.6)', color: activeTab === 'profile' ? '#38bdf8' : '#cbd5e1', border: '1px solid', borderColor: activeTab === 'profile' ? 'rgba(56, 189, 248, 0.5)' : 'transparent', borderLeft: activeTab === 'profile' ? '3px solid #38bdf8' : '3px solid transparent', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: activeTab === 'profile' ? 'bold' : 'normal', transition: '0.2s', backdropFilter: 'blur(5px)' }}
                >
                  <User size={20} weight={activeTab === 'profile' ? "fill" : "regular"} /> Account Profile
                </button>
                <button 
                  onClick={() => setActiveTab('security')}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', background: activeTab === 'security' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 21, 35, 0.6)', color: activeTab === 'security' ? '#38bdf8' : '#cbd5e1', border: '1px solid', borderColor: activeTab === 'security' ? 'rgba(56, 189, 248, 0.5)' : 'transparent', borderLeft: activeTab === 'security' ? '3px solid #38bdf8' : '3px solid transparent', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontWeight: activeTab === 'security' ? 'bold' : 'normal', transition: '0.2s', backdropFilter: 'blur(5px)' }}
                >
                  <LockKey size={20} weight={activeTab === 'security' ? "fill" : "regular"} /> Security
                </button>
              </div>
            </div>

            {/* CONTENT AREA */}
            <div style={{ flex: '2 1 500px', background: 'rgba(15, 21, 35, 0.85)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '30px', backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
              
              {activeTab === 'profile' && (
                <div>
                  <h2 style={{ margin: '0 0 20px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px', color: '#fff' }}>Profile Information</h2>
                  <div style={{ display: 'grid', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '5px', fontWeight: 'bold' }}>FULL NAME</label>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', color: '#fff', border: '1px solid rgba(255,255,255,0.05)' }}>{tpoData.name}</div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '5px', fontWeight: 'bold' }}>OFFICIAL EMAIL</label>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', color: '#fff', border: '1px solid rgba(255,255,255,0.05)' }}>{tpoData.email}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '5px', fontWeight: 'bold' }}>SYSTEM ROLE</label>
                        <div style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)', padding: '12px', borderRadius: '8px', fontWeight: 'bold' }}>{tpoData.role}</div>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '5px', fontWeight: 'bold' }}>ASSIGNED DOMAIN</label>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', color: '#fff', border: '1px solid rgba(255,255,255,0.05)' }}>{tpoData.assignedCourse || 'All Courses'}</div>
                      </div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '5px', fontWeight: 'bold' }}>ASSIGNED BRANCHES</label>
                      <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', color: '#fff', border: '1px solid rgba(255,255,255,0.05)' }}>{(tpoData.assignedBranchesArray || []).join(', ')}</div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div>
                  <h2 style={{ margin: '0 0 20px 0', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '15px', color: '#fff' }}>Security & Password</h2>
                  
                  {isSuperAdmin ? (
                    <form onSubmit={handlePasswordUpdate}>
                      <p style={{ color: '#cbd5e1', marginBottom: '20px' }}>Update your administrator account password below.</p>
                      
                      {message && <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '12px', borderRadius: '8px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={20} /> {message}</div>}
                      {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px', borderRadius: '8px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}><WarningCircle size={20} /> {error}</div>}

                      <div style={{ marginBottom: '20px', maxWidth: '400px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '5px', fontWeight: 'bold' }}>NEW PASSWORD</label>
                        <input 
                          type="password" 
                          className="sleek-input" 
                          style={{ width: '100%', background: 'rgba(0,0,0,0.5)', borderColor: 'rgba(255,255,255,0.1)' }} 
                          placeholder="Enter new password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                        />
                      </div>
                      <button type="submit" className="btn-action" style={{ width: 'auto', padding: '10px 20px', background: '#3b82f6', color: '#fff' }} disabled={isUpdating}>
                        {isUpdating ? <CircleNotch size={20} className="ph-spin" /> : 'Update Password'}
                      </button>
                    </form>
                  ) : (
                    <div>
                      <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', color: '#f59e0b', padding: '15px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                        <LockKey size={24} weight="fill" />
                        <div>
                          <strong style={{ display: 'block' }}>Password Change Restricted</strong>
                          <span style={{ fontSize: '0.85rem' }}>For security reasons, only Super Admins have permission to modify passwords directly. Please contact your administrator if you need to reset your password.</span>
                        </div>
                      </div>
                      <div style={{ maxWidth: '400px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', color: '#cbd5e1', marginBottom: '5px', fontWeight: 'bold' }}>CURRENT PASSWORD</label>
                        <div style={{ background: 'rgba(0,0,0,0.3)', padding: '12px', borderRadius: '8px', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.05)', opacity: 0.7 }}>********</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}