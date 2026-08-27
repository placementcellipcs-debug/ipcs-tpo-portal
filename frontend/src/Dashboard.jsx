import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Briefcase, Files, Trophy, CalendarStar, CircleNotch, 
  TrendUp, BuildingOffice, GraduationCap, ChalkboardTeacher, ShieldCheck, UserList
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
          // Extract the 5 most recent placements for the table
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
    } else {
      parsedDate = new Date(e.date.replace(/st|nd|rd|th/g, ''));
    }
    if (isNaN(parsedDate)) return false;
    return parsedDate >= today;
  }).slice(0, 4);

  return (
    <Layout>
      <div className="page-container" style={{ padding: '0 10px' }}>
        
        {/* HEADER */}
        <div style={{ marginBottom: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0' }}>Dashboard</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1rem' }}>Welcome back, <span style={{ color: '#fff', fontWeight: 'bold' }}>{tpoData.name}</span> 👋</p>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Live data for assigned branches
          </div>
        </div>

        {/* ========================================== */}
        {/* ROW 1: TOP KPI CARDS */}
        {/* ========================================== */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '15px', borderRadius: '12px' }}><Users size={28} weight="fill" /></div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Total Students</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fff' }}>{loading ? <CircleNotch className="ph-spin" size={20}/> : stats.totalStudents}</div>
              <div style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}><TrendUp size={12} weight="bold"/> Enrolled</div>
            </div>
          </div>

          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '15px', borderRadius: '12px' }}><Briefcase size={28} weight="fill" /></div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Active Vacancies</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fff' }}>{loading ? <CircleNotch className="ph-spin" size={20}/> : stats.activeVacancies}</div>
              <div style={{ fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}><TrendUp size={12} weight="bold"/> Hiring now</div>
            </div>
          </div>

          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '15px', borderRadius: '12px' }}><Trophy size={28} weight="fill" /></div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Placed Students</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fff' }}>{loading ? <CircleNotch className="ph-spin" size={20}/> : stats.placed}</div>
              <div style={{ fontSize: '0.75rem', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>Across branches</div>
            </div>
          </div>

          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '15px', borderRadius: '12px' }}><Files size={28} weight="fill" /></div>
            <div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>Active Applications</div>
              <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#fff' }}>{loading ? <CircleNotch className="ph-spin" size={20}/> : stats.pendingApps}</div>
              <div style={{ fontSize: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '4px' }}>In progress</div>
            </div>
          </div>

        </div>

        {/* ========================================== */}
        {/* ROW 2: MAIN GRID (70% Table / 30% Sidebar) */}
        {/* ========================================== */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '30px', marginBottom: '30px' }} className="responsive-grid">
          
          {/* LEFT COLUMN: Recent Placements */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '25px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>Recent Placements</h3>
              <button onClick={() => navigate('/placed')} style={{ background: 'transparent', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>View All</button>
            </div>
            
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1e293b', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <th style={{ paddingBottom: '10px' }}>Student</th>
                  <th style={{ paddingBottom: '10px' }}>Course & Branch</th>
                  <th style={{ paddingBottom: '10px' }}>Company</th>
                  <th style={{ paddingBottom: '10px', textAlign: 'right' }}>Package</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem' }}><CircleNotch size={24} className="ph-spin" color="var(--accent-primary)"/></td></tr>
                ) : recentPlacements.length === 0 ? (
                  <tr><td colSpan="4" style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>No recent placements found.</td></tr>
                ) : (
                  recentPlacements.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                      <td style={{ padding: '15px 0' }}>
                        <div style={{ fontWeight: 'bold', color: '#fff' }}>{p.name}</div>
                      </td>
                      <td style={{ padding: '15px 0' }}>
                        <div style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>{p.course}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{p.branch}</div>
                      </td>
                      <td style={{ padding: '15px 0' }}>
                        <div style={{ fontWeight: 'bold', color: '#fff' }}>{p.company}</div>
                      </td>
                      <td style={{ padding: '15px 0', textAlign: 'right', fontWeight: 'bold', color: '#10b981' }}>
                        {p.packageLpa ? `${p.packageLpa} LPA` : 'TBD'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* RIGHT COLUMN: Upcoming Events & Quick Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            
            {/* Upcoming Drives / Events */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '25px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#fff' }}>Upcoming Events</h3>
                <button onClick={() => navigate('/events')} style={{ background: 'transparent', color: 'var(--accent-primary)', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>View All</button>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '1rem' }}><CircleNotch size={24} className="ph-spin" color="var(--accent-primary)"/></div>
                ) : upcomingEvents.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No upcoming events scheduled.</div>
                ) : (
                  upcomingEvents.map((evt, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
                      <div style={{ textAlign: 'center', background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '8px 12px', borderRadius: '10px', minWidth: '60px' }}>
                        <div style={{ fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{evt.date.substring(0, 3)}</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{evt.date.replace(/[^0-9]/g, '').substring(0, 2)}</div>
                      </div>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.95rem', marginBottom: '3px' }}>{evt.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{evt.type} • {evt.location || 'All Branches'}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Re-designed Quick Actions */}
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '25px' }}>
              <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', color: '#fff' }}>Quick Actions</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                {isTpo && (
                  <button onClick={() => navigate('/tracker')} style={{ background: 'transparent', border: '1px solid #1e293b', color: '#fff', padding: '12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '6px', borderRadius: '8px' }}><Files size={18} weight="bold"/></div> Tracker
                  </button>
                )}
                <button onClick={() => navigate('/students')} style={{ background: 'transparent', border: '1px solid #1e293b', color: '#fff', padding: '12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '6px', borderRadius: '8px' }}><UserList size={18} weight="bold"/></div> Students
                </button>
                <button onClick={() => navigate('/placement-drives')} style={{ background: 'transparent', border: '1px solid #1e293b', color: '#fff', padding: '12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ background: 'rgba(168, 85, 247, 0.1)', color: '#a855f7', padding: '6px', borderRadius: '8px' }}><Briefcase size={18} weight="bold"/></div> Drives
                </button>
                <button onClick={() => navigate('/placed')} style={{ background: 'transparent', border: '1px solid #1e293b', color: '#fff', padding: '12px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '6px', borderRadius: '8px' }}><Trophy size={18} weight="bold"/></div> Placed
                </button>
              </div>
            </div>

          </div>
        </div>

        {/* ========================================== */}
        {/* ROW 3: ROLE BASED NAVIGATION CARDS */}
        {/* ========================================== */}
        <h3 style={{ margin: '0 0 20px 0', fontSize: '1.2rem', color: '#fff' }}>Role Based Navigation</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '30px' }}>
          
          <div onClick={() => navigate('/students')} style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', borderRadius: '16px', padding: '20px', cursor: 'pointer', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
              <div style={{ background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '12px', borderRadius: '50%' }}><GraduationCap size={24} weight="fill"/></div>
              <h4 style={{ margin: 0, color: '#38bdf8', fontSize: '1.1rem' }}>Student Core</h4>
            </div>
            <ul style={{ color: 'var(--text-muted)', fontSize: '0.85rem', paddingLeft: '20px', margin: 0, lineHeight: '1.8' }}>
              <li>Student Database</li><li>LMS Study Materials</li><li>Technical Assessments</li>
            </ul>
          </div>

          <div onClick={() => navigate('/vacancies')} style={{ background: 'rgba(16, 185, 129, 0.05)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '16px', padding: '20px', cursor: 'pointer', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '12px', borderRadius: '50%' }}><BuildingOffice size={24} weight="fill"/></div>
              <h4 style={{ margin: 0, color: '#10b981', fontSize: '1.1rem' }}>Placement Officer</h4>
            </div>
            <ul style={{ color: 'var(--text-muted)', fontSize: '0.85rem', paddingLeft: '20px', margin: 0, lineHeight: '1.8' }}>
              <li>Company Management</li><li>Drive & Applications</li><li>Analytics & Reports</li>
            </ul>
          </div>

          <div onClick={() => navigate('/talentino')} style={{ background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: '16px', padding: '20px', cursor: 'pointer', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
              <div style={{ background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', padding: '12px', borderRadius: '50%' }}><ChalkboardTeacher size={24} weight="fill"/></div>
              <h4 style={{ margin: 0, color: '#a855f7', fontSize: '1.1rem' }}>Trainer Dashboard</h4>
            </div>
            <ul style={{ color: 'var(--text-muted)', fontSize: '0.85rem', paddingLeft: '20px', margin: 0, lineHeight: '1.8' }}>
              <li>Daily Attendance</li><li>Talentino Ratings</li><li>Soft Skills Feedback</li>
            </ul>
          </div>

          {tpoData.accessType === 'superadmin' && (
            <div onClick={() => navigate('/users')} style={{ background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '16px', padding: '20px', cursor: 'pointer', transition: '0.2s' }} onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-4px)'} onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px' }}>
                <div style={{ background: 'rgba(244, 63, 94, 0.15)', color: '#f43f5e', padding: '12px', borderRadius: '50%' }}><ShieldCheck size={24} weight="fill"/></div>
                <h4 style={{ margin: 0, color: '#f43f5e', fontSize: '1.1rem' }}>Super Admin</h4>
              </div>
              <ul style={{ color: 'var(--text-muted)', fontSize: '0.85rem', paddingLeft: '20px', margin: 0, lineHeight: '1.8' }}>
                <li>User Role Management</li><li>All Branches Overview</li><li>Course Dictionary</li>
              </ul>
            </div>
          )}

        </div>

        {/* Global style specifically for grid collapsing on small screens */}
        <style>{`
          @media (max-width: 900px) {
            .responsive-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>

      </div>
    </Layout>
  );
}