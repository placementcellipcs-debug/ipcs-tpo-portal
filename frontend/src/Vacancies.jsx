import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, PlusCircle } from '@phosphor-icons/react';
import Layout from './Layout';

export default function Vacancies() {
  const [vacancies, setVacancies] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');

  useEffect(() => {
    const fetchVacs = async () => {
      try {
        const response = await axios.get('https://ipcs-tpo-portal.onrender.com/api/tpo/vacancies');
        if (response.data.success) {
          setVacancies(response.data.vacancies);
        }
      } catch (error) { console.error("Failed", error); } finally { setLoading(false); }
    };
    fetchVacs();
  }, []);

  const filteredVacs = vacancies.filter(v => {
    const matchQuery = v.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
                       v.company.toLowerCase().includes(searchQuery.toLowerCase()) || 
                       v.position.toLowerCase().includes(searchQuery.toLowerCase());
    const matchCourse = courseFilter === 'All' || v.course.toLowerCase().includes(courseFilter.toLowerCase());
    return matchQuery && matchCourse;
  });

  // Group vacancies by State
  const groupedVacs = {};
  filteredVacs.forEach(v => {
    const loc = (v.state || 'OTHER STATES').toUpperCase().trim();
    if (!groupedVacs[loc]) groupedVacs[loc] = [];
    groupedVacs[loc].push(v);
  });

  return (
    <Layout>
      <div className="page-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '15px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', margin: '0 0 5px 0' }}>Active Job Vacancies</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Current openings across all courses.</p>
          </div>
          <button className="btn-action" style={{ width: 'auto' }} onClick={() => window.open('https://forms.gle/GLGBvxd7TFBF3ekV7', '_blank')}>
            <PlusCircle weight="fill" size={20} /> Add Opening
          </button>
        </div>

        <div className="header-controls" style={{ justifyContent: 'flex-start' }}>
          <input type="text" className="sleek-input" placeholder="Search ID or Company..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <select className="sleek-select" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
            <option value="All">All Courses</option>
            <option value="Industrial Automation">Industrial Automation</option>
            <option value="BMS & CCTV">BMS & CCTV</option>
            <option value="Python and Data Science">Python</option>
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--accent-primary)' }}><CircleNotch size={40} className="ph-spin" /><p>Fetching vacancies...</p></div>
        ) : Object.keys(groupedVacs).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>No active vacancies match your filters.</div>
        ) : (
          Object.keys(groupedVacs).map((state, idx) => (
            <div key={idx} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ textAlign: 'center', fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '1.5rem' }}>
                {state}
              </div>
              <div className="table-container" style={{ marginTop: 0 }}>
                <table className="modern-table">
                  <thead>
                    <tr><th>Job ID</th><th>Position & Company</th><th>Location</th><th>Mode</th><th>Status & Date</th><th style={{ textAlign: 'center' }}>Action</th></tr>
                  </thead>
                  <tbody>
                    {groupedVacs[state].map((v, i) => {
                      const s = v.status.toLowerCase();
                      let statBadge = <span className="badge badge-success">Open</span>;
                      if(s.includes('close') || s.includes('no')) statBadge = <span className="badge badge-gray">Closed</span>;
                      if(s.includes('expire')) statBadge = <span className="badge badge-red">Expired</span>;

                      return (
                        <tr key={i}>
                          <td style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{v.id}</td>
                          <td><span className="primary-text">{v.position}</span><span className="sub-text">{v.company}</span></td>
                          <td>{v.location}</td>
                          <td><span className="badge badge-gray">{v.mode}</span></td>
                          <td>
                            {statBadge}<br/>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'inline-block' }}>
                              Ends: <strong style={{ color: 'var(--accent-warning)' }}>{v.lastDate}</strong>
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button className="btn-secondary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>View</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))
        )}
      </div>
    </Layout>
  );
}