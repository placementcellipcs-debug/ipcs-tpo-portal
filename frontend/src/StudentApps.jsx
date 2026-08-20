import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch } from '@phosphor-icons/react';
import Layout from './Layout';

export default function StudentApps() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const [monthFilter, setMonthFilter] = useState(currentMonth);
  const [courseFilter, setCourseFilter] = useState('All');

  useEffect(() => {
    if (!tpoData) return;
    const fetchApps = async () => {
      try {
        const response = await axios.post('https://ipcs-tpo-portal.onrender.com/api/tpo/applications', { 
          assignedBranchesArray: tpoData.assignedBranchesArray 
        });
        if (response.data.success) {
          setApplications(response.data.applications);
        }
      } catch (error) { console.error("Failed", error); } finally { setLoading(false); }
    };
    fetchApps();
  }, []);

  const filteredApps = applications.filter(a => {
    let dateObj = new Date(a.date);
    let monthKey = !isNaN(dateObj) ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}` : '';
    let mMatch = monthFilter ? monthKey === monthFilter : true;
    let cMatch = courseFilter === 'All' || a.course.toLowerCase().includes(courseFilter.toLowerCase());
    return mMatch && cMatch;
  });

  return (
    <Layout>
      <div className="page-container">
        <h1 style={{ fontSize: '1.8rem', marginBottom: '5px' }}>Student Applications</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>A flat view of all applications submitted by students in your branch.</p>

        <div className="header-controls" style={{ justifyContent: 'flex-start' }}>
          <input type="month" className="sleek-input" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
          <select className="sleek-select" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
            <option value="All">All Courses</option>
            <option value="Industrial Automation">Industrial Automation</option>
            <option value="BMS & CCTV">BMS & CCTV</option>
            <option value="Python and Data Science">Python</option>
            <option value="Digital Marketing">Digital Marketing</option>
          </select>
        </div>

        <div className="table-container">
          <table className="modern-table">
            <thead>
              <tr><th>Student</th><th>Applied Job</th><th>Date</th><th>TPO Name</th><th>Status</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}><CircleNotch size={24} className="ph-spin" /> Fetching applications...</td></tr>
              ) : filteredApps.length === 0 ? (
                <tr><td colSpan="5" style={{ textAlign: 'center', padding: '2rem' }}>No applications found matching filters.</td></tr>
              ) : (
                filteredApps.map((app, i) => {
                  let statClass = 'badge-blue';
                  let s = app.status.toLowerCase();
                  if(s.includes('interview')) statClass = 'badge-purple';
                  if(s.includes('offer') || s.includes('placed') || s.includes('joined')) statClass = 'badge-green';
                  if(s.includes('reject') || s.includes('not attended')) statClass = 'badge-gray';

                  return (
                    <tr key={i}>
                      <td><span className="primary-text">{app.name}</span><span className="sub-text">{app.roll}</span></td>
                      <td><span className="primary-text">{app.jobId}</span><span className="sub-text">{app.company}</span></td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{app.date.split(' ')[0]}</td>
                      <td><strong style={{ color: 'var(--text-main)', fontSize: '0.8rem' }}>{app.tpoName || 'N/A'}</strong></td>
                      <td><span className={`badge ${statClass}`}>{app.status}</span></td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}