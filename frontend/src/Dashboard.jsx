import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  UsersThree, Briefcase, Files, Confetti, 
  TrendUp, CircleNotch, Users, ChartBar, CalendarStar, Circle 
} from '@phosphor-icons/react';
import Layout from './Layout';

export default function Dashboard() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const [stats, setStats] = useState({ totalStudents: 0, pendingApps: 0, placed: 0, activeVacancies: 0 });
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tpoData) return;
    const fetchStats = async () => {
      try {
        const response = await axios.post('https://ipcs-tpo-portal.onrender.com/api/tpo/dashboard-stats', {
          assignedBranchesArray: tpoData.assignedBranchesArray
        });
        if (response.data.success) {
          setStats(response.data.stats);
          setEvents(response.data.events || []);
        }
      } catch (error) {
        console.error("Failed to load stats", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const getGreeting = () => {
    const hours = new Date().getHours();
    if (hours < 12) return "Good morning ☕";
    if (hours < 17) return "Good afternoon ☀️";
    return "Good evening 🌙";
  };

  if (!tpoData) return null;

  return (
    <Layout>
      <div className="page-container">
        <h1 style={{ fontSize: '1.8rem', marginBottom: '5px' }}>Overview</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>Live data for {tpoData.sittingBranch} and assigned branches.</p>
        
        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--accent-primary)' }}>
            <CircleNotch size={40} className="ph-spin" />
            <p>Syncing data from Google Sheets...</p>
          </div>
        ) : (
          <>
            {/* BENTO GRID (HERO, QA, SUMMARY) */}
            <div className="bento-grid">
              <div className="hero-card">
                <div style={{ fontSize: '0.9rem', color: '#f59e0b', fontWeight: '700', marginBottom: '5px' }}>
                  {getGreeting()}
                </div>
                <h1 style={{ fontSize: '2.2rem', fontWeight: '800', margin: '0 0 10px 0', color: 'var(--text-main)' }}>
                  Welcome back, <span style={{ color: 'var(--accent-primary)' }}>{tpoData.name.split(' ')[0]}</span>!
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '2rem' }}>
                  Here is what's happening across your assigned branches today.
                </p>
                <div style={{ display: 'flex', gap: '15px' }}>
                  <button className="btn-action" style={{ width: 'auto' }}>
                    <Users size={20} /> Manage Students
                  </button>
                  <button className="btn-action" style={{ width: 'auto', background: 'var(--hover-bg)', color: 'var(--text-main)', border: '1px solid var(--card-border)' }}>
                    <ChartBar size={20} /> View Reports
                  </button>
                </div>
              </div>

              <div className="qa-box">
                <h3 style={{ margin: '0 0 5px 0', fontSize: '1.05rem' }}>Quick Actions</h3>
                <div className="qa-grid">
                  <div className="qa-item"><Files size={24} color="#f59e0b" weight="fill" /> Tracker</div>
                  <div className="qa-item"><Users size={24} color="#10b981" weight="fill" /> Directory</div>
                  <div className="qa-item"><Briefcase size={24} color="#38bdf8" weight="fill" /> Vacancies</div>
                  <div className="qa-item"><CalendarStar size={24} color="#ef4444" weight="fill" /> Events</div>
                </div>
              </div>

              <div className="summary-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Today's Summary</h3>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
                
                <div className="sum-row">
                  <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '5px' }}><Circle size={12} weight="fill" /> Active Vacancies</span> 
                  <span>{stats.activeVacancies}</span>
                </div>
                <div className="sum-bar-bg"><div className="sum-bar-fill" style={{ width: '80%', background: '#10b981' }}></div></div>
                
                <div className="sum-row">
                  <span style={{ color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '5px' }}><Circle size={12} weight="fill" /> Pending Applications</span> 
                  <span>{stats.pendingApps}</span>
                </div>
                <div className="sum-bar-bg"><div className="sum-bar-fill" style={{ width: '50%', background: '#f59e0b' }}></div></div> 

                <div className="sum-row">
                  <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '5px' }}><Circle size={12} weight="fill" /> Students Verified</span> 
                  <span>{stats.totalStudents} Checked</span>
                </div>
                <div className="sum-bar-bg"><div className="sum-bar-fill" style={{ width: '100%', background: '#38bdf8' }}></div></div>
              </div>
            </div>

            {/* STATS ROW */}
            <div className="stats-row">
              <div className="stat-mini-card">
                <div className="stat-mini-top"><div className="stat-icon-circle" style={{ color: '#38bdf8', background: 'rgba(56, 189, 248, 0.1)' }}><UsersThree weight="fill" /></div><div className="stat-trend"><TrendUp /> Active</div></div>
                <div><div className="stat-mini-val">{stats.totalStudents}</div><div className="stat-mini-label">Total Students</div></div>
              </div>
              <div className="stat-mini-card">
                <div className="stat-mini-top"><div className="stat-icon-circle" style={{ color: '#a855f7', background: 'rgba(168, 85, 247, 0.1)' }}><Briefcase weight="fill" /></div><div className="stat-trend"><TrendUp /> Live</div></div>
                <div><div className="stat-mini-val">{stats.activeVacancies}</div><div className="stat-mini-label">Total Vacancies</div></div>
              </div>
              <div className="stat-mini-card">
                <div className="stat-mini-top"><div className="stat-icon-circle" style={{ color: '#f59e0b', background: 'rgba(245, 158, 11, 0.1)' }}><Files weight="fill" /></div><div className="stat-trend"><TrendUp /> Tracking</div></div>
                <div><div className="stat-mini-val">{stats.pendingApps}</div><div className="stat-mini-label">Applications</div></div>
              </div>
              <div className="stat-mini-card">
                <div className="stat-mini-top"><div className="stat-icon-circle" style={{ color: '#10b981', background: 'rgba(16, 185, 129, 0.1)' }}><Confetti weight="fill" /></div><div className="stat-trend"><TrendUp /> Placed</div></div>
                <div><div className="stat-mini-val">{stats.placed}</div><div className="stat-mini-label">Total Hired</div></div>
              </div>
            </div>

            {/* CSS MARQUEE SLIDER FOR EVENTS */}
            <div className="slider-wrapper">
              <div className="slider-header">
                <CalendarStar weight="fill" style={{ color: 'var(--accent-warning)' }} /> Happening Today & Soon
              </div>
              
              <div className="marquee-container">
                <div className="marquee-track">
                  {events.length === 0 ? (
                    <div className="marquee-card">
                      <div className="mc-text">
                        <strong>No upcoming events</strong>
                        <span>Check the events tab for more details.</span>
                      </div>
                    </div>
                  ) : (
                    [...events, ...events, ...events].map((e, idx) => {
                      const d = new Date(e.date);
                      const isValidDate = !isNaN(d);
                      return (
                        <div className="marquee-card" key={idx}>
                          <div className="marquee-card-left">
                            <div className="mc-date">
                              <div className="mc-m">{isValidDate ? d.toLocaleString('default', { month: 'short' }) : 'TBA'}</div>
                              <div className="mc-day">{isValidDate ? d.getDate() : '-'}</div>
                            </div>
                            <div className="mc-text">
                              <strong>{e.title}</strong>
                              <span>{e.type} • {e.location}</span>
                            </div>
                          </div>
                          <div className="mc-time">{e.time}</div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}