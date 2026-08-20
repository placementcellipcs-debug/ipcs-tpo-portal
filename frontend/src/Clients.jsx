import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, PencilSimple, PaperPlaneRight, FilePdf, X, FloppyDisk } from '@phosphor-icons/react';
import Layout from './Layout';

// 🚨 LIVE RENDER URL
const API_BASE = "https://ipcs-tpo-portal.onrender.com";

export default function Clients() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingStatus, setSavingStatus] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(null);

  useEffect(() => { 
    if (tpoData) fetchClients(); 
  }, [tpoData]);

  const fetchClients = async () => {
    try {
      const res = await axios.post(`${API_BASE}/api/tpo/clients`, { tpoName: tpoData.name });
      if (res.data.success) setClients(res.data.clients);
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
        fetchClients();
      }
    } catch (error) { 
      alert(`Failed to update: ${error.response?.data?.message || error.message}`); 
    } finally { 
      setSavingStatus(false); 
    }
  };

  const sendRequest = async (client) => {
    if(!client.email) return alert("Company Mail ID is missing. Please click 'Edit' and add an email first.");
    setSendingRequest(client.rowNumber);
    try {
      const response = await axios.post(`${API_BASE}/api/tpo/clients/request-mou`, {
        rowNumber: client.rowNumber, companyEmail: client.email, companyName: client.companyName
      });
      if (response.data.success) {
        alert(`✅ Email sent successfully to ${client.companyName}!`);
        fetchClients(); 
      }
    } catch (error) { 
      alert(`❌ Failed to send request: ${error.response?.data?.message || error.message}`); 
    } finally { 
      setSendingRequest(null); 
    }
  };

  const filteredClients = clients.filter(c => c.companyName.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        <h1 style={{ fontSize: '1.8rem', marginBottom: '5px' }}>Hiring Partners & Clients</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Manage company data, upload logos, and process Partnership Certificates.</p>
        
        <input type="text" className="sleek-input" placeholder="Search companies..." style={{ width: '300px', marginBottom: '1.5rem' }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />

        {loading ? <div style={{ textAlign: 'center', marginTop: '3rem', color: '#38bdf8' }}><CircleNotch size={40} className="ph-spin" /></div> 
        : filteredClients.length === 0 ? <div style={{ textAlign: 'center', padding: '2rem' }}>No clients found matching your profile.</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {filteredClients.map(client => (
              <div key={client.rowNumber} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '8px', background: '#fff', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {client.logo ? <img src={getDriveImage(client.logo)} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="Logo" /> : <span style={{ color: '#000', fontWeight: 'bold' }}>{client.companyName.charAt(0)}</span>}
                  </div>
                  <div>
                    <strong style={{ fontSize: '1.2rem', color: '#fff', display: 'block' }}>{client.companyName}</strong>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{client.location || 'Location N/A'}</span>
                  </div>
                </div>

                <div style={{ fontSize: '0.85rem', color: '#cbd5e1' }}>
                  <div style={{ marginBottom: '4px' }}>👤 {client.contactPerson || 'No Contact Person'}</div>
                  <div style={{ marginBottom: '4px' }}>📧 {client.email || 'No Email'}</div>
                  <div>📞 {client.contact || 'No Phone'}</div>
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '15px', borderTop: '1px solid var(--card-border)' }}>
                  {client.documentStatus === 'Completed' && client.mouLink ? (
                    <button className="btn-secondary" style={{ width: '100%', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid #38bdf8', display: 'flex', justifyContent: 'center', gap: '8px' }} onClick={() => window.open(client.mouLink, '_blank')}>
                      <FilePdf weight="fill" size={18} /> View Signed Certificate
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button className="btn-secondary" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '5px' }} onClick={() => openEditModal(client)}>
                        <PencilSimple weight="bold" size={16} /> Edit
                      </button>
                      <button className="btn-action" style={{ flex: 1.5, display: 'flex', justifyContent: 'center', gap: '5px', background: client.mailStatus === 'Request Sent' ? '#f59e0b' : '#10b981', color: client.mailStatus === 'Request Sent' ? '#000' : '#fff' }} onClick={() => sendRequest(client)} disabled={sendingRequest === client.rowNumber}>
                        {sendingRequest === client.rowNumber ? <CircleNotch className="ph-spin" size={16} /> : <><PaperPlaneRight weight="fill" size={16} /> {client.mailStatus === 'Request Sent' ? 'Resend Request' : 'Send Request'}</>}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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

            <button className="btn-action" style={{ background: '#38bdf8', color: '#0f1523', width: '100%', marginTop: '1rem' }} onClick={submitEdit} disabled={savingStatus}>
              {savingStatus ? <CircleNotch size={20} className="ph-spin" /> : <><FloppyDisk size={20} weight="bold"/> Save Updates</>}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}