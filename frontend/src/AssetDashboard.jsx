import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Barcode, MapPin, Laptop, Package, Wrench, WarningCircle, 
  CircleNotch, CurrencyInr, CaretUp, ChartPieSlice, ShieldCheck
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
          <CircleNotch size={50} className="ph-spin" color="#38bdf8" />
          <p style={{ color: 'var(--text-muted)', marginTop: '15px' }}>Loading Asset Telemetry...</p>
        </div>
      </Layout>
    );
  }

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: '2.4rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ShieldCheck color="#38bdf8" weight="fill" /> ERP Asset Telemetry
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1.1rem' }}>Global view of hardware, inventory, and capital allocation.</p>
          </div>
        </div>

        {/* TOP LEVEL KPIS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          
          {/* TOTAL VALUE CARD */}
          <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f1523 100%)', border: '1px solid #38bdf8', borderRadius: '20px', padding: '25px', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', boxShadow: '0 10px 30px rgba(56, 189, 248, 0.15)' }}>
            <div style={{ position: 'absolute', right: '-20px', top: '-20px', opacity: 0.1 }}><CurrencyInr size={150} weight="fill" color="#38bdf8" /></div>
            <span style={{ color: '#38bdf8', fontWeight: 800, fontSize: '0.85rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '5px' }}>Total Capital Invested</span>
            <span style={{ fontSize: '2.8rem', fontWeight: 900, color: '#fff' }}>{formatCurrency(data.totalValue)}</span>
            <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981', fontSize: '0.8rem', fontWeight: 'bold' }}><CaretUp weight="bold"/> Syncing Live</div>
          </div>

          <div style={{ background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '20px', padding: '25px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '15px' }}>Tracked Hardware</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <div style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '12px', borderRadius: '12px' }}><Laptop size={28} weight="fill"/></div>
              <div><span style={{ fontSize: '2rem', fontWeight: 900, color: '#fff', display: 'block', lineHeight: 1 }}>{data.totalAssets}</span><span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Total Assets</span></div>
            </div>
          </div>

          <div style={{ background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '20px', padding: '25px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '15px' }}>Assignment Status</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
              <div><span style={{ display: 'block', color: '#10b981', fontSize: '1.8rem', fontWeight: 900 }}>{data.assigned}</span><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Assigned</span></div>
              <div style={{ width: '1px', height: '100%', background: 'var(--card-border)' }}></div>
              <div><span style={{ display: 'block', color: '#f59e0b', fontSize: '1.8rem', fontWeight: 900 }}>{data.available}</span><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Available</span></div>
            </div>
          </div>

          <div style={{ background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '20px', padding: '25px', display: 'flex', flexDirection: 'column' }}>
            <span style={{ color: 'var(--text-muted)', fontWeight: 800, fontSize: '0.8rem', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '15px' }}>Action Required</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flex: 1 }}>
              <div><span style={{ display: 'block', color: '#ef4444', fontSize: '1.8rem', fontWeight: 900 }}>{data.activeMaintenance}</span><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>In Repair</span></div>
              <div style={{ width: '1px', height: '100%', background: 'var(--card-border)' }}></div>
              <div><span style={{ display: 'block', color: '#a855f7', fontSize: '1.8rem', fontWeight: 900 }}>{data.lowStock.length}</span><span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Low Stock</span></div>
            </div>
          </div>

        </div>

        {/* MID LEVEL: BAR CHARTS & DISTRIBUTION */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', marginBottom: '30px' }}>
          
          <div style={{ background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '20px', padding: '25px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <MapPin size={24} color="#10b981" weight="fill" /> <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>Asset Distribution by Branch</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {data.branches.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>No distribution data.</span> : data.branches.map((b, i) => {
                 const pct = (b.value / data.totalAssets) * 100;
                 return (
                   <div key={i}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '5px' }}>
                       <span style={{ color: '#cbd5e1', fontWeight: 'bold' }}>{b.name}</span>
                       <span style={{ color: '#10b981', fontWeight: 'bold' }}>{b.value}</span>
                     </div>
                     <div style={{ width: '100%', height: '8px', background: '#1e293b', borderRadius: '10px', overflow: 'hidden' }}>
                       <div style={{ width: `${pct}%`, height: '100%', background: '#10b981', borderRadius: '10px' }}></div>
                     </div>
                   </div>
                 );
              })}
            </div>
          </div>

          <div style={{ background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '20px', padding: '25px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <ChartPieSlice size={24} color="#a855f7" weight="fill" /> <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>Assets by Category</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {data.categories.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>No category data.</span> : data.categories.map((c, i) => {
                 const pct = (c.value / data.totalAssets) * 100;
                 return (
                   <div key={i}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '5px' }}>
                       <span style={{ color: '#cbd5e1', fontWeight: 'bold' }}>{c.name}</span>
                       <span style={{ color: '#a855f7', fontWeight: 'bold' }}>{c.value}</span>
                     </div>
                     <div style={{ width: '100%', height: '8px', background: '#1e293b', borderRadius: '10px', overflow: 'hidden' }}>
                       <div style={{ width: `${pct}%`, height: '100%', background: '#a855f7', borderRadius: '10px' }}></div>
                     </div>
                   </div>
                 );
              })}
            </div>
          </div>

        </div>

        {/* BOTTOM LEVEL: ALERTS */}
        {data.lowStock.length > 0 && (
          <div style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '20px', padding: '25px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <WarningCircle size={24} color="#ef4444" weight="fill" /> <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#ef4444' }}>Critical Inventory Alerts</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
              {data.lowStock.map((item, idx) => (
                <div key={idx} style={{ background: '#0f1523', border: '1px solid #1e293b', padding: '15px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ color: '#fff', fontWeight: 'bold', fontSize: '1rem' }}>{item.name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{item.branch}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ color: '#ef4444', fontSize: '1.4rem', fontWeight: 900 }}>{item.qty}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Min: {item.min}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </Layout>
  );
}