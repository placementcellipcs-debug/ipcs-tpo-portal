import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, Users, Eye, X, Prohibit, EnvelopeSimple, Phone, Plus, Briefcase, Buildings, Clock } from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

const DetailBox = ({ label, value }) => (
  <div style={{ background: '#161e2e', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontWeight: 'bold', color: '#fff' }}>{value || 'Not Specified'}</div>
  </div>
);

export default function Vacancies() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  
  const upperRole = String(tpoData?.role || '').toUpperCase();
  const accessType = String(tpoData?.accessType || '').toLowerCase();
  
  const isSuperAdmin = accessType === 'superadmin' || upperRole.includes('ADMIN') || upperRole.includes('HEAD') || upperRole.includes('MANAGER');
  const isTpo = upperRole.includes('TPO');
  
  // 🚨 RESTRICT ACCESS: ONLY TPO CAN ADD VACANCIES (Not Super Admins)
  const canAddOpening = isTpo && !isSuperAdmin;

  const isCourseSpecific = upperRole.includes('TRAINER') || upperRole.includes('RTH') || upperRole.includes('TTH') || upperRole.includes('TECHNICAL LEAD');
  const displayCourse = tpoData?.assignedCourse || '';

  const [vacancies, setVacancies] = useState([]);
  const [applications, setApplications] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // 🚨 NEW TABS STATE
  const [activeTab, setActiveTab] = useState('Open'); // 'Open' or 'Expired'

  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');
  const [tpoFilter, setTpoFilter] = useState('All');
  const [monthYearFilter, setMonthYearFilter] = useState('All');

  const [selectedJob, setSelectedJob] = useState(null);
  const [isJobDetailsModalOpen, setIsJobDetailsModalOpen] = useState(false);
  const [isApplicantsModalOpen, setIsApplicantsModalOpen] = useState(false);

  useEffect(() => {
    const fetchAllData = async () => {
      const localTpoStr = localStorage.getItem('tpoData');
      if (!localTpoStr) return;
      const localTpo = JSON.parse(localTpoStr);
      
      try {
        const [vacRes, appRes] = await Promise.all([
          axios.get(`${API_BASE}/api/tpo/vacancies`),
          axios.post(`${API_BASE}/api/tpo/applications`, { 
            assignedBranchesArray: localTpo.assignedBranchesArray,
            tpoName: localTpo.name,
            role: localTpo.role,
            assignedCourse: localTpo.assignedCourse
          })
        ]);
        
        if (vacRes.data.success) setVacancies(vacRes.data.vacancies);
        if (appRes.data.success) setApplications(appRes.data.applications);

      } catch (error) { console.error("Failed to fetch data", error); } finally { setLoading(false); }
    };
    
    fetchAllData();
  }, []);

  const appsByJobId = {};
  applications.forEach(app => {
    const jobId = String(app.jobId || '').trim();
    if (!appsByJobId[jobId]) appsByJobId[jobId] = [];
    appsByJobId[jobId].push(app);
  });

  const parseDate = (dateStr) => {
    if (!dateStr) return new Date(8640000000000000); 
    let cleanStr = typeof dateStr === 'string' ? dateStr.split(' ')[0].replace(/st|nd|rd|th/g, '') : dateStr;
    if (typeof cleanStr === 'string' && (cleanStr.includes('/') || cleanStr.includes('-'))) {
      const parts = cleanStr.split(/[/-]/);
      if (parts.length === 3) {
        if (parts[2].length === 4) return new Date(`${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`);
        if (parts[0].length === 4) return new Date(`${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`);
      }
    }
    const d = new Date(cleanStr);
    return isNaN(d) ? new Date(8640000000000000) : d;
  };
  
  const today = new Date();
  today.setHours(0,0,0,0);

  const uniqueTPOs = [...new Set(vacancies.map(v => v.tpoName || v.placementofficer || v.placementOfficer || 'Unknown').filter(n => n !== 'Unknown'))].sort();
  const uniqueMonths = [...new Set(vacancies.map(v => {
    const d = parseDate(v.datePosted || v.timestamp || v.date);
    if (d && d.getFullYear() < 2050 && d.getFullYear() > 2000) {
      return d.toLocaleString('en-us', { month: 'long', year: 'numeric' });
    }
    return null;
  }).filter(Boolean))].sort((a, b) => new Date(b) - new Date(a));

  const filteredVacs = vacancies.filter(v => {
    const matchQuery = (v.id || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                       (v.company || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                       (v.position || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchCourse = courseFilter === 'All' || (v.course || '').toLowerCase().includes(courseFilter.toLowerCase());
    
    let matchTrainerScope = true;
    if (isCourseSpecific && displayCourse !== 'All Courses') {
       const vCourse = (v.course || '').toLowerCase();
       const myCourse = displayCourse.toLowerCase();
       matchTrainerScope = vCourse.includes(myCourse) || myCourse.includes(vCourse);
    }

    const deadline = parseDate(v.lastDate);
    const isExpired = deadline < today || String(v.status || '').toLowerCase().includes('expire');
    const isClosed = String(v.status || '').toLowerCase().includes('close') || String(v.status || '').toLowerCase().includes('no');
    
    // 🚨 TABS LOGIC
    const tabMatch = activeTab === 'Open' ? (!isExpired && !isClosed) : (isExpired || isClosed);

    const rowTpo = v.tpoName || v.placementofficer || v.placementOfficer || 'Unknown';
    const tpoMatch = tpoFilter === 'All' || rowTpo === tpoFilter;
    
    let monthMatch = true;
    if (monthYearFilter !== 'All') {
      const d = parseDate(v.datePosted || v.timestamp || v.date);
      if (d && d.getFullYear() < 2050) {
        const dStr = d.toLocaleString('en-us', { month: 'long', year: 'numeric' });
        monthMatch = dStr === monthYearFilter;
      } else {
        monthMatch = false;
      }
    }

    return matchQuery && matchCourse && matchTrainerScope && tabMatch && tpoMatch && monthMatch;
  });

  const groupedVacs = {};
  filteredVacs.forEach(v => {
    const loc = (v.state || 'OTHER STATES').toUpperCase().trim();
    if (!groupedVacs[loc]) groupedVacs[loc] = [];
    groupedVacs[loc].push(v);
  });

  let totalActiveOpenings = 0;
  let totalExpiredOpenings = 0;
  let totalApplicationsCount = 0;
  let uniqueCompaniesSet = new Set();

  vacancies.forEach(v => {
    const deadline = parseDate(v.lastDate);
    const isExpired = deadline < today || String(v.status || '').toLowerCase().includes('expire') || String(v.status || '').toLowerCase().includes('close');
    
    if (isExpired) totalExpiredOpenings++; else totalActiveOpenings++;

    if (v.company && String(v.company).toLowerCase() !== 'unknown company') {
      uniqueCompaniesSet.add(v.company);
    }
    const myApps = appsByJobId[v.id] || [];
    totalApplicationsCount += myApps.length;
  });

  return (
    <Layout>
      <div className="page-container" style={{ maxWidth: '1600px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', margin: '0 0 5px 0' }}>Active Job Vacancies</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Current openings and applicant tracking for your branches.</p>
          </div>
          
          {canAddOpening && (
            <button 
              className="btn-action hover-lift" 
              style={{ background: '#38bdf8', color: '#0f1523', display: 'flex', alignItems: 'center', gap: '8px', width: 'auto', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold' }} 
              onClick={() => window.open('https://forms.gle/9Gxbwx1S2uqeXHne9', '_blank')}
            >
              <Plus weight="bold" size={20} /> Add Opening
            </button>
          )}
        </div>

        {isSuperAdmin && (
          <div className="mini-dash-grid">
            <div className="mini-dash-card">
              <div className="mdc-icon blue"><Briefcase weight="fill" size={24}/></div>
              <div className="mdc-data">
                <p>Total Active</p>
                <h3>{totalActiveOpenings}</h3>
              </div>
            </div>
            <div className="mini-dash-card">
              <div className="mdc-icon green"><Users weight="fill" size={24}/></div>
              <div className="mdc-data">
                <p>Total Applicants</p>
                <h3>{totalApplicationsCount}</h3>
              </div>
            </div>
            <div className="mini-dash-card">
              <div className="mdc-icon purple"><Buildings weight="fill" size={24}/></div>
              <div className="mdc-data">
                <p>Hiring Companies</p>
                <h3>{uniqueCompaniesSet.size}</h3>
              </div>
            </div>
            <div className="mini-dash-card">
              <div className="mdc-icon red"><Prohibit weight="fill" size={24}/></div>
              <div className="mdc-data">
                <p>Expired Openings</p>
                <h3>{totalExpiredOpenings}</h3>
              </div>
            </div>
          </div>
        )}

        {/* 🚨 CUSTOM TABS */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', borderBottom: '2px solid #1e293b' }}>
          <button 
            onClick={() => setActiveTab('Open')}
            style={{ 
              background: 'none', border: 'none', padding: '10px 20px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer',
              color: activeTab === 'Open' ? '#38bdf8' : '#64748b',
              borderBottom: activeTab === 'Open' ? '3px solid #38bdf8' : '3px solid transparent',
              transition: '0.2s'
            }}
          >
            Active Openings
          </button>
          <button 
            onClick={() => setActiveTab('Expired')}
            style={{ 
              background: 'none', border: 'none', padding: '10px 20px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer',
              color: activeTab === 'Expired' ? '#ef4444' : '#64748b',
              borderBottom: activeTab === 'Expired' ? '3px solid #ef4444' : '3px solid transparent',
              transition: '0.2s'
            }}
          >
            Expired Vacancies
          </button>
        </div>

        <div className="header-controls" style={{ justifyContent: 'flex-start', flexWrap: 'wrap', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '12px', border: '1px solid #1e293b', marginBottom: '20px' }}>
          <input type="text" className="sleek-input" placeholder="Search ID or Company..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ minWidth: '200px' }} />
          <select className="sleek-select fixed-options" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
            <option value="All">All Courses</option>
            <option value="Industrial Automation">Industrial Automation</option>
            <option value="BMS & CCTV">BMS & CCTV</option>
            <option value="Python and Data Science">Python</option>
            <option value="Digital Marketing">Digital Marketing</option>
          </select>

          {isSuperAdmin && (
            <>
              <select className="sleek-select fixed-options" value={tpoFilter} onChange={(e) => setTpoFilter(e.target.value)} style={{ border: '1px solid #8b5cf6', background: 'rgba(139, 92, 246, 0.05)' }}>
                <option value="All">All TPOs</option>
                {uniqueTPOs.map((tpo, i) => <option key={i} value={tpo}>{tpo}</option>)}
              </select>
              <select className="sleek-select fixed-options" value={monthYearFilter} onChange={(e) => setMonthYearFilter(e.target.value)} style={{ border: '1px solid #10b981', background: 'rgba(16, 185, 129, 0.05)' }}>
                <option value="All">All Time</option>
                {uniqueMonths.map((m, i) => <option key={i} value={m}>{m}</option>)}
              </select>
            </>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '3rem', color: '#38bdf8' }}><CircleNotch size={40} className="ph-spin" /><p>Fetching vacancies...</p></div>
        ) : Object.keys(groupedVacs).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', background: '#111827', borderRadius: '16px', border: '1px dashed #334155', color: '#64748b' }}>No {activeTab.toLowerCase()} vacancies match your filters.</div>
        ) : (
          Object.keys(groupedVacs).map((state, idx) => (
            <div key={idx} style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
              <div style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 800, color: '#f8fafc', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '1rem' }}>
                {state}
              </div>
              
              <div className="table-container" style={{ marginTop: 0 }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th style={{ paddingBottom: '15px' }}>Job ID</th>
                      <th style={{ paddingBottom: '15px' }}>Position & Company</th>
                      <th style={{ paddingBottom: '15px' }}>Location & Mode</th>
                      
                      {isSuperAdmin && <th style={{ paddingBottom: '15px' }}>Posted By & Date</th>}
                      
                      <th style={{ paddingBottom: '15px' }}>Status & Deadline</th>
                      <th style={{ textAlign: 'center', paddingBottom: '15px' }}>Applicants</th>
                      <th style={{ textAlign: 'right', paddingBottom: '15px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedVacs[state].map((v, i) => {
                      const deadline = parseDate(v.lastDate);
                      const isExpired = deadline < today || String(v.status || '').toLowerCase().includes('expire');
                      const isClosed = String(v.status || '').toLowerCase().includes('close') || String(v.status || '').toLowerCase().includes('no');
                      
                      let statBadge = <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', border: '1px solid rgba(16, 185, 129, 0.3)' }}>Open</span>;
                      if(isClosed) statBadge = <span style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', border: '1px solid rgba(148, 163, 184, 0.3)' }}>Closed</span>;
                      if(isExpired) statBadge = <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '4px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', border: '1px solid rgba(239, 68, 68, 0.3)' }}>Expired</span>;

                      const myApplicants = appsByJobId[v.id] || [];
                      const applicantCount = myApplicants.length;

                      const rowTpo = v.tpoName || v.placementofficer || v.placementOfficer || 'Unknown';
                      const datePostedObj = parseDate(v.datePosted || v.timestamp || v.date);
                      const datePostedStr = (datePostedObj && datePostedObj.getFullYear() < 2050 && datePostedObj.getFullYear() > 2000) ? datePostedObj.toLocaleDateString('en-GB') : 'N/A';

                      return (
                        <tr key={i} className="hover-row">
                          <td style={{ color: '#38bdf8', fontWeight: 700, verticalAlign: 'middle' }}>{v.id}</td>
                          <td style={{ verticalAlign: 'middle' }}>
                            <div className="primary-text" style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.95rem' }}>{v.position}</div>
                            <div className="sub-text" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{v.company}</div>
                          </td>
                          <td style={{ verticalAlign: 'middle' }}>
                            <div style={{ color: '#cbd5e1', fontSize: '0.9rem' }}>{v.location}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{v.mode}</div>
                          </td>
                          
                          {isSuperAdmin && (
                            <td style={{ verticalAlign: 'middle' }}>
                              <div style={{ color: '#a855f7', fontWeight: 'bold', fontSize: '0.85rem' }}>{rowTpo}</div>
                              <div style={{ fontSize: '0.7rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                                <Clock size={12} weight="bold" /> {datePostedStr}
                              </div>
                            </td>
                          )}

                          <td style={{ verticalAlign: 'middle' }}>
                            <div style={{ marginBottom: '6px' }}>{statBadge}</div>
                            <span style={{ fontSize: '0.7rem', color: '#64748b', display: 'inline-block' }}>
                              Ends: <strong style={{ color: isExpired || isClosed ? '#ef4444' : '#f59e0b' }}>{v.lastDate}</strong>
                            </span>
                          </td>
                          
                          <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: applicantCount > 0 ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255,255,255,0.03)', color: applicantCount > 0 ? '#38bdf8' : '#64748b', padding: '6px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 'bold', border: applicantCount > 0 ? '1px solid rgba(56, 189, 248, 0.2)' : '1px solid transparent' }}>
                              <Users size={16} weight={applicantCount > 0 ? "fill" : "regular"} />
                              {applicantCount} Applied
                            </div>
                          </td>

                          <td style={{ textAlign: 'right', verticalAlign: 'middle' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button 
                                className="btn-secondary hover-lift" 
                                style={{ padding: '8px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px', opacity: isExpired ? 0.5 : 1, cursor: isExpired ? 'not-allowed' : 'pointer' }} 
                                onClick={() => !isExpired && setSelectedJob(v) || !isExpired && setIsJobDetailsModalOpen(true)}
                                disabled={isExpired}
                                title={isExpired ? "Job Details unavailable for expired openings" : "View Job Details"}
                              >
                                {isExpired ? <Prohibit weight="bold" size={14}/> : <Eye weight="bold" size={14} />} Details
                              </button>
                              <button 
                                className="btn-action hover-lift" 
                                style={{ background: applicantCount > 0 ? '#3b82f6' : '#1e293b', color: '#fff', padding: '8px 14px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }} 
                                onClick={() => { setSelectedJob(v); setIsApplicantsModalOpen(true); }}
                              >
                                <Users weight="bold" size={14} /> View List
                              </button>
                            </div>
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

      <style>{`
        /* Fix for invisible dropdown options */
        .fixed-options option { background: #0f1523; color: #fff; padding: 10px; font-weight: bold; }
        .fixed-options:focus { background: #0f1523; color: #fff; }

        .hover-lift { transition: transform 0.2s ease; }
        .hover-lift:hover { transform: translateY(-2px); }
        .hover-row { transition: background 0.2s ease; }
        .hover-row:hover { background: rgba(255,255,255,0.02); }
        
        .mini-dash-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px; }
        .mini-dash-card { background: #111827; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; display: flex; align-items: center; gap: 15px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); }
        .mdc-icon { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .mdc-icon.blue { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
        .mdc-icon.green { background: rgba(16, 185, 129, 0.15); color: #10b981; }
        .mdc-icon.purple { background: rgba(168, 85, 247, 0.15); color: #a855f7; }
        .mdc-icon.red { background: rgba(239, 68, 68, 0.15); color: #ef4444; }
        .mdc-data p { margin: 0 0 4px 0; font-size: 0.75rem; color: #94a3b8; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; }
        .mdc-data h3 { margin: 0; font-size: 1.8rem; color: #fff; font-weight: 800; line-height: 1; }
      `}</style>

      {isJobDetailsModalOpen && selectedJob && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', backdropFilter: 'blur(5px)' }} onClick={(e) => { if(e.target === e.currentTarget) setIsJobDetailsModalOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#0f1523', border: '1px solid #1e293b', borderRadius: '16px', padding: '2rem', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: '0 0 5px 0', fontSize: '1.5rem', color: '#fff', fontWeight: 800 }}>{selectedJob.position}</h2>
                <div style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '1.1rem' }}>{selectedJob.company}</div>
              </div>
              <X size={24} style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => setIsJobDetailsModalOpen(false)} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '1.5rem' }}>
              <DetailBox label="Job ID" value={selectedJob.id} />
              <DetailBox label="Location" value={selectedJob.location} />
              <DetailBox label="Mode" value={selectedJob.mode} />
              <DetailBox label="Eligible Course" value={selectedJob.course} />
              <DetailBox label="Salary" value={selectedJob.salary} />
              <DetailBox label="Experience" value={selectedJob.experience} />
              <DetailBox label="Qualification" value={selectedJob.qualification} />
              <DetailBox label="Gender Pref." value={selectedJob.gender} />
            </div>

            {selectedJob.description && (
              <div style={{ background: '#161e2e', padding: '15px', borderRadius: '8px', border: '1px solid #1e293b', marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', fontWeight: 'bold' }}>Job Description</div>
                <div style={{ color: '#e2e8f0', fontSize: '0.9rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{selectedJob.description}</div>
              </div>
            )}

            <div style={{ textAlign: 'right' }}>
              <button className="btn-secondary hover-lift" style={{ padding: '10px 20px', fontWeight: 'bold' }} onClick={() => setIsJobDetailsModalOpen(false)}>Close Window</button>
            </div>
          </div>
        </div>
      )}

      {isApplicantsModalOpen && selectedJob && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', backdropFilter: 'blur(5px)' }} onClick={(e) => { if(e.target === e.currentTarget) setIsApplicantsModalOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: '900px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: '#0f1523', border: '1px solid #1e293b', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            
            <div style={{ padding: '1.5rem 2rem', background: '#161e2e', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: '0 0 5px 0', fontSize: '1.3rem', color: '#fff', fontWeight: 800 }}>Applicants List</h2>
                <div style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 'bold' }}>{selectedJob.id} | {selectedJob.company}</div>
              </div>
              <X size={24} style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => setIsApplicantsModalOpen(false)} />
            </div>

            <div style={{ overflowY: 'auto', padding: '0', flex: 1 }}>
              <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse', margin: 0 }}>
                <thead style={{ position: 'sticky', top: 0, background: '#0f1523', zIndex: 10 }}>
                  <tr>
                    <th style={{ padding: '15px 20px', color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>Student Name</th>
                    <th style={{ padding: '15px 20px', color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>Branch</th>
                    <th style={{ padding: '15px 20px', color: '#94a3b8', borderBottom: '1px solid #1e293b' }}>App Status</th>
                    <th style={{ padding: '15px 20px', color: '#94a3b8', textAlign: 'right', borderBottom: '1px solid #1e293b' }}>Contact Info</th>
                  </tr>
                </thead>
                <tbody>
                  {appsByJobId[selectedJob.id] ? (
                    appsByJobId[selectedJob.id].map((app, i) => {
                      let statClass = 'badge-blue';
                      let s = String(app.status || '').toLowerCase();
                      if(s.includes('interview')) statClass = 'badge-purple';
                      if(s.includes('offer') || s.includes('placed') || s.includes('joined')) statClass = 'badge-green';
                      if(s.includes('reject') || s.includes('not attended')) statClass = 'badge-gray';

                      return (
                        <tr key={i} className="hover-row" style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '15px 20px' }}>
                            <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '0.95rem' }}>{app.name}</div>
                            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{app.roll}</div>
                          </td>
                          <td style={{ padding: '15px 20px', color: '#cbd5e1', fontSize: '0.9rem' }}>{app.branch}</td>
                          <td style={{ padding: '15px 20px' }}><span className={`badge ${statClass}`}>{app.status || 'Applied'}</span></td>
                          <td style={{ padding: '15px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              {app.phone && (
                                <a href={`tel:${app.phone}`} title="Call Student" className="hover-lift" style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                                  <Phone size={18} weight="fill" />
                                </a>
                              )}
                              {app.email && (
                                <a href={`mailto:${app.email}`} title="Email Student" className="hover-lift" style={{ background: 'rgba(234, 67, 53, 0.15)', color: '#ea4335', padding: '8px', borderRadius: '50%', display: 'flex' }}>
                                  <EnvelopeSimple size={18} weight="fill" />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '4rem', color: '#64748b' }}>
                        <Users size={48} style={{ opacity: 0.3, marginBottom: '15px' }} /><br/>
                        <span style={{ fontSize: '1.1rem' }}>No students have applied yet.</span>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}