import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, PencilSimple, PaperPlaneRight, FilePdf, X, FloppyDisk, 
  CheckCircle, WarningCircle, Handshake, Clock, FileText, ArrowSquareOut, MapPin
} from '@phosphor-icons/react';
import Layout from './Layout';

const API_BASE = "https://ipcs-tpo-portal-u0l6.onrender.com";

export default function Clients() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const isSuperAdmin = tpoData?.accessType === 'superadmin';
  const isTpo = (tpoData?.role || '').toUpperCase() === 'TPO';

  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // TPO Tabs: 'pending' vs 'signed'
  const [tpoTab, setTpoTab] = useState('pending');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingStatus, setSavingStatus] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(null);
  const [notification, setNotification] = useState(null);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  useEffect(() => { 
    if (tpoData) fetchClients(); 
  }, [tpoData]);

  const fetchClients = async () => {
    try {
      // 🚨 Super Admins & Non-TPOs fetch ALL clients globally
      const payload = { tpoName: isSuperAdmin || !isTpo ? '' : tpoData.name };
      const res = await axios.post(`${API_BASE}/api/tpo/clients`, payload);
      if (res.data.success) setClients(res.data.clients || []);
    } catch (err) { 
      console.error("Failed to fetch clients:", err); 
    } finally { 
      setLoading(false); 
    }
  };

  const getDriveImage = (url) => {
    if (!url) return null;
    const match = url.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
    return match ? `https://drive.google.com/thumbnail?id=${match[1]}&sz=w400` : url;
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
        fetchClients();
      }
    } catch (error) { 
      showToast(`Failed to update: ${error.response?.data?.message || error.message}`, 'error'); 
    } finally { 
      setSavingStatus(false); 
    }
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
        fetchClients(); 
      }
    } catch (error) { 
      showToast(`Failed to send request: ${error.response?.data?.message || error.message}`, 'error'); 
    } finally { 
      setSendingRequest(null); 
    }
  };

  // Filter Logic
  const filteredClients = clients.filter(c => 
    (c.companyName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (c.location || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const pendingClients = filteredClients.filter(c => c.documentStatus !== 'Completed');
  const signedClients = filteredClients.filter(c => c.documentStatus === 'Completed' || Boolean(c.mouLink));

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Handshake color="var(--accent-primary)" weight="fill" /> Hiring Partners & MOUs
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>
              {isTpo 
                ? "Track partnership requests, update company profiles, and manage signed MOUs." 
                : "Directory of corporate partners and countersigned institutional agreements."}
            </p>
          </div>
        </div>

        {/* TPO SLIDABLE TABS */}
        {isTpo && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
            <button 
              onClick={() => setTpoTab('pending')}
              style={{ background: tpoTab === 'pending' ? 'rgba(56, 189, 248, 0.1)' : 'transparent', color: tpoTab === 'pending' ? 'var(--accent-primary)' : 'var(--text-muted)', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s' }}
            >
              <Clock size={20} weight={tpoTab === 'pending' ? "fill" : "regular"} /> Pending Requests & Outreach ({pendingClients.length})
            </button>
            <button 
              onClick={() => setTpoTab('signed')}
              style={{ background: tpoTab === 'signed' ? 'rgba(16, 185, 129, 0.1)' : 'transparent', color: tpoTab === 'signed' ? '#10b981' : 'var(--text-muted)', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px', transition: '0.2s' }}
            >
              <FileText size={20} weight={tpoTab === 'signed' ? "fill" : "regular"} /> Signed MOUs ({signedClients.length})
            </button>
          </div>
        )}

        <div style={{ marginBottom: '20px', maxWidth: '400px' }}>
          <input 
            type="text" 
            className="sleek-input" 
            placeholder="Search company name or location..." 
            style={{ width: '100%' }} 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
          />
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '3rem', color: '#38bdf8' }}><CircleNotch size={40} className="ph-spin" /></div>
        ) : (
          <>
            {/* VIEW 1: SUPER ADMIN & NON-TPO PARTNERS GRID */}
            {!isTpo && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {filteredClients.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No hiring partners registered.</div>
                ) : (
                  filteredClients.map(client => (
                    <div 
                      key={client.rowNumber} 
                      onClick={() => client.mouLink && window.open(client.mouLink, '_blank')}
                      style={{ 
                        background: 'var(--card-bg)', 
                        border: '1px solid var(--card-border)', 
                        borderRadius: '16px', 
                        padding: '1.5rem', 
                        display: 'flex', 
                        flexDirection: 'column', 
                        alignItems: 'center', 
                        textAlign: 'center',
                        cursor: client.mouLink ? 'pointer' : 'default',
                        transition: '0.2s',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
                      }}
                      onMouseEnter={(e) => { if(client.mouLink) { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.borderColor = 'var(--accent-primary)'; } }}
                      onMouseLeave={(e) => { if(client.mouLink) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = 'var(--card-border)'; } }}
                    >
                      <div style={{ width: '70px', height: '70px', borderRadius: '12px', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', padding: '6px' }}>
                        {client.logo ? <img src={getDriveImage(client.logo)} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="Logo" /> : <span style={{ color: '#0f172a', fontWeight: 'bold', fontSize: '1.5rem' }}>{client.companyName.charAt(0)}</span>}
                      </div>

                      <h3 style={{ margin: '0 0 4px 0', fontSize: '1.15rem', color: '#fff' }}>{client.companyName}</h3>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '15px' }}>
                        <MapPin size={14} /> {client.location || 'Location N/A'}
                      </span>

                      <div style={{ marginTop: 'auto', width: '100%' }}>
                        {client.mouLink ? (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid #10b981', padding: '8px 16px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold', width: '100%', justifyContent: 'center' }}>
                            <FilePdf size={18} weight="fill" /> Open Signed MOU <ArrowSquareOut size={16} />
                          </div>
                        ) : (
                          <div style={{ display: 'inline-block', background: 'var(--bg-dark)', color: 'var(--text-muted)', border: '1px solid var(--card-border)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.75rem', width: '100%' }}>
                            MOU In Progress
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* VIEW 2: TPO TAB 1 - PENDING OUTREACH & REQUESTS */}
            {isTpo && tpoTab === 'pending' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                {pendingClients.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No pending MOU requests.</div>
                ) : (
                  pendingClients.map(client => (
                    <div key={client.rowNumber} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                        <div style={{ width: '55px', height: '55px', borderRadius: '8px', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px' }}>
                          {client.logo ? <img src={getDriveImage(client.logo)} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="Logo" /> : <span style={{ color: '#000', fontWeight: 'bold' }}>{client.companyName.charAt(0)}</span>}
                        </div>
                        <div>
                          <strong style={{ fontSize: '1.1rem', color: '#fff', display: 'block' }}>{client.companyName}</strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{client.location || 'Location N/A'}</span>
                        </div>
                      </div>

                      <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                        <div style={{ marginBottom: '4px' }}>👤 {client.contactPerson || 'No Contact Person'}</div>
                        <div style={{ marginBottom: '4px' }}>✉️ {client.email || 'No Email'}</div>
                        <div>📞 {client.contact || 'No Phone'}</div>
                      </div>

                      <div style={{ marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid var(--card-border)', display: 'flex', gap: '10px' }}>
                        <button className="btn-secondary" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '5px' }} onClick={() => openEditModal(client)}>
                          <PencilSimple weight="bold" size={16} /> Edit
                        </button>
                        <button className="btn-action" style={{ flex: 1.5, display: 'flex', justifyContent: 'center', gap: '5px', background: client.mailStatus === 'Request Sent' ? '#f59e0b' : '#10b981', color: client.mailStatus === 'Request Sent' ? '#000' : '#fff' }} onClick={() => sendRequest(client)} disabled={sendingRequest === client.rowNumber}>
                          {sendingRequest === client.rowNumber ? <CircleNotch className="ph-spin" size={16} /> : <><PaperPlaneRight weight="fill" size={16} /> {client.mailStatus === 'Request Sent' ? 'Resend' : 'Send MOU'}</>}
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* VIEW 3: TPO TAB 2 - SIGNED MOUS */}
            {isTpo && tpoTab === 'signed' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {signedClients.length === 0 ? (
                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No completed MOUs logged yet.</div>
                ) : (
                  signedClients.map(client => (
                    <div key={client.rowNumber} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
                      <div style={{ width: '65px', height: '65px', borderRadius: '10px', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px', padding: '6px' }}>
                        {client.logo ? <img src={getDriveImage(client.logo)} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="Logo" /> : <span style={{ color: '#000', fontWeight: 'bold' }}>{client.companyName.charAt(0)}</span>}
                      </div>
                      <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', color: '#fff' }}>{client.companyName}</h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '15px' }}>{client.location || 'Location N/A'}</span>
                      
                      <button className="btn-secondary" style={{ width: '100%', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid #10b981', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }} onClick={() => window.open(client.mouLink, '_blank')}>
                        <FilePdf weight="fill" size={18} /> View Agreement
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* EDIT MODAL */}
      {isEditModalOpen && selectedClient && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }} onClick={(e) => { if(e.target === e.currentTarget) setIsEditModalOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: '500px', width: '100%', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Edit {selectedClient.companyName}</h2>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsEditModalOpen(false)} />
            </div>
            
            <div style={{ display: 'grid', gap: '15px', marginBottom: '15px' }}>
              <div><label className="data-label">Company Mail ID</label><input type="email" className="sleek-input" style={{width:'100%'}} value={editForm.email} onChange={e=>setEditForm({...editForm, email: e.target.value})} /></div>
              <div><label className="data-label">Company Contact Number</label><input type="text" className="sleek-input" style={{width:'100%'}} value={editForm.phone} onChange={e=>setEditForm({...editForm, phone: e.target.value})} /></div>
              <div><label className="data-label">Company Location</label><input type="text" className="sleek-input" style={{width:'100%'}} value={editForm.location} onChange={e=>setEditForm({...editForm, location: e.target.value})} /></div>
              <div><label className="data-label">Contact Person</label><input type="text" className="sleek-input" style={{width:'100%'}} value={editForm.contactPerson} onChange={e=>setEditForm({...editForm, contactPerson: e.target.value})} /></div>
              <div>
                <label className="data-label">Upload Company Logo</label>
                <input type="file" accept="image/*" className="sleek-input" style={{width:'100%', padding: '6px'}} onChange={e=>setEditForm({...editForm, logoFile: e.target.files[0]})} />
              </div>
            </div>

            <button className="btn-action" style={{ background: '#38bdf8', color: '#0f172a', width: '100%', marginTop: '1rem' }} onClick={submitEdit} disabled={savingStatus}>
              {savingStatus ? <CircleNotch size={20} className="ph-spin" /> : <><FloppyDisk size={20} weight="bold"/> Save Updates</>}
            </button>
          </div>
        </div>
      )}

      {notification && (
        <div style={{
          position: 'fixed', bottom: '30px', right: '30px', zIndex: 999999,
          backgroundColor: notification.type === 'success' ? '#10b981' : '#ef4444',
          color: '#ffffff', padding: '16px 24px', borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '12px',
          fontSize: '1rem', fontWeight: 'bold'
        }}>
          {notification.type === 'success' ? <CheckCircle size={24} weight="fill" /> : <WarningCircle size={24} weight="fill" />}
          {notification.message}
        </div>
      )}
    </Layout>
  );
}