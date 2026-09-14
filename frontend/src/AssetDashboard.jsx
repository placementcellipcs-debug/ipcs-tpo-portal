import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  Laptop, Package, Wrench, WarningCircle, CircleNotch, 
  CheckCircle, Buildings, ChartLineUp, TrendUp, Export, Plus, ShieldCheck 
} from '@phosphor-icons/react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell, PieChart, Pie 
} from 'recharts';
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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh' }}>
        <CircleNotch size={50} className="ph-spin" color="#eab308" />
        <p style={{ color: '#eab308', fontSize: '1rem', marginTop: '20px', letterSpacing: '3px', textTransform: 'uppercase', fontWeight: 'bold' }}>Syncing Ecosystem...</p>
      </div>
    </Layout>
  );

  const formatCurrency = (val) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  
  // Custom Sparkline Data (Simulating live activity)
  const generateSparkline = (base) => [
    { v: base * 0.8 }, { v: base * 1.1 }, { v: base * 0.9 }, { v: base * 1.2 }, 
    { v: base * 1.0 }, { v: base * 1.4 }, { v: base }
  ];

  // Allocation Data for the Half-Doughnut Gauge
  const statusData = [
    { name: 'Assigned', value: data.assigned || 0, color: '#38bdf8' },
    { name: 'Available', value: data.available || 0, color: '#10b981' },
    { name: 'Maintenance', value: data.underMaintenance || 0, color: '#ef4444' }
  ].filter(d => d.value > 0);

  // Custom Tooltip for Recharts
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', padding: '12px 16px', borderRadius: '12px', color: '#fff', backdropFilter: 'blur(10px)', boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
          <p style={{ margin: '0 0 5px 0', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>{payload[0].payload.name || 'Count'}</p>
          <span style={{ color: payload[0].payload.color || '#fff', fontWeight: '900', fontSize: '1.3rem' }}>{payload[0].value}</span>
        </div>
      );
    }
    return null;
  };

  return (
    <Layout>
      <div className="fintech-dashboard page-container">
        
        {/* 🌟 AMBIENT GLOWS */}
        <div className="ambient-orb orb-gold"></div>
        <div className="ambient-orb orb-blue"></div>

        {/* 💳 MAIN PORTFOLIO HEADER (Crypto-Style) */}
        <div className="portfolio-banner">
          <div className="portfolio-content">
            <span className="welcome-text">Welcome back, {tpoData?.name.split(' ')[0]}</span>
            <h1 className="dashboard-title">Asset Command Center</h1>
            
            {isSuperAdmin && (
              <div className="net-worth-container">
                <span className="net-worth-label">Total Capital Invested</span>
                <div className="net-worth-value">{formatCurrency(data.totalValue)}</div>
                <div className="net-worth-trend">
                  <TrendUp size={16} weight="bold" /> 
                  <span>System Synced • Live</span>
                </div>
              </div>
            )}
          </div>
          
          <div className="portfolio-actions">
            {isSuperAdmin && (
              <button className="action-btn export" onClick={() => window.print()}>
                <Export size={18} weight="bold" /> Export Report
              </button>
            )}
            <button className="action-btn primary" onClick={() => window.location.href = '/assets/add'}>
              <Plus size={18} weight="bold" /> New Asset
            </button>
          </div>
        </div>

        {/* 📊 KPI CARDS WITH AREA SPARKLINES */}
        <div className="kpi-grid">
          
          {/* KPI 1 */}
          <div className="kpi-card">
            <div className="kpi-header">
              <div>
                <span className="kpi-title">Total Registry</span>
                <div className="kpi-value">{data.totalAssets}</div>
              </div>
              <div className="kpi-icon-box" style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.3)' }}><Laptop weight="fill" size={24}/></div>
            </div>
            <div className="kpi-chart">
              <ResponsiveContainer width="100%" height={60}>
                <AreaChart data={generateSparkline(data.totalAssets)}>
                  <defs>
                    <linearGradient id="colorBlue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#38bdf8" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#colorBlue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* KPI 2 */}
          <div className="kpi-card">
            <div className="kpi-header">
              <div>
                <span className="kpi-title">Active Assignments</span>
                <div className="kpi-value">{data.assigned}</div>
              </div>
              <div className="kpi-icon-box" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)' }}><CheckCircle weight="fill" size={24}/></div>
            </div>
            <div className="kpi-chart">
              <ResponsiveContainer width="100%" height={60}>
                <AreaChart data={generateSparkline(data.assigned)}>
                  <defs>
                    <linearGradient id="colorGreen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorGreen)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* KPI 3 */}
          <div className="kpi-card">
            <div className="kpi-header">
              <div>
                <span className="kpi-title">Available Stock</span>
                <div className="kpi-value">{data.available}</div>
              </div>
              <div className="kpi-icon-box" style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', border: '1px solid rgba(168, 85, 247, 0.3)' }}><Package weight="fill" size={24}/></div>
            </div>
            <div className="kpi-chart">
              <ResponsiveContainer width="100%" height={60}>
                <AreaChart data={generateSparkline(data.available)}>
                  <defs>
                    <linearGradient id="colorPurple" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke="#a855f7" strokeWidth={2} fillOpacity={1} fill="url(#colorPurple)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* KPI 4 */}
          <div className="kpi-card">
            <div className="kpi-header">
              <div>
                <span className="kpi-title">In Maintenance</span>
                <div className="kpi-value">{data.underMaintenance}</div>
              </div>
              <div className="kpi-icon-box" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)' }}><Wrench weight="fill" size={24}/></div>
            </div>
            <div className="kpi-chart">
              <ResponsiveContainer width="100%" height={60}>
                <AreaChart data={generateSparkline(data.underMaintenance)}>
                  <defs>
                    <linearGradient id="colorRed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="v" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorRed)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* 🎛️ BENTO BOX GRID */}
        <div className="bento-grid">
          
          {/* COL 1: ASSET ALLOCATIONS (GAUGE) */}
          <div className="fintech-panel col-span-1" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="panel-header">
              <h3><ChartLineUp size={18}/> Asset Allocations</h3>
            </div>
            
            {/* The Half-Doughnut Gauge */}
            <div style={{ height: '220px', width: '100%', position: 'relative', marginTop: '10px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusData}
                    cx="50%" cy="80%" // Pushes it down to look like a speedometer
                    startAngle={180} endAngle={0} // Half circle
                    innerRadius={80} outerRadius={110}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                    cornerRadius={5}
                  >
                    {statusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} style={{ filter: `drop-shadow(0px 0px 6px ${entry.color}60)` }} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Gauge Center Text */}
              <div style={{ position: 'absolute', bottom: '15px', left: '0', right: '0', textAlign: 'center' }}>
                <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px' }}>Total Portfolio</span>
                <div style={{ fontSize: '2rem', fontWeight: '900', color: '#fff', lineHeight: '1' }}>{data.totalAssets}</div>
              </div>
            </div>

            {/* Legend */}
            <div className="gauge-legend">
              {statusData.map((s, i) => (
                <div key={i} className="legend-row">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="legend-dot" style={{ background: s.color, boxShadow: `0 0 8px ${s.color}` }}></span>
                    <span className="legend-label">{s.name}</span>
                  </div>
                  <span className="legend-percent">{((s.value / data.totalAssets) * 100 || 0).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* COL 2: BRANCH DISTRIBUTION (GRADIENT BARS) */}
          <div className="fintech-panel col-span-2">
            <div className="panel-header">
              <h3><Buildings size={18}/> Branch Infrastructure Volume</h3>
            </div>
            
            <div style={{ height: '300px', width: '100%', marginTop: '20px' }}>
              {data.branches.length === 0 ? <p style={{ color: '#64748b', textAlign: 'center' }}>No data available.</p> : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.branches} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" stroke="#64748b" tick={{fontSize: 12, fill: '#64748b'}} axisLine={false} tickLine={false} />
                    <YAxis dataKey="name" type="category" stroke="#cbd5e1" fontSize={12} fontWeight="bold" tickLine={false} axisLine={false} width={100} />
                    <Tooltip content={<CustomTooltip />} cursor={{fill: 'rgba(255,255,255,0.05)'}} />
                    <Bar dataKey="value" fill="url(#barGradient)" radius={[0, 6, 6, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* COL 3: LEDGER-STYLE ALERTS */}
          <div className="fintech-panel col-span-1" style={{ display: 'flex', flexDirection: 'column' }}>
            <div className="panel-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <h3 style={{ color: '#ef4444' }}><WarningCircle size={18}/> Activity & Alerts</h3>
            </div>
            
            <div className="ledger-list">
              {data.lowStock.length === 0 && data.activeMaintenance === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#10b981' }}>
                  <ShieldCheck size={40} style={{ opacity: 0.5, margin: '0 auto 10px auto' }} />
                  <p style={{ margin: 0, fontWeight: 'bold' }}>All Systems Healthy</p>
                </div>
              ) : (
                <>
                  {data.activeMaintenance > 0 && (
                    <div className="ledger-row">
                      <div className="ledger-icon" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}><Wrench weight="fill" /></div>
                      <div className="ledger-info">
                        <div className="ledger-title">Asset Repairs</div>
                        <div className="ledger-sub">Maintenance Dept</div>
                      </div>
                      <div className="ledger-action">
                        <span className="ledger-val" style={{ color: '#ef4444' }}>{data.activeMaintenance} Tickets</span>
                        <span className="ledger-badge red">Action Needed</span>
                      </div>
                    </div>
                  )}

                  {data.lowStock.slice(0, 5).map((item, idx) => (
                    <div key={idx} className="ledger-row">
                      <div className="ledger-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}><Package weight="fill" /></div>
                      <div className="ledger-info">
                        <div className="ledger-title">{item.name}</div>
                        <div className="ledger-sub">{item.branch}</div>
                      </div>
                      <div className="ledger-action">
                        <span className="ledger-val" style={{ color: '#f59e0b' }}>{item.qty} Remaining</span>
                        <span className="ledger-badge orange">Low Stock</span>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ---------------------------------------------------------
          🎨 FINTECH STYLESHEET
      --------------------------------------------------------- */}
      <style>{`
        .fintech-dashboard { 
          font-family: 'Inter', sans-serif; 
          color: #f8fafc; 
          padding-top: 20px;
        }

        /* Background Glows */
        .ambient-orb { position: absolute; border-radius: 50%; filter: blur(120px); opacity: 0.15; z-index: -1; pointer-events: none; }
        .orb-gold { width: 500px; height: 500px; background: #eab308; top: -100px; left: 10%; }
        .orb-blue { width: 600px; height: 600px; background: #3b82f6; top: 20%; right: -100px; }

        /* Top Banner */
        .portfolio-banner { 
          display: flex; 
          justify-content: space-between; 
          align-items: flex-end; 
          margin-bottom: 30px; 
          border-top: 2px solid rgba(234, 179, 8, 0.3); /* Gold accent top border */
          background: linear-gradient(180deg, rgba(15,23,42,0.8) 0%, rgba(15,23,42,0.4) 100%);
          border-radius: 20px;
          padding: 30px;
          backdrop-filter: blur(10px);
          flex-wrap: wrap;
          gap: 20px;
        }
        
        .welcome-text { font-size: 0.9rem; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; }
        .dashboard-title { font-size: 2.2rem; font-weight: 900; margin: 5px 0 20px 0; color: #fff; }
        
        .net-worth-container { display: flex; flexDirection: column; }
        .net-worth-label { font-size: 0.8rem; color: #94a3b8; font-weight: bold; margin-bottom: 5px; display: block; }
        .net-worth-value { font-size: 3rem; font-weight: 900; color: #fff; line-height: 1; letter-spacing: -1px; }
        .net-worth-trend { display: inline-flex; alignItems: center; gap: 5px; color: #10b981; font-size: 0.85rem; font-weight: bold; margin-top: 8px; }

        .portfolio-actions { display: flex; gap: 15px; }
        .action-btn { padding: 12px 20px; border-radius: 12px; font-weight: bold; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; border: none; cursor: pointer; transition: 0.3s; }
        .action-btn.export { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); }
        .action-btn.export:hover { background: rgba(255,255,255,0.1); }
        .action-btn.primary { background: #eab308; color: #0f172a; } /* Gold button */
        .action-btn.primary:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(234, 179, 8, 0.3); }

        /* KPI Cards */
        .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 25px; }
        .kpi-card { 
          background: rgba(15, 23, 42, 0.6); 
          border: 1px solid rgba(255,255,255,0.05); 
          border-radius: 20px; 
          padding: 20px 20px 0 20px; /* No bottom padding so chart touches edge */
          overflow: hidden;
          display: flex;
          flex-direction: column;
          backdrop-filter: blur(10px);
          transition: 0.3s;
        }
        .kpi-card:hover { border-color: rgba(255,255,255,0.1); transform: translateY(-5px); box-shadow: 0 15px 30px rgba(0,0,0,0.4); }
        
        .kpi-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
        .kpi-title { font-size: 0.8rem; color: #94a3b8; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
        .kpi-value { font-size: 2rem; font-weight: 900; color: #fff; margin-top: 5px; line-height: 1; }
        .kpi-icon-box { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; }
        .kpi-chart { margin: 0 -20px; /* Pulls chart to the exact edges */ }

        /* Bento Grid */
        .bento-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
        .col-span-2 { grid-column: span 2; }
        .col-span-1 { grid-column: span 1; }
        
        @media (max-width: 1200px) { .bento-grid { grid-template-columns: 1fr 1fr; } .col-span-2 { grid-column: span 2; } .col-span-1 { grid-column: span 1; } }
        @media (max-width: 768px) { .bento-grid { grid-template-columns: 1fr; } .col-span-2, .col-span-1 { grid-column: span 1; } }

        .fintech-panel { 
          background: rgba(15, 23, 42, 0.6); 
          border: 1px solid rgba(255,255,255,0.05); 
          border-radius: 24px; 
          padding: 25px; 
          backdrop-filter: blur(10px); 
        }

        .panel-header h3 { margin: 0; font-size: 1.05rem; color: #fff; font-weight: bold; display: flex; align-items: center; gap: 8px; }

        /* Gauge Legend */
        .gauge-legend { width: 100%; display: flex; flex-direction: column; gap: 12px; margin-top: 15px; }
        .legend-row { display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 10px 15px; border-radius: 12px; }
        .legend-dot { width: 10px; height: 10px; border-radius: 50%; }
        .legend-label { font-size: 0.85rem; color: #cbd5e1; font-weight: bold; }
        .legend-percent { font-size: 0.9rem; color: #fff; font-weight: 900; }

        /* Ledger List */
        .ledger-list { display: flex; flex-direction: column; gap: 10px; margin-top: 15px; flex: 1; overflow-y: auto; }
        .ledger-row { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,0.02); border-radius: 12px; transition: 0.2s; }
        .ledger-row:hover { background: rgba(255,255,255,0.05); }
        .ledger-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; }
        .ledger-info { flex: 1; margin-left: 15px; }
        .ledger-title { font-size: 0.95rem; font-weight: bold; color: #fff; margin-bottom: 2px; }
        .ledger-sub { font-size: 0.75rem; color: #64748b; font-weight: bold; text-transform: uppercase; }
        .ledger-action { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .ledger-val { font-size: 0.9rem; font-weight: 900; }
        
        .ledger-badge { padding: 4px 8px; border-radius: 6px; font-size: 0.65rem; font-weight: bold; text-transform: uppercase; }
        .ledger-badge.red { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
        .ledger-badge.orange { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
      `}</style>
    </Layout>
  );
}