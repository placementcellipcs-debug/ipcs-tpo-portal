import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, Plus, BoxArrowDown, BoxArrowUp, Package, X, CheckCircle } from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function Inventory() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData') || '{}');
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [stockModal, setStockModal] = useState(null); // { item, action: 'IN' | 'OUT' }
  const [stockAmount, setStockAmount] = useState('');
  
  const [formData, setFormData] = useState({ name: '', category: 'Consumable', branch: tpoData.sittingBranch || '', quantity: 0, minQuantity: 5 });

  const fetchInventory = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/assets/inventory`);
      if (res.data.success) setInventory(res.data.inventory);
    } catch (err) { console.error("Error loading inventory", err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchInventory(); }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/v1/assets/inventory/add`, { item: formData, userName: tpoData.name });
      setIsAddModalOpen(false); fetchInventory();
    } catch (err) { alert("Failed to add item."); }
  };

  const handleStockSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/v1/assets/inventory/stock`, { itemId: stockModal.item.itemId, action: stockModal.action, quantity: stockAmount, userName: tpoData.name });
      setStockModal(null); setStockAmount(''); fetchInventory();
    } catch (err) { alert("Failed to update stock."); }
  };

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}><Package color="#38bdf8" weight="fill" /> Consumable Inventory</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Track items like paper, cables, and stationary that don't need serial numbers.</p>
          </div>
          <button className="btn-action" style={{ width: 'auto', background: '#38bdf8', color: '#0f172a' }} onClick={() => setIsAddModalOpen(true)}>
            <Plus weight="bold" /> Add Inventory Item
          </button>
        </div>

        <div className="table-container">
          <table className="modern-table">
            <thead><tr><th>Item ID & Name</th><th>Category</th><th>Branch</th><th>Quantity</th><th>Status</th><th style={{ textAlign: 'center' }}>Actions</th></tr></thead>
            <tbody>
              {loading ? (<tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}><CircleNotch size={32} className="ph-spin" color="#38bdf8"/></td></tr>) 
              : inventory.map(item => (
                <tr key={item.itemId}>
                  <td><span className="primary-text" style={{ color: '#38bdf8' }}>{item.itemId}</span><span className="sub-text">{item.name}</span></td>
                  <td>{item.category}</td>
                  <td>{item.branch}</td>
                  <td><span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: item.quantity <= item.minQuantity ? '#ef4444' : '#10b981' }}>{item.quantity}</span></td>
                  <td><span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 8px', borderRadius: '8px', fontSize: '0.75rem', fontWeight: 'bold' }}>{item.status}</span></td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                      <button onClick={() => setStockModal({ item, action: 'IN' })} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid #10b981', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>+ Stock In</button>
                      <button onClick={() => setStockModal({ item, action: 'OUT' })} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid #ef4444', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>- Consume</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* MODALS */}
        {isAddModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
            <div className="modal-card" style={{ maxWidth: '500px', width: '100%', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}><h2 style={{ margin: 0, color: '#38bdf8' }}>New Inventory Item</h2><X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsAddModalOpen(false)} /></div>
              <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div><label className="data-label">Item Name</label><input type="text" className="sleek-input" style={{ width: '100%' }} value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} required /></div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div><label className="data-label">Initial Quantity</label><input type="number" className="sleek-input" style={{ width: '100%' }} value={formData.quantity} onChange={e => setFormData({...formData, quantity: e.target.value})} required /></div>
                  <div><label className="data-label">Minimum Alert Level</label><input type="number" className="sleek-input" style={{ width: '100%' }} value={formData.minQuantity} onChange={e => setFormData({...formData, minQuantity: e.target.value})} required /></div>
                </div>
                <button type="submit" className="btn-action" style={{ background: '#38bdf8', color: '#0f172a', marginTop: '10px' }}>Add to Inventory</button>
              </form>
            </div>
          </div>
        )}

        {stockModal && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
            <div className="modal-card" style={{ maxWidth: '400px', width: '100%', background: '#0f1523', border: `1px solid ${stockModal.action === 'IN' ? '#10b981' : '#ef4444'}`, borderRadius: '16px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}><h2 style={{ margin: 0, color: stockModal.action === 'IN' ? '#10b981' : '#ef4444' }}>{stockModal.action === 'IN' ? 'Add Stock' : 'Consume Item'}</h2><X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setStockModal(null)} /></div>
              <form onSubmit={handleStockSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ background: '#1e293b', padding: '15px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{stockModal.item.name}</div>
                  <div style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 'bold' }}>Current Stock: {stockModal.item.quantity}</div>
                </div>
                <div><label className="data-label">Quantity to {stockModal.action === 'IN' ? 'Add' : 'Remove'}</label><input type="number" min="1" max={stockModal.action === 'OUT' ? stockModal.item.quantity : 9999} className="sleek-input" style={{ width: '100%' }} value={stockAmount} onChange={e => setStockAmount(e.target.value)} required /></div>
                <button type="submit" className="btn-action" style={{ background: stockModal.action === 'IN' ? '#10b981' : '#ef4444', color: '#fff', marginTop: '10px' }}>Confirm Update</button>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}