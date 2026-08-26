import { useState } from 'react';
import axios from 'axios';
import { User, LockKey, Palette, CircleNotch, CheckCircle, WarningCircle } from '@phosphor-icons/react';
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
      <div className="page-container" style={{ padding: '0 10px' }}>
        <h1 style={{ fontSize: '2rem', marginBottom: '5px' }}>Settings</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '30px' }}>Manage your account preferences and configuration</p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px' }}>
          
          <div style={{ flex: '1 1 250px', maxWidth: '300px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button 
                onClick={() => setActiveTab('profile')}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', background: activeTab === 'profile' ? 'rgba(56, 189, 248, 0.1)' : 'transparent', color: activeTab === 'profile' ? 'var(--accent-primary)' : 'var(--text-muted)', border: 'none', borderLeft: activeTab === 'profile' ? '3px solid var(--accent-primary)' : '3px solid transparent', borderRadius: '0 8px 8px 0', cursor: 'pointer', textAlign: 'left', fontWeight: activeTab === 'profile' ? 'bold' : 'normal', transition: '0.2s' }}
              >
                <User size={20} weight={activeTab === 'profile' ? "fill" : "regular"} /> Account Profile
              </button>
              <button 
                onClick={() => setActiveTab('security')}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', background: activeTab === 'security' ? 'rgba(56, 189, 248, 0.1)' : 'transparent', color: activeTab === 'security' ? 'var(--accent-primary)' : 'var(--text-muted)', border: 'none', borderLeft: activeTab === 'security' ? '3px solid var(--accent-primary)' : '3px solid transparent', borderRadius: '0 8px 8px 0', cursor: 'pointer', textAlign: 'left', fontWeight: activeTab === 'security' ? 'bold' : 'normal', transition: '0.2s' }}
              >
                <LockKey size={20} weight={activeTab === 'security' ? "fill" : "regular"} /> Security
              </button>
              <button 
                onClick={() => setActiveTab('appearance')}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', background: activeTab === 'appearance' ? 'rgba(56, 189, 248, 0.1)' : 'transparent', color: activeTab === 'appearance' ? 'var(--accent-primary)' : 'var(--text-muted)', border: 'none', borderLeft: activeTab === 'appearance' ? '3px solid var(--accent-primary)' : '3px solid transparent', borderRadius: '0 8px 8px 0', cursor: 'pointer', textAlign: 'left', fontWeight: activeTab === 'appearance' ? 'bold' : 'normal', transition: '0.2s' }}
              >
                <Palette size={20} weight={activeTab === 'appearance' ? "fill" : "regular"} /> Appearance
              </button>
            </div>
          </div>

          <div style={{ flex: '2 1 500px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '30px' }}>
            
            {activeTab === 'profile' && (
              <div>
                <h2 style={{ margin: '0 0 20px 0', borderBottom: '1px solid var(--card-border)', paddingBottom: '15px' }}>Profile Information</h2>
                <div style={{ display: 'grid', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>FULL NAME</label>
                    <div style={{ background: 'var(--bg-dark)', padding: '12px', borderRadius: '8px', color: '#fff' }}>{tpoData.name}</div>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>OFFICIAL EMAIL</label>
                    <div style={{ background: 'var(--bg-dark)', padding: '12px', borderRadius: '8px', color: '#fff' }}>{tpoData.email}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>SYSTEM ROLE</label>
                      <div style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '12px', borderRadius: '8px', fontWeight: 'bold' }}>{tpoData.role}</div>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>ASSIGNED DOMAIN</label>
                      <div style={{ background: 'var(--bg-dark)', padding: '12px', borderRadius: '8px', color: '#fff' }}>{tpoData.assignedCourse}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div>
                <h2 style={{ margin: '0 0 20px 0', borderBottom: '1px solid var(--card-border)', paddingBottom: '15px' }}>Security & Password</h2>
                
                {isSuperAdmin ? (
                  <form onSubmit={handlePasswordUpdate}>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Update your administrator account password below.</p>
                    
                    {message && <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '12px', borderRadius: '8px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={20} /> {message}</div>}
                    {error && <div style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '12px', borderRadius: '8px', marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px' }}><WarningCircle size={20} /> {error}</div>}

                    <div style={{ marginBottom: '20px', maxWidth: '400px' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>NEW PASSWORD</label>
                      <input 
                        type="password" 
                        className="sleek-input" 
                        style={{ width: '100%' }} 
                        placeholder="Enter new password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" className="btn-action" style={{ width: 'auto', padding: '10px 20px' }} disabled={isUpdating}>
                      {isUpdating ? <CircleNotch size={20} className="ph-spin" /> : 'Update Password'}
                    </button>
                  </form>
                ) : (
                  <div>
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', color: '#f59e0b', padding: '15px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                      <LockKey size={24} weight="fill" />
                      <div>
                        <strong style={{ display: 'block' }}>Password Change Restricted</strong>
                        <span style={{ fontSize: '0.85rem' }}>For security reasons, only Super Admins have permission to modify passwords directly. Please contact your administrator if you need to reset your password.</span>
                      </div>
                    </div>
                    <div style={{ maxWidth: '400px' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '5px', fontWeight: 'bold' }}>CURRENT PASSWORD</label>
                      <div style={{ background: 'var(--bg-dark)', padding: '12px', borderRadius: '8px', color: 'var(--text-muted)', opacity: 0.7 }}>********</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'appearance' && (
              <div>
                <h2 style={{ margin: '0 0 20px 0', borderBottom: '1px solid var(--card-border)', paddingBottom: '15px' }}>Appearance</h2>
                <div style={{ background: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', border: '1px solid #0ea5e9', padding: '15px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Moon size={24} weight="fill" />
                  <div>
                    <strong style={{ display: 'block' }}>Dark Mode Enforced</strong>
                    <span style={{ fontSize: '0.85rem' }}>The portal has been permanently locked to Dark Mode to ensure maximum text visibility and accessibility across all modules.</span>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </Layout>
  );
}