import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, Users, Eye, X, Prohibit, EnvelopeSimple, Phone, Plus, FloppyDisk } from '@phosphor-icons/react';
import Layout from './Layout';

const API_BASE = "https://api-talenzo.ipcsglobal.info";

const DetailBox = ({ label, value }) => (
  <div style={{ background: '#161e2e', padding: '12px', borderRadius: '8px', border: '1px solid #1e293b' }}>
    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '4px' }}>{label}</div>
    <div style={{ fontWeight: 'bold', color: '#fff' }}>{value || 'Not Specified'}</div>
  </div>
);

export default function Vacancies() {
  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null;
  
  // 🚨 RESTRICT ACCESS: ONLY TPO & SUPER ADMIN CAN ADD VACANCIES
  const upperRole = (tpoData?.role || '').toUpperCase();
  const isTpo = upperRole === 'TPO';
  const isSuperAdmin = tpoData?.accessType === 'superadmin' || upperRole.includes('GENERAL MANAGER') || upperRole.includes('ZONAL PLACEMENT HEAD') || upperRole === 'TECHNICAL HEAD';
  const canAddOpening = isTpo || isSuperAdmin;

  const [vacancies, setVacancies] = useState([]);
  const [applications, setApplications] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');

  const [selectedJob, setSelectedJob] = useState(null);
  const [isJobDetailsModalOpen, setIsJobDetailsModalOpen] = useState(false);
  const [isApplicantsModalOpen, setIsApplicantsModalOpen] = useState(false);
  
  // ADD MODAL STATE
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [addForm, setAddForm] = useState({
    id: '', company: '', position: '', location: '', state: '', mode: 'Work at Office', lastDate: '', course: 'Industrial Automation', qualification: '', description: '', experience: '', salary: '', gender: 'Any'
  });

  const fetchData = async () => {
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

  useEffect(() => {
    fetchData();
  }, []);

  const handleAddSubmit = async () => {
    if (!addForm.id || !addForm.company || !addForm.position) return alert("Job ID, Company, and Position are required.");
    setSavingStatus(true);
    try {
      const res = await axios.post(`${API_BASE}/api/tpo/vacancies/add`, addForm);
      if (res.data.success) {
        setIsAddModalOpen(false);
        setAddForm({ id: '', company: '', position: '', location: '', state: '', mode: 'Work at Office', lastDate: '', course: 'Industrial Automation', qualification: '', description: '', experience: '', salary: '', gender: 'Any' });
        fetchData(); // Refresh list automatically
      }
    } catch (err) {
      alert("Failed to add vacancy.");
    } finally {
      setSavingStatus(false);
    }
  };

  const appsByJobId = {};
  applications.forEach(app => {
    const jobId = (app.jobId || '').toString().trim();
    if (!appsByJobId[jobId]) appsByJobId[jobId] = [];
    appsByJobId[jobId].push(app);
  });

  const filteredVacs = vacancies.filter(v => {
    const matchQuery = (v.id || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                       (v.company || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
                       (v.position || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchCourse = courseFilter === 'All' || (v.course || '').toLowerCase().includes(courseFilter.toLowerCase());
    return matchQuery && matchCourse;
  });

  const groupedVacs = {};
  filteredVacs.forEach(v => {
    const loc = (v.state || 'OTHER STATES').toUpperCase().trim();
    if (!groupedVacs[loc]) groupedVacs[loc] = [];
    groupedVacs[loc].push(v);
  });

  const parseDate = (dateStr) => {
    if (!dateStr) return new Date(8640000000000000);
    if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`); 
    }
    return new Date(dateStr);
  };
  
  const today = new Date();
  today.setHours(0,0,0,0);

  return (
    <Layout>
      <div className="page-container">
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '1.8rem', margin: '0 0 5px 0' }}>Active Job Vacancies</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Current openings and applicant tracking for your branches.</p>
          </div>
          
          {/* 🚨 ADD OPENING BUTTON: VISIBLE ONLY TO TPO & ADMINS */}
          {canAddOpening && (
            <button className="btn-action" style={{ background: '#38bdf8', color: '#0f1523', display: 'flex', alignItems: 'center', gap: '8px', width: 'auto', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold' }} onClick={() => setIsAddModalOpen(true)}>
              <Plus weight="bold" size={20} /> Add Opening
            </button>
          )}
        </div>

        <div className="header-controls" style={{ justifyContent: 'flex-start' }}>
          <input type="text" className="sleek-input" placeholder="Search ID or Company..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          <select className="sleek-select" value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
            <option value="All">All Courses</option>
            <option value="Industrial Automation">Industrial Automation</option>
            <option value="BMS & CCTV">BMS & CCTV</option>
            <option value="Python and Data Science">Python</option>
            <option value="Digital Marketing">Digital Marketing</option>
          </select>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '3rem', color: '#38bdf8' }}><CircleNotch size={40} className="ph-spin" /><p>Fetching vacancies...</p></div>
        ) : Object.keys(groupedVacs).length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>No active vacancies match your filters.</div>
        ) : (
          Object.keys(groupedVacs).map((state, idx) => (
            <div key={idx} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ textAlign: 'center', fontSize: '1.2rem', fontWeight: 800, color: '#fff', textTransform: 'uppercase', letterSpacing: '2px', marginBottom: '1.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '1rem' }}>
                {state}
              </div>
              
              <div className="table-container" style={{ marginTop: 0 }}>
                <table className="modern-table">
                  <thead>
                    <tr>
                      <th>Job ID</th>
                      <th>Position & Company</th>
                      <th>Location & Mode</th>
                      <th>Status & Deadline</th>
                      <th style={{ textAlign: 'center' }}>Applicants</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupedVacs[state].map((v, i) => {
                      const deadline = parseDate(v.lastDate);
                      const isExpired = deadline < today || (v.status || '').toLowerCase().includes('expire');
                      
                      let statBadge = <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>Open</span>;
                      if((v.status || '').toLowerCase().includes('close') || (v.status || '').toLowerCase().includes('no')) statBadge = <span style={{ background: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>Closed</span>;
                      if(isExpired) statBadge = <span style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold' }}>Expired</span>;

                      const myApplicants = appsByJobId[v.id] || [];
                      const applicantCount = myApplicants.length;

                      return (
                        <tr key={i}>
                          <td style={{ color: '#38bdf8', fontWeight: 700 }}>{v.id}</td>
                          <td>
                            <div className="primary-text" style={{ fontWeight: 'bold', color: '#fff' }}>{v.position}</div>
                            <div className="sub-text" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{v.company}</div>
                          </td>
                          <td>
                            <div style={{ color: '#cbd5e1' }}>{v.location}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{v.mode}</div>
                          </td>
                          <td>
                            {statBadge}<br/>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'inline-block' }}>
                              Ends: <strong style={{ color: isExpired ? '#ef4444' : '#f59e0b' }}>{v.lastDate}</strong>
                            </span>
                          </td>
                          
                          <td style={{ textAlign: 'center' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: applicantCount > 0 ? 'rgba(56, 189, 248, 0.1)' : 'rgba(255,255,255,0.05)', color: applicantCount > 0 ? '#38bdf8' : 'var(--text-muted)', padding: '6px 12px', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' }}>
                              <Users size={16} weight={applicantCount > 0 ? "fill" : "regular"} />
                              {applicantCount} Applied
                            </div>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button 
                                className="btn-secondary" 
                                style={{ padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px', opacity: isExpired ? 0.5 : 1, cursor: isExpired ? 'not-allowed' : 'pointer' }} 
                                onClick={() => !isExpired && setSelectedJob(v) || !isExpired && setIsJobDetailsModalOpen(true)}
                                disabled={isExpired}
                                title={isExpired ? "Job Details unavailable for expired openings" : "View Job Details"}
                              >
                                {isExpired ? <Prohibit weight="bold" size={14}/> : <Eye weight="bold" size={14} />} Details
                              </button>
                              <button 
                                className="btn-action" 
                                style={{ background: applicantCount > 0 ? '#3b82f6' : '#1e293b', color: '#fff', padding: '6px 12px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }} 
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

      {/* VIEW JOB DETAILS MODAL */}
      {isJobDetailsModalOpen && selectedJob && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }} onClick={(e) => { if(e.target === e.currentTarget) setIsJobDetailsModalOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ margin: '0 0 5px 0', fontSize: '1.5rem', color: '#fff' }}>{selectedJob.position}</h2>
                <div style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '1.1rem' }}>{selectedJob.company}</div>
              </div>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsJobDetailsModalOpen(false)} />
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
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>Job Description</div>
                <div style={{ color: '#fff', fontSize: '0.9rem', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{selectedJob.description}</div>
              </div>
            )}

            <div style={{ textAlign: 'right' }}>
              <button className="btn-secondary" onClick={() => setIsJobDetailsModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* VIEW APPLICANTS MODAL */}
      {isApplicantsModalOpen && selectedJob && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }} onClick={(e) => { if(e.target === e.currentTarget) setIsApplicantsModalOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: '900px', width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            
            <div style={{ padding: '1.5rem 2rem', background: '#161e2e', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 style={{ margin: '0 0 5px 0', fontSize: '1.3rem', color: '#fff' }}>Applicants</h2>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{selectedJob.id} | {selectedJob.company}</div>
              </div>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsApplicantsModalOpen(false)} />
            </div>

            <div style={{ overflowY: 'auto', padding: '0' }}>
              <table className="modern-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: '#0f1523', zIndex: 10 }}>
                  <tr>
                    <th style={{ padding: '15px 20px', color: 'var(--text-muted)' }}>Student Name</th>
                    <th style={{ padding: '15px 20px', color: 'var(--text-muted)' }}>Branch</th>
                    <th style={{ padding: '15px 20px', color: 'var(--text-muted)' }}>App Status</th>
                    <th style={{ padding: '15px 20px', color: 'var(--text-muted)', textAlign: 'right' }}>Contact Info</th>
                  </tr>
                </thead>
                <tbody>
                  {appsByJobId[selectedJob.id] ? (
                    appsByJobId[selectedJob.id].map((app, i) => {
                      let statClass = 'badge-blue';
                      let s = (app.status || '').toLowerCase();
                      if(s.includes('interview')) statClass = 'badge-purple';
                      if(s.includes('offer') || s.includes('placed') || s.includes('joined')) statClass = 'badge-green';
                      if(s.includes('reject') || s.includes('not attended')) statClass = 'badge-gray';

                      return (
                        <tr key={i} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '15px 20px' }}>
                            <div style={{ fontWeight: 'bold', color: '#fff' }}>{app.name}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{app.roll}</div>
                          </td>
                          <td style={{ padding: '15px 20px', color: '#cbd5e1' }}>{app.branch}</td>
                          <td style={{ padding: '15px 20px' }}><span className={`badge ${statClass}`}>{app.status || 'Applied'}</span></td>
                          <td style={{ padding: '15px 20px', textAlign: 'right' }}>
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              {app.phone && (
                                <a href={`tel:${app.phone}`} title="Call Student" style={{ background: 'rgba(14, 165, 233, 0.15)', color: '#0ea5e9', padding: '6px', borderRadius: '50%', display: 'flex' }}>
                                  <Phone size={16} weight="fill" />
                                </a>
                              )}
                              {app.email && (
                                <a href={`mailto:${app.email}`} title="Email Student" style={{ background: 'rgba(234, 67, 53, 0.15)', color: '#ea4335', padding: '6px', borderRadius: '50%', display: 'flex' }}>
                                  <EnvelopeSimple size={16} weight="fill" />
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        <Users size={32} style={{ opacity: 0.5, marginBottom: '10px' }} /><br/>
                        No students have applied to this opening yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 🚨 NEW MODAL: ADD JOB OPENING */}
      {isAddModalOpen && canAddOpening && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }} onClick={(e) => { if(e.target === e.currentTarget) setIsAddModalOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '15px' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#fff' }}>Post New Job Opening</h2>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsAddModalOpen(false)} />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Job ID *</label>
                <input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.id} onChange={e=>setAddForm({...addForm, id: e.target.value})} placeholder="e.g. JOB-10200" />
              </div>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Company Name *</label>
                <input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.company} onChange={e=>setAddForm({...addForm, company: e.target.value})} />
              </div>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Position *</label>
                <input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.position} onChange={e=>setAddForm({...addForm, position: e.target.value})} />
              </div>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Location (City)</label>
                <input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.location} onChange={e=>setAddForm({...addForm, location: e.target.value})} />
              </div>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>State</label>
                <input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.state} onChange={e=>setAddForm({...addForm, state: e.target.value})} />
              </div>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Work Mode</label>
                <select className="sleek-select" style={{ width: '100%' }} value={addForm.mode} onChange={e=>setAddForm({...addForm, mode: e.target.value})}>
                  <option>Work at Office</option>
                  <option>Hybrid</option>
                  <option>Remote</option>
                </select>
              </div>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Course Category</label>
                <select className="sleek-select" style={{ width: '100%' }} value={addForm.course} onChange={e=>setAddForm({...addForm, course: e.target.value})}>
                  <option>Industrial Automation</option>
                  <option>BMS & CCTV</option>
                  <option>Embedded and IoT</option>
                  <option>Digital Marketing</option>
                  <option>Information technology (IT)</option>
                  <option>Any Course</option>
                </select>
              </div>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Last Date to Apply</label>
                <input type="date" className="sleek-input" style={{ width: '100%' }} value={addForm.lastDate} onChange={e=>setAddForm({...addForm, lastDate: e.target.value})} />
              </div>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Salary Package</label>
                <input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.salary} onChange={e=>setAddForm({...addForm, salary: e.target.value})} placeholder="e.g. 3.5 LPA" />
              </div>
              <div>
                <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Experience Req.</label>
                <input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.experience} onChange={e=>setAddForm({...addForm, experience: e.target.value})} placeholder="e.g. Fresher / 1 Year" />
              </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Qualification</label>
              <input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.qualification} onChange={e=>setAddForm({...addForm, qualification: e.target.value})} placeholder="e.g. B.Tech / Diploma" />
            </div>

            <div style={{ marginBottom: '25px' }}>
              <label style={{ color: 'var(--text-muted)', fontSize: '0.8rem', display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Job Description</label>
              <textarea className="sleek-input" style={{ width: '100%', minHeight: '120px', resize: 'vertical' }} value={addForm.description} onChange={e=>setAddForm({...addForm, description: e.target.value})} placeholder="Enter full job description..."></textarea>
            </div>

            <button className="btn-action" style={{ background: '#38bdf8', color: '#0f172a', width: '100%', padding: '12px', fontWeight: 'bold', fontSize: '1.05rem' }} onClick={handleAddSubmit} disabled={savingStatus}>
              {savingStatus ? <CircleNotch size={20} className="ph-spin" /> : <><FloppyDisk size={20} weight="bold"/> Publish Vacancy</>}
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}