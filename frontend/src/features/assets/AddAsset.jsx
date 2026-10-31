import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, Laptop, Barcode, ShieldCheck, 
  MapPinLine, Plus, Trash, CheckCircle, WarningCircle, Image as ImageIcon, UploadSimple
} from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import DateInput from '../../components/DateInput';
import { API_BASE } from '../../services/apiConfig';
import AssetCategoryFields from './AssetCategoryFields';

const DYNAMIC_TEMPLATES = {
  'Laptop': ['Serial Number', 'MAC Address', 'Processor (CPU)', 'RAM', 'Storage', 'Operating System'],
  'Desktop': ['Serial Number', 'MAC Address', 'Processor (CPU)', 'RAM', 'Storage', 'Operating System'],
  'Mobile Phone': ['IMEI 1', 'IMEI 2', 'Operating System', 'Storage'],
  'SIM Card': ['Mobile Number', 'Provider', 'ICCID', 'Plan Type'],
  'Network Switch': ['Serial Number', 'MAC Address', 'IP Address', 'Number of Ports'],
  'Router': ['Serial Number', 'MAC Address', 'WAN IP', 'Firmware Version'],
  'CCTV Camera': ['Camera Type', 'Resolution', 'IP Address', 'MAC Address']
};

// 🚨 ADDED HARDCODED LOCATIONS
const HARDCODED_LOCATIONS = [
  'Automation Lab', 'BMS Lab', 'IT Lab', 'DM Lab', 'Embedded Lab', 
  'Front Office', 'TPO Room', 'BM Cabin'
];

export default function AddAsset() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData') || '{}');
  
  const [loading, setLoading] = useState(true);
  const [formLoadError, setFormLoadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  const [dbData, setDbData] = useState({ branches: [], categories: [], subcategories: [], locations: [], vendors: [] });
  
  const [asset, setAsset] = useState({
    name: '', category: '', subcategory: '', branch: tpoData.sittingBranch || '', location: '', 
    condition: 'NEW', brand: '', model: '', purchaseDate: '', purchaseCost: '', vendor: '', invoice: '', warrantyEnd: ''
  });

  const [customFields, setCustomFields] = useState([]);
  const [assetPhoto, setAssetPhoto] = useState(null);
  const [assetPhotoPreview, setAssetPhotoPreview] = useState('');
  const assetPhotoPreviewRef = useRef('');
  
  // 🚨 NEW: State for "Other" Custom Location
  const [customLocation, setCustomLocation] = useState('');

  const loadFormData = useCallback(async () => {
    setLoading(true);
    setFormLoadError('');
    try {
      const res = await axios.get(`${API_BASE}/api/v1/assets/form-data`, { timeout: 15000 });
      if (res.data?.success) {
        setDbData({
          branches: Array.isArray(res.data.branches) ? res.data.branches : [],
          categories: Array.isArray(res.data.categories) ? res.data.categories : [],
          subcategories: Array.isArray(res.data.subcategories) ? res.data.subcategories : [],
          locations: Array.isArray(res.data.locations) ? res.data.locations : [],
          vendors: Array.isArray(res.data.vendors) ? res.data.vendors : []
        });
      } else {
        throw new Error(res.data?.message || 'The asset setup data could not be loaded.');
      }
    } catch (error) {
      setFormLoadError(error.response?.data?.message || error.message || 'The asset setup data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadFormData(); }, [loadFormData]);

  useEffect(() => () => {
    if (assetPhotoPreviewRef.current) URL.revokeObjectURL(assetPhotoPreviewRef.current);
  }, []);

  const handleAssetPhotoChange = file => {
    if (assetPhotoPreviewRef.current) URL.revokeObjectURL(assetPhotoPreviewRef.current);
    const previewUrl = file ? URL.createObjectURL(file) : '';
    assetPhotoPreviewRef.current = previewUrl;
    setAssetPhoto(file);
    setAssetPhotoPreview(previewUrl);
  };

  const handleSubcategoryChange = (sub) => {
    setAsset(current => ({ ...current, subcategory: sub }));
    
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
    
    // 🚨 Safely resolve the final location string
    let finalLocation = asset.location;
    if (asset.location === 'Other') {
      if (!customLocation.trim()) {
        setNotification({ type: 'error', text: 'Please specify the custom location.' });
        setIsSubmitting(false);
        return;
      }
      finalLocation = customLocation;
    }

    try {
      const formData = new FormData();
      formData.append('asset', JSON.stringify({ ...asset, location: finalLocation }));
      formData.append('customFields', JSON.stringify(customFields.filter(f => f.name && f.value)));
      formData.append('userName', tpoData.name || '');
      formData.append('userEmail', tpoData.email || '');
      if (assetPhoto) formData.append('photo', assetPhoto);
      const res = await axios.post(`${API_BASE}/api/v1/assets/add`, formData);
      if(res.data.success) {
        setNotification({ type: 'success', text: `Asset ${res.data.assetId} successfully registered!` });
        // Reset form
        setAsset({ name: '', category: '', subcategory: '', branch: tpoData.sittingBranch || '', location: '', condition: 'NEW', brand: '', model: '', purchaseDate: '', purchaseCost: '', vendor: '', invoice: '', warrantyEnd: '' });
        setCustomLocation('');
        setCustomFields([]);
        if (assetPhotoPreviewRef.current) URL.revokeObjectURL(assetPhotoPreviewRef.current);
        assetPhotoPreviewRef.current = '';
        setAssetPhoto(null);
        setAssetPhotoPreview('');
      }
    } catch (err) {
      setNotification({ type: 'error', text: err.response?.data?.message || 'Failed to register asset.' });
    } finally {
      setIsSubmitting(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => setNotification(null), 4000);
    }
  };

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
              <Barcode color="var(--accent-primary)" weight="fill" /> Register New Asset
            </h1>
            <p>Add trackable hardware, equipment, and furniture to the branch registry.</p>
          </div>
        </div>

        {loading ? (
          <div className="empty-state-card"><CircleNotch size={40} className="ph-spin text-blue" /><p>Loading forms...</p></div>
        ) : formLoadError ? (
          <div className="empty-state-card asset-form-load-error" role="alert">
            <WarningCircle size={36} color="#f59e0b" />
            <p>{formLoadError}</p>
            <button type="button" className="btn-action" onClick={() => void loadFormData()}>Retry loading form</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* SECTION 1: BASIC INFO */}
            <div className="glass-panel" style={{ padding: '30px', borderRadius: '20px', borderLeft: '4px solid #3b82f6' }}>
              <h2 style={{ fontSize: '1.2rem', color: 'var(--accent-primary)', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><Laptop weight="fill"/> Basic Identification</h2>
              
              <AssetCategoryFields
                type="ASSET"
                category={asset.category}
                subcategory={asset.subcategory}
                subcategoryRequired
                categories={dbData.categories}
                subcategories={dbData.subcategories}
                dataReady={!loading}
                onCategoryChange={value => { setAsset(current => ({ ...current, category: value, subcategory: '' })); setCustomFields([]); }}
                onSubcategoryChange={handleSubcategoryChange}
              />

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

                {/* 🚨 DYNAMIC LOCATION DROPDOWN */}
                <div>
                  <label className="data-label">Physical Location *</label>
                  <select 
                    className="premium-select" 
                    style={{ width: '100%' }} 
                    value={asset.location === 'Other' || HARDCODED_LOCATIONS.includes(asset.location) ? asset.location : (asset.location ? 'Other' : '')} 
                    onChange={(e) => setAsset({...asset, location: e.target.value})} 
                    required
                  >
                    <option value="">Select Location</option>
                    {HARDCODED_LOCATIONS.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                    <option value="Other">Other (Specify manually)</option>
                  </select>

                  {/* 🚨 CONDITIONAL "OTHER" TEXTBOX */}
                  {(asset.location === 'Other' || (!HARDCODED_LOCATIONS.includes(asset.location) && asset.location !== '')) && (
                    <input 
                      type="text" 
                      className="premium-input" 
                      style={{ width: '100%', marginTop: '10px', background: 'rgba(56, 189, 248, 0.1)', border: '1px solid var(--accent-primary)' }} 
                      value={customLocation} 
                      onChange={e => setCustomLocation(e.target.value)} 
                      placeholder="e.g. Server Room, 2nd Floor" 
                      required 
                    />
                  )}
                </div>

                <div>
                  <label className="data-label">Initial Condition</label>
                  <select className="premium-select" style={{ width: '100%' }} value={asset.condition} onChange={e => setAsset({...asset, condition: e.target.value})}>
                    <option value="NEW">New</option><option value="EXCELLENT">Excellent</option><option value="GOOD">Good</option><option value="FAIR">Fair</option>
                  </select>
                </div>
              </div>

              <div className="asset-photo-upload">
                <div className="asset-photo-upload-copy"><ImageIcon size={22} weight="duotone" /><span><b>Asset condition photo</b><small>Capture the item when it enters the register.</small></span></div>
                <label className="asset-photo-picker">{assetPhoto ? <CheckCircle size={18} /> : <UploadSimple size={18} />} {assetPhoto ? 'Replace photo' : 'Add photo'}<input type="file" accept="image/*" capture="environment" onChange={event => handleAssetPhotoChange(event.target.files?.[0] || null)} /></label>
                {assetPhoto && <span className="asset-photo-filename">{assetPhoto.name}</span>}
                {assetPhotoPreview && <img className="asset-photo-preview" src={assetPhotoPreview} alt="Asset preview" />}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '20px' }}>
                <div>
                  <label className="data-label">Purchase Date</label>
                  <DateInput className="premium-input" style={{ width: '100%' }} value={asset.purchaseDate} onChange={e => setAsset({...asset, purchaseDate: e.target.value})} />
                </div>
                <div>
                  <label className="data-label">Purchase Cost (₹)</label>
                  <input type="number" className="premium-input" style={{ width: '100%' }} value={asset.purchaseCost} onChange={e => setAsset({...asset, purchaseCost: e.target.value})} placeholder="0.00" />
                </div>
                <div>
                  <label className="data-label">Vendor / Supplier</label>
                  <input type="text" list="asset-vendor-options" className="premium-input" style={{ width: '100%' }} value={asset.vendor} onChange={e => setAsset({...asset, vendor: e.target.value})} placeholder="Choose or enter a vendor" />
                  <datalist id="asset-vendor-options">{dbData.vendors.map((vendor, index) => <option key={`${vendor.vendorid || vendor.vendorname}-${index}`} value={vendor.vendorname || vendor.name || ''} />)}</datalist>
                </div>
                <div>
                  <label className="data-label">Warranty End Date</label>
                  <DateInput className="premium-input" style={{ width: '100%' }} value={asset.warrantyEnd} onChange={e => setAsset({...asset, warrantyEnd: e.target.value})} />
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
        .asset-photo-upload { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin: 18px 0 22px; padding: 15px; border: 1px dashed rgba(59,130,246,.42); border-radius: 14px; background: rgba(59,130,246,.06); }
        .asset-photo-upload-copy { display: flex; align-items: center; gap: 11px; margin-right: auto; color: #60a5fa; }
        .asset-photo-upload-copy b, .asset-photo-upload-copy small { display: block; }
        .asset-photo-upload-copy b { color: #e2e8f0; font-size: .88rem; }
        .asset-photo-upload-copy small { margin-top: 3px; color: #94a3b8; font-size: .73rem; }
        .asset-photo-picker { display: inline-flex; align-items: center; gap: 8px; padding: 9px 12px; border: 1px solid rgba(59,130,246,.5); border-radius: 10px; color: #bfdbfe; font-size: .8rem; font-weight: 800; cursor: pointer; }
        .asset-photo-picker input { position: absolute; width: 1px; height: 1px; overflow: hidden; opacity: 0; }
        .asset-photo-filename { max-width: 180px; overflow: hidden; color: #94a3b8; font-size: .72rem; text-overflow: ellipsis; white-space: nowrap; }
        .asset-photo-preview { width: 72px; height: 72px; border: 1px solid rgba(255,255,255,.16); border-radius: 12px; object-fit: cover; }
        @media (max-width: 700px) { .asset-photo-upload { align-items: flex-start; } .asset-photo-picker { margin-left: 32px; } }
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
