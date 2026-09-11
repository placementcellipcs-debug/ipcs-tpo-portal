import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, Users, Eye, X, Prohibit, EnvelopeSimple, Phone, Plus, Briefcase, Buildings, Clock, MapPinLine, GraduationCap, Money, GenderIntersex } from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

const DetailBox = ({ label, value, icon }) => (
  <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
    <div style={{ background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', padding: '8px', borderRadius: '8px' }}>
      {icon}
    </div>
    <div>
      <div style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '4px', fontWeight: 'bold', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontWeight: '600', color: '#fff', fontSize: '0.95rem' }}>{value || 'Not Specified'}</div>
    </div>
  </div>
);

export default function Vacancies() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  
  const upperRole = String(tpoData?.role || '').toUpperCase();
  const accessType = String(tpoData?.accessType || '').toLowerCase();
  
  const isSuperAdmin = accessType === 'superadmin' || upperRole.includes('ADMIN') || upperRole.includes('HEAD') || upperRole.includes('MANAGER');
  const isTpo = upperRole.includes('TPO');
  const canAddOpening = isTpo && !isSuperAdmin;
  const isCourseSpecific = upperRole.includes('TRAINER') || upperRole.includes('RTH') || upperRole.includes('TTH') || upperRole.includes('TECHNICAL LEAD');
  const displayCourse = tpoData?.assignedCourse || '';

  const [vacancies, setVacancies] = useState([]);
  const [applications, setApplications] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState('Open'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  
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
    if (d && d.getFullYear() < 2050 && d.getFullYear() > 2000) return d.toLocaleString('en-us', { month: 'long', year: 'numeric' });
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
    
    const tabMatch = activeTab === 'Open' ? (!isExpired && !isClosed) : (isExpired || isClosed);
    
    const statMatch = statusFilter === 'All' ||
                      (statusFilter === 'Open' && !isExpired && !isClosed) ||
                      (statusFilter === 'Expired' && (isExpired || isClosed));

    const rowTpo = v.tpoName || v.placementofficer || v.placementOfficer || 'Unknown';
    const tpoMatch = tpoFilter === 'All' || rowTpo === tpoFilter;
    
    let monthMatch = true;
    if (monthYearFilter !== 'All') {
      const d = parseDate(v.datePosted || v.timestamp || v.date);
      if (d && d.getFullYear() < 2050) {
        monthMatch = d.toLocaleString('en-us', { month: 'long', year: 'numeric' }) === monthYearFilter;
      } else { monthMatch = false; }
    }

    return matchQuery && matchCourse && matchTrainerScope && tabMatch && statMatch && tpoMatch && monthMatch;
  });

  const groupedVacs = {};
  filteredVacs.forEach(v => {
    const loc = (v.state || 'OTHER STATES').toUpperCase().trim();
    if (!groupedVacs[loc]) groupedVacs[loc] = [];
    groupedVacs[loc].push(v);
  });

  let totalActiveOpenings = 0; let totalExpiredOpenings = 0; let totalApplicationsCount = 0;
  let uniqueCompaniesSet = new Set();

  vacancies.forEach(v => {
    const deadline = parseDate(v.lastDate);
    const isExpired = deadline < today || String(v.status || '').toLowerCase().includes('expire') || String(v.status || '').toLowerCase().includes('close');
    if (isExpired) totalExpiredOpenings++; else totalActiveOpenings++;
    if (v.company && String(v.company).toLowerCase() !== 'unknown company') uniqueCompaniesSet.add(v.company);
    totalApplicationsCount += (appsByJobId[v.id] || []).length;
  });

  return (
    <Layout>
      <div className="premium-dashboard-wrapper page-container" style={{ maxWidth: '1600px', margin: '0 auto', paddingBottom: '50px' }}>
        
        {/* HEADER SECTION */}
        <div className="top-hero-section">
          <div className="hero-text">
            <h1>Active Job Ecosystem</h1>
            <p>Real-time applicant tracking and opening management</p>
          </div>
          {canAddOpening && (
            <button className="premium-btn primary hover-lift" onClick={() => window.open('https://forms.gle/9Gxbwx1S2uqeXHne9', '_blank')}>
              <Plus weight="bold" size={20} /> Add Opening
            </button>
          )}
        </div>

        {/* ADMIN MINI DASHBOARD */}
        {isSuperAdmin && (
          <div className="bento-grid mini-dash-wrapper">
            <div className="kpi-card glass-panel hover-lift">
              <div className="kpi-top">
                <div><div className="kpi-title">Total Active</div><div className="kpi-val">{totalActiveOpenings}</div></div>
                <div className="kpi-icon blue"><Briefcase weight="fill" size={26}/></div>
              </div>
            </div>
            <div className="kpi-card glass-panel hover-lift">
              <div className="kpi-top">
                <div><div className="kpi-title">Total Applicants</div><div className="kpi-val">{totalApplicationsCount}</div></div>
                <div className="kpi-icon green"><Users weight="fill" size={26}/></div>
              </div>
            </div>
            <div className="kpi-card glass-panel hover-lift">
              <div className="kpi-top">
                <div><div className="kpi-title">Hiring Companies</div><div className="kpi-val">{uniqueCompaniesSet.size}</div></div>
                <div className="kpi-icon purple"><Buildings weight="fill" size={26}/></div>
              </div>
            </div>
            <div className="kpi-card glass-panel hover-lift">
              <div className="kpi-top">
                <div><div className="kpi-title">Expired Openings</div><div className="kpi-val">{totalExpiredOpenings}</div></div>
                <div className="kpi-icon red"><Prohibit weight="fill" size={26}/></div>
              </div>
            </div>
          </div>
        )}

        {/* PREMIUM FILTER & TAB ACTION BAR */}
        <div className="glass-panel control-action-bar">
          
          <div className="segmented-tabs">
            <button className={`seg-tab ${activeTab === 'Open' ? 'active' : ''}`} onClick={() => setActiveTab('Open')}>
              Active Openings
            </button>
            <button className={`seg-tab ${activeTab === 'Expired' ? 'active-expired' : ''}`} onClick={() => setActiveTab('Expired')}>
              Expired / Closed
            </button>
          </div>

          <div className="filter-group">
            <input type="text" className="premium-input" placeholder="Search ID, Role, Company..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <select className="premium-select" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
              <option value="All">All Courses</option>
              <option value="Industrial Automation">Industrial Automation</option>
              <option value="BMS & CCTV">BMS & CCTV</option>
              <option value="Python and Data Science">Python & Data</option>
              <option value="Digital Marketing">Digital Marketing</option>
            </select>

            {isSuperAdmin && (
              <>
                <select className="premium-select border-purple" value={tpoFilter} onChange={(e) => setTpoFilter(e.target.value)}>
                  <option value="All">All TPOs</option>
                  {uniqueTPOs.map((tpo, i) => <option key={i} value={tpo}>{tpo}</option>)}
                </select>
                <select className="premium-select border-green" value={monthYearFilter} onChange={(e) => setMonthYearFilter(e.target.value)}>
                  <option value="All">All Time</option>
                  {uniqueMonths.map((m, i) => <option key={i} value={m}>{m}</option>)}
                </select>
              </>
            )}
          </div>
        </div>

        {/* JOB CARDS GRID (Replaces Table) */}
        {loading ? (
          <div className="empty-state-card"><CircleNotch size={40} className="ph-spin text-blue" /><p>Fetching vacancies...</p></div>
        ) : Object.keys(groupedVacs).length === 0 ? (
          <div className="empty-state-card">
            <span style={{ fontSize: '2.5rem', marginBottom: '10px', display: 'block' }}>🔍</span>
            No {activeTab.toLowerCase()} vacancies match your current filters.
          </div>
        ) : (
          Object.keys(groupedVacs).map((state, idx) => (
            <div key={idx} className="state-group-section">
              <div className="state-header">
                <span className="state-line"></span>
                <h2 className="state-title">{state}</h2>
                <span className="state-line"></span>
              </div>
              
              <div className="job-card-grid">
                {groupedVacs[state].map((v, i) => {
                  const deadline = parseDate(v.lastDate);
                  const isExpired = deadline < today || String(v.status || '').toLowerCase().includes('expire');
                  const isClosed = String(v.status || '').toLowerCase().includes('close') || String(v.status || '').toLowerCase().includes('no');
                  
                  let statClass = 'green'; let statText = 'Open Now';
                  if(isClosed) { statClass = 'gray'; statText = 'Closed'; }
                  else if(isExpired) { statClass = 'red'; statText = 'Expired'; }

                  const myApplicants = appsByJobId[v.id] || [];
                  const applicantCount = myApplicants.length;

                  const rowTpo = v.tpoName || v.placementofficer || v.placementOfficer || 'Unknown';
                  const datePostedObj = parseDate(v.datePosted || v.timestamp || v.date);
                  const datePostedStr = (datePostedObj && datePostedObj.getFullYear() < 2050 && datePostedObj.getFullYear() > 2000) ? datePostedObj.toLocaleDateString('en-GB') : 'N/A';

                  return (
                    <div key={i} className="job-card glass-panel hover-lift">
                      
                      <div className="jc-header">
                        <div className="jc-company-logo">{String(v.company || 'U').charAt(0).toUpperCase()}</div>
                        <div className="jc-company-info">
                          <h3 className="text-truncate">{v.position}</h3>
                          <p className="text-truncate">{v.company}</p>
                        </div>
                        <div className="jc-id">{v.id}</div>
                      </div>

                      <div className="jc-body">
                        <div className="jc-detail"><MapPinLine size={16} /> <span>{v.location} ({v.mode})</span></div>
                        <div className="jc-detail"><GraduationCap size={16} /> <span>{v.course}</span></div>
                        {isSuperAdmin && <div className="jc-detail text-purple"><Clock size={16} /> <span>{rowTpo} • {datePostedStr}</span></div>}
                      </div>

                      <div className="jc-divider"></div>

                      <div className="jc-footer">
                        <div>
                          <div className={`status-pill ${statClass}`}>{statText}</div>
                          <div className="jc-deadline">Ends: <span style={{color: isExpired || isClosed ? '#ef4444' : '#fff'}}>{v.lastDate}</span></div>
                        </div>
                        <div className="jc-applicants" onClick={() => { setSelectedJob(v); setIsApplicantsModalOpen(true); }}>
                          <Users size={16} weight={applicantCount > 0 ? "fill" : "regular"} color={applicantCount > 0 ? '#3b82f6' : '#94a3b8'}/>
                          <span style={{ color: applicantCount > 0 ? '#3b82f6' : '#94a3b8' }}>{applicantCount} Applied</span>
                        </div>
                      </div>

                      {/* Floating Action Overlay on Hover */}
                      <div className="jc-hover-actions">
                        <button className="premium-btn secondary" onClick={() => !isExpired && setSelectedJob(v) || !isExpired && setIsJobDetailsModalOpen(true)} disabled={isExpired}>
                          {isExpired ? <Prohibit size={18}/> : <Eye size={18} />} Details
                        </button>
                        <button className="premium-btn primary" onClick={() => { setSelectedJob(v); setIsApplicantsModalOpen(true); }}>
                          <Users size={18} /> View List
                        </button>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* JOB DETAILS MODAL */}
      {isJobDetailsModalOpen && selectedJob && (
        <div className="modal-backdrop" onClick={(e) => { if(e.target === e.currentTarget) setIsJobDetailsModalOpen(false); }}>
          <div className="premium-modal glass-panel">
            <div className="modal-header">
              <div>
                <h2>{selectedJob.position}</h2>
                <div className="modal-subtitle">{selectedJob.company}</div>
              </div>
              <button className="close-btn" onClick={() => setIsJobDetailsModalOpen(false)}><X size={24} /></button>
            </div>

            <div className="modal-grid">
              <DetailBox label="Job ID" value={selectedJob.id} icon={<Briefcase size={20} weight="fill"/>} />
              <DetailBox label="Location & Mode" value={`${selectedJob.location} (${selectedJob.mode})`} icon={<MapPinLine size={20} weight="fill"/>} />
              <DetailBox label="Eligible Course" value={selectedJob.course} icon={<GraduationCap size={20} weight="fill"/>} />
              <DetailBox label="Salary" value={selectedJob.salary} icon={<Money size={20} weight="fill"/>} />
              <DetailBox label="Experience" value={selectedJob.experience} icon={<Clock size={20} weight="fill"/>} />
              <DetailBox label="Qualification" value={selectedJob.qualification} icon={<BookOpen size={20} weight="fill"/>} />
              <DetailBox label="Gender Pref." value={selectedJob.gender} icon={<GenderIntersex size={20} weight="fill"/>} />
            </div>

            {selectedJob.description && (
              <div className="modal-desc-box">
                <div className="desc-title">Job Description</div>
                <div className="desc-content">{selectedJob.description}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* APPLICANTS MODAL */}
      {isApplicantsModalOpen && selectedJob && (
        <div className="modal-backdrop" onClick={(e) => { if(e.target === e.currentTarget) setIsApplicantsModalOpen(false); }}>
          <div className="premium-modal glass-panel" style={{ maxWidth: '900px', padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '85vh' }}>
            
            <div className="modal-header" style={{ padding: '25px', background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <h2>Applicants List</h2>
                <div className="modal-subtitle">{selectedJob.id} | {selectedJob.company}</div>
              </div>
              <button className="close-btn" onClick={() => setIsApplicantsModalOpen(false)}><X size={24} /></button>
            </div>

            <div style={{ overflowY: 'auto', padding: '20px' }}>
              <div className="clean-list">
                {appsByJobId[selectedJob.id] ? (
                  appsByJobId[selectedJob.id].map((app, i) => {
                    let statClass = 'blue';
                    let s = String(app.status || '').toLowerCase();
                    if(s.includes('interview')) statClass = 'purple';
                    if(s.includes('offer') || s.includes('placed') || s.includes('joined')) statClass = 'green';
                    if(s.includes('reject') || s.includes('not attended')) statClass = 'red';

                    return (
                      <div key={i} className="clean-row hover-bg">
                        <div className="cl-left">
                          <div className="cl-avatar">{app.name.charAt(0).toUpperCase()}</div>
                          <div><div className="cl-title">{app.name}</div><div className="cl-sub">{app.roll} • {app.branch}</div></div>
                        </div>
                        <div className="cl-middle">
                           <span className={`status-pill ${statClass}`}>{app.status || 'Applied'}</span>
                        </div>
                        <div className="cl-right" style={{ display: 'flex', gap: '10px' }}>
                          {app.phone && (
                            <a href={`tel:${app.phone}`} className="action-circle blue" title="Call">
                              <Phone size={18} weight="fill" />
                            </a>
                          )}
                          {app.email && (
                            <a href={`mailto:${app.email}`} className="action-circle red" title="Email">
                              <EnvelopeSimple size={18} weight="fill" />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="empty-state-card" style={{ background: 'transparent', border: 'none' }}>
                    <Users size={48} style={{ opacity: 0.3, marginBottom: '15px' }} />
                    <span style={{ fontSize: '1.1rem' }}>No students have applied yet.</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------------
          🎨 PREMIUM CSS FOR VACANCIES PAGE
      --------------------------------------------------------- */}
      <style>{`
        .premium-dashboard-wrapper { font-family: 'Inter', sans-serif; color: #f8fafc; }
        
        /* Glass Panels */
        .glass-panel { background: rgba(15, 23, 42, 0.7); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .hover-lift { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); cursor: pointer; }
        .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.7); border-color: rgba(255, 255, 255, 0.1); background: rgba(30, 41, 59, 0.8); }

        /* Hero */
        .top-hero-section { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; flex-wrap: wrap; gap: 20px; }
        .hero-text h1 { font-size: 2.2rem; font-weight: 800; margin: 0 0 5px 0; color: #fff; }
        .hero-text p { color: #94a3b8; margin: 0; font-size: 1rem; }
        .premium-btn { border: none; padding: 10px 20px; border-radius: 12px; font-weight: bold; font-size: 0.9rem; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; }
        .premium-btn.primary { background: #3b82f6; color: #fff; }
        .premium-btn.secondary { background: rgba(255,255,255,0.05); color: #fff; border: 1px solid rgba(255,255,255,0.1); }
        .premium-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }

        /* Admin Mini Dash */
        .mini-dash-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 25px; }
        .kpi-card { border-radius: 16px; padding: 20px; }
        .kpi-top { display: flex; justify-content: space-between; align-items: flex-start; }
        .kpi-title { font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 5px; }
        .kpi-val { font-size: 2rem; font-weight: 900; color: #fff; line-height: 1; }
        .kpi-icon { width: 45px; height: 45px; border-radius: 12px; display: flex; align-items: center; justify-content: center; box-shadow: inset 0 2px 10px rgba(255,255,255,0.05); }
        .kpi-icon.blue { background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); }
        .kpi-icon.green { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .kpi-icon.purple { background: rgba(168, 85, 247, 0.15); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.3); }
        .kpi-icon.red { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }

        /* Control Action Bar */
        .control-action-bar { border-radius: 16px; padding: 15px; margin-bottom: 30px; display: flex; flex-direction: column; gap: 15px; }
        .segmented-tabs { display: flex; background: rgba(0,0,0,0.3); padding: 5px; border-radius: 12px; width: fit-content; border: 1px solid rgba(255,255,255,0.05); }
        .seg-tab { background: transparent; border: none; padding: 8px 24px; color: #94a3b8; font-weight: bold; font-size: 0.9rem; border-radius: 8px; cursor: pointer; transition: 0.3s; }
        .seg-tab.active { background: #3b82f6; color: #fff; box-shadow: 0 4px 10px rgba(59,130,246,0.3); }
        .seg-tab.active-expired { background: #ef4444; color: #fff; box-shadow: 0 4px 10px rgba(239,68,68,0.3); }
        
        .filter-group { display: flex; gap: 12px; flex-wrap: wrap; }
        .premium-input, .premium-select { background: rgba(0,0,0,0.2); color: #fff; border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px 15px; font-size: 0.85rem; outline: none; transition: 0.2s; }
        .premium-input { min-width: 250px; flex: 1; }
        .premium-input:focus, .premium-select:focus { border-color: #3b82f6; background: rgba(0,0,0,0.4); }
        .premium-select option { background: #0f1523; color: #fff; padding: 10px; font-weight: bold; }
        .border-purple { border-color: rgba(168, 85, 247, 0.3); } .border-purple:focus { border-color: #a855f7; }
        .border-green { border-color: rgba(16, 185, 129, 0.3); } .border-green:focus { border-color: #10b981; }

        /* Empty State */
        .empty-state-card { background: rgba(15, 23, 42, 0.5); border: 1px dashed rgba(255,255,255,0.1); border-radius: 16px; padding: 50px 20px; text-align: center; color: #94a3b8; font-size: 1.1rem; font-weight: bold; }
        .text-blue { color: #3b82f6; }

        /* State Grouping */
        .state-group-section { margin-bottom: 40px; }
        .state-header { display: flex; align-items: center; gap: 15px; margin-bottom: 20px; opacity: 0.8; }
        .state-title { margin: 0; font-size: 1.2rem; font-weight: 900; letter-spacing: 2px; color: #cbd5e1; text-transform: uppercase; }
        .state-line { flex: 1; height: 1px; background: linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0) 100%); }

        /* Job Cards Grid */
        .job-card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }
        .job-card { border-radius: 20px; padding: 20px; display: flex; flex-direction: column; position: relative; overflow: hidden; }
        .jc-hover-actions { position: absolute; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(4px); display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 12px; opacity: 0; transition: 0.3s ease; border-radius: 20px; }
        .job-card:hover .jc-hover-actions { opacity: 1; }
        
        .jc-header { display: flex; align-items: center; gap: 15px; margin-bottom: 15px; }
        .jc-company-logo { width: 48px; height: 48px; border-radius: 12px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; font-weight: 900; color: #fff; flex-shrink: 0; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3); }
        .jc-company-info { flex: 1; min-width: 0; }
        .jc-company-info h3 { margin: 0 0 2px 0; font-size: 1.05rem; font-weight: 800; color: #fff; }
        .jc-company-info p { margin: 0; font-size: 0.8rem; color: #94a3b8; font-weight: 500; }
        .jc-id { background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 8px; font-size: 0.7rem; font-weight: bold; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.1); }
        .text-truncate { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        .jc-body { display: flex; flex-direction: column; gap: 8px; margin-bottom: 15px; }
        .jc-detail { display: flex; align-items: center; gap: 8px; font-size: 0.85rem; color: #cbd5e1; }
        .text-purple { color: #a855f7; font-weight: bold; }
        
        .jc-divider { height: 1px; background: rgba(255,255,255,0.05); margin-bottom: 15px; }
        
        .jc-footer { display: flex; justify-content: space-between; align-items: flex-end; }
        .status-pill { padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: 800; display: inline-block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        .status-pill.green { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .status-pill.red { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }
        .status-pill.gray { background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); }
        .status-pill.blue { background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); }
        .status-pill.purple { background: rgba(168, 85, 247, 0.15); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.3); }
        
        .jc-deadline { font-size: 0.75rem; color: #64748b; font-weight: 500; }
        .jc-applicants { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.03); padding: 8px 12px; border-radius: 12px; font-size: 0.8rem; font-weight: bold; border: 1px solid rgba(255,255,255,0.05); }

        /* Modals */
        .modal-backdrop { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); z-index: 99999; display: flex; justify-content: center; align-items: center; padding: 20px; }
        .premium-modal { width: 100%; max-width: 800px; max-height: 90vh; overflow-y: auto; border-radius: 24px; padding: 30px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.8); }
        .modal-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 15px; margin-bottom: 20px; }
        .modal-header h2 { margin: 0 0 5px 0; font-size: 1.6rem; color: #fff; font-weight: 800; }
        .modal-subtitle { color: #38bdf8; font-weight: bold; font-size: 1.1rem; }
        .close-btn { background: none; border: none; color: #64748b; cursor: pointer; transition: 0.2s; display: flex; }
        .close-btn:hover { color: #ef4444; transform: scale(1.1); }
        
        .modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        @media (max-width: 600px) { .modal-grid { grid-template-columns: 1fr; } }
        
        .modal-desc-box { background: rgba(255,255,255,0.02); padding: 20px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); margin-bottom: 20px; }
        .desc-title { font-size: 0.8rem; color: #94a3b8; text-transform: uppercase; margin-bottom: 10px; font-weight: bold; letter-spacing: 0.5px; }
        .desc-content { color: #e2e8f0; font-size: 0.95rem; line-height: 1.6; white-space: pre-wrap; }

        /* Clean List (Applicants Modal) */
        .clean-list { display: flex; flex-direction: column; gap: 10px; }
        .clean-row { display: flex; justify-content: space-between; align-items: center; padding: 15px; background: rgba(0, 0, 0, 0.2); border-radius: 12px; border: 1px solid rgba(255,255,255,0.02); transition: 0.2s; }
        .hover-bg:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
        .cl-left { display: flex; align-items: center; gap: 15px; flex: 1; min-width: 0; }
        .cl-avatar { width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; flex-shrink: 0; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3); }
        .cl-title { font-size: 1rem; font-weight: 700; color: #fff; margin-bottom: 3px; }
        .cl-sub { font-size: 0.8rem; color: #94a3b8; }
        .action-circle { width: 36px; height: 36px; border-radius: 10px; display: flex; align-items: center; justify-content: center; transition: 0.2s; }
        .action-circle.blue { background: rgba(59, 130, 246, 0.15); color: #3b82f6; } .action-circle.blue:hover { background: #3b82f6; color: #fff; }
        .action-circle.red { background: rgba(239, 68, 68, 0.15); color: #ef4444; } .action-circle.red:hover { background: #ef4444; color: #fff; }
      `}</style>
    </Layout>
  );
}