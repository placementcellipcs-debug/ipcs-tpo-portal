import { useState, useRef } from 'react';
import axios from 'axios';
import { Camera, ShieldCheck, User, LockKey, CircleNotch, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import Layout from './Layout';

export default function Settings() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const [tpoData, setTpoData] = useState(tpoDataStr ? JSON.parse(tpoDataStr) : null);
  
  const [activeTab, setActiveTab] = useState('profile');
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [message, setMessage] = useState({ text: '', type: '' });
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef(null);

  if (!tpoData) return null;

  const getDriveImage = (url) => {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
    return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
      return setMessage({ text: "New passwords do not match", type: 'error' });
    }
    
    setIsUpdating(true);
    setMessage({ text: '', type: '' });

    try {
      const response = await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/profile/update-password', {
        email: tpoData.email || '',
        loginId: tpoData.loginId || '',
        newPassword: passwords.new
      });

      if (response.data.success) {
        setMessage({ text: "Password updated successfully! Please use it on your next login.", type: 'success' });
        setPasswords({ current: '', new: '', confirm: '' });
      }
    } catch (error) {
      setMessage({ text: error.response?.data?.message || "Failed to update password", type: 'error' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploading(true);
    setMessage({ text: '', type: '' });
    
    // 🚨 Passing both email and loginId ensures a 100% match
    const formData = new FormData();
    formData.append('email', tpoData.email || '');
    formData.append('loginId', tpoData.loginId || '');
    formData.append('photo', file);

    try {
      const res = await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/profile/update-photo', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        const updatedTpo = { ...tpoData, photo: res.data.photoUrl };
        localStorage.setItem('tpoData', JSON.stringify(updatedTpo));
        setTpoData(updatedTpo);
        setMessage({ text: "Profile photo updated successfully! It will sync across the portal.", type: 'success' });
        
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || "Failed to upload photo to Google Drive.";
      setMessage({ text: errMsg, type: 'error' });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0, maxWidth: '1000px', margin: '0 auto' }}>
        
        <div style={{ marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0' }}>Settings</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Manage your account preferences and configuration</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '30px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              onClick={() => { setActiveTab('profile'); setMessage({text:'', type:''}); }}
              style={{ padding: '15px 20px', borderRadius: '12px', border: 'none', background: activeTab === 'profile' ? 'rgba(56, 189, 248, 0.1)' : 'transparent', color: activeTab === 'profile' ? '#38bdf8' : 'var(--text-muted)', textAlign: 'left', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: '0.2s', borderLeft: activeTab === 'profile' ? '3px solid #38bdf8' : '3px solid transparent' }}
            >
              <User size={20} weight={activeTab === 'profile' ? "fill" : "regular"} /> Account Profile
            </button>
            <button 
              onClick={() => { setActiveTab('security'); setMessage({text:'', type:''}); }}
              style={{ padding: '15px 20px', borderRadius: '12px', border: 'none', background: activeTab === 'security' ? 'rgba(56, 189, 248, 0.1)' : 'transparent', color: activeTab === 'security' ? '#38bdf8' : 'var(--text-muted)', textAlign: 'left', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: '0.2s', borderLeft: activeTab === 'security' ? '3px solid #38bdf8' : '3px solid transparent' }}
            >
              <LockKey size={20} weight={activeTab === 'security' ? "fill" : "regular"} /> Security
            </button>
          </div>

          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2.5rem' }}>
            
            {message.text && (
              <div style={{ marginBottom: '20px', padding: '15px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 'bold', background: message.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: message.type === 'success' ? '#10b981' : '#ef4444', border: `1px solid ${message.type === 'success' ? '#10b981' : '#ef4444'}` }}>
                {message.type === 'success' ? <CheckCircle size={20} weight="fill"/> : <WarningCircle size={20} weight="fill"/>}
                {message.text}
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="fade-in">
                <h2 style={{ fontSize: '1.4rem', margin: '0 0 25px 0', borderBottom: '1px solid var(--card-border)', paddingBottom: '15px' }}>Profile Information</h2>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '25px', marginBottom: '30px' }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--bg-dark)', border: '3px solid #38bdf8', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {tpoData.photo ? (
                         <img src={getDriveImage(tpoData.photo) || tpoData.photo} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                         <span style={{ fontSize: '2.5rem', color: '#fff', fontWeight: 'bold' }}>{tpoData.name?.charAt(0)}</span>
                      )}
                    </div>
                    
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoUpload} style={{ display: 'none' }} />
                    
                    <button 
                      onClick={() => fileInputRef.current.click()}
                      disabled={isUploading}
                      style={{ position: 'absolute', bottom: '-5px', right: '-5px', background: '#38bdf8', color: '#0f172a', border: 'none', width: '35px', height: '35px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}
                    >
                      {isUploading ? <CircleNotch size={18} className="ph-spin" /> : <Camera size={18} weight="fill" />}
                    </button>
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 5px 0', color: '#fff', fontSize: '1.2rem' }}>{tpoData.name}</h3>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Upload a professional picture for your account.</p>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: '20px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Full Name</label>
                    <input type="text" className="sleek-input" style={{ width: '100%', background: 'var(--bg-dark)', opacity: 0.8 }} value={tpoData.name} readOnly />
                  </div>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Official Email</label>
                    <input type="text" className="sleek-input" style={{ width: '100%', background: 'var(--bg-dark)', opacity: 0.8 }} value={tpoData.email} readOnly />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>System Role</label>
                      <input type="text" className="sleek-input" style={{ width: '100%', background: 'var(--bg-dark)', color: '#38bdf8', fontWeight: 'bold' }} value={(tpoData.role || 'Placement Officer').toUpperCase()} readOnly />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Assigned Domain</label>
                      <input type="text" className="sleek-input" style={{ width: '100%', background: 'var(--bg-dark)', opacity: 0.8 }} value={tpoData.assignedCourse || 'All Courses'} readOnly />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Assigned Branches</label>
                    <input type="text" className="sleek-input" style={{ width: '100%', background: 'var(--bg-dark)', opacity: 0.8 }} value={Array.isArray(tpoData.assignedBranchesArray) ? tpoData.assignedBranchesArray.join(', ') : tpoData.assignedBranchesArray} readOnly />
                  </div>
                  
                  <p style={{ fontSize: '0.75rem', color: '#f59e0b', marginTop: '10px' }}>
                    * To update core details like your name or assigned branch, please contact the System Administrator.
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="fade-in">
                <h2 style={{ fontSize: '1.4rem', margin: '0 0 25px 0', borderBottom: '1px solid var(--card-border)', paddingBottom: '15px' }}>Security & Authentication</h2>
                
                <form onSubmit={handlePasswordUpdate}>
                  <div style={{ display: 'grid', gap: '20px', marginBottom: '30px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>New Password</label>
                      <input 
                        type="password" 
                        className="sleek-input" 
                        style={{ width: '100%' }} 
                        value={passwords.new}
                        onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                        required
                        minLength={6}
                      />
                    </div>
                    
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Confirm New Password</label>
                      <input 
                        type="password" 
                        className="sleek-input" 
                        style={{ width: '100%' }} 
                        value={passwords.confirm}
                        onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                        required
                        minLength={6}
                      />
                    </div>
                  </div>

                  <div style={{ background: 'rgba(56, 189, 248, 0.05)', padding: '15px', borderRadius: '8px', display: 'flex', gap: '15px', alignItems: 'center', border: '1px solid rgba(56, 189, 248, 0.2)', marginBottom: '25px' }}>
                    <ShieldCheck size={32} color="#38bdf8" weight="fill" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                      Updating your password will sync immediately to the secure Google Sheets backend. Make sure to use a strong password with at least 6 characters.
                    </div>
                  </div>

                  <button type="submit" className="btn-action" style={{ width: 'auto', background: '#38bdf8', color: '#0f172a', padding: '0.8rem 2rem', fontWeight: 'bold' }} disabled={isUpdating}>
                    {isUpdating ? <CircleNotch size={20} className="ph-spin" /> : 'Update Password'}
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>
    </Layout>
  );
}