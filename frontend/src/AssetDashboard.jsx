import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Laptop, Package, Wrench, WarningCircle, 
  CircleNotch, CheckCircle, Buildings, ChartBar
} from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function AssetDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/v1/assets/dashboard`);
        if (res.data.success) {
          setData(res.data.stats);
        }
      } catch (err) {
        console.error("Dashboard load failed", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading || !data) {
    return (
      <Layout>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
          <CircleNotch size={40} className="ph-spin" color="var(--accent-primary)" />
          <p style={{ color: 'var(--text-muted)', marginTop: '15px' }}>Loading Dashboard Data...</p>
        </div>
      </Layout>
    );
  }

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ marginBottom: '30px' }}>
          <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ChartBar color="var(--accent-primary)" weight="fill" /> Asset Management Dashboard
          </h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>Overview of hardware, inventory, and branch allocations.</p>
        </div>

        {/* STANDARD STATS GRID */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8' }}>
              <Laptop size={28} weight="fill" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.8rem', color: '#fff' }}>{data.totalAssets}</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Total Assets</p>
            </div>
          </div>

          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
              <CheckCircle size={28} weight="fill" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.8rem', color: '#fff' }}>{data.assigned}</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Assigned Assets</p>
            </div>
          </div>

          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f59e0b' }}>
              <Package size={28} weight="fill" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.8rem', color: '#fff' }}>{data.available}</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Available in Stock</p>
            </div>
          </div>

          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
              <Wrench size={28} weight="fill" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.8rem', color: '#fff' }}>{data.underMaintenance}</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem', textTransform: 'uppercase', fontWeight: 'bold' }}>Under Maintenance</p>
            </div>
          </div>

        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '25px' }}>
          
          {/* LEFT COLUMN: BRANCH DISTRIBUTION */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '25px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', borderBottom: '1px solid var(--card-border)', paddingBottom: '15px' }}>
              <Buildings size={22} color="var(--accent-primary)" /> 
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>Asset Distribution by Branch</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {data.branches.length === 0 ? (
                <span style={{ color: 'var(--text-muted)' }}>No distribution data available.</span>
              ) : (
                data.branches.map((b, i) => {
                 const pct = (b.value / data.totalAssets) * 100;
                 return (
                   <div key={i}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                       <span style={{ color: '#cbd5e1' }}>{b.name}</span>
                       <span style={{ color: '#fff', fontWeight: 'bold' }}>{b.value} Assets</span>
                     </div>
                     <div style={{ width: '100%', height: '6px', background: 'var(--bg-dark)', borderRadius: '4px', overflow: 'hidden' }}>
                       <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-primary)', borderRadius: '4px' }}></div>
                     </div>
                   </div>
                 );
                })
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: ALERTS & FINANCIALS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '25px' }}>
              <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: '#fff' }}>Total Capital Invested</h3>
              <div style={{ fontSize: '2.2rem', fontWeight: 'bold', color: '#10b981' }}>
                {formatCurrency(data.totalValue)}
              </div>
              <p style={{ margin: '5px 0 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Based on recorded purchase costs.</p>
            </div>

            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '25px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                <WarningCircle size={22} color="#ef4444" /> 
                <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#ef4444' }}>Inventory Alerts</h3>
              </div>
              
              {data.lowStock.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>All consumables are sufficiently stocked.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.lowStock.map((item, idx) => (
                    <div key={idx} style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>{item.name}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{item.branch}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ color: '#ef4444', fontSize: '1.1rem', fontWeight: 'bold' }}>{item.qty}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Min: {item.min}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </Layout>
  );
}