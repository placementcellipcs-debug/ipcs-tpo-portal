import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, Laptop, Barcode, ShieldCheck, 
  MapPinLine, Plus, Trash, CheckCircle, WarningCircle 
} from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

const DYNAMIC_TEMPLATES = {
  'Laptop': ['Serial Number', 'MAC Address', 'Processor (CPU)', 'RAM', 'Storage', 'Operating System'],
  'Desktop': ['Serial Number', 'MAC Address', 'Processor (CPU)', 'RAM', 'Storage', 'Operating System'],
  'Mobile Phone': ['IMEI 1', 'IMEI 2', 'Operating System', 'Storage'],
  'SIM Card': ['Mobile Number', 'Provider', 'ICCID', 'Plan Type'],
  'Network Switch': ['Serial Number', 'MAC Address', 'IP Address', 'Number of Ports'],
  'Router': ['Serial Number', 'MAC Address', 'WAN IP', 'Firmware Version'],
  'CCTV Camera': ['Camera Type', 'Resolution', 'IP Address', 'MAC Address']
};

const DEFAULT_CATEGORIES = [{ categoryid: 'CAT01', categoryname: 'IT Equipment' }, { categoryid: 'CAT02', categoryname: 'Networking' }, { categoryid: 'CAT03', categoryname: 'Mobile & SIM' }, { categoryid: 'CAT04', categoryname: 'Furniture' }];
const DEFAULT_SUBCATEGORIES = [{ categoryid: 'CAT01', name: 'Laptop' }, { categoryid: 'CAT01', name: 'Desktop' }, { categoryid: 'CAT01', name: 'Monitor' }, { categoryid: 'CAT02', name: 'Network Switch' }, { categoryid: 'CAT02', name: 'Router' }, { categoryid: 'CAT02', name: 'CCTV Camera' }, { categoryid: 'CAT03', name: 'Mobile Phone' }, { categoryid: 'CAT03', name: 'SIM Card' }];

export default function AddAsset() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData') || '{}');
  
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  const [dbData, setDbData] = useState({ branches: [], categories: DEFAULT_CATEGORIES, subcategories: DEFAULT_SUBCATEGORIES, locations: [], vendors: [] });
  
  const [asset, setAsset] = useState({
    name: '', category: '', subcategory: '', branch: tpoData.sittingBranch || '', location: '', 
    condition: 'NEW', brand: '', model: '', purchaseDate: '', purchaseCost: '', vendor: '', invoice: '', warrantyEnd: ''
  });

  const [customFields, setCustomFields] = useState([]);

  useEffect(() => {
    axios.get(`${API_BASE}/api/v1/assets/form-data`).then(res => {
      if(res.data.success) {
        setDbData(prev => ({
          branches: res.data.branches,
          categories: res.data.categories.length > 0 ? res.data.categories : prev.categories,
          subcategories: res.data.subcategories.length > 0 ? res.data.subcategories : prev.subcategories,
          locations: res.data.locations,
          vendors: res.data.vendors
        }));
      }
    }).finally(() => setLoading(false));
  }, []);

  const handleCategoryChange = (e) => {
    setAsset({ ...asset, category: e.target.value, subcategory: '' });
    setCustomFields([]);
  };

  const handleSubcategoryChange = (e) => {
    const sub = e.target.value;
    setAsset({ ...asset, subcategory: sub });
    
    const template = DYNAMIC_TEMPLATES[sub];
    if (template) {
      setCustomFields(template.map(name => ({ name, value: '' })));
    } else {
      setCustomFields([{ name: 'Serial Number', value: '' }]);
    }
  };

  const handleCustomFieldChange = (index, val) => {
    const updated = [...customFields];
    updated[index].value = val;
    setCustomFields(updated);
  };

  const addEmptyField = () => setCustomFields([...customFields, { name: '', value: '' }]);
  const removeField = (index) => setCustomFields(customFields.filter((_, i) => i !== index));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/api/v1/assets/add`, {
        asset,
        customFields: customFields.filter(f => f.name && f.value),
        userName: tpoData.name,
        userEmail: tpoData.email
      });
      if(res.data.success) {
        setNotification({ type: 'success', text: `Asset ${res.data.assetId} successfully registered!` });
        setAsset({ name: '', category: '', subcategory: '', branch: tpoData.sittingBranch || '', location: '', condition: 'NEW', brand: '', model: '', purchaseDate: '', purchaseCost: '', vendor: '', invoice: '', warrantyEnd: '' });
        setCustomFields([]);
      }
    } catch (err) {
      setNotification({ type: 'error', text: err.response?.data?.message || 'Failed to register asset.' });
    } finally {
      setIsSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setNotification(null), 4000);
    }
  };

  const activeCategoryId = dbData.categories.find(c => c.categoryname === asset.category)?.categoryid;
  const availableSubcategories = dbData.subcategories.filter(s => s.categoryid === activeCategoryId);

  return (
    <Layout>
      <div className="premium-dashboard-wrapper page-container" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '50px' }}>
        
        {/* TOAST NOTIFICATION */}
        {notification && (
          <div style={{ position: 'fixed', bottom: '30px', right: '30px', zIndex: 999999, backgroundColor: notification.type === 'success' ? '#10b981' : '#ef4444', color: '#ffffff', padding: '16px 24px', borderRadius: '10px', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '1rem', fontWeight: 'bold' }}>
            {notification.type === 'success' ? <CheckCircle size={24} weight="fill" /> : <WarningCircle size={24} weight="fill" />}
            {notification.text}
          </div>
        )}

        {/* HERO SECTION */}
        <div className="top-hero-section">
          <div className="hero-text">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Barcode color="#38bdf8" weight="fill" /> Register New Asset
            </h1>
            <p>Add trackable hardware, equipment, and furniture to the branch registry.</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state-card"><CircleNotch size={40} className="ph-spin text-blue" /><p>Loading forms...</p></div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* SECTION 1: BASIC INFO */}
            <div className="glass-panel" style={{ padding: '30px', borderRadius: '20px', borderLeft: '4px solid #3b82f6' }}>
              <h2 style={{ fontSize: '1.2rem', color: '#38bdf8', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><Laptop weight="fill"/> Basic Identification</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label className="data-label">Asset Category *</label>
                  <select className="premium-select" style={{ width: '100%' }} value={asset.category} onChange={handleCategoryChange} required>
                    <option value="">Select Category</option>
                    {dbData.categories.map((c, i) => <option key={i} value={c.categoryname}>{c.categoryname}</option>)}
                  </select>
                </div>
                <div>
                  <label className="data-label">Subcategory *</label>
                  <select className="premium-select" style={{ width: '100%' }} value={asset.subcategory} onChange={handleSubcategoryChange} required disabled={!asset.category}>
                    <option value="">Select Subcategory</option>
                    {availableSubcategories.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '20px' }}>
                <div>
                  <label className="data-label">Asset Name *</label>
                  <input type="text" className="premium-input" style={{ width: '100%' }} value={asset.name} onChange={e => setAsset({...asset, name: e.target.value})} placeholder="e.g. Dell Training Laptop 01" required />
                </div>
                <div>
                  <label className="data-label">Brand</label>
                  <input type="text" className="premium-input" style={{ width: '100%' }} value={asset.brand} onChange={e => setAsset({...asset, brand: e.target.value})} placeholder="e.g. Dell" />
                </div>
                <div>
                  <label className="data-label">Model</label>
                  <input type="text" className="premium-input" style={{ width: '100%' }} value={asset.model} onChange={e => setAsset({...asset, model: e.target.value})} placeholder="e.g. Latitude 5440" />
                </div>
              </div>
            </div>

            {/* SECTION 2: DYNAMIC CUSTOM FIELDS */}
            {asset.subcategory && (
              <div className="glass-panel" style={{ padding: '30px', borderRadius: '20px', borderLeft: '4px solid #10b981', animation: 'fadeInReveal 0.3s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ fontSize: '1.2rem', color: '#10b981', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><ShieldCheck weight="fill"/> Technical Specifications</h2>
                  <button type="button" onClick={addEmptyField} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid #10b981', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}><Plus weight="bold"/> Add Field</button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  {customFields.map((field, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <input type="text" style={{ width: '100%', marginBottom: '5px', background: 'transparent', border: 'none', borderBottom: '1px dashed #64748b', padding: '4px 0', color: '#94a3b8', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold', outline: 'none' }} value={field.name} onChange={(e) => { const upd = [...customFields]; upd[idx].name = e.target.value; setCustomFields(upd); }} placeholder="Field Name (e.g. IMEI)" />
                        <input type="text" className="premium-input" style={{ width: '100%' }} value={field.value} onChange={(e) => handleCustomFieldChange(idx, e.target.value)} placeholder={`Enter ${field.name || 'value'}`} />
                      </div>
                      <button type="button" onClick={() => removeField(idx)} style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '10px', borderRadius: '8px', cursor: 'pointer', height: '42px', display: 'flex', alignItems: 'center' }}><Trash size={18}/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 3: OWNERSHIP & PURCHASE */}
            <div className="glass-panel" style={{ padding: '30px', borderRadius: '20px', borderLeft: '4px solid #f59e0b' }}>
              <h2 style={{ fontSize: '1.2rem', color: '#f59e0b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><MapPinLine weight="fill"/> Allocation & Purchase</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label className="data-label">Assigned Branch *</label>
                  <select className="premium-select" style={{ width: '100%' }} value={asset.branch} onChange={e => setAsset({...asset, branch: e.target.value})} required>
                    <option value="">Select Branch</option>
                    {dbData.branches.map((b, i) => <option key={i} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="data-label">Physical Location</label>
                  <input type="text" className="premium-input" style={{ width: '100%' }} value={asset.location} onChange={e => setAsset({...asset, location: e.target.value})} placeholder="e.g. Training Lab 2" />
                </div>
                <div>
                  <label className="data-label">Initial Condition</label>
                  <select className="premium-select" style={{ width: '100%' }} value={asset.condition} onChange={e => setAsset({...asset, condition: e.target.value})}>
                    <option value="NEW">New</option><option value="EXCELLENT">Excellent</option><option value="GOOD">Good</option><option value="FAIR">Fair</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px' }}>
                <div>
                  <label className="data-label">Purchase Date</label>
                  <input type="date" className="premium-input" style={{ width: '100%' }} value={asset.purchaseDate} onChange={e => setAsset({...asset, purchaseDate: e.target.value})} />
                </div>
                <div>
                  <label className="data-label">Purchase Cost (₹)</label>
                  <input type="number" className="premium-input" style={{ width: '100%' }} value={asset.purchaseCost} onChange={e => setAsset({...asset, purchaseCost: e.target.value})} placeholder="0.00" />
                </div>
                <div>
                  <label className="data-label">Vendor / Supplier</label>
                  <input type="text" className="premium-input" style={{ width: '100%' }} value={asset.vendor} onChange={e => setAsset({...asset, vendor: e.target.value})} placeholder="e.g. Amazon" />
                </div>
                <div>
                  <label className="data-label">Warranty End Date</label>
                  <input type="date" className="premium-input" style={{ width: '100%' }} value={asset.warrantyEnd} onChange={e => setAsset({...asset, warrantyEnd: e.target.value})} />
                </div>
              </div>
            </div>

            <button type="submit" className="premium-btn primary" style={{ padding: '16px', fontSize: '1.1rem', width: '100%' }} disabled={isSubmitting}>
              {isSubmitting ? <CircleNotch size={24} className="ph-spin" /> : 'Register Asset & Generate ID'}
            </button>
          </form>
        )}
      </div>

      {/* ---------------------------------------------------------
          🎨 PREMIUM CSS FOR ADD ASSET
      --------------------------------------------------------- */}
      <style>{`
        .premium-dashboard-wrapper { font-family: 'Inter', sans-serif; color: #f8fafc; }
        
        .glass-panel { background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5); }
        
        .top-hero-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 20px; }
        .hero-text h1 { font-size: 2.2rem; font-weight: 800; margin: 0 0 5px 0; color: #fff; }
        .hero-text p { color: #94a3b8; margin: 0; font-size: 1rem; }
        
        .data-label { color: #94a3b8; font-size: 0.8rem; font-weight: bold; display: block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        
        .premium-input, .premium-select { background: rgba(0,0,0,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 12px 15px; font-size: 0.95rem; outline: none; transition: 0.2s; box-sizing: border-box; }
        .premium-input:focus, .premium-select:focus { border-color: #3b82f6; background: rgba(0,0,0,0.4); }
        .premium-select option { background: #0f1523; color: #fff; padding: 10px; font-weight: bold; }
        
        .premium-btn { border: none; border-radius: 12px; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; cursor: pointer; }
        .premium-btn.primary { background: #3b82f6; color: #fff; }
        .premium-btn.primary:hover:not(:disabled) { background: #2563eb; transform: translateY(-2px); box-shadow: 0 10px 20px -10px rgba(59, 130, 246, 0.5); }
        .premium-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .empty-state-card { background: rgba(15, 23, 42, 0.5); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px; padding: 50px 20px; text-align: center; color: #94a3b8; font-size: 1.1rem; font-weight: bold; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 15px; }
        
        @keyframes fadeInReveal { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </Layout>
  );
}