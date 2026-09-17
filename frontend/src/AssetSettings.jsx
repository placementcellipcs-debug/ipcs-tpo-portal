import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, CheckCircle, WarningCircle, Tag, MapPin, 
  Storefront, Plus, X, DesktopTower, Prohibit
} from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function AssetSettings() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  const accessType = String(tpoData?.accessType || '').toLowerCase();
  
  // Strict Security: Only Super Admins can configure the ERP ecosystem
  const isSuperAdmin = accessType === 'superadmin';

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('categories');
  const [dbData, setDbData] = useState({ branches: [], categories: [], subcategories: [], locations: [], vendors: [] });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState(''); // 'category', 'subcategory', 'location', 'vendor'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  // Form States
  const [catForm, setCatForm] = useState({ categoryName: '', type: 'ASSET' });
  const [subCatForm, setSubCatForm] = useState({ categoryId: '', subcategoryName: '' });
  const [locForm, setLocForm] = useState({ branchName: '', room: '', area: 'Lab' });
  const [vendorForm, setVendorForm] = useState({ vendorName: '', contactPerson: '', phone: '', email: '' });

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/v1/assets/form-data`);
      if (res.data.success) {
        setDbData(res.data);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const showToast = (text, type = 'success') => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const openModal = (type) => {
    setModalType(type);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let endpoint = '';
      let payload = {};

      if (modalType === 'category') { endpoint = '/api/v1/assets/config/category'; payload = catForm; }
      else if (modalType === 'subcategory') { endpoint = '/api/v1/assets/config/subcategory'; payload = subCatForm; }
      else if (modalType === 'location') { endpoint = '/api/v1/assets/config/location'; payload = locForm; }
      else if (modalType === 'vendor') { endpoint = '/api/v1/assets/config/vendor'; payload = vendorForm; }

      const res = await axios.post(`${API_BASE}${endpoint}`, payload);
      if (res.data.success) {
        showToast(res.data.message);
        setIsModalOpen(false);
        // Reset Forms
        setCatForm({ categoryName: '', type: 'ASSET' });
        setSubCatForm({ categoryId: '', subcategoryName: '' });
        setLocForm({ branchName: '', room: '', area: 'Lab' });
        setVendorForm({ vendorName: '', contactPerson: '', phone: '', email: '' });
        fetchData(); // Refresh the data to show the new card instantly
      }
    } catch (err) { showToast(err.response?.data?.message || 'Action failed.', 'error'); } 
    finally { setIsSubmitting(false); }
  };

  if (!isSuperAdmin) return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#94a3b8', textAlign: 'center' }}>
        <Prohibit size={64} color="#ef4444" weight="fill" style={{ marginBottom: '20px' }} />
        <h2>Access Restricted</h2>
        <p>Only Super Admins can configure the master ERP ecosystem.</p>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="premium-dashboard-wrapper page-container" style={{ maxWidth: '1400px', margin: '0 auto', paddingBottom: '50px' }}>
        
        {notification && (
          <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 999999, backgroundColor: notification.type === 'success' ? '#10b981' : '#ef4444', color: '#ffffff', padding: '16px 24px', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1rem', fontWeight: 'bold' }}>
            {notification.type === 'success' ? <CheckCircle size={24} weight="fill" /> : <WarningCircle size={24} weight="fill" />}
            {notification.text}
          </div>
        )}

        <div className="top-hero-section">
          <div className="hero-text">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><DesktopTower color="#8b5cf6" weight="fill" /> System Configuration</h1>
            <p>Manage organizational categories, physical locations, and vendors for the Asset ERP.</p>
          </div>
        </div>

        {/* NAVIGATION TABS */}
        <div className="glass-panel control-action-bar" style={{ display: 'flex', gap: '15px', marginBottom: '30px' }}>
          <button className={`premium-tab ${activeTab === 'categories' ? 'active' : ''}`} onClick={() => setActiveTab('categories')}><Tag size={18} /> Categories & Tags</button>
          <button className={`premium-tab ${activeTab === 'locations' ? 'active' : ''}`} onClick={() => setActiveTab('locations')}><MapPin size={18} /> Branch Locations</button>
          <button className={`premium-tab ${activeTab === 'vendors' ? 'active' : ''}`} onClick={() => setActiveTab('vendors')}><Storefront size={18} /> Hardware Vendors</button>
        </div>

        {loading ? (
          <div className="empty-state-card"><CircleNotch size={40} className="ph-spin text-blue" /><p>Syncing ecosystem configurations...</p></div>
        ) : (
          <div className="config-workspace">
            
            {/* 1. CATEGORIES WORKSPACE */}
            {activeTab === 'categories' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '1.2rem', color: '#fff', margin: 0 }}>Asset Classifications</h2>
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="premium-btn primary" onClick={() => openModal('category')}><Plus size={16} weight="bold"/> New Category</button>
                    <button className="premium-btn secondary" onClick={() => openModal('subcategory')}><Plus size={16} weight="bold"/> Add Subcategory</button>
                  </div>
                </div>

                <div className="bento-grid">
                  {dbData.categories.length === 0 ? <p style={{color:'#64748b'}}>No categories defined.</p> : dbData.categories.map((cat, i) => {
                    const subs = dbData.subcategories.filter(s => s.categoryid === cat.categoryid);
                    return (
                      <div key={i} className="config-card glass-panel hover-lift">
                        <div className="cc-header">
                          <div className="cc-icon" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#8b5cf6' }}><Tag weight="fill"/></div>
                          <span className="badge-blue">{cat.type}</span>
                        </div>
                        <h3 className="cc-title">{cat.categoryname}</h3>
                        <p className="cc-desc">{cat.categoryid} • {subs.length} Subcategories mapped.</p>
                        <div className="cc-tags">
                          {subs.map((s, idx) => <span key={idx} className="small-tag">{s.name}</span>)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* 2. LOCATIONS WORKSPACE */}
            {activeTab === 'locations' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '1.2rem', color: '#fff', margin: 0 }}>Branch Infrastructure</h2>
                  <button className="premium-btn primary" onClick={() => openModal('location')}><Plus size={16} weight="bold"/> Add Lab / Room</button>
                </div>

                <div className="bento-grid">
                  {dbData.locations.length === 0 ? <p style={{color:'#64748b'}}>No locations mapped to branches.</p> : dbData.locations.map((loc, i) => (
                    <div key={i} className="config-card glass-panel hover-lift">
                      <div className="cc-header">
                        <div className="cc-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}><MapPin weight="fill"/></div>
                        <span className="badge-green">{loc.branchid}</span>
                      </div>
                      <h3 className="cc-title">{loc.room}</h3>
                      <p className="cc-desc">Type: {loc.area}</p>
                      <div className="cc-tags">
                        <span className="small-tag">{loc.locationid}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* 3. VENDORS WORKSPACE */}
            {activeTab === 'vendors' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '1.2rem', color: '#fff', margin: 0 }}>Registered Suppliers</h2>
                  <button className="premium-btn primary" onClick={() => openModal('vendor')}><Plus size={16} weight="bold"/> Add Vendor</button>
                </div>

                <div className="bento-grid">
                  {dbData.vendors.length === 0 ? <p style={{color:'#64748b'}}>No vendors registered.</p> : dbData.vendors.map((v, i) => (
                    <div key={i} className="config-card glass-panel hover-lift">
                      <div className="cc-header">
                        <div className="cc-icon" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}><Storefront weight="fill"/></div>
                        <span className="badge-purple">Active</span>
                      </div>
                      <h3 className="cc-title">{v.vendorname}</h3>
                      <p className="cc-desc">{v.contactperson || 'No Contact Person'}</p>
                      <div className="cc-tags">
                        {v.phone && <span className="small-tag">{v.phone}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

          </div>
        )}
      </div>

      {/* DYNAMIC FORM MODAL */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={(e) => { if(e.target === e.currentTarget) setIsModalOpen(false); }}>
          <div className="premium-modal glass-panel" style={{ maxWidth: '500px' }}>
            <div className="modal-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '15px', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#fff' }}>
                {modalType === 'category' ? 'Create Category' : modalType === 'subcategory' ? 'Add Subcategory' : modalType === 'location' ? 'Map New Location' : 'Register Vendor'}
              </h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}><X size={24} /></button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              
              {modalType === 'category' && (
                <>
                  <div><label className="data-label">Category Name *</label><input type="text" className="premium-input" style={{ width: '100%' }} value={catForm.categoryName} onChange={e => setCatForm({...catForm, categoryName: e.target.value})} placeholder="e.g. Office Furniture" required /></div>
                  <div><label className="data-label">Category Type</label><select className="premium-select" style={{ width: '100%' }} value={catForm.type} onChange={e => setCatForm({...catForm, type: e.target.value})}><option value="ASSET">Trackable Asset</option><option value="CONSUMABLE">Consumable Inventory</option></select></div>
                </>
              )}

              {modalType === 'subcategory' && (
                <>
                  <div><label className="data-label">Parent Category *</label><select className="premium-select" style={{ width: '100%' }} value={subCatForm.categoryId} onChange={e => setSubCatForm({...subCatForm, categoryId: e.target.value})} required><option value="">-- Select Parent --</option>{dbData.categories.map(c => <option key={c.categoryid} value={c.categoryid}>{c.categoryname}</option>)}</select></div>
                  <div><label className="data-label">Subcategory Name *</label><input type="text" className="premium-input" style={{ width: '100%' }} value={subCatForm.subcategoryName} onChange={e => setSubCatForm({...subCatForm, subcategoryName: e.target.value})} placeholder="e.g. Office Chair" required /></div>
                </>
              )}

              {modalType === 'location' && (
                <>
                  <div><label className="data-label">Select Branch *</label><select className="premium-select" style={{ width: '100%' }} value={locForm.branchName} onChange={e => setLocForm({...locForm, branchName: e.target.value})} required><option value="">-- Select Branch --</option>{dbData.branches.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
                  <div><label className="data-label">Room / Lab Name *</label><input type="text" className="premium-input" style={{ width: '100%' }} value={locForm.room} onChange={e => setLocForm({...locForm, room: e.target.value})} placeholder="e.g. Automation Lab 2" required /></div>
                  <div><label className="data-label">Area Type</label><select className="premium-select" style={{ width: '100%' }} value={locForm.area} onChange={e => setLocForm({...locForm, area: e.target.value})}><option value="Lab">Student Lab</option><option value="Office">Staff Office</option><option value="Storage">Storage / Store Room</option></select></div>
                </>
              )}

              {modalType === 'vendor' && (
                <>
                  <div><label className="data-label">Company / Vendor Name *</label><input type="text" className="premium-input" style={{ width: '100%' }} value={vendorForm.vendorName} onChange={e => setVendorForm({...vendorForm, vendorName: e.target.value})} placeholder="e.g. Dell India Pvt Ltd" required /></div>
                  <div><label className="data-label">Contact Person</label><input type="text" className="premium-input" style={{ width: '100%' }} value={vendorForm.contactPerson} onChange={e => setVendorForm({...vendorForm, contactPerson: e.target.value})} placeholder="e.g. Amit Sharma" /></div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                    <div><label className="data-label">Phone</label><input type="text" className="premium-input" style={{ width: '100%' }} value={vendorForm.phone} onChange={e => setVendorForm({...vendorForm, phone: e.target.value})} /></div>
                    <div><label className="data-label">Email</label><input type="email" className="premium-input" style={{ width: '100%' }} value={vendorForm.email} onChange={e => setVendorForm({...vendorForm, email: e.target.value})} /></div>
                  </div>
                </>
              )}

              <button type="submit" className="premium-btn primary" style={{ width: '100%', padding: '14px', marginTop: '10px' }} disabled={isSubmitting}>
                {isSubmitting ? <CircleNotch size={24} className="ph-spin" /> : "Save Configuration to System"}
              </button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .premium-dashboard-wrapper { font-family: 'Inter', sans-serif; color: #f8fafc; }
        .glass-panel { background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .hover-lift { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); cursor: default; }
        .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 15px 30px -10px rgba(0,0,0,0.5); border-color: rgba(255, 255, 255, 0.1); background: rgba(30, 41, 59, 0.8); }

        .top-hero-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
        .hero-text h1 { font-size: 2.2rem; font-weight: 800; margin: 0 0 5px 0; color: #fff; }
        .hero-text p { color: #94a3b8; margin: 0; font-size: 1rem; }

        .premium-tab { background: transparent; border: none; padding: 12px 24px; color: #94a3b8; font-weight: bold; font-size: 0.95rem; border-radius: 12px; cursor: pointer; transition: 0.3s; display: flex; align-items: center; gap: 8px; }
        .premium-tab.active { background: #3b82f6; color: #fff; box-shadow: 0 4px 15px rgba(59,130,246,0.3); }

        .premium-btn { border: none; padding: 10px 20px; border-radius: 10px; font-weight: bold; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; cursor: pointer; }
        .premium-btn.primary { background: #3b82f6; color: #fff; }
        .premium-btn.secondary { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); }
        .premium-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .bento-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .config-card { border-radius: 16px; padding: 25px; display: flex; flexDirection: column; }
        .cc-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px; }
        .cc-icon { width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; }
        .cc-title { margin: 0 0 5px 0; font-size: 1.2rem; color: #fff; font-weight: 800; }
        .cc-desc { margin: 0 0 15px 0; color: #94a3b8; font-size: 0.85rem; }
        .cc-tags { display: flex; flex-wrap: wrap; gap: 6px; }
        .small-tag { background: rgba(255,255,255,0.05); color: #cbd5e1; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; border: 1px solid rgba(255,255,255,0.1); }
        
        .badge-blue { background: rgba(56, 189, 248, 0.15); color: #8b5cf6; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; font-weight: bold; border: 1px solid rgba(56, 189, 248, 0.3); }
        .badge-green { background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; font-weight: bold; border: 1px solid rgba(16, 185, 129, 0.3); }
        .badge-purple { background: rgba(168, 85, 247, 0.15); color: #a855f7; padding: 4px 10px; border-radius: 8px; font-size: 0.75rem; font-weight: bold; border: 1px solid rgba(168, 85, 247, 0.3); }

        .modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); z-index: 99999; display: flex; justify-content: center; align-items: center; padding: 20px; }
        .premium-modal { width: 100%; max-height: 90vh; overflow-y: auto; border-radius: 20px; padding: 30px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); }
        .close-btn { background: none; border: none; color: #64748b; cursor: pointer; transition: 0.2s; display: flex; }
        .close-btn:hover { color: #ef4444; }

        .data-label { color: #94a3b8; font-size: 0.8rem; font-weight: bold; display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        .premium-input, .premium-select { background: rgba(0,0,0,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px 15px; font-size: 0.95rem; outline: none; transition: 0.2s; box-sizing: border-box; }
        .premium-input:focus, .premium-select:focus { border-color: #3b82f6; background: rgba(0,0,0,0.4); }
        .premium-select option { background: #0f1523; color: #fff; padding: 10px; }
      `}</style>
    </Layout>
  );
}