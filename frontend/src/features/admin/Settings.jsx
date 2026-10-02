import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { Camera, ShieldCheck, User, LockKey, CircleNotch, CheckCircle, WarningCircle, PaintBrush, X, Crop, MagnifyingGlassPlus, MagnifyingGlassMinus } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig'; // 🚨 Imports your smart URL!
import { ACCENT_OPTIONS, applyAppearance, readAppearance, saveAppearance } from '../../services/appearance';

const PROFILE_CROP_SIZE = 320;

function ProfilePhotoCropModal({ file, busy, onCancel, onConfirm }) {
  const [imageInfo, setImageInfo] = useState(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState('');
  const imageRef = useRef(null);
  const dragRef = useRef(null);

  useEffect(() => {
    if (!file) return undefined;
    let isCurrent = true;
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      if (!isCurrent) return;
      imageRef.current = image;
      setImageInfo({ src: objectUrl, width: image.naturalWidth, height: image.naturalHeight });
      setOffset({ x: 0, y: 0 });
      setZoom(1);
      setError('');
    };
    image.onerror = () => { if (isCurrent) setError('This image could not be opened. Choose another photo.'); };
    image.src = objectUrl;
    return () => {
      isCurrent = false;
      URL.revokeObjectURL(objectUrl);
      imageRef.current = null;
    };
  }, [file]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    const handleKeyDown = event => {
      if (event.key === 'Escape' && !busy) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [busy, onCancel]);

  const baseScale = imageInfo ? Math.max(PROFILE_CROP_SIZE / imageInfo.width, PROFILE_CROP_SIZE / imageInfo.height) : 1;
  const scale = baseScale * zoom;
  const scaledWidth = imageInfo ? imageInfo.width * scale : PROFILE_CROP_SIZE;
  const scaledHeight = imageInfo ? imageInfo.height * scale : PROFILE_CROP_SIZE;
  const clampOffset = (point, nextZoom = zoom) => {
    if (!imageInfo) return point;
    const nextScale = baseScale * nextZoom;
    const maxX = Math.max(0, (imageInfo.width * nextScale - PROFILE_CROP_SIZE) / 2);
    const maxY = Math.max(0, (imageInfo.height * nextScale - PROFILE_CROP_SIZE) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, point.x)), y: Math.max(-maxY, Math.min(maxY, point.y)) };
  };

  const handlePointerDown = event => {
    if (busy || !imageInfo) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y };
  };
  const handlePointerMove = event => {
    if (!dragRef.current) return;
    setOffset(clampOffset({
      x: dragRef.current.offsetX + event.clientX - dragRef.current.x,
      y: dragRef.current.offsetY + event.clientY - dragRef.current.y
    }));
  };
  const handlePointerUp = event => {
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const handleZoom = event => {
    const nextZoom = Number(event.target.value);
    setZoom(nextZoom);
    setOffset(current => clampOffset(current, nextZoom));
  };

  const applyCrop = () => {
    const image = imageRef.current;
    if (!imageInfo || !image) return;
    const sourceSize = PROFILE_CROP_SIZE / scale;
    const centerX = imageInfo.width / 2 - offset.x / scale;
    const centerY = imageInfo.height / 2 - offset.y / scale;
    const sx = Math.max(0, Math.min(imageInfo.width - sourceSize, centerX - sourceSize / 2));
    const sy = Math.max(0, Math.min(imageInfo.height - sourceSize, centerY - sourceSize / 2));
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const context = canvas.getContext('2d');
    if (!context) return setError('Your browser could not prepare this crop. Try another browser.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, sx, sy, sourceSize, sourceSize, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => {
      if (!blob) return setError('The cropped photo could not be created. Please try again.');
      const baseName = String(file.name || 'profile-photo').replace(/\.[^.]+$/, '') || 'profile-photo';
      onConfirm(new File([blob], `${baseName}-cropped.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
    }, 'image/jpeg', 0.92);
  };

  return createPortal((
    <div className="profile-crop-backdrop" onClick={event => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
      <section className="profile-crop-dialog" role="dialog" aria-modal="true" aria-labelledby="profile-crop-title">
        <header className="profile-crop-header">
          <div className="profile-crop-heading-icon"><Crop size={21} weight="bold" /></div>
          <div><h2 id="profile-crop-title">Adjust your profile photo</h2><p>Drag to reposition, then zoom until it looks right.</p></div>
          <button type="button" className="profile-crop-close" onClick={onCancel} disabled={busy} aria-label="Close crop tool"><X size={20} /></button>
        </header>

        <div className="profile-crop-workspace">
          <div className="profile-crop-stage" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} aria-label="Drag image to adjust crop">
            {imageInfo ? <img src={imageInfo.src} alt="Photo crop preview" draggable="false" style={{ position: 'absolute', left: `calc(50% + ${offset.x}px)`, top: `calc(50% + ${offset.y}px)`, width: `${scaledWidth}px`, height: `${scaledHeight}px`, maxWidth: 'none', transform: 'translate(-50%, -50%)', pointerEvents: 'none', userSelect: 'none' }} /> : <CircleNotch size={32} className="ph-spin" />}
            <div className="profile-crop-ring" aria-hidden="true" />
          </div>
          <div className="profile-crop-tools">
            <div className="profile-crop-preview-label"><span>PROFILE PREVIEW</span><small>Square crop · shown as a circle</small></div>
            <div className="profile-crop-zoom"><MagnifyingGlassMinus size={18} /><input aria-label="Zoom photo" type="range" min="1" max="3" step="0.01" value={zoom} onChange={handleZoom} disabled={!imageInfo || busy} /><MagnifyingGlassPlus size={18} /></div>
            <div className="profile-crop-zoom-value">Zoom <strong>{Math.round(zoom * 100)}%</strong></div>
            <div className="profile-crop-hint">Keep your face centered inside the circle. The portal will save a crisp 512 × 512 photo.</div>
          </div>
        </div>

        {error && <div className="profile-crop-error" role="alert">{error}</div>}
        <footer className="profile-crop-actions">
          <button type="button" className="profile-crop-cancel" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="profile-crop-confirm" onClick={applyCrop} disabled={!imageInfo || busy}>{busy ? <><CircleNotch className="ph-spin" size={18} /> Uploading…</> : <><Crop size={18} weight="bold" /> Crop &amp; upload</>}</button>
        </footer>
      </section>
      <style>{`
        .profile-crop-backdrop{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;padding:20px;background:rgba(3,7,18,.82);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);animation:profileCropFade .18s ease-out}
        .profile-crop-dialog{width:min(100%,760px);max-height:calc(100dvh - 32px);overflow:auto;padding:clamp(18px,3vw,30px);border:1px solid rgba(148,163,184,.2);border-radius:26px;background:radial-gradient(ellipse at 5% 0%,rgba(56,189,248,.13),transparent 38%),linear-gradient(145deg,#121d31,#0b1220 72%);color:#f8fafc;box-shadow:0 28px 100px rgba(0,0,0,.55);animation:profileCropRise .24s cubic-bezier(.2,.8,.2,1)}
        .profile-crop-header{display:flex;align-items:center;gap:14px;padding-bottom:22px;border-bottom:1px solid rgba(148,163,184,.14)}
        .profile-crop-heading-icon{width:44px;height:44px;display:grid;place-items:center;border:1px solid rgba(56,189,248,.26);border-radius:14px;background:rgba(56,189,248,.12);color:#7dd3fc}
        .profile-crop-header h2{margin:0;font-size:1.2rem;letter-spacing:-.02em}.profile-crop-header p{margin:4px 0 0;color:#94a3b8;font-size:.82rem}
        .profile-crop-close{margin-left:auto;width:38px;height:38px;display:grid;place-items:center;border:1px solid rgba(148,163,184,.16);border-radius:12px;background:rgba(15,23,42,.8);color:#cbd5e1;cursor:pointer}.profile-crop-close:disabled{opacity:.5}
        .profile-crop-workspace{display:grid;grid-template-columns:minmax(260px,1fr) minmax(190px,.62fr);gap:clamp(22px,5vw,48px);align-items:center;padding:26px 2px}
        .profile-crop-stage{position:relative;width:min(100%,320px);aspect-ratio:1;margin:auto;overflow:hidden;border:1px solid rgba(148,163,184,.18);border-radius:50%;background:radial-gradient(circle at center,#1e293b,#070b13 72%);display:grid;place-items:center;touch-action:none;cursor:grab;box-shadow:0 0 0 10px rgba(56,189,248,.04),0 20px 55px rgba(0,0,0,.4)}.profile-crop-stage:active{cursor:grabbing}
        .profile-crop-ring{position:absolute;inset:0;border:2px solid rgba(255,255,255,.78);border-radius:50%;box-shadow:inset 0 0 0 999px rgba(3,7,18,.02);pointer-events:none}
        .profile-crop-tools{align-self:stretch;display:flex;flex-direction:column;justify-content:center;gap:16px}.profile-crop-preview-label span{display:block;color:#7dd3fc;font-size:.69rem;font-weight:850;letter-spacing:.14em}.profile-crop-preview-label small{display:block;margin-top:6px;color:#94a3b8;font-size:.79rem}
        .profile-crop-zoom{display:flex;align-items:center;gap:12px;color:#94a3b8}.profile-crop-zoom input{width:100%;accent-color:#38bdf8}.profile-crop-zoom-value{display:flex;justify-content:space-between;color:#94a3b8;font-size:.8rem}.profile-crop-zoom-value strong{color:#e0f2fe}
        .profile-crop-hint{padding:13px 14px;border:1px solid rgba(148,163,184,.12);border-radius:14px;background:rgba(15,23,42,.54);color:#94a3b8;font-size:.78rem;line-height:1.55}
        .profile-crop-error{margin-bottom:15px;padding:11px 13px;border:1px solid rgba(248,113,113,.28);border-radius:12px;background:rgba(127,29,29,.2);color:#fecaca;font-size:.84rem}
        .profile-crop-actions{display:flex;justify-content:flex-end;gap:10px;padding-top:18px;border-top:1px solid rgba(148,163,184,.14)}.profile-crop-actions button{display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:44px;padding:0 18px;border-radius:13px;font-weight:800;cursor:pointer;transition:transform .18s ease,filter .18s ease}.profile-crop-actions button:hover:not(:disabled){transform:translateY(-1px);filter:brightness(1.08)}.profile-crop-actions button:disabled{opacity:.6;cursor:wait}
        .profile-crop-cancel{border:1px solid rgba(148,163,184,.22);background:rgba(15,23,42,.72);color:#cbd5e1}.profile-crop-confirm{border:1px solid rgba(125,211,252,.35);background:linear-gradient(135deg,#0ea5e9,#2563eb);color:#fff;box-shadow:0 8px 22px rgba(37,99,235,.25)}
        @keyframes profileCropFade{from{opacity:0}to{opacity:1}}@keyframes profileCropRise{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
        @media(max-width:640px){.profile-crop-workspace{grid-template-columns:1fr;padding:22px 0 18px}.profile-crop-tools{gap:12px}.profile-crop-actions button{flex:1}}
        @media(prefers-reduced-motion:reduce){.profile-crop-backdrop,.profile-crop-dialog{animation:none}.profile-crop-actions button{transition:none}}
      `}</style>
    </div>
  ), document.body);
}

export default function Settings() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const [tpoData, setTpoData] = useState(tpoDataStr ? JSON.parse(tpoDataStr) : null);
  
  const [activeTab, setActiveTab] = useState('profile');
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [message, setMessage] = useState({ text: '', type: '' });
  const [appearance, setAppearance] = useState(readAppearance);
  const [appearanceNotice, setAppearanceNotice] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [photoToCrop, setPhotoToCrop] = useState(null);

  const fileInputRef = useRef(null);

  const updateAppearance = changes => {
    const nextAppearance = { ...appearance, ...changes };
    setAppearance(nextAppearance);
    applyAppearance(nextAppearance);
    saveAppearance(nextAppearance);
    setAppearanceNotice('Appearance saved on this device.');
  };

  if (!tpoData) return null;

  // 🚨 SECURITY LOCK: Check if user is Super Admin
  const isSuperAdmin = tpoData.accessType === 'superadmin';

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
      const response = await axios.post(`${API_BASE}/api/tpo/profile/update-password`, {
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

  const handlePhotoSelection = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) return setMessage({ text: 'Choose an image file for your profile photo.', type: 'error' });
    setMessage({ text: '', type: '' });
    setPhotoToCrop(file);
  };

  const handlePhotoUpload = async (file) => {
    if (!file) return;
    setIsUploading(true);
    setMessage({ text: '', type: '' });
    
    const formData = new FormData();
    formData.append('email', tpoData.email || '');
    formData.append('loginId', tpoData.loginId || '');
    formData.append('photo', file);

    try {
      const res = await axios.post(`${API_BASE}/api/tpo/profile/update-photo`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      if (res.data.success) {
        const updatedTpo = { ...tpoData, photo: res.data.photoUrl };
        localStorage.setItem('tpoData', JSON.stringify(updatedTpo));
        setTpoData(updatedTpo);
        setPhotoToCrop(null);
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

        <div className="settings-layout" style={{ display: 'grid', gridTemplateColumns: '250px 1fr', gap: '30px' }}>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button 
              onClick={() => { setActiveTab('profile'); setMessage({text:'', type:''}); }}
              style={{ padding: '15px 20px', borderRadius: '12px', border: 'none', background: activeTab === 'profile' ? 'rgba(56, 189, 248, 0.1)' : 'transparent', color: activeTab === 'profile' ? 'var(--accent-primary)' : 'var(--text-muted)', textAlign: 'left', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: '0.2s', borderLeft: activeTab === 'profile' ? '3px solid var(--accent-primary)' : '3px solid transparent' }}
            >
              <User size={20} weight={activeTab === 'profile' ? "fill" : "regular"} /> Account Profile
            </button>

            <button
              onClick={() => { setActiveTab('appearance'); setMessage({ text: '', type: '' }); setAppearanceNotice(''); }}
              style={{ padding: '15px 20px', borderRadius: '12px', border: 'none', background: activeTab === 'appearance' ? 'var(--accent-glow)' : 'transparent', color: activeTab === 'appearance' ? 'var(--accent-primary)' : 'var(--text-muted)', textAlign: 'left', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: '0.2s', borderLeft: activeTab === 'appearance' ? '3px solid var(--accent-primary)' : '3px solid transparent' }}
            >
              <PaintBrush size={20} weight={activeTab === 'appearance' ? 'fill' : 'regular'} /> Appearance
            </button>

            {/* 🚨 ONLY VISIBLE TO SUPER ADMINS */}
            {isSuperAdmin && (
              <button 
                onClick={() => { setActiveTab('security'); setMessage({text:'', type:''}); }}
                style={{ padding: '15px 20px', borderRadius: '12px', border: 'none', background: activeTab === 'security' ? 'rgba(56, 189, 248, 0.1)' : 'transparent', color: activeTab === 'security' ? 'var(--accent-primary)' : 'var(--text-muted)', textAlign: 'left', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: '0.2s', borderLeft: activeTab === 'security' ? '3px solid var(--accent-primary)' : '3px solid transparent' }}
              >
                <LockKey size={20} weight={activeTab === 'security' ? "fill" : "regular"} /> Security
              </button>
            )}
          </div>

          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2.5rem' }}>
            
            {message.text && (
              <div className={`alert alert-${message.type}`} role={message.type === 'error' ? 'alert' : 'status'} style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                {message.type === 'success' ? <CheckCircle size={20} weight="fill"/> : <WarningCircle size={20} weight="fill"/>}
                {message.text}
              </div>
            )}

            {activeTab === 'profile' && (
              <div className="fade-in">
                <h2 style={{ fontSize: '1.4rem', margin: '0 0 25px 0', borderBottom: '1px solid var(--card-border)', paddingBottom: '15px' }}>Profile Information</h2>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '25px', marginBottom: '30px', flexWrap: 'wrap' }}>
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: '100px', height: '100px', borderRadius: '50%', background: 'var(--bg-dark)', border: '3px solid var(--accent-primary)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {tpoData.photo ? (
                         <img src={getDriveImage(tpoData.photo) || tpoData.photo} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                         <span style={{ fontSize: '2.5rem', color: 'var(--text-main)', fontWeight: 'bold' }}>{tpoData.name?.charAt(0)}</span>
                      )}
                    </div>
                    
                    <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoSelection} style={{ display: 'none' }} />
                    
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                      style={{ position: 'absolute', bottom: '-5px', right: '-5px', background: 'var(--accent-primary)', color: '#0f172a', border: 'none', width: '35px', height: '35px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}
                    >
                      {isUploading ? <CircleNotch size={18} className="ph-spin" /> : <Camera size={18} weight="fill" />}
                    </button>
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 5px 0', color: 'var(--text-main)', fontSize: '1.2rem' }}>{tpoData.name}</h3>
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>Choose, crop, and position your photo before saving it across the portal.</p>
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
                      <input type="text" className="sleek-input" style={{ width: '100%', background: 'var(--bg-dark)', color: 'var(--accent-primary)', fontWeight: 'bold' }} value={(tpoData.role || 'Placement Officer').toUpperCase()} readOnly />
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

            {activeTab === 'appearance' && (
              <div className="fade-in">
                <h2 style={{ fontSize: '1.4rem', margin: '0 0 8px 0' }}>Appearance</h2>
                <p style={{ color: 'var(--text-muted)', margin: '0 0 26px' }}>Choose a light or dark workspace and an accent color. Your choice is saved on this device.</p>

                <section className="appearance-setting-block" aria-labelledby="appearance-mode-title">
                  <h3 id="appearance-mode-title">Display mode</h3>
                  <div className="appearance-mode-options">
                    {[
                      { id: 'dark', label: 'Dark' },
                      { id: 'light', label: 'Light' }
                    ].map(option => <button key={option.id} type="button" className={`appearance-mode-option${appearance.theme === option.id ? ' active' : ''}`} aria-pressed={appearance.theme === option.id} onClick={() => updateAppearance({ theme: option.id })}>
                      <span className={`appearance-mode-preview ${option.id}`} aria-hidden="true"><i /><i /><i /></span>
                      <span>{option.label}</span>
                      {appearance.theme === option.id && <CheckCircle size={18} weight="fill" />}
                    </button>)}
                  </div>
                </section>

                <section className="appearance-setting-block" aria-labelledby="appearance-accent-title">
                  <h3 id="appearance-accent-title">Accent color</h3>
                  <div className="appearance-accent-options">
                    {ACCENT_OPTIONS.map(option => <button key={option.id} type="button" className={`appearance-accent-option${appearance.accent === option.id ? ' active' : ''}`} style={{ '--swatch-color': option.color }} aria-label={`${option.label} accent`} aria-pressed={appearance.accent === option.id} onClick={() => updateAppearance({ accent: option.id })}><span aria-hidden="true" />{option.label}</button>)}
                  </div>
                </section>

                {appearanceNotice && <p className="appearance-saved" role="status"><CheckCircle size={17} weight="fill" />{appearanceNotice}</p>}
              </div>
            )}

            {activeTab === 'security' && isSuperAdmin && (
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
                    <ShieldCheck size={32} color="var(--accent-primary)" weight="fill" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                      Updating your password will sync immediately to the secure Google Sheets backend. Make sure to use a strong password with at least 6 characters.
                    </div>
                  </div>

                  <button type="submit" className="btn-action" style={{ width: 'auto', background: 'var(--accent-primary)', color: '#0f172a', padding: '0.8rem 2rem', fontWeight: 'bold' }} disabled={isUpdating}>
                    {isUpdating ? <CircleNotch size={20} className="ph-spin" /> : 'Update Password'}
                  </button>
                </form>
              </div>
            )}

          </div>
        </div>
      </div>
      {photoToCrop && <ProfilePhotoCropModal file={photoToCrop} busy={isUploading} onCancel={() => !isUploading && setPhotoToCrop(null)} onConfirm={handlePhotoUpload} />}
    </Layout>
  );
}
