import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Briefcase, Files, Trophy, CalendarStar, CircleNotch, 
  TrendUp, BuildingOffice, GraduationCap, ChalkboardTeacher, 
  ShieldCheck, UserList, CaretRight, BookOpen, Clock, PresentationChart,
  NotePencil, Desktop, FolderOpen, Bell, ChartLineUp, Student,
  CalendarCheck, ListChecks, ArrowUpRight
} from '@phosphor-icons/react';
import Layout from './Layout';

export default function Dashboard() {
  const navigate = useNavigate();
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const isTpo = (tpoData?.role || '').toUpperCase() === 'TPO';
  
  const [stats, setStats] = useState({ totalStudents: 0, pendingApps: 0, placed: 0, activeVacancies: 0 });
  const [events, setEvents] = useState([]);
  const [recentPlacements, setRecentPlacements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const reqPayload = { assignedBranchesArray: tpoData.assignedBranchesArray, role: tpoData.role, assignedCourse: tpoData.assignedCourse };
        const [statsRes, appsRes] = await Promise.all([
          axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/dashboard-stats', reqPayload),
          axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/applications', { ...reqPayload, tpoName: tpoData.name })
        ]);
        
        if (statsRes.data.success) {
          setStats(statsRes.data.stats);
          setEvents(statsRes.data.events || []);
        }
        if (appsRes.data.success) {
          const placed = appsRes.data.applications.filter(a => {
            const s = (a.status || '').toLowerCase();
            const j = (a.joiningStatus || '').toLowerCase();
            return s.includes('placed') || s.includes('got offer') || s.includes('join') || s.includes('offer') || j.includes('join');
          }).reverse().slice(0, 5);
          setRecentPlacements(placed);
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    if (tpoData) fetchData();
  }, [tpoData]);

  const today = new Date();
  today.setHours(0,0,0,0);
  
  const upcomingEvents = events.filter(e => {
    if (!e.date || !e.title || e.title.toLowerCase().includes('dummy')) return false;
    let parsedDate = null;
    if (e.date.includes('/')) {
      const parts = e.date.split(/[/\s,]+/);
      if (parts.length >= 3) parsedDate = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
    } else { parsedDate = new Date(e.date.replace(/st|nd|rd|th/g, '')); }
    if (isNaN(parsedDate)) return false;
    return parsedDate >= today;
  }).slice(0, 3);

  const placementRate = stats.totalStudents > 0 ? ((stats.placed / stats.totalStudents) * 100).toFixed(1) : '0.0';

  // ==========================================
  // NATIVE SVG CHART GENERATORS (No Libraries Needed!)
  // ==========================================
  
  // 1. Smooth Line Chart Generator
  const trendData = [
    { month: 'Jan', placed: 40, offers: 85 }, { month: 'Feb', placed: 30, offers: 60 }, { month: 'Mar', placed: 60, offers: 110 },
    { month: 'Apr', placed: 45, offers: 90 }, { month: 'May', placed: 70, offers: 140 }, { month: 'Jun', placed: 50, offers: 120 },
    { month: 'Jul', placed: 80, offers: 160 }, { month: 'Aug', placed: 65, offers: 130 }, { month: 'Sep', placed: 90, offers: 170 },
    { month: 'Oct', placed: 75, offers: 150 }, { month: 'Nov', placed: 110, offers: 210 }, { month: 'Dec', placed: 95, offers: 180 }
  ];
  const chartHeight = 160; const chartWidth = 600; const maxVal = 250; const xStep = chartWidth / (trendData.length - 1);
  const makeSmoothPath = (dataKey) => {
    if(!trendData.length) return '';
    let path = `M 0,${chartHeight - (trendData[0][dataKey]/maxVal*chartHeight)}`;
    for(let i=0; i<trendData.length-1; i++) {
      const x1 = i * xStep; const y1 = chartHeight - (trendData[i][dataKey]/maxVal*chartHeight);
      const x2 = (i+1) * xStep; const y2 = chartHeight - (trendData[i+1][dataKey]/maxVal*chartHeight);
      const cx = (x1+x2)/2; path += ` C ${cx},${y1} ${cx},${y2} ${x2},${y2}`;
    }
    return path;
  };

  // 2. Donut Chart Generator
  const domainData = [
    { name: 'Automation', value: 439, color: '#3b82f6' }, { name: 'IT & Software', value: 251, color: '#10b981' },
    { name: 'BMS & CCTV', value: 188, color: '#f59e0b' }, { name: 'Digital Mkt', value: 126, color: '#ec4899' },
    { name: 'Embedded', value: 252, color: '#8b5cf6' }
  ];
  const totalDomain = domainData.reduce((acc, curr) => acc + curr.value, 0);
  let cumulativePercent = 0;
  const radius = 40; const circumference = 2 * Math.PI * radius;

  // Batch Progress Mock Data
  const batchProgress = [
    { batch: 'Python Full Stack - Jan', course: 'Full Stack', progress: 85, color: '#3b82f6' },
    { batch: 'Data Science - Feb', course: 'Data Science', progress: 72, color: '#10b981' },
    { batch: 'Java Development - Jan', course: 'Java', progress: 68, color: '#a855f7' },
    { batch: 'Industrial Auto - Mar', course: 'Automation', progress: 90, color: '#f59e0b' },
    { batch: 'Digital Marketing - Apr', course: 'Marketing', progress: 75, color: '#ec4899' },
  ];

  return (
    <Layout>
      <div className="page-container" style={{ padding: '0 10px', maxWidth: '1600px', margin: '0 auto' }}>
        
        {/* HEADER */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', color: '#fff' }}>Good Morning, {tpoData.name.split(' ')[0]} 👋</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Here's what's happening in your institute today.</p>
          </div>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '10px 20px', borderRadius: '30px', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Clock size={16} /> {today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>

        {/* ========================================== */}
        {/* ROW 1: TOP 6 KPI CARDS */}
        {/* ========================================== */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', marginBottom: '25px' }}>
          
          <div className="kpi-card">
            <div className="kpi-icon" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' }}><Users weight="fill" size={24} /></div>
            <div>
              <div className="kpi-title">Total Students</div>
              <div className="kpi-value">{loading ? <CircleNotch className="ph-spin" size={20}/> : stats.totalStudents}</div>
              <div className="kpi-trend green"><TrendUp size={12} weight="bold"/> 12.5% from last month</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}><PresentationChart weight="fill" size={24} /></div>
            <div>
              <div className="kpi-title">Active Vacancies</div>
              <div className="kpi-value">{loading ? <CircleNotch className="ph-spin" size={20}/> : stats.activeVacancies}</div>
              <div className="kpi-trend green"><TrendUp size={12} weight="bold"/> 8.3% from last month</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon" style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)' }}><Student weight="fill" size={24} /></div>
            <div>
              <div className="kpi-title">Placed Students</div>
              <div className="kpi-value">{loading ? <CircleNotch className="ph-spin" size={20}/> : stats.placed}</div>
              <div className="kpi-trend green"><TrendUp size={12} weight="bold"/> 15.7% from last month</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' }}><ChartLineUp weight="fill" size={24} /></div>
            <div>
              <div className="kpi-title">Placement Rate</div>
              <div className="kpi-value">{loading ? <CircleNotch className="ph-spin" size={20}/> : `${placementRate}%`}</div>
              <div className="kpi-trend green"><TrendUp size={12} weight="bold"/> 6.4% from last month</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon" style={{ color: '#ec4899', background: 'rgba(236, 72, 153, 0.1)' }}><BuildingOffice weight="fill" size={24} /></div>
            <div>
              <div className="kpi-title">Active Drives</div>
              <div className="kpi-value">{loading ? <CircleNotch className="ph-spin" size={20}/> : '12'}</div>
              <div className="kpi-trend green"><TrendUp size={12} weight="bold"/> 9.1% from last month</div>
            </div>
          </div>

          <div className="kpi-card">
            <div className="kpi-icon" style={{ color: '#0ea5e9', background: 'rgba(14, 165, 233, 0.1)' }}><Briefcase weight="fill" size={24} /></div>
            <div>
              <div className="kpi-title">Pending Apps</div>
              <div className="kpi-value">{loading ? <CircleNotch className="ph-spin" size={20}/> : stats.pendingApps}</div>
              <div className="kpi-trend green"><TrendUp size={12} weight="bold"/> 10.2% from last month</div>
            </div>
          </div>

        </div>

        {/* ========================================== */}
        {/* ROW 2 & 3: MASTER GRID LAYOUT */}
        {/* ========================================== */}
        <div className="dashboard-main-grid">
          
          {/* --- COLUMN 1: TRENDS & RECENT PLACEMENTS (WIDEST) --- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* Trend Line Chart */}
            <div className="dash-panel">
              <div className="panel-header">
                <h3>Placement Trends</h3>
                <span className="panel-subtitle">This Year ▾</span>
              </div>
              <div style={{ display: 'flex', gap: '20px', marginBottom: '15px', fontSize: '0.8rem', fontWeight: 'bold' }}>
                <div style={{ color: '#3b82f6', display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{width:'10px', height:'3px', background:'#3b82f6'}}></span> Placed</div>
                <div style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}><span style={{width:'10px', height:'3px', background:'#10b981'}}></span> Offers</div>
              </div>
              
              <div style={{ height: `${chartHeight}px`, width: '100%', position: 'relative', marginBottom: '20px' }}>
                <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                  {/* Grid Lines */}
                  {[0, 1, 2, 3, 4].map(i => <line key={i} x1="0" y1={chartHeight * (i/4)} x2={chartWidth} y2={chartHeight * (i/4)} stroke="#1e293b" strokeWidth="1" />)}
                  {/* The Data Lines */}
                  <path d={makeSmoothPath('offers')} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" />
                  <path d={makeSmoothPath('placed')} fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold' }}>
                  {trendData.map(d => <span key={d.month}>{d.month}</span>)}
                </div>
              </div>

              {/* Trend Footer Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', borderTop: '1px solid var(--card-border)', paddingTop: '15px' }}>
                <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Total Offers</div><div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#fff' }}>1,842</div></div>
                <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Total Placed</div><div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#fff' }}>1,256</div></div>
                <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Highest Package</div><div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#fff' }}>18.5 LPA</div></div>
                <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '5px' }}>Average Package</div><div style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#fff' }}>4.6 LPA</div></div>
              </div>
            </div>

            {/* Recent Placements Table */}
            <div className="dash-panel" style={{ flex: 1 }}>
              <div className="panel-header">
                <h3>Recent Placements</h3>
                <button onClick={() => navigate('/placed')} className="text-btn">View All</button>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--card-border)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                    <th style={{ paddingBottom: '10px', fontWeight: 'bold' }}>Student</th>
                    <th style={{ paddingBottom: '10px', fontWeight: 'bold' }}>Course</th>
                    <th style={{ paddingBottom: '10px', fontWeight: 'bold' }}>Company</th>
                    <th style={{ paddingBottom: '10px', textAlign: 'right', fontWeight: 'bold' }}>Package</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}><CircleNotch size={24} className="ph-spin" color="var(--accent-primary)"/></td></tr>
                  ) : recentPlacements.length === 0 ? (
                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No recent placements found.</td></tr>
                  ) : (
                    recentPlacements.map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--card-border)' }}>
                        <td style={{ padding: '12px 0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent-primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>
                            {p.name.charAt(0)}
                          </div>
                          <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.9rem' }}>{p.name}</div>
                        </td>
                        <td style={{ padding: '12px 0', color: '#cbd5e1', fontSize: '0.85rem' }}>{p.course}</td>
                        <td style={{ padding: '12px 0', fontWeight: 'bold', color: '#fff', fontSize: '0.85rem' }}>{p.company}</td>
                        <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: 'bold', color: '#10b981', fontSize: '0.85rem' }}>
                          {p.packageLpa ? `${p.packageLpa} LPA` : 'TBD'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>

          {/* --- COLUMN 2: DONUT CHART & PROGRESS --- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* Domain Donut Chart */}
            <div className="dash-panel">
              <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', color: '#fff' }}>Placements by Domain</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                
                {/* Custom Native SVG Donut */}
                <div style={{ width: '140px', height: '140px', position: 'relative' }}>
                  <svg viewBox="0 0 100 100" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                    {domainData.map(slice => {
                      const percent = slice.value / totalDomain;
                      const strokeDasharray = `${percent * circumference} ${circumference}`;
                      const strokeDashoffset = cumulativePercent * circumference * -1;
                      cumulativePercent += percent;
                      return <circle key={slice.name} r={radius} cx="50" cy="50" fill="transparent" stroke={slice.color} strokeWidth="16" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} style={{ transition: 'stroke-dashoffset 1s ease' }} />
                    })}
                  </svg>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: '#fff' }}>1,256</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Total Placed</div>
                  </div>
                </div>

                {/* Donut Legend */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {domainData.map(d => (
                    <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#cbd5e1' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: d.color }}></span>
                        {d.name}
                      </div>
                      <div style={{ color: 'var(--text-muted)' }}>{((d.value/totalDomain)*100).toFixed(0)}%</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Batch Progress */}
            <div className="dash-panel" style={{ flex: 1 }}>
              <div className="panel-header">
                <h3>Batch Progress Overview</h3>
                <button onClick={() => navigate('/courses')} className="text-btn">View All</button>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 'bold', marginBottom: '15px', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>
                <span>Batch</span><span>Course</span><span>Progress</span>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {batchProgress.map((b, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr', alignItems: 'center', fontSize: '0.8rem' }}>
                    <div style={{ fontWeight: 'bold', color: '#fff' }}>{b.batch}</div>
                    <div style={{ color: '#cbd5e1' }}>{b.course}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ flex: 1, height: '6px', background: 'var(--bg-dark)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ width: `${b.progress}%`, height: '100%', background: b.color, borderRadius: '3px' }}></div>
                      </div>
                      <span style={{ fontWeight: 'bold', color: '#fff', width: '30px' }}>{b.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* --- COLUMN 3: DRIVES, LINKS, & CALENDAR --- */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
            
            {/* Upcoming Drives */}
            <div className="dash-panel">
              <div className="panel-header">
                <h3>Upcoming Drives</h3>
                <button onClick={() => navigate('/events')} className="text-btn">View All</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '1rem' }}><CircleNotch size={24} className="ph-spin" color="var(--accent-primary)"/></div>
                ) : upcomingEvents.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No upcoming drives scheduled.</div>
                ) : (
                  upcomingEvents.map((evt, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '15px', alignItems: 'center', borderBottom: '1px solid var(--card-border)', paddingBottom: '15px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem' }}>
                        {evt.title.charAt(0)}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.9rem' }}>{evt.title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{evt.type} • {evt.location || 'All Branches'}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 'bold' }}>{evt.date}</div>
                        <div style={{ fontSize: '0.7rem', color: '#10b981' }}>Active</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quick Links Grid */}
            <div className="dash-panel">
              <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: '#fff' }}>Quick Links</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                
                <div onClick={() => navigate('/students')} className="quick-link-box">
                  <div className="icon-wrap" style={{ color: '#8b5cf6', background: 'rgba(139, 92, 246, 0.1)' }}><Users weight="fill" size={20}/></div>
                  <span>Students</span>
                </div>
                
                {isTpo && (
                  <div onClick={() => navigate('/tracker')} className="quick-link-box">
                    <div className="icon-wrap" style={{ color: '#3b82f6', background: 'rgba(59, 130, 246, 0.1)' }}><ListChecks weight="fill" size={20}/></div>
                    <span>Tracker</span>
                  </div>
                )}
                
                <div onClick={() => navigate('/placement-drives')} className="quick-link-box">
                  <div className="icon-wrap" style={{ color: '#ec4899', background: 'rgba(236, 72, 153, 0.1)' }}><BuildingOffice weight="fill" size={20}/></div>
                  <span>Add Drive</span>
                </div>
                
                <div onClick={() => navigate('/events')} className="quick-link-box">
                  <div className="icon-wrap" style={{ color: '#0ea5e9', background: 'rgba(14, 165, 233, 0.1)' }}><CalendarCheck weight="fill" size={20}/></div>
                  <span>Events</span>
                </div>
                
                <div onClick={() => navigate('/clients')} className="quick-link-box">
                  <div className="icon-wrap" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}><FolderOpen weight="fill" size={20}/></div>
                  <span>Documents</span>
                </div>
                
                {isTpo && (
                  <div onClick={() => navigate('/reports')} className="quick-link-box">
                    <div className="icon-wrap" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' }}><ChartLineUp weight="fill" size={20}/></div>
                    <span>Reports</span>
                  </div>
                )}
              </div>
            </div>

            {/* Agenda List */}
            <div className="dash-panel" style={{ flex: 1 }}>
              <div className="panel-header">
                <h3>Agenda</h3>
                <button onClick={() => navigate('/events')} className="text-btn">View Calendar</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', width: '60px' }}>10:00 AM</div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fff' }}>Training Session</div>
                    <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Data Structures - Batch Jan</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', width: '60px' }}>01:30 PM</div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fff' }}>Mock Interview</div>
                    <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>TCS Drive Preparation</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-muted)', width: '60px' }}>03:00 PM</div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#fff' }}>Placement Drive</div>
                    <div style={{ fontSize: '0.75rem', color: '#cbd5e1' }}>Infosys Online Test</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* ========================================== */}
        {/* ROW 4: ACCESS IMPORTANT MODULES (7 Colored Cards) */}
        {/* ========================================== */}
        <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', color: '#fff' }}>Access Important Modules</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', marginBottom: '40px' }}>
          
          <div onClick={() => navigate('/students')} className="module-card blue">
            <h4 style={{ color: '#3b82f6' }}>Student Directory</h4>
            <p>View and manage student information</p>
            <div className="link">View Students <ArrowUpRight size={14} weight="bold"/></div>
          </div>

          {(tpoData.accessType === 'superadmin') && (
            <div onClick={() => navigate('/courses')} className="module-card green">
              <h4 style={{ color: '#10b981' }}>Course Management</h4>
              <p>Create and manage courses & syllabus</p>
              <div className="link">Manage Courses <ArrowUpRight size={14} weight="bold"/></div>
            </div>
          )}

          {(tpoData.accessType === 'superadmin' || (tpoData.role || '').toUpperCase().includes('RTH')) && (
            <div onClick={() => navigate('/exams')} className="module-card purple">
              <h4 style={{ color: '#a855f7' }}>Assessment Center</h4>
              <p>Create tests and evaluate students</p>
              <div className="link">Go to Assessments <ArrowUpRight size={14} weight="bold"/></div>
            </div>
          )}

          <div onClick={() => navigate('/talentino')} className="module-card yellow">
            <h4 style={{ color: '#f59e0b' }}>Attendance Tracking</h4>
            <p>Monitor daily Talentino check-ins</p>
            <div className="link">View Attendance <ArrowUpRight size={14} weight="bold"/></div>
          </div>

          <div onClick={() => navigate('/placement-drives')} className="module-card pink">
            <h4 style={{ color: '#ec4899' }}>Placement Management</h4>
            <p>Manage drives, offers and placements</p>
            <div className="link">Manage Placements <ArrowUpRight size={14} weight="bold"/></div>
          </div>

          {isTpo && (
            <div onClick={() => navigate('/reports')} className="module-card teal">
              <h4 style={{ color: '#0ea5e9' }}>Reports & Analytics</h4>
              <p>Detailed insights and performance reports</p>
              <div className="link">View Reports <ArrowUpRight size={14} weight="bold"/></div>
            </div>
          )}

          <div onClick={() => navigate('/clients')} className="module-card orange">
            <h4 style={{ color: '#f97316' }}>Document Center</h4>
            <p>Store and manage important MOUs</p>
            <div className="link">View Documents <ArrowUpRight size={14} weight="bold"/></div>
          </div>

        </div>

        {/* Global Styles for this Dashboard */}
        <style>{`
          .kpi-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 16px; padding: 20px; display: flex; alignItems: center; gap: 15px; }
          .kpi-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .kpi-title { font-size: 0.8rem; color: var(--text-muted); font-weight: bold; margin-bottom: 4px; }
          .kpi-value { font-size: 1.6rem; font-weight: bold; color: #fff; margin-bottom: 4px; }
          .kpi-trend { font-size: 0.7rem; display: flex; align-items: center; gap: 4px; font-weight: bold; }
          .kpi-trend.green { color: #10b981; }

          .dashboard-main-grid { display: grid; grid-template-columns: 2.2fr 1.2fr 1fr; gap: 20px; margin-bottom: 30px; }
          @media (max-width: 1200px) { .dashboard-main-grid { grid-template-columns: 1fr 1fr; } }
          @media (max-width: 800px) { .dashboard-main-grid { grid-template-columns: 1fr; } }

          .dash-panel { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 16px; padding: 25px; display: flex; flex-direction: column; }
          .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
          .panel-header h3 { margin: 0; font-size: 1.15rem; color: #fff; }
          .panel-subtitle { font-size: 0.8rem; color: var(--text-muted); background: var(--bg-dark); padding: 4px 10px; border-radius: 6px; border: 1px solid var(--card-border); cursor: pointer; }
          .text-btn { background: transparent; color: var(--accent-primary); border: none; cursor: pointer; font-weight: bold; font-size: 0.85rem; }
          .text-btn:hover { text-decoration: underline; }

          .quick-link-box { background: var(--bg-dark); border: 1px solid var(--card-border); border-radius: 12px; padding: 15px 10px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; cursor: pointer; transition: 0.2s; text-align: center; }
          .quick-link-box:hover { border-color: var(--accent-primary); transform: translateY(-2px); }
          .quick-link-box .icon-wrap { padding: 10px; border-radius: 10px; display: flex; align-items: center; justify-content: center; }
          .quick-link-box span { font-size: 0.75rem; color: #cbd5e1; font-weight: bold; }

          .module-card { background: rgba(255,255,255,0.02); border: 1px solid var(--card-border); border-radius: 16px; padding: 20px; display: flex; flex-direction: column; cursor: pointer; transition: 0.2s; }
          .module-card:hover { transform: translateY(-4px); }
          .module-card h4 { margin: 0 0 8px 0; font-size: 1.05rem; }
          .module-card p { margin: 0 0 15px 0; font-size: 0.75rem; color: var(--text-muted); line-height: 1.5; flex: 1; }
          .module-card .link { font-size: 0.8rem; font-weight: bold; display: flex; align-items: center; gap: 5px; margin-top: auto; }
          
          .module-card.blue { background: rgba(59, 130, 246, 0.05); border-color: rgba(59, 130, 246, 0.2); }
          .module-card.blue .link { color: #3b82f6; }
          .module-card.green { background: rgba(16, 185, 129, 0.05); border-color: rgba(16, 185, 129, 0.2); }
          .module-card.green .link { color: #10b981; }
          .module-card.purple { background: rgba(168, 85, 247, 0.05); border-color: rgba(168, 85, 247, 0.2); }
          .module-card.purple .link { color: #a855f7; }
          .module-card.yellow { background: rgba(245, 158, 11, 0.05); border-color: rgba(245, 158, 11, 0.2); }
          .module-card.yellow .link { color: #f59e0b; }
          .module-card.pink { background: rgba(236, 72, 153, 0.05); border-color: rgba(236, 72, 153, 0.2); }
          .module-card.pink .link { color: #ec4899; }
          .module-card.teal { background: rgba(14, 165, 233, 0.05); border-color: rgba(14, 165, 233, 0.2); }
          .module-card.teal .link { color: #0ea5e9; }
          .module-card.orange { background: rgba(249, 115, 22, 0.05); border-color: rgba(249, 115, 22, 0.2); }
          .module-card.orange .link { color: #f97316; }
        `}</style>

      </div>
    </Layout>
  );
}