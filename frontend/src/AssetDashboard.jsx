import { useEffect, useState } from 'react';
import axios from 'axios';
import { Laptop, Package, Wrench, WarningCircle, CircleNotch, CheckCircle, Buildings, ChartBar } from '@phosphor-icons/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function AssetDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_BASE}/api/v1/assets/dashboard`);
        if (res.data.success) setData(res.data.stats);
      } catch (err) { console.error("Dashboard load failed", err); } 
      finally { setLoading(false); }
    };
    fetchData();
  }, []);

  if (loading || !data) return (
    <Layout><div className="empty-state-card" style={{marginTop:'10vh'}}><CircleNotch size={40} className="ph-spin text-blue" /><p>Loading Ecosystem Data...</p></div></Layout>
  );

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  const COLORS = ['#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#ec4899'];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155', padding: '12px', borderRadius: '8px', color: '#fff' }}>
          <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>{payload[0].payload.name}</p>
          <span style={{ color: '#38bdf8' }}>{payload[0].value} Assets</span>
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

        <div className="mini-dash-grid">
          <div className="kpi-card glass-panel hover-lift">
            <div className="kpi-top"><div><div className="kpi-title">Total Assets</div><div className="kpi-val">{data.totalAssets}</div></div><div className="kpi-icon blue"><Laptop weight="fill" size={26}/></div></div>
          </div>
          <div className="kpi-card glass-panel hover-lift">
            <div className="kpi-top"><div><div className="kpi-title">Assigned</div><div className="kpi-val">{data.assigned}</div></div><div className="kpi-icon green"><CheckCircle weight="fill" size={26}/></div></div>
          </div>
          <div className="kpi-card glass-panel hover-lift">
            <div className="kpi-top"><div><div className="kpi-title">Available Stock</div><div className="kpi-val">{data.available}</div></div><div className="kpi-icon orange"><Package weight="fill" size={26}/></div></div>
          </div>
          <div className="kpi-card glass-panel hover-lift">
            <div className="kpi-top"><div><div className="kpi-title">In Maintenance</div><div className="kpi-val">{data.underMaintenance}</div></div><div className="kpi-icon red"><Wrench weight="fill" size={26}/></div></div>
          </div>
        </div>

        <div className="bento-master-grid" style={{ gridTemplateColumns: '2fr 1fr' }}>
          
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

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="bento-card glass-panel" style={{ textAlign: 'center', padding: '30px' }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '1rem', color: '#94a3b8', textTransform: 'uppercase' }}>Total Capital Invested</h3>
              <div style={{ fontSize: '2.8rem', fontWeight: '900', color: '#10b981', textShadow: '0 4px 15px rgba(16,185,129,0.3)' }}>
                {formatCurrency(data.totalValue)}
              </div>
            </div>

            <div className="bento-card glass-panel flex-1">
              <div className="card-header">
                <h3><WarningCircle size={20} color="#ef4444"/> Inventory Alerts</h3>
              </div>
              <div className="clean-list" style={{ marginTop: '10px' }}>
                {data.lowStock.length === 0 ? <p className="empty-tasks" style={{textAlign:'center', marginTop:'20px'}}>All consumables are sufficiently stocked.</p> : 
                  data.lowStock.map((item, idx) => (
                    <div key={idx} className="clean-row" style={{ background: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      <div className="cl-left">
                        <div><div className="cl-title">{item.name}</div><div className="cl-sub">{item.branch}</div></div>
                      </div>
                      <div className="cl-right">
                        <div className="cl-title text-red" style={{ color: '#ef4444', fontSize: '1.2rem' }}>{item.qty}</div>
                        <div className="cl-sub">Min: {item.min}</div>
                      </div>
                    </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* (Insert Premium CSS Block Here from Previous Responses) */}
    </Layout>
  );
}