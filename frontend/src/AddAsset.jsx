import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, Laptop, Barcode, ShieldCheck, 
  MapPin, Plus, Trash, CheckCircle, WarningCircle 
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
    
    // Dynamically inject custom fields based on the selected subcategory
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
        customFields: customFields.filter(f => f.name && f.value), // Only save filled fields
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
    }
  };

  const activeCategoryId = dbData.categories.find(c => c.categoryname === asset.category)?.categoryid;
  const availableSubcategories = dbData.subcategories.filter(s => s.categoryid === activeCategoryId);

  return (
    <Layout>
      <div className="page-container" style={{ maxWidth: '900px' }}>
        
        {notification && (
          <div style={{ marginBottom: '20px', padding: '15px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1rem', fontWeight: 'bold', background: notification.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: notification.type === 'success' ? '#10b981' : '#ef4444', border: `1px solid ${notification.type === 'success' ? '#10b981' : '#ef4444'}` }}>
            {notification.type === 'success' ? <CheckCircle size={24} weight="fill"/> : <WarningCircle size={24} weight="fill"/>}
            {notification.text}
          </div>
        )}

        <div style={{ marginBottom: '2.5rem' }}>
          <h1 style={{ fontSize: '2.2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Barcode color="#38bdf8" weight="fill" /> Register New Asset
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Add trackable hardware, equipment, and furniture to the branch registry.</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}><CircleNotch size={40} className="ph-spin" color="#38bdf8" /></div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* SECTION 1: BASIC INFO */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
              <h2 style={{ fontSize: '1.2rem', color: '#38bdf8', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}><Laptop weight="fill"/> Basic Identification</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>Asset Category *</label>
                  <select className="sleek-select" style={{ width: '100%' }} value={asset.category} onChange={handleCategoryChange} required>
                    <option value="">Select Category</option>
                    {dbData.categories.map((c, i) => <option key={i} value={c.categoryname}>{c.categoryname}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>Subcategory *</label>
                  <select className="sleek-select" style={{ width: '100%' }} value={asset.subcategory} onChange={handleSubcategoryChange} required disabled={!asset.category}>
                    <option value="">Select Subcategory</option>
                    {availableSubcategories.map((s, i) => <option key={i} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>Asset Name *</label>
                  <input type="text" className="sleek-input" style={{ width: '100%' }} value={asset.name} onChange={e => setAsset({...asset, name: e.target.value})} placeholder="e.g. Dell Training Laptop 01" required />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>Brand</label>
                  <input type="text" className="sleek-input" style={{ width: '100%' }} value={asset.brand} onChange={e => setAsset({...asset, brand: e.target.value})} placeholder="e.g. Dell" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>Model</label>
                  <input type="text" className="sleek-input" style={{ width: '100%' }} value={asset.model} onChange={e => setAsset({...asset, model: e.target.value})} placeholder="e.g. Latitude 5440" />
                </div>
              </div>
            </div>

            {/* SECTION 2: DYNAMIC CUSTOM FIELDS */}
            {asset.subcategory && (
              <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem', animation: 'fadeInReveal 0.3s' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontSize: '1.2rem', color: '#10b981', margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}><ShieldCheck weight="fill"/> Technical Specifications</h2>
                  <button type="button" onClick={addEmptyField} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid #10b981', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '5px' }}><Plus weight="bold"/> Add Field</button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  {customFields.map((field, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                      <div style={{ flex: 1 }}>
                        <input type="text" className="sleek-input" style={{ width: '100%', marginBottom: '5px', background: 'transparent', border: 'none', borderBottom: '1px dashed var(--text-muted)', padding: '4px 0', color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', fontWeight: 'bold' }} value={field.name} onChange={(e) => { const upd = [...customFields]; upd[idx].name = e.target.value; setCustomFields(upd); }} placeholder="Field Name (e.g. IMEI)" />
                        <input type="text" className="sleek-input" style={{ width: '100%' }} value={field.value} onChange={(e) => handleCustomFieldChange(idx, e.target.value)} placeholder={`Enter ${field.name || 'value'}`} />
                      </div>
                      <button type="button" onClick={() => removeField(idx)} style={{ background: 'transparent', border: 'none', color: '#ef4444', padding: '10px', cursor: 'pointer' }}><Trash size={20}/></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SECTION 3: OWNERSHIP & PURCHASE */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
              <h2 style={{ fontSize: '1.2rem', color: '#f59e0b', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}><MapPin weight="fill"/> Ownership & Procurement</h2>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>Assigned Branch *</label>
                  <select className="sleek-select" style={{ width: '100%' }} value={asset.branch} onChange={e => setAsset({...asset, branch: e.target.value})} required>
                    <option value="">Select Branch</option>
                    {dbData.branches.map((b, i) => <option key={i} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>Physical Location</label>
                  <input type="text" className="sleek-input" style={{ width: '100%' }} value={asset.location} onChange={e => setAsset({...asset, location: e.target.value})} placeholder="e.g. Training Lab 2" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>Initial Condition</label>
                  <select className="sleek-select" style={{ width: '100%' }} value={asset.condition} onChange={e => setAsset({...asset, condition: e.target.value})}>
                    <option value="NEW">New</option><option value="EXCELLENT">Excellent</option><option value="GOOD">Good</option><option value="FAIR">Fair</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>Purchase Date</label>
                  <input type="date" className="sleek-input" style={{ width: '100%' }} value={asset.purchaseDate} onChange={e => setAsset({...asset, purchaseDate: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>Purchase Cost (₹)</label>
                  <input type="number" className="sleek-input" style={{ width: '100%' }} value={asset.purchaseCost} onChange={e => setAsset({...asset, purchaseCost: e.target.value})} placeholder="0.00" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>Vendor / Supplier</label>
                  <input type="text" className="sleek-input" style={{ width: '100%' }} value={asset.vendor} onChange={e => setAsset({...asset, vendor: e.target.value})} placeholder="e.g. Amazon" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold', textTransform: 'uppercase' }}>Warranty End Date</label>
                  <input type="date" className="sleek-input" style={{ width: '100%' }} value={asset.warrantyEnd} onChange={e => setAsset({...asset, warrantyEnd: e.target.value})} />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" className="btn-action" style={{ width: 'auto', padding: '1rem 3rem', fontSize: '1.1rem', background: '#38bdf8', color: '#0f172a' }} disabled={isSubmitting}>
                {isSubmitting ? <CircleNotch size={24} className="ph-spin" /> : 'Register Asset & Generate ID'}
              </button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  );
}