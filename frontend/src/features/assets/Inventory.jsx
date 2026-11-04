import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { CircleNotch, Package, X } from '@phosphor-icons/react';
import { Link } from 'react-router-dom';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import './Inventory.css';

export default function Inventory() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData') || '{}');
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inventoryError, setInventoryError] = useState('');
  const [stockModal, setStockModal] = useState(null); // { item, action: 'IN' | 'OUT' }
  const [stockAmount, setStockAmount] = useState('');

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    setInventoryError('');
    try {
      const res = await axios.get(`${API_BASE}/api/v1/assets/inventory`, { timeout: 15000 });
      if (res.data.success) setInventory(res.data.inventory);
      else throw new Error(res.data?.message || 'Inventory could not be loaded.');
    } catch (err) {
      console.error('Error loading inventory', err);
      setInventoryError(err.response?.data?.message || err.message || 'Inventory could not be loaded.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchInventory(); }, 0);
    return () => window.clearTimeout(timer);
  }, [fetchInventory]);

  useEffect(() => {
    if (!stockModal) return undefined;
    const originalOverflow = document.body.style.overflow;
    const onKeyDown = event => {
      if (event.key === 'Escape') setStockModal(null);
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [stockModal]);

  const handleStockSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/api/v1/assets/inventory/stock`, { itemId: stockModal.item.itemId, action: stockModal.action, quantity: stockAmount, userName: tpoData.name });
      setStockModal(null); setStockAmount(''); fetchInventory();
    } catch { alert("Failed to update stock."); }
  };

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}><Package color="var(--accent-primary)" weight="fill" /> Consumable Inventory</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Track items like paper, cables, and stationery that don't need serial numbers.</p>
          </div>
          <Link className="btn-action" style={{ width: 'auto', background: 'var(--accent-primary)', color: '#0f172a', textDecoration: 'none' }} to="/assets/add?type=consumable">Register stock</Link>
        </div>

        <div className="table-container">
          <table className="modern-table">
            <thead><tr><th>Item ID & Name</th><th>Category / Subcategory</th><th>Branch</th><th>Quantity</th><th>Status</th><th style={{ textAlign: 'center' }}>Actions</th></tr></thead>
            <tbody>
              {loading ? (<tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}><CircleNotch size={32} className="ph-spin" color="var(--accent-primary)"/></td></tr>)
              : inventoryError ? (<tr><td colSpan="6" style={{ textAlign: 'center', padding: '2.5rem' }}><p>{inventoryError}</p><button type="button" className="btn-action" onClick={() => void fetchInventory()}>Retry inventory</button></td></tr>)
              : inventory.map(item => (
                <tr key={item.itemId}>
                  <td><span className="primary-text" style={{ color: 'var(--accent-primary)' }}>{item.itemId}</span><span className="sub-text">{item.name}</span></td>
                  <td>{item.category}{item.subcategory && <span className="sub-text">{item.subcategory}</span>}</td>
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
        {stockModal && createPortal(
          <div className="asset-inventory-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setStockModal(null); }}>
            <div className={`asset-inventory-modal ${stockModal.action === 'IN' ? 'stock-in' : 'stock-out'}`} role="dialog" aria-modal="true" aria-labelledby="stock-modal-title">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}><h2 id="stock-modal-title" style={{ margin: 0, color: stockModal.action === 'IN' ? '#10b981' : '#ef4444' }}>{stockModal.action === 'IN' ? 'Add Stock' : 'Consume Item'}</h2><button type="button" className="asset-inventory-modal-close" aria-label="Close" onClick={() => setStockModal(null)}><X size={21} /></button></div>
              <form onSubmit={handleStockSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ background: '#1e293b', padding: '15px', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{stockModal.item.name}</div>
                  <div style={{ fontSize: '1.2rem', color: '#fff', fontWeight: 'bold' }}>Current Stock: {stockModal.item.quantity}</div>
                </div>
                <div><label className="data-label">Quantity to {stockModal.action === 'IN' ? 'Add' : 'Remove'}</label><input type="number" min="1" max={stockModal.action === 'OUT' ? stockModal.item.quantity : 9999} className="sleek-input" style={{ width: '100%' }} value={stockAmount} onChange={e => setStockAmount(e.target.value)} required /></div>
                <button type="submit" className="btn-action" style={{ background: stockModal.action === 'IN' ? '#10b981' : '#ef4444', color: '#fff', marginTop: '10px' }}>Confirm Update</button>
              </form>
            </div>
          </div>, document.body
        )}
      </div>
    </Layout>
  );
}
