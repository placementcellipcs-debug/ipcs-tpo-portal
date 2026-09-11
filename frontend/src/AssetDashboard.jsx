import { useEffect, useState } from 'react';
import axios from 'axios';
import { Laptop, Package, Wrench, WarningCircle, CircleNotch, CheckCircle, Buildings, ChartBar } from '@phosphor-icons/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function AssetDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  // Access Control
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  const upperRole = String(tpoData?.role || '').toUpperCase();
  const accessType = String(tpoData?.accessType || '').toLowerCase();
  
  const isSuperAdmin = accessType === 'superadmin' || upperRole.includes('ADMIN') || upperRole.includes('HEAD') || upperRole.includes('MANAGER');
  const canManageAssets = isSuperAdmin || upperRole.includes('ASSET');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/v1/assets/dashboard`);
        if (res.data.success) setData(res.data.stats);
      } catch (err) { 
        console.error("Dashboard load failed", err); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchData();
  }, []);

  if (loading || !data) return (
    <Layout>
      <div className="empty-state-card" style={{marginTop:'10vh'}}>
        <CircleNotch size={40} className="ph-spin text-blue" />
        <p>Loading Asset Ecosystem...</p>
      </div>
    </Layout>
  );

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  const COLORS = ['#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#ec4899'];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155', padding: '12px', borderRadius: '8px', color: '#fff', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
          <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>{payload[0].payload.name}</p>
          <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>{payload[0].value} Assets</span>
        </div>
      );
    }
    return null;
  };

  return (
    <Layout>
      <div className="premium-dashboard-wrapper page-container" style={{ maxWidth: '1600px', margin: '0 auto', paddingBottom: '50px' }}>
        
        <div className="top-hero-section">
          <div className="hero-text">
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><ChartBar color="#38bdf8" weight="fill" /> Asset Command Center</h1>
            <p>Overview of hardware, inventory value, and branch allocations.</p>
          </div>
        </div>

        {/* TOP KPI GRID */}
        <div className="mini-dash-grid">
          <div className="kpi-card glass-panel hover-lift">
            <div className="kpi-top">
              <div><div className="kpi-title">Total Assets</div><div className="kpi-val">{data.totalAssets}</div></div>
              <div className="kpi-icon blue"><Laptop weight="fill" size={26}/></div>
            </div>
          </div>
          <div className="kpi-card glass-panel hover-lift">
            <div className="kpi-top">
              <div><div className="kpi-title">Assigned</div><div className="kpi-val">{data.assigned}</div></div>
              <div className="kpi-icon green"><CheckCircle weight="fill" size={26}/></div>
            </div>
          </div>
          <div className="kpi-card glass-panel hover-lift">
            <div className="kpi-top">
              <div><div className="kpi-title">Available Stock</div><div className="kpi-val">{data.available}</div></div>
              <div className="kpi-icon orange"><Package weight="fill" size={26}/></div>
            </div>
          </div>
          <div className="kpi-card glass-panel hover-lift">
            <div className="kpi-top">
              <div><div className="kpi-title">In Maintenance</div><div className="kpi-val">{data.underMaintenance}</div></div>
              <div className="kpi-icon red"><Wrench weight="fill" size={26}/></div>
            </div>
          </div>
        </div>

        {/* MAIN BENTO BOX LAYOUT */}
        <div className="bento-master-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
          
          {/* LEFT: INTERACTIVE RECHARTS GRAPH */}
          <div className="bento-card glass-panel">
            <div className="card-header">
              <h3><Buildings size={20} color="#38bdf8"/> Branch Distribution</h3>
            </div>
            <div style={{ height: '300px', width: '100%', marginTop: '20px' }}>
              {data.branches.length === 0 ? <p className="empty-tasks">No data available.</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.branches} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" stroke="#64748b" />
                    <YAxis dataKey="name" type="category" stroke="#cbd5e1" fontSize={12} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                      {data.branches.map((e, i) => <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} /> )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* RIGHT: FINANCIALS & ALERTS */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* ONLY ADMINS SEE FINANCIAL DATA */}
            {isSuperAdmin && (
              <div className="bento-card glass-panel hover-lift" style={{ textAlign: 'center', padding: '30px' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#94a3b8', textTransform: 'uppercase' }}>Total Capital Invested</h3>
                <div style={{ fontSize: '2.8rem', fontWeight: '900', color: '#10b981', textShadow: '0 4px 15px rgba(16,185,129,0.3)' }}>
                  {formatCurrency(data.totalValue)}
                </div>
              </div>
            )}

            <div className="bento-card glass-panel flex-1 hover-lift">
              <div className="card-header">
                <h3><WarningCircle size={20} color="#ef4444"/> Inventory Alerts</h3>
              </div>
              <div className="clean-list" style={{ marginTop: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                {data.lowStock.length === 0 ? <p className="empty-tasks" style={{textAlign:'center', marginTop:'20px'}}>All consumables are sufficiently stocked.</p> : 
                  data.lowStock.map((item, idx) => (
                    <div key={idx} className="clean-row" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '10px' }}>
                      <div className="cl-left">
                        <div><div className="cl-title" style={{ fontSize: '0.9rem' }}>{item.name}</div><div className="cl-sub">{item.branch}</div></div>
                      </div>
                      <div className="cl-right">
                        <div className="cl-title text-red" style={{ color: '#ef4444', fontSize: '1.2rem' }}>{item.qty}</div>
                        <div className="cl-sub" style={{ fontSize: '0.7rem' }}>Min: {item.min}</div>
                      </div>
                    </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .premium-dashboard-wrapper { font-family: 'Inter', sans-serif; color: #f8fafc; }
        .glass-panel { background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .hover-lift { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); cursor: default; }
        .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.7); border-color: rgba(255, 255, 255, 0.1); background: rgba(30, 41, 59, 0.8); }
        
        .top-hero-section { margin-bottom: 25px; }
        .hero-text h1 { font-size: 2.2rem; font-weight: 800; margin: 0 0 5px 0; color: #fff; }
        .hero-text p { color: #94a3b8; margin: 0; font-size: 1rem; }
        
        .mini-dash-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px; }
        .kpi-card { border-radius: 16px; padding: 20px; }
        .kpi-top { display: flex; justify-content: space-between; align-items: flex-start; }
        .kpi-title { font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
        .kpi-val { font-size: 2rem; font-weight: 900; color: #fff; line-height: 1; }
        .kpi-icon { width: 45px; height: 45px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 2px 10px rgba(255,255,255,0.05); }
        .kpi-icon.blue { background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); }
        .kpi-icon.green { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .kpi-icon.orange { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
        .kpi-icon.red { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
        
        .bento-master-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; }
        .bento-card { border-radius: 20px; padding: 25px; }
        .card-header h3 { margin: 0; font-size: 1.1rem; color: #fff; display: flex; align-items: center; gap: 8px; }
        
        .clean-list { display: flex; flex-direction: column; gap: 10px; }
        .clean-row { display: flex; justify-content: space-between; align-items: center; padding: 15px; border-radius: 12px; }
        .cl-left { display: flex; align-items: center; gap: 15px; }
        .cl-title { font-size: 1rem; font-weight: 700; color: #fff; margin-bottom: 3px; }
        .cl-sub { font-size: 0.8rem; color: #94a3b8; }
        .empty-tasks { color: #64748b; font-size: 0.85rem; font-style: italic; }
        .empty-state-card { background: rgba(15, 23, 42, 0.5); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px; padding: 50px 20px; text-align: center; color: #94a3b8; font-size: 1.1rem; font-weight: bold; }
        
        @media (max-width: 1000px) { .bento-master-grid { grid-template-columns: 1fr; } }
      `}</style>
    </Layout>
  );
}