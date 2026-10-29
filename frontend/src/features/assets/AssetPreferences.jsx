import { useMemo, useRef, useState } from 'react';
import axios from 'axios';
import {
  ArrowClockwise, Barcode, Buildings, Camera, CheckCircle, CircleNotch,
  DownloadSimple, FileCsv, Gear, Moon, Package, PaintBrush, Sun,
  WarningCircle, Wrench
} from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import { ACCENT_OPTIONS, applyAppearance, readAppearance, saveAppearance } from '../../services/appearance';
import { isPortalAdminAccount } from '../../utils/roleAccess';
import { Link } from 'react-router-dom';
import './AssetPreferences.css';

const reportOptions = [
  { id: 'assets', label: 'Asset register', detail: 'Tracked assets, branch, category, and current assignment.', endpoint: '/api/v1/assets', key: 'assets', icon: Barcode, tone: 'blue' },
  { id: 'inventory', label: 'Consumable stock', detail: 'Stock levels, minimums, and branch locations.', endpoint: '/api/v1/assets/inventory', key: 'inventory', icon: Package, tone: 'mint' },
  { id: 'transfers', label: 'Transfer history', detail: 'Requests, approvals, dispatch, and received status.', endpoint: '/api/v1/assets/transfers', key: 'transfers', icon: Buildings, tone: 'violet' },
  { id: 'maintenance', label: 'Maintenance log', detail: 'Reported issues, service status, and costs.', endpoint: '/api/v1/assets/maintenance', key: 'maintenance', icon: Wrench, tone: 'amber' },
  { id: 'activity', label: 'Activity history', detail: 'Latest 250 visible activity entries.', endpoint: '/api/v1/assets/activity', key: 'activity', icon: ArrowClockwise, tone: 'rose' }
];

const getDriveImage = value => {
  if (!value || typeof value !== 'string') return '';
  const match = value.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
  return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : value;
};

const quoteCsv = value => {
  const text = Array.isArray(value) ? value.join('; ') : value && typeof value === 'object' ? JSON.stringify(value) : String(value ?? '');
  const safeText = typeof value !== 'number' && /^[=+@-]/.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
};

function downloadCsv(filename, records) {
  const rows = Array.isArray(records) ? records : [];
  if (!rows.length) throw new Error('There are no records available in your permitted branches to export.');
  const headers = [...new Set(rows.flatMap(row => Object.keys(row || {})))];
  const csv = `\uFEFF${[headers.map(quoteCsv).join(','), ...rows.map(row => headers.map(key => quoteCsv(row?.[key])).join(','))].join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function AssetPreferences() {
  const [account, setAccount] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tpoData') || '{}') || {}; } catch { return {}; }
  });
  const [tab, setTab] = useState('profile');
  const [appearance, setAppearance] = useState(readAppearance);
  const [appearanceNotice, setAppearanceNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const [busyReport, setBusyReport] = useState('');
  const [notice, setNotice] = useState(null);
  const fileInput = useRef(null);
  const photo = getDriveImage(account.photo || account.profilePhoto);
  const initials = useMemo(() => String(account.name || account.email || 'Staff').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase(), [account]);
  const accessBranch = account.sittingBranch || (Array.isArray(account.assignedBranchesArray) ? account.assignedBranchesArray.join(', ') : account.assignedBranchesArray) || 'Branches allowed for your account';

  const updateAppearance = changes => {
    const next = { ...appearance, ...changes };
    setAppearance(next);
    applyAppearance(next);
    saveAppearance(next);
    setAppearanceNotice('Saved on this device. It will be used across the portal.');
  };

  const handlePhotoSelect = async event => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) return setNotice({ type: 'error', text: 'Choose a JPG, PNG, or other image file.' });
    if (file.size > 8 * 1024 * 1024) return setNotice({ type: 'error', text: 'Choose an image smaller than 8 MB.' });
    setUploading(true);
    setNotice(null);
    const formData = new FormData();
    formData.append('email', account.email || '');
    formData.append('loginId', account.loginId || '');
    formData.append('photo', file);
    try {
      const response = await axios.post(`${API_BASE}/api/tpo/profile/update-photo`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (!response.data?.success || !response.data?.photoUrl) throw new Error(response.data?.message || 'The profile image did not save.');
      const updated = { ...account, photo: response.data.photoUrl };
      localStorage.setItem('tpoData', JSON.stringify(updated));
      setAccount(updated);
      window.dispatchEvent(new Event('portal-account-updated'));
      setNotice({ type: 'success', text: 'Profile photo saved. It is now visible in the asset workspace.' });
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || error.message || 'Could not update the profile photo.' });
    } finally { setUploading(false); }
  };

  const exportReport = async report => {
    setBusyReport(report.id);
    setNotice(null);
    try {
      const response = await axios.get(`${API_BASE}${report.endpoint}`);
      if (!response.data?.success) throw new Error(response.data?.message || 'Could not load this report.');
      const rows = response.data[report.key] || [];
      const stamp = new Date().toISOString().slice(0, 10);
      downloadCsv(`asset-${report.id}-${stamp}.csv`, rows);
      setNotice({ type: 'success', text: `${report.label} CSV downloaded (${rows.length.toLocaleString('en-IN')} rows).` });
    } catch (error) {
      setNotice({ type: 'error', text: error.response?.data?.message || error.message || `Could not download ${report.label}.` });
    } finally { setBusyReport(''); }
  };

  return <Layout><main className="asset-preferences-page">
    <header className="asset-preferences-hero">
      <div><span className="asset-preferences-kicker"><i /> YOUR WORKSPACE</span><h1>Make it <em>yours.</em></h1><p>Manage your profile, set the look and feel, and export the asset records available to your account.</p></div>
      <div className="asset-preferences-hero-icon"><PaintBrush size={35} weight="duotone" /><span /><i /></div>
    </header>

    <nav className="asset-preferences-tabs" aria-label="Workspace settings">
      {[['profile', 'Profile'], ['appearance', 'Appearance'], ['reports', 'Download reports']].map(([id, label]) => <button key={id} type="button" className={tab === id ? 'active' : ''} onClick={() => { setTab(id); setNotice(null); }}>
        {id === 'profile' ? <Camera size={18} /> : id === 'appearance' ? <PaintBrush size={18} /> : <DownloadSimple size={18} />}{label}
      </button>)}
      {isPortalAdminAccount(account) && <Link to="/assets/setup"><Gear size={18} /> Asset setup</Link>}
    </nav>

    {notice && <div className={`asset-preferences-notice ${notice.type}`} role={notice.type === 'error' ? 'alert' : 'status'}>{notice.type === 'success' ? <CheckCircle size={19} weight="fill" /> : <WarningCircle size={19} weight="fill" />}{notice.text}</div>}

    {tab === 'profile' && <section className="asset-preferences-card asset-profile-card">
      <div className="asset-preferences-section-head"><div><span>ACCOUNT</span><h2>Your profile</h2><p>Your role and branch access come from your portal account.</p></div><span className="asset-settings-badge">Staff profile</span></div>
      <div className="asset-profile-layout">
        <div className="asset-profile-photo-area"><div className="asset-profile-photo">{photo ? <img src={photo} alt={`${account.name || 'Your'} profile`} /> : <span>{initials}</span>}</div><button type="button" className="asset-photo-change" onClick={() => fileInput.current?.click()} disabled={uploading}>{uploading ? <CircleNotch size={17} className="ph-spin" /> : <Camera size={17} weight="fill" />}{uploading ? 'Saving photo…' : 'Change photo'}</button><input ref={fileInput} type="file" accept="image/*" onChange={handlePhotoSelect} hidden /><small>Image file · up to 8 MB · visible across the portal</small></div>
        <div className="asset-profile-fields"><label><span>Full name</span><input readOnly value={account.name || 'Staff member'} /></label><label><span>Official email</span><input readOnly value={account.email || ''} /></label><label><span>Role</span><input readOnly value={account.role || 'Asset workspace'} /></label><label><span>Branch access</span><input readOnly value={accessBranch} /></label><p>Need to update your name, role, or branch permissions? Contact a portal administrator.</p></div>
      </div>
    </section>}

    {tab === 'appearance' && <section className="asset-preferences-card">
      <div className="asset-preferences-section-head"><div><span>DISPLAY</span><h2>Appearance</h2><p>Choose a display mode and accent color. These preferences are saved in this browser.</p></div><PaintBrush size={23} /></div>
      <div className="asset-appearance-block"><h3>Display mode</h3><div className="asset-mode-options">{[{ id: 'dark', label: 'Dark', icon: Moon }, { id: 'light', label: 'Light', icon: Sun }].map(option => { const Icon = option.icon; return <button type="button" key={option.id} className={appearance.theme === option.id ? 'active' : ''} aria-pressed={appearance.theme === option.id} onClick={() => updateAppearance({ theme: option.id })}><span><Icon size={22} /></span><b>{option.label}</b>{appearance.theme === option.id && <CheckCircle size={18} weight="fill" />}</button>; })}</div></div>
      <div className="asset-appearance-block"><h3>Accent color</h3><div className="asset-accent-options">{ACCENT_OPTIONS.map(option => <button type="button" key={option.id} className={appearance.accent === option.id ? 'active' : ''} aria-pressed={appearance.accent === option.id} onClick={() => updateAppearance({ accent: option.id })}><i style={{ background: option.color }} /><span>{option.label}</span>{appearance.accent === option.id && <CheckCircle size={17} weight="fill" />}</button>)}</div></div>
      {appearanceNotice && <p className="asset-appearance-saved" role="status"><CheckCircle size={17} weight="fill" />{appearanceNotice}</p>}
    </section>}

    {tab === 'reports' && <section className="asset-preferences-card">
      <div className="asset-preferences-section-head"><div><span>EXPORTS</span><h2>Download asset reports</h2><p>Export CSV files using the same branch access rules as the asset workspace. Each file contains the latest data returned by the portal.</p></div><FileCsv size={25} /></div>
      <div className="asset-report-grid">{reportOptions.map(report => { const Icon = report.icon; return <article className={`asset-report-card ${report.tone}`} key={report.id}><span className="asset-report-icon"><Icon size={21} weight="duotone" /></span><div><h3>{report.label}</h3><p>{report.detail}</p></div><button type="button" onClick={() => void exportReport(report)} disabled={Boolean(busyReport)}>{busyReport === report.id ? <CircleNotch size={17} className="ph-spin" /> : <DownloadSimple size={17} />}{busyReport === report.id ? 'Preparing…' : 'Download CSV'}</button></article>; })}</div>
      <p className="asset-export-scope"><Buildings size={16} /> Exports include only data the signed-in account is permitted to view.</p>
    </section>}
  </main></Layout>;
}
