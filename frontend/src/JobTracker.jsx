import { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, CaretDown, FloppyDisk, CheckCircle, 
  WhatsappLogo, EnvelopeSimple, FilePdf 
} from '@phosphor-icons/react';
import Layout from './Layout';

export default function JobTracker() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters & Sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');
  const [sortOrder, setSortOrder] = useState('newest'); 
  
  const [openGroups, setOpenGroups] = useState({});
  const [savingStatus, setSavingStatus] = useState({});
  const [localEdits, setLocalEdits] = useState({});

  useEffect(() => {
    if (!tpoData) return;
    const fetchData = async () => {
      try {
        const response = await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/applications', { 
          assignedBranchesArray: tpoData.assignedBranchesArray,
          tpoName: tpoData.name 
        });
        if (response.data.success) setApplications(response.data.applications);
      } catch (error) { console.error("Failed to load data", error); } finally { setLoading(false); }
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
      const response = await axios.post('https://ipcs-tpo-portal-u0l6.onrender.com/api/tpo/applications/update', {
        rowNumber: rowNum, 
        status: newStatus, 
        remarks: newRemarks,
        fullApp: app // WE ADDED THIS LINE! Pass the entire app object for the Audit Log
      });
      if (response.data.success) {
        setSavingStatus(prev => ({ ...prev, [rowNum]: 'success' }));
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

  const statusOptions = ["Applied", "Interview Scheduled", "Interview Not Attended", "No Response From Student", "Student Rejected", "Got Offer", "Selected & Joined", "Placed", "Rejected"];

  const btnStyle = {
    base: { display: 'flex', alignItems: 'center', padding: '4px 8px', borderRadius: '4px', fontSize: '0.75rem', textDecoration: 'none', fontWeight: 600, cursor: 'pointer', transition: '0.2s' },
    whatsapp: { color: '#10b981', background: 'rgba(16, 185, 129, 0.15)' },
    mail: { color: '#38bdf8', background: 'rgba(56, 189, 248, 0.15)' },
    pdf: { color: '#f59e0b', background: 'rgba(245, 158, 11, 0.15)' },
    disabled: { color: '#64748b', background: 'rgba(100, 116, 139, 0.1)', cursor: 'not-allowed' }
  };

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        <h1 style={{ fontSize: '1.8rem', marginBottom: '5px' }}>Job Tracker (Action)</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>Search, sort, and track interview statuses across your active jobs.</p>
        
        <div className="header-controls">
          <div className="filter-group">
            <input type="text" className="sleek-input" placeholder="Search student, company, or ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            <input type="month" className="sleek-input" value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
            
            <select className="sleek-select" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
              <option value="All">All Courses</option>
              <option value="Industrial Automation">Industrial Automation</option>
              <option value="BMS & CCTV">BMS & CCTV</option>
              <option value="Embedded and IOT">Embedded and IOT</option>
              <option value="Python and Data Science">Python</option>
              <option value="Artificial Intelligence">AI</option>
              <option value="Digital Marketing">Digital Marketing</option>
            </select>

            <select className="sleek-select" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
              <option value="newest">Sort: Recent Activity</option>
              <option value="jobId-az">Sort: Job ID (A-Z)</option>
              <option value="jobId-za">Sort: Job ID (Z-A)</option>
              <option value="company-az">Sort: Company Name (A-Z)</option>
              <option value="company-za">Sort: Company Name (Z-A)</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: '1.5rem' }}>
          {loading ? (
            <div style={{ textAlign: 'center', marginTop: '3rem', color: 'var(--accent-primary)' }}><CircleNotch size={40} className="ph-spin" /><p>Loading tracker...</p></div>
          ) : groupsArray.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>No applications found matching your search.</div>
          ) : (
            groupsArray.map(group => {
              const isOpen = openGroups[group.groupKey];
              const posText = group.position && !group.position.includes('undefined') ? group.position : '';
              const compText = group.company && !group.company.includes('Unknown') ? group.company : 'Company Not Specified';
              const groupTitle = group.jobId ? group.jobId : compText;
              const groupSubtitle = group.jobId ? [compText, posText].filter(Boolean).join(' - ') : posText;

              return (
                <div key={group.groupKey}>
                  <div className="job-group-header" onClick={() => toggleGroup(group.groupKey)} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '1.2rem 1.5rem', borderRadius: '12px', marginTop: '1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--accent-primary)', display: 'block' }}>{groupTitle}</strong>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {groupSubtitle} {groupSubtitle && '•'} {group.apps.length} Application(s)
                      </span>
                    </div>
                    <CaretDown size={20} style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: '0.3s' }} />
                  </div>

                  {isOpen && (
                    <div style={{ padding: '0.5rem 0 1.5rem 0', animation: 'fadeInReveal 0.3s ease' }}>
                      <div className="table-container" style={{ marginTop: 0 }}>
                        <table className="modern-table">
                          <thead><tr><th>Student Info & Contact</th><th>Date Applied</th><th>Status Update</th><th>Remarks Log</th><th>Save</th></tr></thead>
                          <tbody>
                            {group.apps.map(app => {
                              const rowEdits = localEdits[app.rowNumber] || {};
                              const currentStatus = rowEdits.status !== undefined ? rowEdits.status : app.status;
                              const currentRemarks = rowEdits.remarks !== undefined ? rowEdits.remarks : app.remarks;
                              const btnStatus = savingStatus[app.rowNumber];

                              // Safe String Checks to enable the buttons
                              const safePhone = app.phone ? String(app.phone).trim() : '';
                              const safeEmail = app.email ? String(app.email).trim() : '';
                              const safeResume = app.resume ? String(app.resume).trim() : '';

                              const hasPhone = safePhone !== '' && safePhone !== 'N/A';
                              const hasEmail = safeEmail !== '' && safeEmail !== 'N/A';
                              const hasResume = safeResume !== '' && safeResume !== 'N/A';

                              return (
                                <tr key={app.rowNumber}>
                                  <td>
                                    <span className="primary-text" style={{ marginBottom: '2px', display: 'block', fontSize: '1rem' }}>
                                      {app.name} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>({app.roll})</span>
                                    </span>
                                    
                                    {/* NEW: Display Branch and Qualification cleanly */}
                                    <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '10px', fontWeight: 600 }}>
                                      {app.branch} • {app.qual || app.course}
                                    </span>
                                    
                                    {/* 1-CLICK QUICK ACTIONS */}
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                      <a 
                                        href={hasPhone ? `https://wa.me/91${safePhone.replace(/\D/g,'')}` : '#'} 
                                        target={hasPhone ? "_blank" : "_self"} 
                                        rel="noreferrer" 
                                        style={{ ...btnStyle.base, ...(hasPhone ? btnStyle.whatsapp : btnStyle.disabled) }}
                                        onClick={(e) => { if(!hasPhone) e.preventDefault(); }}
                                      >
                                        <WhatsappLogo weight="fill" size={14} style={{ marginRight: '4px' }} /> Chat
                                      </a>
                                      
                                      <a 
                                        href={hasEmail ? `mailto:${safeEmail}` : '#'} 
                                        style={{ ...btnStyle.base, ...(hasEmail ? btnStyle.mail : btnStyle.disabled) }}
                                        onClick={(e) => { if(!hasEmail) e.preventDefault(); }}
                                      >
                                        <EnvelopeSimple weight="bold" size={14} style={{ marginRight: '4px' }} /> Mail
                                      </a>
                                      
                                      <a 
                                        href={hasResume ? (getDrivePdf(safeResume) || safeResume) : '#'} 
                                        target={hasResume ? "_blank" : "_self"} 
                                        rel="noreferrer" 
                                        style={{ ...btnStyle.base, ...(hasResume ? btnStyle.pdf : btnStyle.disabled) }}
                                        onClick={(e) => { if(!hasResume) e.preventDefault(); }}
                                      >
                                        <FilePdf weight="fill" size={14} style={{ marginRight: '4px' }} /> CV
                                      </a>
                                    </div>
                                  </td>
                                  
                                  <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{app.date.split(' ')[0]}</td>
                                  
                                  <td>
                                    <select className="sleek-select" style={{ padding: '8px', width: '100%', borderRadius: '6px' }} value={currentStatus} onChange={(e) => handleEditChange(app.rowNumber, 'status', e.target.value)}>
                                      {statusOptions.map(o => <option key={o} value={o}>{o}</option>)}
                                    </select>
                                  </td>
                                  
                                  <td>
                                    <input type="text" placeholder="Add remarks..." className="sleek-input" style={{ padding: '8px', width: '100%' }} value={currentRemarks} onChange={(e) => handleEditChange(app.rowNumber, 'remarks', e.target.value)} />
                                  </td>
                                  
                                  <td style={{ textAlign: 'center' }}>
                                    <button className="btn-action" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', width: '100%', background: btnStatus === 'success' ? 'var(--accent-success)' : 'var(--accent-primary)' }} onClick={() => saveApplication(app)} disabled={btnStatus === 'saving'}>
                                      {btnStatus === 'saving' ? <CircleNotch size={16} className="ph-spin" /> : btnStatus === 'success' ? <CheckCircle size={16} weight="fill" /> : <><FloppyDisk size={16} weight="bold" /> Save</>}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </Layout>
  );
}