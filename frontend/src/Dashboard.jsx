import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Briefcase, Trophy, CalendarCheck, CircleNotch, 
  BookOpen, NotePencil, Desktop, FolderOpen, ListChecks, 
  ChartBar, MapPinLine, Clock, Student, ChalkboardTeacher,
  WarningCircle, Buildings, CheckCircle, ArrowUpRight
} from '@phosphor-icons/react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell 
} from 'recharts';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function Dashboard() {
  const navigate = useNavigate();
  
  // ---------------------------------------------------------
  // 🔐 ROLE-BASED ACCESS CONTROL (SAFE PARSING)
  // ---------------------------------------------------------
  let tpoData = {};
  try {
    const rawData = localStorage.getItem('tpoData');
    if (rawData) tpoData = JSON.parse(rawData) || {};
  } catch(e) { console.error("Error reading tpoData"); }
  
  const userRole = String(tpoData?.role || '').toUpperCase();
  const accessType = String(tpoData?.accessType || '').toLowerCase();
  
  const isSuperAdmin = accessType === 'superadmin' || userRole.includes('ADMIN') || userRole.includes('HEAD') || userRole.includes('MANAGER');
  const isTpo = userRole.includes('TPO') || isSuperAdmin; 
  const isTrainer = userRole.includes('TRAINER') || userRole.includes('TTH') || isSuperAdmin;

  // ---------------------------------------------------------
  // 📊 STATE MANAGEMENT
  // ---------------------------------------------------------
  const [stats, setStats] = useState({ totalStudents: 0, pendingApps: 0, placed: 0, activeVacancies: 0 });
  const [events, setEvents] = useState([]);
  const [recentPlacements, setRecentPlacements] = useState([]);
  const [activeIssues, setActiveIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  const [trendData, setTrendData] = useState(Array(12).fill({ m: '', Applications: 0, Offers: 0, Placed: 0 }));
  const [domainData, setDomainData] = useState([]);
  const [topCompanies, setTopCompanies] = useState([]);
  const [pipeline, setPipeline] = useState({ applied: 0, interview: 0, offers: 0, placed: 0 });
  const [totalAppsCount, setTotalAppsCount] = useState(0);
  const [trainerLogs, setTrainerLogs] = useState([]);

  const DOMAIN_COLORS = ['#3b82f6', '#10b981', '#a855f7', '#f59e0b', '#ec4899', '#0ea5e9'];

  // ---------------------------------------------------------
  // ⚙️ DATA PROCESSING (BULLETPROOF)
  // ---------------------------------------------------------
  const parseDateRobust = (dStr) => {
    if (!dStr) return null;
    let cleanStr = typeof dStr === 'string' ? dStr.split(' ')[0].replace(/st|nd|rd|th/g, '') : dStr;
    if (typeof cleanStr === 'string' && (cleanStr.includes('/') || cleanStr.includes('-'))) {
      const parts = cleanStr.split(/[/-]/);
      if (parts.length === 3) {
        if (parts[2].length === 4) return new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        if (parts[0].length === 4) return new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`);
      }
    }
    const d = new Date(cleanStr);
    return isNaN(d) ? null : d;
  };

  const getStandardDomain = (courseStr) => {
    if (!courseStr) return 'Other';
    const c = String(courseStr).toLowerCase();
    if (c.includes('automation') || c.includes('plc')) return 'Industrial Automation';
    if (c.includes('bms') || c.includes('cctv')) return 'BMS & CCTV';
    if (c.includes('embed') || c.includes('iot')) return 'Embedded & IoT';
    if (c.includes('digital') || c.includes('dm')) return 'Digital Marketing';
    if (c.includes('python') || c.includes('data') || c.includes('it')) return 'Data Science & IT';
    return 'Other';
  };

  const processApps = (tpoLogs) => {
    if (!Array.isArray(tpoLogs)) return;
    const deduped = {};
    
    tpoLogs.forEach(row => {
      if (!row) return;
      const getVal = (s) => {
        const targetKey = Object.keys(row).find(k => String(k).toLowerCase().replace(/\s/g, '').includes(String(s).toLowerCase()));
        return targetKey ? row[targetKey] : '';
      };
      
      const log = {
        name: getVal('studentname') || getVal('name') || 'Unknown', 
        roll: getVal('roll'), 
        company: getVal('company') || 'Unknown',
        course: getVal('course') || 'General', 
        status: getVal('status') || 'Applied', 
        date: getVal('dateplaced') || getVal('timestamp'),
        joiningStatus: getVal('joiningstatus')
      };
      
      const key = `${log.roll || log.name}_${log.company}`.toLowerCase();
      if (!deduped[key] || (log.status.toLowerCase().includes('placed') || log.status.toLowerCase().includes('offer'))) {
        deduped[key] = log;
      }
    });
    
    const uniqueApps = Object.values(deduped);
    setTotalAppsCount(uniqueApps.length);
    
    const currentYear = new Date().getFullYear();
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    let newTrend = months.map(m => ({ m, Applications: 0, Offers: 0, Placed: 0 }));
    let domCount = {};
    let compCount = {};
    let pApp = 0, pInt = 0, pOff = 0, pPl = 0;
    const placedRecent = [];

    uniqueApps.forEach(app => {
      const st = String(app.status || '').toLowerCase();
      const jSt = String(app.joiningStatus || '').toLowerCase();
      const isPlaced = st.includes('placed') || st.includes('offer') || jSt.includes('join');
      const isOffer = st.includes('offer') || isPlaced;
      
      if (isPlaced) placedRecent.push(app);
      if (st.includes('applied') || st.includes('pending')) pApp++;
      if (st.includes('interview') || st.includes('shortlist')) pInt++;
      if (st.includes('offer')) pOff++;
      if (isPlaced) pPl++;
      
      if (isPlaced) { 
        let c = getStandardDomain(app.course); 
        domCount[c] = (domCount[c] || 0) + 1; 
        if (app.company && app.company.toLowerCase() !== 'unknown company' && app.company.toLowerCase() !== 'unknown') {
          compCount[app.company] = (compCount[app.company] || 0) + 1;
        }
      }

      const d = parseDateRobust(app.date);
      if (d && d.getFullYear() === currentYear) {
        const mIdx = d.getMonth();
        newTrend[mIdx].Applications++;
        if (isOffer) newTrend[mIdx].Offers++;
        if (isPlaced) newTrend[mIdx].Placed++;
      }
    });

    setTrendData(newTrend);
    setDomainData(Object.keys(domCount).map((k) => ({ name: k, value: domCount[k] })).sort((a,b) => b.value - a.value).slice(0, 5));
    setTopCompanies(Object.keys(compCount).map(k => ({ name: k, count: compCount[k] })).sort((a,b) => b.count - a.count).slice(0, 3));
    setPipeline({ applied: pApp, interview: pInt, offers: pOff, placed: pPl });
    setRecentPlacements(placedRecent.sort((a, b) => (parseDateRobust(b.date)?.getTime()||0) - (parseDateRobust(a.date)?.getTime()||0)).slice(0, 4));
  };

  useEffect(() => {
    if (!tpoData || !tpoData.role) return;

    const fetchData = async () => {
      try {
        const reqPayload = { 
          assignedBranchesArray: tpoData.assignedBranchesArray || [], 
          role: tpoData.role || '', 
          assignedCourse: tpoData.assignedCourse || '', 
          tpoName: tpoData.name || ''
        };
        
        const [statsRes, reportsRes] = await Promise.all([
          axios.post(`${API_BASE}/api/tpo/dashboard-stats`, reqPayload),
          axios.post(`${API_BASE}/api/tpo/reports`, reqPayload)
        ]);
        
        if (statsRes.data && statsRes.data.success) { 
          setStats(statsRes.data.stats || stats); 
          setEvents(statsRes.data.events || []); 
        }

        if (reportsRes.data && reportsRes.data.success) {
          processApps(reportsRes.data.tpoLogs || []);
          setActiveIssues((reportsRes.data.issues || []).filter(i => String(i.status||'').toLowerCase() !== 'resolved').slice(0, 3));
        }

        if (isTrainer) {
          const trRes = await axios.get(`${API_BASE}/api/admin/trainer-logs`);
          if (trRes.data && trRes.data.success) {
            let myLogs = trRes.data.logs || [];
            if (!isSuperAdmin) myLogs = myLogs.filter(l => l.trainerName === tpoData.name);
            setTrainerLogs(myLogs.slice(0, 5));
          }
        }
      } catch (err) { console.error("Dashboard Fetch Error:", err); } finally { setLoading(false); }
    };
    fetchData();
  }, []); 

  const today = new Date();
  today.setHours(0,0,0,0);
  const upcomingEvents = (events || []).filter(e => {
    const pd = parseDateRobust(e?.date); 
    return pd && pd >= today && !String(e?.title || '').toLowerCase().includes('dummy');
  }).sort((a,b) => (parseDateRobust(a.date)?.getTime()||0) - (parseDateRobust(b.date)?.getTime()||0)).slice(0, 4);

  // Math Helpers
  const totalPipe = (pipeline.applied + pipeline.interview + pipeline.offers + pipeline.placed) || 1;
  const pApp = ((pipeline.applied / totalPipe) * 100).toFixed(0);
  const pInt = ((pipeline.interview / totalPipe) * 100).toFixed(0);
  const pOff = ((pipeline.offers / totalPipe) * 100).toFixed(0);
  const pPlc = ((pipeline.placed / totalPipe) * 100).toFixed(0);
  const placementRate = stats.totalStudents > 0 ? ((stats.placed / stats.totalStudents) * 100).toFixed(1) : '0.0';

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #334155', padding: '12px', borderRadius: '8px', color: '#fff' }}>
          {label && <p style={{ margin: '0 0 8px 0', borderBottom: '1px solid #334155', paddingBottom: '6px', fontSize: '0.9rem', fontWeight: 'bold' }}>{label}</p>}
          {payload.map((entry, index) => (
            <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', fontSize: '0.8rem' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: entry.color }}></div>
              <span style={{ color: '#cbd5e1' }}>{entry.name}:</span>
              <span style={{ fontWeight: 'bold' }}>{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <Layout>
      <div className="premium-dashboard-wrapper">
        
        {/* =========================================================
            HEADER & FLOATING KPIS
        ========================================================= */}
        <div className="top-hero-section">
          <div className="hero-text">
            <h1>Welcome in, {String(tpoData?.name || 'Officer').split(' ')[0]}</h1>
            <p>Real-time ecosystem overview for {today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          
          <div className="floating-kpis">
            <div className="f-kpi">
              <span className="f-icon"><Users weight="fill" color="#3b82f6"/></span>
              <div className="f-data">
                <h2>{loading ? <CircleNotch className="ph-spin"/> : stats.totalStudents}</h2>
                <p>Total Students</p>
              </div>
            </div>
            <div className="f-kpi">
              <span className="f-icon"><Briefcase weight="fill" color="#10b981"/></span>
              <div className="f-data">
                <h2>{loading ? <CircleNotch className="ph-spin"/> : stats.activeVacancies}</h2>
                <p>Active Hiring</p>
              </div>
            </div>
            <div className="f-kpi">
              <span className="f-icon"><Trophy weight="fill" color="#a855f7"/></span>
              <div className="f-data">
                <h2>{loading ? <CircleNotch className="ph-spin"/> : stats.placed}</h2>
                <p>Placed Students</p>
              </div>
            </div>
          </div>
        </div>

        {/* =========================================================
            SEGMENTED PROGRESS BAR
        ========================================================= */}
        <div className="segmented-pipeline-container">
          <div className="seg-labels">
            <span style={{ width: `${pApp}%` }}>Apps ({pipeline.applied})</span>
            <span style={{ width: `${pInt}%` }}>Interviews ({pipeline.interview})</span>
            <span style={{ width: `${pOff}%` }}>Offers ({pipeline.offers})</span>
            <span style={{ width: `${pPlc}%` }}>Placed ({pipeline.placed})</span>
          </div>
          <div className="seg-bar-wrapper">
            <div className="seg-fill" style={{ width: `${pApp}%`, background: '#334155' }}></div>
            <div className="seg-fill" style={{ width: `${pInt}%`, background: '#3b82f6' }}></div>
            <div className="seg-fill" style={{ width: `${pOff}%`, background: '#f59e0b' }}></div>
            <div className="seg-fill" style={{ width: `${pPlc}%`, background: '#10b981' }}></div>
          </div>
        </div>

        {/* =========================================================
            MAIN BENTO GRID
        ========================================================= */}
        <div className="bento-master-grid">
          
          {/* PROFILE CARD */}
          <div className="bento-card profile-bento">
            <div className="profile-img-container">
              {tpoData?.photo ? (
                <img src={tpoData.photo} alt="Profile" className="profile-img" />
              ) : (
                <div className="profile-fallback">{String(tpoData?.name || 'U').charAt(0).toUpperCase()}</div>
              )}
            </div>
            <div className="profile-info">
              <h2>{tpoData?.name || 'Officer'}</h2>
              <p>{tpoData?.role || 'Staff Member'}</p>
            </div>
            <div className="profile-badge">
              <span>{tpoData?.sittingBranch || 'All Branches'}</span>
            </div>
            <div className="profile-stats">
              <div className="p-stat"><span>Role</span><strong>{accessType.toUpperCase()}</strong></div>
              <div className="p-stat"><span>Status</span><strong style={{color: '#10b981'}}>Active</strong></div>
            </div>
          </div>

          {/* TRENDS CHART */}
          <div className="bento-card charts-bento">
            <div className="card-header">
              <h3>Progress Trends <ArrowUpRight size={16} color="#64748b"/></h3>
              <div className="chart-legend-mini">
                <span style={{color: '#3b82f6'}}>● Placed</span>
                <span style={{color: '#10b981'}}>● Offers</span>
                <span style={{color: '#a855f7'}}>● Apps</span>
              </div>
            </div>
            <div style={{ height: '220px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorApps" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/><stop offset="95%" stopColor="#a855f7" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorOff" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                    <linearGradient id="colorPl" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/><stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/></linearGradient>
                  </defs>
                  <XAxis dataKey="m" stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="Applications" stroke="#a855f7" strokeWidth={3} fillOpacity={1} fill="url(#colorApps)" />
                  <Area type="monotone" dataKey="Offers" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorOff)" />
                  <Area type="monotone" dataKey="Placed" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorPl)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* DONUT CHART */}
          <div className="bento-card circular-bento">
            <div className="card-header">
              <h3>Domain Spread <ArrowUpRight size={16} color="#64748b"/></h3>
            </div>
            <div className="donut-wrapper">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Tooltip content={<CustomTooltip />} />
                  <Pie data={domainData.length > 0 ? domainData : [{name: 'No Data', value: 1}]} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={4} dataKey="value" stroke="none">
                    {(domainData.length > 0 ? domainData : [{name: 'No Data'}]).map((e, i) => <Cell key={`c-${i}`} fill={DOMAIN_COLORS[i % DOMAIN_COLORS.length]} /> )}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-center">
                <h3>{stats.placed}</h3><p>Total</p>
              </div>
            </div>
            <div className="mini-legend">
              {domainData.slice(0,3).map((d, i) => (
                <div key={d.name} className="ml-item">
                  <span style={{background: DOMAIN_COLORS[i]}}></span> {d.name}
                </div>
              ))}
            </div>
          </div>

          {/* UPCOMING EVENTS */}
          <div className="bento-card dark-task-list">
            <div className="dark-task-header">
              <h3>Upcoming Schedule</h3>
              <span className="task-count">{upcomingEvents.length}</span>
            </div>
            <div className="dark-tasks">
              {upcomingEvents.length === 0 ? <p className="empty-tasks">No events scheduled.</p> :
                upcomingEvents.map((evt, i) => (
                  <div key={i} className="dark-task-item">
                    <div className="dt-icon"><CalendarCheck size={18} weight="fill"/></div>
                    <div className="dt-info">
                      <h4>{evt.title}</h4>
                      <p>{String(evt.date || '').substring(0,10)} | {evt.location || 'Online'}</p>
                    </div>
                    <div className="dt-check"><CheckCircle size={20} weight="fill"/></div>
                  </div>
              ))}
            </div>
          </div>
        </div>

        {/* =========================================================
            BOTTOM GRID: QUICK ACCESS & RECENT ACTIVITY
        ========================================================= */}
        <div className="bottom-bento-grid">
          
          <div className="bento-card" style={{ gridColumn: 'span 2' }}>
            <div className="card-header">
              <h3>Recent Placements</h3>
              <button className="text-link" onClick={()=>navigate('/placed')}>View All</button>
            </div>
            <div className="clean-list">
              {recentPlacements.length > 0 ? recentPlacements.map((p, i) => (
                <div key={i} className="clean-row">
                  <div className="cl-left">
                    <div className="cl-avatar">{String(p.name || 'U').charAt(0).toUpperCase()}</div>
                    <div><div className="cl-title">{p.name}</div><div className="cl-sub">{p.course}</div></div>
                  </div>
                  <div className="cl-right">
                    <div className="cl-title text-blue">{p.company}</div>
                    <div className="cl-sub status-pill green">{String(p.status||'Placed').toUpperCase()}</div>
                  </div>
                </div>
              )) : <p className="empty-state">No recent placements.</p>}
            </div>
          </div>

          {/* ACTION CENTER / TRAINER LOGS */}
          <div className="bento-card">
            {(isSuperAdmin || isTpo) && !isTrainer ? (
              <>
                <div className="card-header">
                  <h3>Action Center</h3>
                  <button className="text-link" onClick={()=>navigate('/issues')}>Resolve</button>
                </div>
                <div className="clean-list">
                  {activeIssues.length > 0 ? activeIssues.map((issue, i) => (
                    <div key={i} className="clean-row alert-row">
                      <div className="cl-left">
                        <div className="cl-icon red"><WarningCircle weight="bold"/></div>
                        <div style={{overflow: 'hidden'}}>
                          <div className="cl-title">{issue.name} ({issue.branch})</div>
                          <div className="cl-sub truncate">{issue.details}</div>
                        </div>
                      </div>
                    </div>
                  )) : (
                    <div className="empty-state">
                      <span style={{ fontSize: '2rem' }}>🎉</span>
                      <p>All clear! No active student issues.</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="card-header">
                  <h3>My Trainer Logs</h3>
                  <button className="text-link" onClick={()=>navigate('/trainer-logs')}>History</button>
                </div>
                <div className="clean-list">
                  {trainerLogs.length > 0 ? trainerLogs.map((l, i) => (
                    <div key={i} className="clean-row">
                      <div className="cl-left">
                        <div className="cl-icon green"><ChalkboardTeacher weight="fill"/></div>
                        <div>
                          <div className="cl-title">{l.course}</div>
                          <div className="cl-sub">{String(l.timestamp || '').split(' ')[0] || 'Recent'}</div>
                        </div>
                      </div>
                      <div className="cl-right" style={{ display: 'flex', gap: '5px' }}>
                        <span className="status-pill green">{l.present} P</span>
                        <span className="status-pill red">{l.absentees} A</span>
                      </div>
                    </div>
                  )) : <div className="empty-state">No logs submitted recently.</div>}
                </div>
              </>
            )}
          </div>

          <div className="bento-card">
            <h3>Quick Access</h3>
            <div className="quick-access-grid">
              <div className="qa-btn" onClick={()=>navigate('/students')}><Student size={24} color="#3b82f6" weight="fill"/><span>Students</span></div>
              <div className="qa-btn" onClick={()=>navigate('/exams')}><NotePencil size={24} color="#f59e0b" weight="fill"/><span>Exams</span></div>
              <div className="qa-btn" onClick={()=>navigate('/study-materials')}><BookOpen size={24} color="#ec4899" weight="fill"/><span>Material</span></div>
              <div className="qa-btn" onClick={()=>navigate('/clients')}><FolderOpen size={24} color="#0ea5e9" weight="fill"/><span>Docs</span></div>
              
              {isTpo && <div className="qa-btn" onClick={()=>navigate('/placement-drives')}><CalendarCheck size={24} color="#a855f7" weight="fill"/><span>Drives</span></div>}
              {isTpo && <div className="qa-btn" onClick={()=>navigate('/tracker')}><ListChecks size={24} color="#10b981" weight="fill"/><span>Tracker</span></div>}
              {isTpo && <div className="qa-btn" onClick={()=>navigate('/talentino')}><Users size={24} color="#eab308" weight="fill"/><span>Talentino</span></div>}
              {showReports && <div className="qa-btn" onClick={()=>navigate('/reports')}><ChartBar size={24} color="#3b82f6" weight="fill"/><span>Reports</span></div>}
            </div>
          </div>

        </div>

        {/* ---------------------------------------------------------
            🎨 CSS FOR "BENTO BOX" PREMIUM LAYOUT
        --------------------------------------------------------- */}
        <style>{`
          .premium-dashboard-wrapper { font-family: 'Inter', sans-serif; color: #f8fafc; }
          
          /* Hero Section */
          .top-hero-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; flex-wrap: wrap; gap: 20px; }
          .hero-text h1 { font-size: 2.2rem; font-weight: 800; margin: 0 0 5px 0; color: #fff; }
          .hero-text p { color: #94a3b8; margin: 0; font-size: 1rem; }
          
          /* Floating KPIs */
          .floating-kpis { display: flex; gap: 40px; align-items: center; }
          .f-kpi { display: flex; align-items: center; gap: 15px; }
          .f-icon { width: 45px; height: 45px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; }
          .f-data h2 { font-size: 2.2rem; font-weight: 300; margin: 0; color: #fff; line-height: 1; font-family: monospace; }
          .f-data p { font-size: 0.75rem; font-weight: bold; color: #64748b; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px; }
          
          @media (max-width: 900px) {
            .top-hero-section { flex-direction: column; align-items: flex-start; }
            .floating-kpis { width: 100%; justify-content: space-between; gap: 10px; }
            .f-data h2 { font-size: 1.5rem; }
          }

          /* Segmented Bar */
          .segmented-pipeline-container { background: #111827; border-radius: 16px; padding: 25px; margin-bottom: 25px; border: 1px solid #1e293b; }
          .seg-labels { display: flex; width: 100%; margin-bottom: 12px; }
          .seg-labels span { font-size: 0.75rem; color: #cbd5e1; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; padding-right: 5px; }
          .seg-bar-wrapper { width: 100%; height: 16px; background: #0f1523; border-radius: 20px; display: flex; overflow: hidden; box-shadow: inset 0 2px 5px rgba(0,0,0,0.5); }
          .seg-fill { height: 100%; transition: width 1s ease-in-out; }

          /* Bento Master Grid */
          .bento-master-grid { display: grid; grid-template-columns: 1fr 2fr 1fr 1.2fr; gap: 20px; margin-bottom: 20px; }
          .bento-card { background: #111827; border: 1px solid #1e293b; border-radius: 24px; padding: 25px; position: relative; overflow: hidden; }
          
          @media (max-width: 1300px) { .bento-master-grid { grid-template-columns: 1fr 1fr; } }
          @media (max-width: 768px) { .bento-master-grid { grid-template-columns: 1fr; } }

          /* Left: Profile Card */
          .profile-bento { display: flex; flex-direction: column; align-items: center; text-align: center; justify-content: center; background: linear-gradient(180deg, #1e293b 0%, #0f1523 100%); }
          .profile-img-container { width: 100px; height: 100px; border-radius: 30px; margin-bottom: 15px; overflow: hidden; border: 3px solid #334155; box-shadow: 0 10px 20px rgba(0,0,0,0.5); }
          .profile-img { width: 100%; height: 100%; object-fit: cover; }
          .profile-fallback { width: 100%; height: 100%; background: #3b82f6; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 2.5rem; font-weight: bold; }
          .profile-info h2 { font-size: 1.2rem; margin: 0 0 5px 0; color: #fff; }
          .profile-info p { font-size: 0.85rem; color: #94a3b8; margin: 0; }
          .profile-badge { background: rgba(255,255,255,0.05); padding: 6px 16px; border-radius: 20px; font-size: 0.75rem; font-weight: bold; margin: 15px 0; border: 1px solid rgba(255,255,255,0.1); }
          .profile-stats { display: flex; gap: 20px; width: 100%; border-top: 1px solid #1e293b; padding-top: 15px; justify-content: center; }
          .p-stat { display: flex; flex-direction: column; align-items: center; gap: 4px; }
          .p-stat span { font-size: 0.7rem; color: #64748b; text-transform: uppercase; }
          .p-stat strong { font-size: 0.85rem; color: #fff; }

          /* Charts Details */
          .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .card-header h3 { margin: 0; font-size: 1.1rem; color: #fff; display: flex; align-items: center; gap: 8px; }
          .chart-legend-mini { display: flex; gap: 12px; font-size: 0.75rem; font-weight: bold; }
          
          .donut-wrapper { position: relative; width: 100%; height: 180px; }
          .donut-center { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; }
          .donut-center h3 { margin: 0; font-size: 1.8rem; color: #fff; }
          .donut-center p { margin: 0; font-size: 0.75rem; color: #64748b; }
          .mini-legend { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 15px; justify-content: center; }
          .ml-item { font-size: 0.75rem; color: #94a3b8; display: flex; align-items: center; gap: 6px; }
          .ml-item span { width: 8px; height: 8px; border-radius: 2px; }

          /* Right: Dark Task List */
          .dark-task-list { background: #1a1a1a; border: none; box-shadow: inset 0 2px 10px rgba(0,0,0,0.5); }
          .dark-task-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 15px; border-bottom: 1px solid #333; }
          .dark-task-header h3 { margin: 0; font-size: 1rem; color: #fff; }
          .task-count { font-size: 1.2rem; color: #fff; font-weight: 300; }
          .dark-tasks { display: flex; flex-direction: column; gap: 15px; }
          .dark-task-item { display: flex; align-items: center; gap: 15px; }
          .dt-icon { width: 32px; height: 32px; border-radius: 10px; background: rgba(255,255,255,0.05); color: #94a3b8; display: flex; align-items: center; justify-content: center; }
          .dt-info { flex: 1; overflow: hidden; }
          .dt-info h4 { margin: 0 0 4px 0; font-size: 0.85rem; color: #e2e8f0; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .dt-info p { margin: 0; font-size: 0.7rem; color: #64748b; }
          .dt-check { color: #f59e0b; }
          .empty-tasks { color: #64748b; font-size: 0.85rem; font-style: italic; }

          /* Bottom Grid */
          .bottom-bento-grid { display: grid; grid-template-columns: 1.5fr 1fr 1fr; gap: 20px; }
          @media (max-width: 1100px) { .bottom-bento-grid { grid-template-columns: 1fr 1fr; } }
          @media (max-width: 768px) { .bottom-bento-grid { grid-template-columns: 1fr; } }

          /* Clean Lists */
          .text-link { background: none; border: none; color: #3b82f6; cursor: pointer; font-size: 0.8rem; font-weight: bold; }
          .clean-list { display: flex; flex-direction: column; gap: 10px; }
          .clean-row { display: flex; justify-content: space-between; align-items: center; padding: 12px; background: rgba(255,255,255,0.02); border-radius: 12px; transition: 0.2s; }
          .clean-row:hover { background: #1e293b; }
          .cl-left { display: flex; align-items: center; gap: 12px; flex: 1; min-width: 0; }
          .cl-avatar { width: 36px; height: 36px; border-radius: 50%; background: #3b82f6; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1rem; flex-shrink: 0; }
          .cl-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; background: rgba(255,255,255,0.05); }
          .cl-icon.red { color: #ef4444; }
          .cl-icon.green { color: #10b981; }
          .cl-title { font-size: 0.9rem; font-weight: 600; color: #fff; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .cl-sub { font-size: 0.75rem; color: #94a3b8; }
          .cl-right { text-align: right; flex-shrink: 0; }
          .truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 200px; }
          .status-pill { padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: bold; display: inline-block; }
          .status-pill.green { background: rgba(16, 185, 129, 0.1); color: #10b981; }
          .status-pill.red { background: rgba(239, 68, 68, 0.1); color: #ef4444; }

          /* Quick Access */
          .quick-access-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 10px; }
          .qa-btn { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 15px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: 0.2s; }
          .qa-btn:hover { background: #1e293b; border-color: #334155; transform: translateY(-2px); }
          .qa-btn span { color: #cbd5e1; font-weight: 600; font-size: 0.85rem; }
          
          .empty-state { text-align: center; padding: 30px; color: #64748b; font-size: 0.85rem; border: 1px dashed #334155; border-radius: 12px; height: 100%; display: flex; flex-direction: column; justify-content: center; }
        `}</style>
      </div>
    </Layout>
  );
}