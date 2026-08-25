import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { User, LockKey, Palette, UploadSimple, CircleNotch } from '@phosphor-icons/react';
import Layout from './Layout';

const API_BASE = "https://ipcs-tpo-portal-u0l6.onrender.com";

export default function Settings() {
  const [localTpoData, setLocalTpoData] = useState(JSON.parse(localStorage.getItem('tpoData')));
  const [activePanel, setActivePanel] = useState('profile');
  const [theme, setTheme] = useState(document.body.getAttribute('data-theme') || 'dark');
  
  // States for Photo Upload
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  // Listen for theme changes from the top nav moon icon
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.body.getAttribute('data-theme') || 'dark');
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  const handleThemeChange = (newTheme) => {
    document.body.setAttribute('data-theme', newTheme);
    setTheme(newTheme);
  };

  const getDriveImage = (url) => {
    if (!url) return null;
    const match = url.match(/(?:id=|\/d\/)([\w-]{25,})/);
    return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
  };

  // 🚨 THE PHOTO UPLOAD HANDLER
  const handlePhotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', file);
      formData.append('email', localTpoData.email);
      
      const res = await axios.post(`${API_BASE}/api/tpo/profile/update-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      if (res.data.success) {
        // Update Local Storage and State so the image changes instantly
        const updatedData = { ...localTpoData, photo: res.data.photoUrl };
        localStorage.setItem('tpoData', JSON.stringify(updatedData));
        setLocalTpoData(updatedData);
      }
    } catch (err) {
      alert('Failed to upload photo. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  if (!localTpoData) return null;

  const profilePhotoUrl = getDriveImage(localTpoData.photo);

  return (
    <Layout>
      <div className="page-container">
        <div className="settings-header">
          <h1>Settings</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage your officer account preferences and configuration</p>
        </div>

        <div className="settings-layout">
          {/* Settings Sidebar */}
          <div className="settings-nav">
            <div className={`set-nav-item ${activePanel === 'profile' ? 'active' : ''}`} onClick={() => setActivePanel('profile')}>
              <User size={20} /> Profile
            </div>
            <div className={`set-nav-item ${activePanel === 'security' ? 'active' : ''}`} onClick={() => setActivePanel('security')}>
              <LockKey size={20} /> Security
            </div>
            <div className={`set-nav-item ${activePanel === 'appearance' ? 'active' : ''}`} onClick={() => setActivePanel('appearance')}>
              <Palette size={20} /> Appearance
            </div>
          </div>

          {/* Settings Content Panels */}
          <div className="settings-panel-container">
            
            {activePanel === 'profile' && (
              <div className="settings-panel">
                <div className="panel-title">Profile Information</div>
                
                <div className="profile-photo-row">
                  <div className="profile-photo-large">
                    {profilePhotoUrl ? <img src={profilePhotoUrl} alt="Profile" /> : localTpoData.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    {/* Hidden File Input */}
                    <input 
                      type="file" 
                      accept="image/*" 
                      ref={fileInputRef} 
                      style={{ display: 'none' }} 
                      onChange={handlePhotoUpload} 
                    />
                    
                    <button 
                      className="btn-action" 
                      style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', width: 'auto' }}
                      onClick={() => fileInputRef.current.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? <CircleNotch size={16} className="ph-spin" /> : <UploadSimple size={16} />} 
                      {isUploading ? ' Uploading...' : ' Change Photo'}
                    </button>
                  </div>
                </div>

                <div className="grid-2col">
                  <div className="form-group"><label>Full Name</label><input type="text" className="sleek-input" value={localTpoData.name} readOnly style={{ opacity: 0.7 }} /></div>
                  <div className="form-group"><label>Job Title</label><input type="text" className="sleek-input" value="Placement Officer" readOnly style={{ opacity: 0.7 }} /></div>
                  <div className="form-group"><label>Official Email</label><input type="text" className="sleek-input" value={localTpoData.email} readOnly style={{ opacity: 0.7 }} /></div>
                  
                  {/* Phone number safely bound */}
                  <div className="form-group"><label>Phone Number</label><input type="text" className="sleek-input" value={localTpoData.phone || 'Not Provided'} readOnly style={{ opacity: 0.7 }} /></div>
                </div>

                <div className="form-group">
                  <label>Assigned Branches</label>
                  <div className="branch-badges-container">
                    {localTpoData.assignedBranchesArray.map((b, i) => <span key={i} className="branch-pill">{b}</span>)}
                  </div>
                </div>
              </div>
            )}

            {activePanel === 'security' && (
              <div className="settings-panel">
                <div className="panel-title">Security & Password</div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px' }}>Password resets are handled via the root database.</p>
                <div className="form-group">
                  <label>Current Password</label>
                  <input type="password" placeholder="********" className="sleek-input" disabled />
                </div>
              </div>
            )}

            {activePanel === 'appearance' && (
              <div className="settings-panel">
                <div className="panel-title">Appearance</div>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <div className={`theme-option-box ${theme === 'light' ? 'selected' : ''}`} onClick={() => handleThemeChange('light')}>
                    <div className="theme-preview" style={{ background: '#ffffff' }}></div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Light Mode</div>
                  </div>
                  <div className={`theme-option-box ${theme === 'dark' ? 'selected' : ''}`} onClick={() => handleThemeChange('dark')}>
                    <div className="theme-preview" style={{ background: '#0f172a' }}></div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>Dark Mode</div>
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