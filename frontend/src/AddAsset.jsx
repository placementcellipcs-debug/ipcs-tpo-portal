import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, Laptop, Barcode, ShieldCheck, MapPinLine, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function AddAsset() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData') || '{}');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dbData, setDbData] = useState({ branches: [], categories: [], subcategories: [] });
  
  const [asset, setAsset] = useState({ name: '', category: '', subcategory: '', branch: tpoData.sittingBranch || '', location: '', condition: 'NEW', brand: '', model: '', purchaseDate: '', purchaseCost: '', vendor: '' });
  const [customFields, setCustomFields] = useState([{ name: 'Serial Number', value: '' }]);

  useEffect(() => {
    axios.get(`${API_BASE}/api/v1/assets/form-data`).then(res => {
      if(res.data.success) setDbData(res.data);
    }).finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault(); setIsSubmitting(true);
    try {
      await axios.post(`${API_BASE}/api/v1/assets/add`, { asset, customFields, userName: tpoData.name, userEmail: tpoData.email });
      alert("Asset Registered successfully!");
      setAsset({ name: '', category: '', subcategory: '', branch: tpoData.sittingBranch || '', location: '', condition: 'NEW', brand: '', model: '', purchaseDate: '', purchaseCost: '', vendor: '' });
    } catch (err) { alert("Failed"); } finally { setIsSubmitting(false); }
  };

  return (
    <Layout>
      <div className="premium-dashboard-wrapper page-container" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '50px' }}>
        
        <div className="top-hero-section">
          <div className="hero-text">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Barcode color="#38bdf8" weight="fill" /> Register New Asset</h1>
            <p>Add trackable hardware and equipment to the registry.</p>
          </div>
        </div>

        {loading ? <div className="empty-state-card"><CircleNotch size={40} className="ph-spin text-blue" /></div> : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            <div className="glass-panel" style={{ padding: '30px', borderRadius: '20px', borderLeft: '4px solid #3b82f6' }}>
              <h2 style={{ fontSize: '1.2rem', color: '#38bdf8', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><Laptop weight="fill"/> Basic Identification</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                <div><label className="data-label">Category *</label><input type="text" className="premium-input" value={asset.category} onChange={e=>setAsset({...asset, category: e.target.value})} required/></div>
                <div><label className="data-label">Asset Name *</label><input type="text" className="premium-input" value={asset.name} onChange={e=>setAsset({...asset, name: e.target.value})} required/></div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '30px', borderRadius: '20px', borderLeft: '4px solid #10b981' }}>
              <h2 style={{ fontSize: '1.2rem', color: '#10b981', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><ShieldCheck weight="fill"/> Specifications</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div><label className="data-label">Brand</label><input type="text" className="premium-input" value={asset.brand} onChange={e=>setAsset({...asset, brand: e.target.value})}/></div>
                <div><label className="data-label">Serial Number</label><input type="text" className="premium-input" value={customFields[0].value} onChange={e=>{const c=[...customFields]; c[0].value=e.target.value; setCustomFields(c);}}/></div>
              </div>
            </div>

            <div className="glass-panel" style={{ padding: '30px', borderRadius: '20px', borderLeft: '4px solid #f59e0b' }}>
              <h2 style={{ fontSize: '1.2rem', color: '#f59e0b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}><MapPinLine weight="fill"/> Allocation & Purchase</h2>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div><label className="data-label">Branch *</label><input type="text" className="premium-input" value={asset.branch} onChange={e=>setAsset({...asset, branch: e.target.value})} required/></div>
                <div><label className="data-label">Purchase Cost (₹)</label><input type="number" className="premium-input" value={asset.purchaseCost} onChange={e=>setAsset({...asset, purchaseCost: e.target.value})}/></div>
              </div>
            </div>

            <button type="submit" className="premium-btn primary" style={{ padding: '15px', fontSize: '1.1rem' }} disabled={isSubmitting}>
              {isSubmitting ? <CircleNotch size={24} className="ph-spin" /> : 'Register Asset & Generate ID'}
            </button>
          </form>
        )}
      </div>
    </Layout>
  );
}