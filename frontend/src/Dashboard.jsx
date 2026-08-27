import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  Users, Briefcase, Files, Trophy, CalendarStar, ChartBar, CaretRight, 
  CircleNotch, UserCheck 
} from '@phosphor-icons/react';
import Layout from './Layout';

export default function Dashboard() {
  const navigate = useNavigate();
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const isTpo = (tpoData?.role || '').toUpperCase() === 'TPO';
  
  const [stats, setStats] = useState({ totalStudents: 0, pendingApps: 0, placed: 0, activeVacancies: 0 });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/dashboard-stats', {
          assignedBranchesArray: tpoData.assignedBranchesArray,
          role: tpoData.role,
          assignedCourse: tpoData.assignedCourse
        });
        if (res.data.success) {
          setStats(res.data.stats);
          setEvents(res.data.events || []);
        }
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    if (tpoData) fetchStats();
  }, [tpoData]);

  // 🚨 SMART EVENT FILTER: Only shows upcoming events & ignores dummies
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
  });

  return (
    <Layout>
      <style>
      {`
        @keyframes scrollSlow {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        /* 🚨 MARQUEE SPEED SLOWED DOWN (80 seconds) */
        .scrolling-ticker {
          display: inline-block;
          white-space: nowrap;
          animation: scrollSlow 80s linear infinite;
        }
        .scrolling-ticker:hover {
          animation-play-state: paused;
        }
      `}
      </style>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ marginBottom: '30px' }}>
          <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0' }}>Overview</h1>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>
            Live data for {tpoData.sittingBranch || 'N/A'} and assigned branches.
          </p>
        </div>

        {/* TOP ROW */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          
          {/* Welcome Box */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '25px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ fontSize: '0.9rem', color: '#f59e0b', fontWeight: 'bold', marginBottom: '5px' }}>Good afternoon ☀️</div>
            <h2 style={{ fontSize: '2.2rem', margin: '0 0 10px 0', color: '#fff' }}>Welcome back, <span style={{ color: 'var(--accent-primary)' }}>{tpoData.name.split(' ')[0]}!</span></h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '20px' }}>Here is what's happening across your assigned branches today.</p>
            <div style={{ display: 'flex', gap: '15px' }}>
              <button className="btn-action" style={{ width: 'auto', padding: '10px 20px', borderRadius: '8px' }} onClick={() => navigate('/students')}>
                <Users size={18} weight="bold" style={{ marginRight: '8px' }}/> Manage Students
              </button>
              {/* 🚨 View Reports button removed as requested */}
            </div>
          </div>

          {/* Quick Actions (Connected) */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '25px' }}>
            <h3 style={{ margin: '0 0 15px 0', fontSize: '1.1rem', color: '#fff' }}>Quick Actions</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
              {isTpo && (
                <div onClick={() => navigate('/tracker')} style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '15px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transition: '0.2s', border: '1px solid transparent' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#f59e0b'} onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
                  <Files size={28} weight="fill" style={{ marginBottom: '8px' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Tracker</span>
                </div>
              )}
              <div onClick={() => navigate('/students')} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '15px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transition: '0.2s', border: '1px solid transparent' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#10b981'} onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
                <Users size={28} weight="fill" style={{ marginBottom: '8px' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Directory</span>
              </div>
              <div onClick={() => navigate('/vacancies')} style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '15px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transition: '0.2s', border: '1px solid transparent' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#38bdf8'} onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
                <Briefcase size={28} weight="fill" style={{ marginBottom: '8px' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Vacancies</span>
              </div>
              <div onClick={() => navigate('/events')} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', padding: '15px', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transition: '0.2s', border: '1px solid transparent' }} onMouseEnter={e => e.currentTarget.style.borderColor = '#ef4444'} onMouseLeave={e => e.currentTarget.style.borderColor = 'transparent'}>
                <CalendarStar size={28} weight="fill" style={{ marginBottom: '8px' }} />
                <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>Events</span>
              </div>
            </div>
          </div>

          {/* Today's Summary */}
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '25px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#fff' }}>Today's Summary</h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{today.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', flex: 1, justifyContent: 'center' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  <span style={{ color: '#10b981' }}>● Active Vacancies</span>
                  <span style={{ color: '#fff' }}>{loading ? '...' : stats.activeVacancies}</span>
                </div>
                <div style={{ height: '6px', background: 'var(--bg-dark)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '75%', height: '100%', background: '#10b981' }}></div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  <span style={{ color: '#f59e0b' }}>● Pending Applications</span>
                  <span style={{ color: '#fff' }}>{loading ? '...' : stats.pendingApps}</span>
                </div>
                <div style={{ height: '6px', background: 'var(--bg-dark)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '45%', height: '100%', background: '#f59e0b' }}></div>
                </div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                  <span style={{ color: '#38bdf8' }}>● Students Verified</span>
                  <span style={{ color: '#fff' }}>{loading ? '...' : stats.totalStudents} Checked</span>
                </div>
                <div style={{ height: '6px', background: 'var(--bg-dark)', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', background: '#38bdf8' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* MIDDLE KPI ROW */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '20px' }}>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
            <Users size={32} color="#38bdf8" weight="fill" style={{ marginBottom: '10px' }} />
            <div style={{ position: 'absolute', top: '20px', right: '20px', fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>~ Active</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '5px' }}>{loading ? <CircleNotch className="ph-spin" size={24}/> : stats.totalStudents}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Total Students</div>
          </div>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
            <Briefcase size={32} color="#a855f7" weight="fill" style={{ marginBottom: '10px' }} />
            <div style={{ position: 'absolute', top: '20px', right: '20px', fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>~ Live</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '5px' }}>{loading ? <CircleNotch className="ph-spin" size={24}/> : stats.activeVacancies}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Total Vacancies</div>
          </div>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
            <Files size={32} color="#f59e0b" weight="fill" style={{ marginBottom: '10px' }} />
            <div style={{ position: 'absolute', top: '20px', right: '20px', fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>~ Tracking</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '5px' }}>{loading ? <CircleNotch className="ph-spin" size={24}/> : stats.pendingApps}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Applications</div>
          </div>
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px', position: 'relative', overflow: 'hidden' }}>
            <Trophy size={32} color="#10b981" weight="fill" style={{ marginBottom: '10px' }} />
            <div style={{ position: 'absolute', top: '20px', right: '20px', fontSize: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>~ Placed</div>
            <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#fff', marginBottom: '5px' }}>{loading ? <CircleNotch className="ph-spin" size={24}/> : stats.placed}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 'bold' }}>Total Hired</div>
          </div>
        </div>

        {/* BOTTOM EVENT TICKER */}
        <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '20px', borderRight: '1px solid var(--card-border)', flexShrink: 0, fontWeight: 'bold', color: '#fff' }}>
            <CalendarStar size={20} color="var(--accent-primary)" weight="fill" /> Happening Today & Soon
          </div>
          <div style={{ flex: 1, overflow: 'hidden', paddingLeft: '20px', position: 'relative' }}>
            {upcomingEvents.length === 0 ? (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No upcoming events scheduled.</span>
            ) : (
              <div className="scrolling-ticker">
                {upcomingEvents.map((evt, idx) => (
                  <div key={idx} style={{ display: 'inline-block', background: 'var(--bg-dark)', padding: '10px 20px', borderRadius: '8px', marginRight: '15px', border: '1px solid #1e293b' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '5px' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 'bold' }}>{evt.date}</span>
                      <span style={{ fontSize: '0.9rem', color: '#fff', fontWeight: 'bold' }}>{evt.title}</span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent-primary)' }}></span> {evt.type} • {evt.location || 'All Branches'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </Layout>
  );
}