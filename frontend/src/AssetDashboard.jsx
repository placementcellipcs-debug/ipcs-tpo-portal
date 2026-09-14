import { useEffect, useState } from 'react';
import axios from 'axios';
import { Laptop, Package, Wrench, WarningCircle, CircleNotch, CheckCircle, Buildings, ChartBar, TrendUp, Warning, DesktopTower } from '@phosphor-icons/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, LineChart, Line } from 'recharts';
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
      <div className="empty-state-card" style={{marginTop:'10vh', background: 'transparent', border: 'none'}}>
        <CircleNotch size={50} className="ph-spin" color="#38bdf8" />
        <p style={{ color: '#38bdf8', fontSize: '1.2rem', marginTop: '15px', letterSpacing: '2px' }}>INITIALIZING ASSET ECOSYSTEM...</p>
      </div>
    </Layout>
  );

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

  // Status Distribution Data for Radial Chart
  const statusData = [
    { name: 'Assigned', value: data.assigned, color: '#38bdf8' },
    { name: 'Available', value: data.available, color: '#10b981' },
    { name: 'Maintenance', value: data.underMaintenance, color: '#ef4444' }
  ];

  // Dummy data to create the "Crypto Sparkline" effect on KPI cards
  const sparklineData = [
    { v: 10 }, { v: 25 }, { v: 15 }, { v: 40 }, { v: 30 }, { v: 60 }, { v: 50 }
  ];

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 30px rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '0.8rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>{payload[0].payload.name || payload[0].name}</p>
          <span style={{ color: payload[0].payload.color || '#38bdf8', fontWeight: '900', fontSize: '1.2rem' }}>{payload[0].value} Assets</span>
        </div>
      );
    }
    return null;
  };

  return (
    <Layout>
      <div className="premium-dashboard-wrapper page-container" style={{ position: 'relative', maxWidth: '1600px', margin: '0 auto', paddingBottom: '50px' }}>
        
        {/* 🌟 AMBIENT GLOW EFFECTS (Inspired by your Crypto UI references) */}
        <div className="ambient-glow glow-blue"></div>
        <div className="ambient-glow glow-purple"></div>

        {/* HERO BANNER & PORTFOLIO VALUE */}
        <div className="portfolio-banner">
          <div className="banner-left">
            <h1 className="gradient-text">Welcome back, {tpoData?.name.split(' ')[0]}</h1>
            <p>Here is your real-time asset and infrastructure overview.</p>
            
            {isSuperAdmin && (
              <div className="net-balance-card">
                <span className="balance-label">Total Asset Net Balance (INR)</span>
                <div className="balance-value">{formatCurrency(data.totalValue)}</div>
                <div className="balance-trend"><TrendUp size={16} weight="bold"/> +1.24% this month</div>
              </div>
            )}
          </div>
          <div className="banner-right">
            {/* Visual abstract graphic */}
            <div className="abstract-graphic">
              <DesktopTower size={80} color="rgba(56, 189, 248, 0.8)" weight="duotone" />
            </div>
          </div>
        </div>

        {/* KPI CARDS WITH SPARKLINE WAVES */}
        <div className="kpi-grid-premium">
          <div className="kpi-card-v2">
            <div className="kpi-v2-header">
              <div className="kpi-v2-icon" style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8' }}><Laptop weight="fill" size={24}/></div>
              <span className="kpi-v2-title">Total Assets</span>
            </div>
            <div className="kpi-v2-body">
              <div className="kpi-v2-val">{data.totalAssets}</div>
              <div className="sparkline">
                <ResponsiveContainer width="100%" height={40}>
                  <LineChart data={sparklineData}><Line type="monotone" dataKey="v" stroke="#38bdf8" strokeWidth={3} dot={false} /></LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="kpi-card-v2">
            <div className="kpi-v2-header">
              <div className="kpi-v2-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981' }}><CheckCircle weight="fill" size={24}/></div>
              <span className="kpi-v2-title">Assigned Active</span>
            </div>
            <div className="kpi-v2-body">
              <div className="kpi-v2-val">{data.assigned}</div>
              <div className="sparkline">
                <ResponsiveContainer width="100%" height={40}>
                  <LineChart data={sparklineData}><Line type="monotone" dataKey="v" stroke="#10b981" strokeWidth={3} dot={false} /></LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="kpi-card-v2">
            <div className="kpi-v2-header">
              <div className="kpi-v2-icon" style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7' }}><Package weight="fill" size={24}/></div>
              <span className="kpi-v2-title">Available Stock</span>
            </div>
            <div className="kpi-v2-body">
              <div className="kpi-v2-val">{data.available}</div>
              <div className="sparkline">
                <ResponsiveContainer width="100%" height={40}>
                  <LineChart data={sparklineData}><Line type="monotone" dataKey="v" stroke="#a855f7" strokeWidth={3} dot={false} /></LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="kpi-card-v2">
            <div className="kpi-v2-header">
              <div className="kpi-v2-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}><Wrench weight="fill" size={24}/></div>
              <span className="kpi-v2-title">In Maintenance</span>
            </div>
            <div className="kpi-v2-body">
              <div className="kpi-v2-val">{data.underMaintenance}</div>
              <div className="sparkline">
                <ResponsiveContainer width="100%" height={40}>
                  <LineChart data={sparklineData}><Line type="monotone" dataKey="v" stroke="#ef4444" strokeWidth={3} dot={false} /></LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* MAIN BENTO BOX GRID */}
        <div className="bento-grid-complex">
          
          {/* LEFT AREA: BRANCH DISTRIBUTION (GRADIENT BAR CHART) */}
          <div className="bento-card col-span-2">
            <div className="card-header-flex">
              <h3 className="card-title-neon"><Buildings size={20}/> Infrastructure by Branch</h3>
              <span className="status-badge gray">Live View</span>
            </div>
            
            <div style={{ height: '320px', width: '100%', marginTop: '20px' }}>
              {data.branches.length === 0 ? <p className="empty-tasks">No data available.</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.branches} layout="vertical" margin={{ top: 0, right: 30, left: 40, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBar" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8}/>
                        <stop offset="100%" stopColor="#8b5cf6" stopOpacity={1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" stroke="#64748b" tick={{fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#cbd5e1" fontSize={13} fontWeight="bold" tickLine={false} axisLine={false} width={100} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                    <Bar dataKey="value" fill="url(#colorBar)" radius={[0, 8, 8, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* MIDDLE AREA: RADIAL STATUS ALLOCATION */}
          <div className="bento-card col-span-1" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="card-header-flex" style={{ width: '100%' }}>
              <h3 className="card-title-neon">Asset Allocation</h3>
            </div>
            
            <div style={{ height: '240px', width: '100%', marginTop: '10px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%" cy="50%"
                    innerRadius={70} outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    stroke="none"
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} style={{ filter: `drop-shadow(0px 0px 8px ${entry.color}80)` }} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Allocation Legend */}
            <div className="allocation-legend">
              {statusData.map((s, i) => (
                <div key={i} className="legend-item">
                  <div className="legend-dot" style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }}></div>
                  <div className="legend-info">
                    <span className="legend-name">{s.name}</span>
                    <span className="legend-val">{((s.value / data.totalAssets) * 100 || 0).toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT AREA: RECENT ALERTS (TRANSACTION STYLE) */}
          <div className="bento-card col-span-1" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="card-header-flex">
              <h3 className="card-title-neon text-red"><Warning size={20}/> Critical Alerts</h3>
              <span className="status-badge red-pulse">Action Required</span>
            </div>
            
            <div className="crypto-list-wrapper">
              {data.lowStock.length === 0 && data.activeMaintenance === 0 ? (
                <div style={{ textAlign: 'center', color: '#64748b', marginTop: '40px' }}>
                  <CheckCircle size={40} color="#10b981" style={{ opacity: 0.5, marginBottom: '10px' }} />
                  <p>All systems operational. No low stock or active repairs.</p>
                </div>
              ) : (
                <>
                  {data.activeMaintenance > 0 && (
                    <div className="crypto-list-row">
                      <div className="clr-icon" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}><Wrench weight="fill" /></div>
                      <div className="clr-info">
                        <h4>Pending Repairs</h4>
                        <p>Asset Maintenance</p>
                      </div>
                      <div className="clr-action">
                        <span className="clr-val text-red">{data.activeMaintenance} Items</span>
                        <span className="status-badge red">Urgent</span>
                      </div>
                    </div>
                  )}

                  {data.lowStock.slice(0,4).map((item, idx) => (
                    <div key={idx} className="crypto-list-row">
                      <div className="clr-icon" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b' }}><Package weight="fill" /></div>
                      <div className="clr-info">
                        <h4>{item.name}</h4>
                        <p>{item.branch} Branch</p>
                      </div>
                      <div className="clr-action">
                        <span className="clr-val text-orange">{item.qty} Left</span>
                        <span className="status-badge orange">Min: {item.min}</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        .premium-dashboard-wrapper { font-family: 'Inter', sans-serif; color: #f8fafc; z-index: 1; }
        
        /* Ambient Glow Effects */
        .ambient-glow { position: absolute; border-radius: 50%; filter: blur(100px); opacity: 0.15; z-index: -1; pointer-events: none; }
        .glow-blue { width: 500px; height: 500px; background: #3b82f6; top: -100px; left: -100px; }
        .glow-purple { width: 400px; height: 400px; background: #a855f7; top: 20%; right: -50px; }

        /* Banner Area */
        .portfolio-banner { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(145deg, rgba(15,23,42,0.9), rgba(30,41,59,0.4)); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 40px; margin-bottom: 30px; box-shadow: 0 20px 40px -15px rgba(0,0,0,0.5); backdrop-filter: blur(20px); position: relative; overflow: hidden; }
        .banner-left { z-index: 2; }
        .gradient-text { font-size: 2.2rem; font-weight: 900; margin: 0 0 5px 0; background: linear-gradient(90deg, #ffffff, #94a3b8); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .banner-left p { color: #94a3b8; font-size: 1rem; margin: 0 0 25px 0; }
        
        .net-balance-card { background: rgba(0,0,0,0.3); border: 1px solid rgba(16, 185, 129, 0.2); padding: 20px 30px; border-radius: 16px; display: inline-block; box-shadow: inset 0 0 20px rgba(16,185,129,0.05); }
        .balance-label { display: block; font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; font-weight: bold; letter-spacing: 1px; margin-bottom: 5px; }
        .balance-value { font-size: 3.5rem; font-weight: 900; color: #fff; line-height: 1; text-shadow: 0 0 30px rgba(16, 185, 129, 0.4); margin-bottom: 10px; }
        .balance-trend { display: inline-flex; align-items: center; gap: 5px; background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 4px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: bold; }
        
        .banner-right { opacity: 0.2; transform: rotate(-15deg) scale(1.5); pointer-events: none; }

        /* KPI Cards (Crypto Style) */
        .kpi-grid-premium { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .kpi-card-v2 { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 20px; padding: 20px; backdrop-filter: blur(10px); transition: 0.3s; }
        .kpi-card-v2:hover { transform: translateY(-5px); background: rgba(30, 41, 59, 0.8); border-color: rgba(255,255,255,0.1); box-shadow: 0 15px 30px -10px rgba(0,0,0,0.6); }
        .kpi-v2-header { display: flex; align-items: center; gap: 12px; margin-bottom: 15px; }
        .kpi-v2-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .kpi-v2-title { color: #94a3b8; font-weight: bold; font-size: 0.9rem; }
        .kpi-v2-body { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
        .kpi-v2-val { font-size: 2.2rem; font-weight: 900; color: #fff; }
        .sparkline { flex: 1; max-width: 100px; }

        /* Bento Grid */
        .bento-grid-complex { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        .col-span-2 { grid-column: span 2; }
        .col-span-1 { grid-column: span 1; }
        @media (max-width: 1200px) { .bento-grid-complex { grid-template-columns: 1fr 1fr; } .col-span-2 { grid-column: span 2; } .col-span-1 { grid-column: span 1; } }
        @media (max-width: 768px) { .bento-grid-complex { grid-template-columns: 1fr; } .col-span-2, .col-span-1 { grid-column: span 1; } }

        .bento-card { background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 24px; padding: 25px; backdrop-filter: blur(10px); }
        
        .card-header-flex { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 15px; }
        .card-title-neon { margin: 0; font-size: 1.1rem; color: #fff; font-weight: 800; display: flex; align-items: center; gap: 8px; }
        .card-title-neon.text-red { color: #ef4444; }
        
        /* Badges */
        .status-badge { padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
        .status-badge.gray { background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border: 1px solid rgba(148, 163, 184, 0.3); }
        .status-badge.red { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
        .status-badge.orange { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
        .red-pulse { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); animation: pulseAlert 2s infinite; }
        @keyframes pulseAlert { 0% { box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } 70% { box-shadow: 0 0 0 10px rgba(239,68,68,0); } 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0); } }

        /* Radial Legend */
        .allocation-legend { display: flex; gap: 15px; flex-wrap: wrap; justify-content: center; margin-top: 15px; width: 100%; }
        .legend-item { display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.2); padding: 8px 12px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.02); }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
        .legend-info { display: flex; flex-direction: column; }
        .legend-name { font-size: 0.75rem; color: #94a3b8; text-transform: uppercase; font-weight: bold; }
        .legend-val { font-size: 1rem; color: #fff; font-weight: 900; }

        /* Crypto Transaction List */
        .crypto-list-wrapper { display: flex; flex-direction: column; gap: 10px; margin-top: 20px; overflow-y: auto; flex: 1; }
        .crypto-list-row { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,0.02); border-radius: 12px; transition: 0.2s; border: 1px solid transparent; }
        .crypto-list-row:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
        .clr-icon { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; }
        .clr-info { flex: 1; margin-left: 15px; }
        .clr-info h4 { margin: 0 0 2px 0; font-size: 0.95rem; color: #fff; font-weight: 700; }
        .clr-info p { margin: 0; font-size: 0.8rem; color: #64748b; font-weight: 500; }
        .clr-action { text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .clr-val { font-weight: 900; font-size: 0.95rem; }
        .text-red { color: #ef4444; } .text-orange { color: #f59e0b; }
      `}</style>
    </Layout>
  );
}