import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, CaretDown, FloppyDisk, CheckCircle, 
  WhatsappLogo, EnvelopeSimple, FilePdf, X 
} from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function JobTracker() {
  const [interviewModal, setInterviewModal] = useState({
    isOpen: false,
    appRowNumber: null,
    status: '',
    date: '',
    time: '',
    venue: ''
  });

  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  
  const userRole = String(tpoData?.role || '').toUpperCase();
  const accessType = String(tpoData?.accessType || '').toLowerCase();
  const isSuperAdmin = accessType === 'superadmin' || userRole.includes('ADMIN') || userRole.includes('HEAD') || userRole.includes('MANAGER');
  
  const isStrictTpo = userRole.includes('TPO') && !isSuperAdmin;

  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('newest'); 
  
  const [openGroups, setOpenGroups] = useState({});
  const [savingStatus, setSavingStatus] = useState({});
  const [localEdits, setLocalEdits] = useState({});

  useEffect(() => {
    if (!tpoData) return;

    if (!isStrictTpo) {
      window.location.href = '/dashboard';
      return;
    }

    const fetchData = async () => {
      try {
        const response = await axios.post(`${API_BASE}/api/tpo/applications`, { 
          assignedBranchesArray: tpoData.assignedBranchesArray,
          tpoName: tpoData.name 
        });
        
        if (response.data.success) {
          const myName = (tpoData.name || '').toLowerCase().trim();
          
          const strictlyMyJobs = response.data.applications.filter(app => {
            const jobOwner = (app.tpoName || '').toLowerCase().trim();
            return jobOwner === myName;
          });

          setApplications(strictlyMyJobs);
        }
      } catch (error) { 
        console.error("Failed to load data", error); 
      } finally { 
        setLoading(false); 
      }
    };
    fetchData();
  }, []);

  const toggleGroup = (groupKey) => setOpenGroups(prev => ({ ...prev, [groupKey]: !prev[groupKey] }));

  const handleEditChange = (rowNumber, field, value) => {
    setLocalEdits(prev => ({ ...prev, [rowNumber]: { ...prev[rowNumber], [field]: value } }));
  };

  const getDrivePdf = (url) => {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
    return match ? `https://drive.google.com/file/d/${match[1]}/view` : url;
  };

  const saveApplication = async (app) => {
    const rowNum = app.rowNumber;
    const edits = localEdits[rowNum] || {};
    const newStatus = edits.status !== undefined ? edits.status : app.status;
    const newRemarks = edits.remarks !== undefined ? edits.remarks : app.remarks;

    setSavingStatus(prev => ({ ...prev, [rowNum]: 'saving' }));

    try {
      const payload = {
        rowNumber: rowNum, 
        status: newStatus, 
        remarks: newRemarks,
        fullApp: app,
        currentUserEmail: tpoData?.email || '',
        interviewDate: interviewModal.appRowNumber === rowNum ? interviewModal.date : '',
        interviewTime: interviewModal.appRowNumber === rowNum ? interviewModal.time : '',
        interviewVenue: interviewModal.appRowNumber === rowNum ? interviewModal.venue : ''
      };

      const response = await axios.post(`${API_BASE}/api/tpo/applications/update`, payload);
      
      if (response.data.success) {
        setSavingStatus(prev => ({ ...prev, [rowNum]: 'success' }));
        
        if (interviewModal.isOpen && interviewModal.appRowNumber === rowNum) {
          setInterviewModal({ isOpen: false, appRowNumber: null, status: '', date: '', time: '', venue: '' });
        }

        setTimeout(() => setSavingStatus(prev => ({ ...prev, [rowNum]: null })), 2000);
      }
    } catch (error) {
      setSavingStatus(prev => ({ ...prev, [rowNum]: 'error' }));
      alert("Failed to save. Check server logs.");
    }
  };

  const filteredApps = applications.filter(a => {
    let dateObj = new Date(a.date);
    let monthKey = !isNaN(dateObj) ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}` : '';
    
    let mMatch = monthFilter ? monthKey === monthFilter : true;
    let cMatch = courseFilter === 'All' || a.course.toLowerCase().includes(courseFilter.toLowerCase());
    
    let sMatch = searchQuery === '' || 
                 a.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                 a.jobId.toLowerCase().includes(searchQuery.toLowerCase()) || 
                 a.company.toLowerCase().includes(searchQuery.toLowerCase());

    return mMatch && cMatch && sMatch;
  });

  const groupedApps = {};
  filteredApps.forEach(app => {
    let groupKey = app.jobId ? app.jobId : `${app.company} - ${app.position}`;
    if (!app.jobId && app.company === 'Unknown Company') groupKey = `Unspecified Job - Row ${app.rowNumber}`;

    if(!groupedApps[groupKey]) {
      groupedApps[groupKey] = { jobId: app.jobId, company: app.company, position: app.position, apps: [] };
    }
    groupedApps[groupKey].apps.push(app);
  });

  const groupsArray = Object.keys(groupedApps).map(key => ({ groupKey: key, ...groupedApps[key] }));

  groupsArray.sort((a, b) => {
    if (sortOrder === 'jobId-az') return (a.jobId || '').localeCompare(b.jobId || '');
    if (sortOrder === 'jobId-za') return (b.jobId || '').localeCompare(a.jobId || '');
    if (sortOrder === 'company-az') return (a.company || '').localeCompare(b.company || '');
    if (sortOrder === 'company-za') return (b.company || '').localeCompare(a.company || '');
    if (sortOrder === 'newest') {
      const maxDateA = Math.max(...a.apps.map(app => new Date(app.date).getTime() || 0));
      const maxDateB = Math.max(...b.apps.map(app => new Date(app.date).getTime() || 0));
      return maxDateB - maxDateA;
    }
    return 0;
  });

  const statusOptions = [
    "Applied", 
    "Interview Scheduled", 
    "Interview Not Attended", 
    "No Response from Student", 
    "Got Offer", 
    "Placed", 
    "Student Rejected Offer", 
    "Company Rejected"
  ];

  if (!isStrictTpo) return <></>;

  return (
    <Layout>
      <div className="page-container jt-premium-wrapper">
        
        {/* PREMIUM HEADER */}
        <div className="jt-hero-section">
          <h1 className="jt-title">Job Tracker (Action)</h1>
          <p className="jt-subtitle">Search, sort, and track interview statuses across your active jobs.</p>
        </div>
        
        {/* PREMIUM FILTERS */}
        <div className="jt-filter-bar">
          <input type="text" className="jt-input" placeholder="Search student, company, or ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <input type="month" className="jt-input" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
          
          <select className="jt-select" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
            <option value="All">All Courses</option>
            <option value="Industrial Automation">Industrial Automation</option>
            <option value="BMS & CCTV">BMS & CCTV</option>
            <option value="Embedded and IOT">Embedded and IOT</option>
            <option value="Python and Data Science">Python</option>
            <option value="Artificial Intelligence">AI</option>
            <option value="Digital Marketing">Digital Marketing</option>
          </select>

          <select className="jt-select" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
            <option value="newest">Sort: Recent Activity</option>
            <option value="jobId-az">Sort: Job ID (A-Z)</option>
            <option value="jobId-za">Sort: Job ID (Z-A)</option>
            <option value="company-az">Sort: Company Name (A-Z)</option>
            <option value="company-za">Sort: Company Name (Z-A)</option>
          </select>
        </div>

        {/* DATA RENDERING */}
        <div className="jt-content-area">
          {loading ? (
            <div className="jt-loading"><CircleNotch size={48} className="ph-spin" /><p>Syncing job opening data...</p></div>
          ) : groupsArray.length === 0 ? (
            <div className="jt-empty-state">No applications found for your job openings.</div>
          ) : (
            groupsArray.map(group => {
              const isOpen = openGroups[group.groupKey];
              const posText = group.position && !group.position.includes('undefined') ? group.position : '';
              const compText = group.company && !group.company.includes('Unknown') ? group.company : 'Company Not Specified';
              const groupTitle = group.jobId ? group.jobId : compText;
              const groupSubtitle = group.jobId ? [compText, posText].filter(Boolean).join(' - ') : posText;

              return (
                <div key={group.groupKey} className="jt-accordion-wrapper">
                  
                  {/* ACCORDION HEADER */}
                  <div className={`jt-accordion-header ${isOpen ? 'active' : ''}`} onClick={() => toggleGroup(group.groupKey)}>
                    <div>
                      <strong className="jt-acc-title">{groupTitle}</strong>
                      <span className="jt-acc-sub">{groupSubtitle} • {group.apps.length} Application(s)</span>
                    </div>
                    <CaretDown size={20} className="jt-chevron" style={{ transform: isOpen ? 'rotate(180deg)' : 'none' }} />
                  </div>

                  {/* ACCORDION BODY (GRID BASED) */}
                  {isOpen && (
                    <div className="jt-accordion-body">
                      
                      {/* Grid Headers matching screenshot */}
                      <div className="jt-grid-header">
                        <span>STUDENT INFO & CONTACT</span>
                        <span style={{ textAlign: 'center' }}>DATE APPLIED</span>
                        <span>STATUS UPDATE</span>
                        <span>REMARKS LOG</span>
                        <span style={{ textAlign: 'center' }}>SAVE</span>
                      </div>

                      {/* Application Cards */}
                      <div className="jt-app-list">
                        {group.apps.map(app => {
                          const rowEdits = localEdits[app.rowNumber] || {};
                          const currentStatus = rowEdits.status !== undefined ? rowEdits.status : app.status;
                          const currentRemarks = rowEdits.remarks !== undefined ? rowEdits.remarks : app.remarks;
                          const btnStatus = savingStatus[app.rowNumber];

                          const safePhone = app.phone ? String(app.phone).trim() : '';
                          const safeEmail = app.email ? String(app.email).trim() : '';
                          const safeResume = app.resume ? String(app.resume).trim() : '';

                          const hasPhone = safePhone !== '' && safePhone !== 'N/A';
                          const hasEmail = safeEmail !== '' && safeEmail !== 'N/A';
                          const hasResume = safeResume !== '' && safeResume !== 'N/A';

                          return (
                            <div key={app.rowNumber} className="jt-app-card">
                              
                              {/* COL 1: Student Details & Badges */}
                              <div className="jt-col-student">
                                <div className="jt-stu-name">
                                  {app.name} <span className="jt-stu-roll">({app.roll})</span>
                                </div>
                                <div className="jt-stu-course">{app.branch} • {app.qual || app.course}</div>
                                
                                <div className="jt-badge-row">
                                  <a 
                                    href={hasPhone ? `https://wa.me/91${safePhone.replace(/\D/g,'')}` : '#'} 
                                    target={hasPhone ? "_blank" : "_self"} 
                                    rel="noreferrer" 
                                    className={`jt-badge ${hasPhone ? 'chat' : 'disabled'}`}
                                    onClick={(e) => { if(!hasPhone) e.preventDefault(); }}
                                  >
                                    <WhatsappLogo weight="fill" size={14} /> Chat
                                  </a>
                                  <a 
                                    href={hasEmail ? `mailto:${safeEmail}` : '#'} 
                                    className={`jt-badge ${hasEmail ? 'mail' : 'disabled'}`}
                                    onClick={(e) => { if(!hasEmail) e.preventDefault(); }}
                                  >
                                    <EnvelopeSimple weight="bold" size={14} /> Mail
                                  </a>
                                  <a 
                                    href={hasResume ? (getDrivePdf(safeResume) || safeResume) : '#'} 
                                    target={hasResume ? "_blank" : "_self"} 
                                    rel="noreferrer" 
                                    className={`jt-badge ${hasResume ? 'cv' : 'disabled'}`}
                                    onClick={(e) => { if(!hasResume) e.preventDefault(); }}
                                  >
                                    <FilePdf weight="fill" size={14} /> CV
                                  </a>
                                </div>
                              </div>
                              
                              {/* COL 2: Date Applied */}
                              <div className="jt-col-date">
                                {app.date.split(' ')[0]}
                              </div>
                              
                              {/* COL 3: Status Dropdown */}
                              <div className="jt-col-status">
                                <select 
                                  className="jt-select" 
                                  value={currentStatus} 
                                  onChange={(e) => {
                                    const newStat = e.target.value;
                                    handleEditChange(app.rowNumber, 'status', newStat);
                                    if (newStat === 'Interview Scheduled') {
                                      setInterviewModal({ isOpen: true, appRowNumber: app.rowNumber, status: newStat, date: '', time: '', venue: '' });
                                    }
                                  }}
                                >
                                  {statusOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                </select>
                              </div>
                              
                              {/* COL 4: Remarks Log */}
                              <div className="jt-col-remarks">
                                <input 
                                  type="text" 
                                  placeholder="Add remarks..." 
                                  className="jt-input" 
                                  value={currentRemarks} 
                                  onChange={(e) => handleEditChange(app.rowNumber, 'remarks', e.target.value)} 
                                />
                              </div>
                              
                              {/* COL 5: Action Save */}
                              <div className="jt-col-save">
                                <button 
                                  className={`jt-save-btn ${btnStatus === 'success' ? 'success' : ''}`} 
                                  onClick={() => saveApplication(app)} 
                                  disabled={btnStatus === 'saving'}
                                >
                                  {btnStatus === 'saving' ? <CircleNotch size={18} className="ph-spin" /> : 
                                   btnStatus === 'success' ? <CheckCircle size={18} weight="bold" /> : 
                                   <><FloppyDisk size={18} weight="bold" /> Save</>}
                                </button>
                              </div>

                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* INTERVIEW MODAL REMAINS FUNCTIONAL */}
      {interviewModal.isOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div className="modal-card" style={{ maxWidth: '500px', width: '100%', background: '#0f1523', border: '1px solid #1e293b', borderRadius: '16px', padding: '2rem' }}>
            
            <div style={{ borderBottom: '1px solid #1e293b', paddingBottom: '1rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ margin: 0, color: '#8b5cf6', fontSize: '1.4rem' }}>Schedule Interview</h2>
                <p style={{ margin: '5px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>
                  These details will be emailed to the student and recorded.
                </p>
              </div>
              <X size={24} style={{ cursor: 'pointer', color: '#94a3b8' }} onClick={() => {
                handleEditChange(interviewModal.appRowNumber, 'status', 'Applied');
                setInterviewModal({ ...interviewModal, isOpen: false });
              }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '5px', fontWeight: 'bold' }}>Interview Date *</label>
                <input type="date" className="jt-input" value={interviewModal.date} onChange={(e) => setInterviewModal({...interviewModal, date: e.target.value})} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '5px', fontWeight: 'bold' }}>Interview Time *</label>
                <input type="time" className="jt-input" value={interviewModal.time} onChange={(e) => setInterviewModal({...interviewModal, time: e.target.value})} />
              </div>
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '5px', fontWeight: 'bold' }}>Venue / Google Meet Link *</label>
              <input type="text" className="jt-input" placeholder="e.g., Calicut Branch or Meet Link" value={interviewModal.venue} onChange={(e) => setInterviewModal({...interviewModal, venue: e.target.value})} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #1e293b', paddingTop: '1.5rem' }}>
              <button className="jt-btn-cancel" onClick={() => {
                  handleEditChange(interviewModal.appRowNumber, 'status', 'Applied');
                  setInterviewModal({ ...interviewModal, isOpen: false });
                }}>Cancel</button>
              <button className="jt-save-btn" style={{ width: 'auto' }} onClick={() => {
                  if (!interviewModal.date || !interviewModal.time || !interviewModal.venue) return alert("Please fill in all interview details to proceed.");
                  const appToSave = applications.find(a => a.rowNumber === interviewModal.appRowNumber);
                  if (appToSave) saveApplication(appToSave);
                }}>Confirm & Send Mail</button>
            </div>
          </div>
        </div>
      )}

      {/* 🎨 ULTRA 4K PREMIUM STYLES TO MATCH MOCKUP EXACTLY */}
      <style>{`
        /* Global Page Adjustments */
        .jt-premium-wrapper {
          font-family: 'Inter', sans-serif;
        }

        /* Top Hero Section */
        .jt-hero-section {
          margin-bottom: 25px;
        }
        .jt-title {
          font-size: 2.2rem;
          font-weight: 800;
          color: #fff;
          margin: 0 0 5px 0;
        }
        .jt-subtitle {
          color: #94a3b8;
          font-size: 1.05rem;
          margin: 0;
        }

        /* Sleek Filter Bar */
        .jt-filter-bar {
          display: flex;
          gap: 15px;
          margin-bottom: 30px;
          flex-wrap: wrap;
        }

        /* Inputs & Selects matching the Dark Theme */
        .jt-input, .jt-select {
          background: #0b1121; /* Very dark inner background */
          border: 1px solid #1e293b;
          color: #f8fafc;
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 0.9rem;
          outline: none;
          transition: all 0.2s ease;
        }
        .jt-input:focus, .jt-select:focus {
          border-color: #8b5cf6;
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.1);
        }
        .jt-input::placeholder { color: #475569; }
        .jt-select option { background: #0f1523; color: #fff; padding: 10px; }
        
        /* Loading & Empty States */
        .jt-loading, .jt-empty-state {
          text-align: center;
          padding: 4rem 0;
          color: #8b5cf6;
        }
        .jt-empty-state {
          color: #64748b;
          font-size: 1.1rem;
        }

        /* Accordion Wrapper */
        .jt-accordion-wrapper {
          margin-bottom: 20px;
        }

        /* Accordion Header */
        .jt-accordion-header {
          background: #111827; /* Dark card background */
          border: 1px solid #1e293b;
          padding: 1.2rem 1.5rem;
          border-radius: 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          transition: 0.2s ease;
        }
        .jt-accordion-header:hover {
          background: #161e2e;
          border-color: #334155;
        }
        .jt-accordion-header.active {
          border-bottom-left-radius: 0;
          border-bottom-right-radius: 0;
          border-bottom: 1px solid transparent;
        }
        
        .jt-acc-title {
          font-size: 1.1rem;
          color: #8b5cf6; /* Vibrant Cyan */
          display: block;
          margin-bottom: 4px;
        }
        .jt-acc-sub {
          font-size: 0.85rem;
          color: #64748b;
        }
        .jt-chevron {
          color: #94a3b8;
          transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Accordion Body */
        .jt-accordion-body {
          background: transparent;
          padding: 10px 0 0 0;
          animation: fadeIn 0.3s ease;
        }

        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-5px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Grid Based Table Header */
        .jt-grid-header {
          display: grid;
          grid-template-columns: 2.5fr 1fr 1.5fr 1.5fr 0.8fr;
          gap: 15px;
          padding: 0 20px 12px 20px;
          font-size: 0.75rem;
          font-weight: 800;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        /* The Application Cards (Mockup accurate) */
        .jt-app-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .jt-app-card {
          display: grid;
          grid-template-columns: 2.5fr 1fr 1.5fr 1.5fr 0.8fr;
          gap: 15px;
          background: #111827; /* Same dark tone as accordion header */
          border: 1px solid #1e293b;
          border-radius: 12px;
          padding: 20px;
          align-items: center;
          transition: 0.2s;
        }
        .jt-app-card:hover {
          border-color: rgba(255,255,255,0.1);
        }

        /* Columns Content */
        .jt-stu-name {
          color: #fff;
          font-size: 1.05rem;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .jt-stu-roll {
          color: #64748b;
          font-size: 0.85rem;
          font-weight: 600;
        }
        .jt-stu-course {
          color: #94a3b8;
          font-size: 0.8rem;
          margin-bottom: 12px;
        }

        .jt-col-date {
          color: #94a3b8;
          font-size: 0.9rem;
          text-align: center;
        }

        /* Action Badges */
        .jt-badge-row {
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        }
        
        .jt-badge {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 700;
          text-decoration: none;
          transition: 0.2s;
        }
        
        .jt-badge.chat { color: #10b981; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); }
        .jt-badge.chat:hover { background: rgba(16, 185, 129, 0.25); }
        
        .jt-badge.mail { color: #8b5cf6; background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.3); }
        .jt-badge.mail:hover { background: rgba(56, 189, 248, 0.25); }
        
        .jt-badge.cv { color: #f59e0b; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); }
        .jt-badge.cv:hover { background: rgba(245, 158, 11, 0.25); }
        
        .jt-badge.disabled { color: #475569; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); cursor: not-allowed; }

        /* Save & Cancel Buttons */
        .jt-save-btn {
          width: 100%;
          background: #8b5cf6; /* The signature Cyan from mockup */
          color: #020617;
          border: none;
          padding: 10px 16px;
          border-radius: 8px;
          font-weight: 800;
          font-size: 0.85rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          transition: all 0.2s;
        }
        .jt-save-btn:hover:not(:disabled) {
          background: #0284c7;
          color: #fff;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(56, 189, 248, 0.3);
        }
        .jt-save-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        .jt-save-btn.success { background: #10b981; color: #fff; }
        
        .jt-btn-cancel {
          background: transparent;
          border: 1px solid #334155;
          color: #cbd5e1;
          padding: 10px 20px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: bold;
          transition: 0.2s;
        }
        .jt-btn-cancel:hover { background: rgba(255,255,255,0.05); color: #fff; }

        /* Responsive Breakpoints */
        @media (max-width: 1024px) {
          .jt-grid-header { display: none; } /* Hide headers on small screens */
          .jt-app-card {
            grid-template-columns: 1fr;
            gap: 20px;
          }
          .jt-col-date { text-align: left; }
          .jt-col-date::before { content: "Date Applied: "; color: #64748b; font-size: 0.8rem; margin-right: 5px; }
        }
      `}</style>
    </Layout>
  );
}