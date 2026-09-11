import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, PencilSimple, PaperPlaneRight, FilePdf, X, FloppyDisk, 
  CheckCircle, WarningCircle, Handshake, Clock, ArrowSquareOut, 
  MapPinLine, UserCircle, EnvelopeSimple, Phone, Buildings, IdentificationCard, Plus
} from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

const ClientLogo = ({ client, size = 70, noMargin = false }) => {
  const [imgErr, setImgErr] = useState(false);
  
  const getDriveImage = (url) => {
    if (!url) return null;
    const match = url.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
    return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
  };

  const logoUrl = getDriveImage(client.logo);
  const initial = String(client.companyName || 'C').charAt(0).toUpperCase();

  return (
    <div className="client-logo-box" style={{ width: `${size}px`, height: `${size}px`, marginBottom: noMargin ? '0' : '15px' }}>
      {(!logoUrl || imgErr) ? (
        <div className="client-fallback">{initial}</div>
      ) : (
        <img src={logoUrl} alt="Logo" onError={() => setImgErr(true)} />
      )}
    </div>
  );
};

export default function Clients() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  const upperRole = String(tpoData?.role || '').toUpperCase();
  const accessType = String(tpoData?.accessType || '').toLowerCase();
  
  const isSuperAdmin = accessType === 'superadmin' || upperRole.includes('ADMIN') || upperRole.includes('HEAD') || upperRole.includes('MANAGER');
  
  // 🚨 RESTRICT ACCESS: TPO ONLY (NO ADMINS)
  const isTpo = upperRole.includes('TPO');
  const canManageClients = isTpo && !isSuperAdmin;

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('Signed'); 

  // Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [editForm, setEditForm] = useState({});
  
  // New Add Client Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addForm, setAddForm] = useState({ companyName: '', website: '', location: '', phone: '', email: '', contactPerson: '', logoFile: null });

  const [savingStatus, setSavingStatus] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(null);
  const [notification, setNotification] = useState(null);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => { 
    const fetchClientsInitial = async () => {
      const localStr = localStorage.getItem('tpoData');
      if (!localStr) return;
      const localTpo = JSON.parse(localStr);
      const isSA = localTpo.accessType === 'superadmin' || String(localTpo.role||'').toUpperCase().includes('ADMIN');

      const cached = localStorage.getItem('dash_clients');
      if (cached) { setClients(JSON.parse(cached)); setLoading(false); }

      try {
        const payload = { tpoName: isSA ? '' : localTpo.name };
        const res = await axios.post(`${API_BASE}/api/tpo/clients`, payload);
        if (res.data.success) {
          setClients(res.data.clients || []);
          localStorage.setItem('dash_clients', JSON.stringify(res.data.clients || [])); 
        }
      } catch (err) { console.error("Failed to fetch clients:", err); } 
      finally { setLoading(false); }
    };
    fetchClientsInitial(); 
  }, []); 

  const fetchClientsManual = async () => {
    try {
      const payload = { tpoName: isSuperAdmin ? '' : tpoData.name };
      const res = await axios.post(`${API_BASE}/api/tpo/clients`, payload);
      if (res.data.success) {
        setClients(res.data.clients || []);
        localStorage.setItem('dash_clients', JSON.stringify(res.data.clients || [])); 
      }
    } catch (err) { console.error(err); }
  };

  // 🚨 ADD NEW CLIENT HANDLER
  const submitAddClient = async () => {
    if (!addForm.companyName) return showToast("Company Name is required", "error");
    setSavingStatus(true);
    try {
      const formData = new FormData();
      formData.append('tpoName', tpoData.name);
      formData.append('companyName', addForm.companyName);
      formData.append('website', addForm.website);
      formData.append('location', addForm.location);
      formData.append('phone', addForm.phone);
      formData.append('email', addForm.email);
      formData.append('contactPerson', addForm.contactPerson);
      if (addForm.logoFile) formData.append('logoFile', addForm.logoFile);

      const res = await axios.post(`${API_BASE}/api/tpo/clients/add`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      if(res.data.success) {
        setIsAddModalOpen(false);
        setAddForm({ companyName: '', website: '', location: '', phone: '', email: '', contactPerson: '', logoFile: null });
        showToast("New Hiring Partner added successfully!");
        fetchClientsManual();
      }
    } catch (error) { showToast(`Failed to add: ${error.response?.data?.message || error.message}`, 'error'); } 
    finally { setSavingStatus(false); }
  };

  const openEditModal = (client) => {
    setSelectedClient(client);
    setEditForm({ email: client.email, phone: client.contact, location: client.location, contactPerson: client.contactPerson, logoFile: null });
    setIsEditModalOpen(true);
  };

  const submitEdit = async () => {
    setSavingStatus(true);
    try {
      const formData = new FormData();
      formData.append('rowNumber', selectedClient.rowNumber);
      formData.append('email', editForm.email);
      formData.append('phone', editForm.phone);
      formData.append('location', editForm.location);
      formData.append('contactPerson', editForm.contactPerson);
      formData.append('logo', selectedClient.logo);
      if (editForm.logoFile) formData.append('logoFile', editForm.logoFile);

      const res = await axios.post(`${API_BASE}/api/tpo/clients/update`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      if(res.data.success) {
        setIsEditModalOpen(false);
        showToast("Company details updated successfully!");
        fetchClientsManual();
      }
    } catch (error) { showToast(`Failed to update: ${error.response?.data?.message || error.message}`, 'error'); } 
    finally { setSavingStatus(false); }
  };

  const sendRequest = async (client) => {
    if(!client.email) return showToast("Company Mail ID is missing. Please click 'Edit' and add an email first.", 'error');
    setSendingRequest(client.rowNumber);
    try {
      const response = await axios.post(`${API_BASE}/api/tpo/clients/request-mou`, {
        rowNumber: client.rowNumber, companyEmail: client.email, companyName: client.companyName
      });
      if (response.data.success) {
        showToast(`Email sent successfully to ${client.companyName}!`);
        fetchClientsManual(); 
      }
    } catch (error) { showToast(`Failed to send request: ${error.response?.data?.message || error.message}`, 'error'); } 
    finally { setSendingRequest(null); }
  };

  const filteredClients = clients.filter(c => {
    const matchSearch = String(c.companyName || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                        String(c.location || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const isSigned = String(c.documentStatus || '').toLowerCase() === 'completed' || Boolean(c.mouLink);
    const tabMatch = activeTab === 'Signed' ? isSigned : !isSigned;

    return matchSearch && tabMatch;
  });

  const totalPartners = clients.length;
  const totalSigned = clients.filter(c => String(c.documentStatus || '').toLowerCase() === 'completed' || Boolean(c.mouLink)).length;
  const totalPending = totalPartners - totalSigned;
  const uniqueTPOs = new Set(clients.map(c => c.tpoName || 'Unknown').filter(n => n !== 'Unknown')).size;

  return (
    <Layout>
      <div className="premium-dashboard-wrapper page-container" style={{ maxWidth: '1600px', margin: '0 auto', paddingBottom: '50px' }}>
        
        {/* HERO SECTION */}
        <div className="top-hero-section">
          <div className="hero-text">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Handshake color="#38bdf8" weight="fill" /> Hiring Partners & MOUs</h1>
            <p>Directory of corporate partners and countersigned institutional agreements.</p>
          </div>
          {/* 🚨 TPO ONLY: ADD PARTNER BUTTON */}
          {canManageClients && (
            <button className="premium-btn primary hover-lift" onClick={() => setIsAddModalOpen(true)}>
              <Plus weight="bold" size={20} /> Add Partner
            </button>
          )}
        </div>

        {/* 🚨 ADMIN MINI-DASHBOARD */}
        {isSuperAdmin && (
          <div className="mini-dash-grid">
            <div className="kpi-card glass-panel hover-lift">
              <div className="kpi-top"><div><div className="kpi-title">Total Partners</div><div className="kpi-val">{totalPartners}</div></div><div className="kpi-icon blue"><Buildings weight="fill" size={26}/></div></div>
            </div>
            <div className="kpi-card glass-panel hover-lift">
              <div className="kpi-top"><div><div className="kpi-title">Signed MOUs</div><div className="kpi-val">{totalSigned}</div></div><div className="kpi-icon green"><CheckCircle weight="fill" size={26}/></div></div>
            </div>
            <div className="kpi-card glass-panel hover-lift">
              <div className="kpi-top"><div><div className="kpi-title">Pending MOUs</div><div className="kpi-val">{totalPending}</div></div><div className="kpi-icon orange"><Clock weight="fill" size={26}/></div></div>
            </div>
            <div className="kpi-card glass-panel hover-lift">
              <div className="kpi-top"><div><div className="kpi-title">Active TPOs</div><div className="kpi-val">{uniqueTPOs}</div></div><div className="kpi-icon purple"><IdentificationCard weight="fill" size={26}/></div></div>
            </div>
          </div>
        )}

        {/* CONTROLS (TABS & SEARCH) */}
        <div className="glass-panel control-action-bar" style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="segmented-tabs">
            <button className={`seg-tab ${activeTab === 'Signed' ? 'active-green' : ''}`} onClick={() => setActiveTab('Signed')}>Signed MOUs</button>
            <button className={`seg-tab ${activeTab === 'Pending' ? 'active-orange' : ''}`} onClick={() => setActiveTab('Pending')}>Pending Signatures</button>
          </div>
          
          <div className="filter-group">
            <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
              <input type="text" className="premium-input" placeholder="Search company name or location..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', paddingLeft: '40px' }} />
              <Buildings size={18} style={{ position: 'absolute', left: '15px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            </div>
          </div>
        </div>

        {/* CLIENT CARDS GRID */}
        {loading ? (
          <div className="empty-state-card"><CircleNotch size={40} className="ph-spin text-blue" /><p>Fetching corporate partners...</p></div>
        ) : filteredClients.length === 0 ? (
          <div className="empty-state-card"><span style={{ fontSize: '2.5rem', marginBottom: '10px', display: 'block' }}>🏢</span>No companies found in this category.</div>
        ) : (
          <div className="client-grid">
            {filteredClients.map((c, i) => {
              const isSigned = String(c.documentStatus || '').toLowerCase() === 'completed' || Boolean(c.mouLink);
              return (
                <div key={i} className="client-card glass-panel hover-lift">
                  
                  <div className="client-header">
                    <ClientLogo client={c} size={80} />
                    <h3 className="client-name">{c.companyName || 'Unknown Company'}</h3>
                    <div className="client-loc"><MapPinLine size={14} /> {c.location || 'Location Not Specified'}</div>
                  </div>

                  {/* ADMIN ONLY: HIDDEN DETAILS */}
                  {isSuperAdmin && (
                    <div className="admin-client-details">
                      <div className="acd-item"><UserCircle size={16} /> <span>{c.contactPerson || 'No Name'}</span></div>
                      <div className="acd-item"><Phone size={16} /> <span>{c.contact || 'No Phone'}</span></div>
                      <div className="acd-item"><EnvelopeSimple size={16} /> <span style={{ wordBreak: 'break-all' }}>{c.email || 'No Email'}</span></div>
                      <div className="acd-tpo">Managed by: <strong>{c.tpoName || 'Unknown'}</strong></div>
                    </div>
                  )}

                  <div className="client-footer">
                    {isSigned ? (
                      <button className="mou-btn signed-btn" onClick={() => c.mouLink && window.open(c.mouLink, '_blank')}>
                        <FilePdf size={18} weight="fill" /> Open Signed MOU <ArrowSquareOut size={14} />
                      </button>
                    ) : (
                      <div className="pending-footer">
                        {/* 🚨 TPO ONLY: BUTTONS */}
                        {canManageClients ? (
                          <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                            <button className="mou-btn edit-btn" onClick={() => openEditModal(c)}>
                              <PencilSimple size={18} weight="bold" /> Edit
                            </button>
                            <button className={`mou-btn request-btn ${c.mailStatus === 'Request Sent' ? 'sent' : ''}`} onClick={() => sendRequest(c)} disabled={sendingRequest === c.rowNumber}>
                              {sendingRequest === c.rowNumber ? <CircleNotch className="ph-spin" size={18} /> : <><PaperPlaneRight size={18} weight="fill" /> {c.mailStatus === 'Request Sent' ? 'Resend' : 'Send MOU'}</>}
                            </button>
                          </div>
                        ) : (
                          /* ADMINS / TRAINERS ONLY SEE STATUS PENDANT */
                          <div className="mou-btn pending-btn"><Clock size={18} weight="bold"/> Signature Pending</div>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 🚨 ADD CLIENT MODAL */}
      {isAddModalOpen && (
        <div className="modal-backdrop" onClick={(e) => { if(e.target === e.currentTarget) setIsAddModalOpen(false); }}>
          <div className="premium-modal glass-panel" style={{ maxWidth: '550px', padding: '30px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.5rem', color: '#fff' }}>Add New Partner</h2>
                <div className="modal-subtitle">Add a new company to the directory</div>
              </div>
              <button className="close-btn" onClick={() => setIsAddModalOpen(false)}><X size={24} /></button>
            </div>
            
            <div style={{ display: 'grid', gap: '15px', marginBottom: '20px' }}>
              <div><label className="data-label">Company Name *</label><input type="text" className="premium-input" style={{width:'100%'}} placeholder="e.g. Google India" value={addForm.companyName} onChange={e=>setAddForm({...addForm, companyName: e.target.value})} /></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div><label className="data-label">Contact Person</label><input type="text" className="premium-input" style={{width:'100%'}} placeholder="HR Manager Name" value={addForm.contactPerson} onChange={e=>setAddForm({...addForm, contactPerson: e.target.value})} /></div>
                <div><label className="data-label">Contact Number</label><input type="text" className="premium-input" style={{width:'100%'}} placeholder="+91 XXXXX XXXXX" value={addForm.phone} onChange={e=>setAddForm({...addForm, phone: e.target.value})} /></div>
              </div>
              <div><label className="data-label">Company Email</label><input type="email" className="premium-input" style={{width:'100%'}} placeholder="hr@company.com" value={addForm.email} onChange={e=>setAddForm({...addForm, email: e.target.value})} /></div>
              <div><label className="data-label">Location / State</label><input type="text" className="premium-input" style={{width:'100%'}} placeholder="e.g. Bangalore, Karnataka" value={addForm.location} onChange={e=>setAddForm({...addForm, location: e.target.value})} /></div>
              <div><label className="data-label">Company Website</label><input type="url" className="premium-input" style={{width:'100%'}} placeholder="https://..." value={addForm.website} onChange={e=>setAddForm({...addForm, website: e.target.value})} /></div>
              <div>
                <label className="data-label">Upload Company Logo</label>
                <input type="file" accept="image/*" className="premium-input" style={{width:'100%', padding: '8px'}} onChange={e=>setAddForm({...addForm, logoFile: e.target.files[0]})} />
              </div>
            </div>

            <button className="premium-btn primary" style={{ width: '100%', padding: '14px', fontSize: '1rem' }} onClick={submitAddClient} disabled={savingStatus || !addForm.companyName}>
              {savingStatus ? <CircleNotch size={20} className="ph-spin" /> : <><Buildings size={20} weight="bold"/> Register Partner</>}
            </button>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {isEditModalOpen && selectedClient && (
        <div className="modal-backdrop" onClick={(e) => { if(e.target === e.currentTarget) setIsEditModalOpen(false); }}>
          <div className="premium-modal glass-panel" style={{ maxWidth: '500px', padding: '30px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ fontSize: '1.4rem' }}>Edit Details</h2>
                <div className="modal-subtitle">{selectedClient.companyName}</div>
              </div>
              <button className="close-btn" onClick={() => setIsEditModalOpen(false)}><X size={24} /></button>
            </div>
            
            <div style={{ display: 'grid', gap: '15px', marginBottom: '20px' }}>
              <div><label className="data-label">Company Email</label><input type="email" className="premium-input" style={{width:'100%'}} value={editForm.email} onChange={e=>setEditForm({...editForm, email: e.target.value})} /></div>
              <div><label className="data-label">Contact Number</label><input type="text" className="premium-input" style={{width:'100%'}} value={editForm.phone} onChange={e=>setEditForm({...editForm, phone: e.target.value})} /></div>
              <div><label className="data-label">Location</label><input type="text" className="premium-input" style={{width:'100%'}} value={editForm.location} onChange={e=>setEditForm({...editForm, location: e.target.value})} /></div>
              <div><label className="data-label">Contact Person</label><input type="text" className="premium-input" style={{width:'100%'}} value={editForm.contactPerson} onChange={e=>setEditForm({...editForm, contactPerson: e.target.value})} /></div>
              <div>
                <label className="data-label">Upload Company Logo</label>
                <input type="file" accept="image/*" className="premium-input" style={{width:'100%', padding: '8px'}} onChange={e=>setEditForm({...editForm, logoFile: e.target.files[0]})} />
              </div>
            </div>

            <button className="premium-btn primary" style={{ width: '100%', padding: '12px' }} onClick={submitEdit} disabled={savingStatus}>
              {savingStatus ? <CircleNotch size={20} className="ph-spin" /> : <><FloppyDisk size={20} weight="bold"/> Save Updates</>}
            </button>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {notification && (
        <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 999999, backgroundColor: notification.type === 'success' ? '#10b981' : '#ef4444', color: '#ffffff', padding: '16px 24px', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1rem', fontWeight: 'bold' }}>
          {notification.type === 'success' ? <CheckCircle size={24} weight="fill" /> : <WarningCircle size={24} weight="fill" />}
          {notification.message}
        </div>
      )}

      {/* ---------------------------------------------------------
          🎨 PREMIUM CSS FOR CLIENTS PAGE
      --------------------------------------------------------- */}
      <style>{`
        .premium-dashboard-wrapper { font-family: 'Inter', sans-serif; color: #f8fafc; }
        .glass-panel { background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .hover-lift { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); cursor: pointer; }
        .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.7); border-color: rgba(255, 255, 255, 0.1); background: rgba(30, 41, 59, 0.8); }

        .top-hero-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 20px;}
        .hero-text h1 { font-size: 2.2rem; font-weight: 800; margin: 0 0 5px 0; color: #fff; }
        .hero-text p { color: #94a3b8; margin: 0; font-size: 1rem; }
        
        .premium-btn { border: none; padding: 10px 20px; border-radius: 12px; font-weight: bold; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; cursor: pointer; }
        .premium-btn.primary { background: #3b82f6; color: #fff; }
        .premium-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .mini-dash-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px; }
        .kpi-card { border-radius: 16px; padding: 20px; }
        .kpi-top { display: flex; justify-content: space-between; align-items: flex-start; }
        .kpi-title { font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
        .kpi-val { font-size: 2rem; font-weight: 900; color: #fff; line-height: 1; }
        .kpi-icon { width: 45px; height: 45px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 2px 10px rgba(255,255,255,0.05); }
        .kpi-icon.blue { background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); }
        .kpi-icon.green { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .kpi-icon.orange { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
        .kpi-icon.purple { background: rgba(168, 85, 247, 0.15); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.3); }

        .control-action-bar { border-radius: 16px; padding: 15px; margin-bottom: 30px; display: flex; gap: 15px; }
        .segmented-tabs { display: flex; background: rgba(0,0,0,0.3); padding: 5px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05); }
        .seg-tab { background: transparent; border: none; padding: 10px 24px; color: #94a3b8; font-weight: bold; font-size: 0.95rem; border-radius: 8px; cursor: pointer; transition: 0.3s; }
        .seg-tab.active-green { background: #10b981; color: #fff; box-shadow: 0 4px 10px rgba(16,185,129,0.3); }
        .seg-tab.active-orange { background: #f59e0b; color: #fff; box-shadow: 0 4px 10px rgba(245,158,11,0.3); }
        
        .premium-input { background: rgba(0,0,0,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px 15px; font-size: 0.9rem; outline: none; transition: 0.2s; width: 100%; box-sizing: border-box; }
        .premium-input:focus { border-color: #3b82f6; background: rgba(0,0,0,0.4); }

        .client-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 20px; }
        .client-card { border-radius: 20px; padding: 25px; display: flex; flex-direction: column; justify-content: space-between; }
        
        .client-header { display: flex; flex-direction: column; align-items: center; text-align: center; margin-bottom: 20px; }
        .client-logo-box { width: 80px; height: 80px; border-radius: 20px; background: #0f1523; border: 2px solid #1e293b; margin-bottom: 15px; display: flex; align-items: center; justify-content: center; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.3); }
        .client-logo-box img { width: 100%; height: 100%; object-fit: contain; }
        .client-fallback { font-size: 2.2rem; font-weight: 900; color: #fff; background: linear-gradient(135deg, #3b82f6, #8b5cf6); width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
        .client-name { margin: 0 0 5px 0; font-size: 1.15rem; color: #fff; font-weight: 800; line-height: 1.3; }
        .client-loc { color: #94a3b8; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 5px; }

        .admin-client-details { background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.02); border-radius: 12px; padding: 12px; margin-bottom: 20px; display: flex; flex-direction: column; gap: 8px; }
        .acd-item { display: flex; align-items: center; gap: 8px; color: #cbd5e1; font-size: 0.8rem; }
        .acd-item svg { color: #64748b; flex-shrink: 0; }
        .acd-tpo { margin-top: 5px; padding-top: 8px; border-top: 1px solid rgba(255,255,255,0.05); font-size: 0.75rem; color: #94a3b8; text-align: center; }
        .acd-tpo strong { color: #a855f7; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }

        .client-footer { margin-top: auto; }
        .mou-btn { width: 100%; padding: 10px; border-radius: 10px; font-weight: bold; font-size: 0.85rem; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; text-decoration: none; transition: 0.2s; border: none; }
        .signed-btn { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .signed-btn:hover { background: #10b981; color: #fff; }
        
        .pending-footer { display: flex; flex-direction: column; gap: 10px; width: 100%; }
        .edit-btn { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); flex: 1; }
        .edit-btn:hover { background: rgba(255,255,255,0.1); }
        .request-btn { background: #3b82f6; color: #fff; flex: 2; }
        .request-btn:hover { background: #2563eb; transform: translateY(-2px); }
        .request-btn.sent { background: #f59e0b; color: #000; }
        .pending-btn { background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); cursor: default; }

        .data-label { color: #94a3b8; font-size: 0.8rem; font-weight: bold; margin-bottom: 5px; display: block; }
        
        .empty-state-card { background: rgba(15, 23, 42, 0.5); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px; padding: 50px 20px; text-align: center; color: #94a3b8; font-size: 1.1rem; font-weight: bold; }

        .modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); z-index: 99999; display: flex; justify-content: center; align-items: center; padding: 20px; }
        .premium-modal { width: 100%; max-height: 90vh; overflow-y: auto; border-radius: 24px; padding: 30px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); }
        .modal-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 15px; margin-bottom: 20px; }
        .modal-header h2 { margin: 0 0 5px 0; font-size: 1.6rem; color: #fff; font-weight: 800; }
        .modal-subtitle { color: #38bdf8; font-weight: bold; font-size: 1.1rem; }
        .close-btn { background: none; border: none; color: #64748b; cursor: pointer; transition: 0.2s; display: flex; }
        .close-btn:hover { color: #ef4444; transform: scale(1.1); }
      `}</style>
    </Layout>
  );
}