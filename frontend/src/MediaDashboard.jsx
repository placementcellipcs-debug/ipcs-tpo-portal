import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, PaintBrush, CheckCircle, Clock, UploadSimple, ArrowSquareOut, 
  ImageSquare, VideoCamera, FilePdf, DownloadSimple, User, Briefcase, Plus, 
  InstagramLogo, LinkedinLogo, Kanban, Files, ShareNetwork, ClockCounterClockwise, SlidersHorizontal, Eye
} from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function MediaDashboard() {
  const [data, setData] = useState({ tasks: [], files: [], social: [], logs: [] });
  const [loading, setLoading] = useState(true);
  const [activeMainTab, setActiveMainTab] = useState('Tasks');
  const [activeTaskTab, setActiveTaskTab] = useState('Pending');
  
  // Workspace State
  const [selectedTask, setSelectedTask] = useState(null);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sessionForm, setSessionForm] = useState({ sessionLevel: 'Session 1', status: 'In Progress', file: null });
  const [socialForm, setSocialForm] = useState({ platform: 'Instagram', postType: 'Post', postLink: '', status: 'Published' });

  const tpoDataStr = localStorage.getItem('tpoData');
  const tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : { name: 'Designer' };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/design/tasks`);
      if (res.data.success) {
        setData({
          tasks: res.data.tasks || [],
          files: res.data.files || [],
          social: res.data.social || [],
          logs: res.data.logs || []
        });
      }
    } catch (err) {
      console.error('Error fetching design data', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDashboardData(); }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    setUploading(true);
    const formData = new FormData();
    formData.append('designId', selectedTask.designId);
    formData.append('sessionLevel', sessionForm.sessionLevel);
    formData.append('status', sessionForm.status);
    formData.append('user', tpoData.name);
    if (sessionForm.file) formData.append('file', sessionForm.file);

    try {
      await axios.post(`${API_BASE}/api/design/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      setIsWorkspaceOpen(false);
      fetchDashboardData();
    } catch (err) { alert("Upload failed."); } finally { setUploading(false); }
  };

  const handleSocialPublish = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      await axios.post(`${API_BASE}/api/design/social`, { designId: selectedTask.designId, user: tpoData.name, ...socialForm });
      alert("Social tracking updated!");
      fetchDashboardData();
    } catch (err) { alert("Failed to save social data."); } finally { setUploading(false); }
  };

  const getDriveImage = (url) => {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
    return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
  };

  const pendingTasks = data.tasks.filter(t => String(t.status).toLowerCase() !== 'completed');
  const completedTasks = data.tasks.filter(t => String(t.status).toLowerCase() === 'completed');
  const displayTasks = activeTaskTab === 'Pending' ? pendingTasks : completedTasks;

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0, maxWidth: '1600px', margin: '0 auto' }}>
        
        {/* HERO SECTION */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h1 style={{ fontSize: '2.2rem', display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 5px 0' }}>
              <PaintBrush weight="fill" color="#ec4899" /> Media & Creative ERP
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Manage the complete lifecycle of placement media and social posting.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '10px 20px', borderRadius: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Tasks</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#f59e0b' }}>{pendingTasks.length}</div>
            </div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '10px 20px', borderRadius: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Published Posts</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#10b981' }}>{data.social.length}</div>
            </div>
          </div>
        </div>

        {/* 🚨 MAIN TABS NAVIGATION */}
        <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', paddingBottom: '10px', marginBottom: '25px', borderBottom: '1px solid var(--card-border)' }}>
          {[
            { name: 'Tasks', icon: <Kanban size={20} /> },
            { name: 'Files', icon: <Files size={20} /> },
            { name: 'Social Media', icon: <ShareNetwork size={20} /> },
            { name: 'Activity Log', icon: <ClockCounterClockwise size={20} /> },
            { name: 'Settings', icon: <SlidersHorizontal size={20} /> }
          ].map(tab => (
            <button 
              key={tab.name}
              onClick={() => setActiveMainTab(tab.name)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '12px 12px 0 0',
                border: 'none', background: activeMainTab === tab.name ? 'rgba(236, 72, 153, 0.1)' : 'transparent',
                color: activeMainTab === tab.name ? '#ec4899' : 'var(--text-muted)', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', borderBottom: activeMainTab === tab.name ? '3px solid #ec4899' : '3px solid transparent'
              }}
            >
              {tab.icon} {tab.name}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px' }}><CircleNotch size={50} className="ph-spin" color="#ec4899" /></div>
        ) : (
          <>
            {/* ========================================================================= */}
            {/* 1. TASKS KANBAN/GRID VIEW */}
            {/* ========================================================================= */}
            {activeMainTab === 'Tasks' && (
              <>
                <div className="segmented-tabs" style={{ marginBottom: '20px', display: 'flex', gap: '10px', background: 'var(--card-bg)', padding: '5px', borderRadius: '12px', width: 'fit-content', border: '1px solid var(--card-border)' }}>
                  <button onClick={() => setActiveTaskTab('Pending')} style={{ padding: '8px 24px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTaskTab === 'Pending' ? '#ec4899' : 'transparent', color: activeTaskTab === 'Pending' ? '#fff' : 'var(--text-muted)' }}>
                    Active Board
                  </button>
                  <button onClick={() => setActiveTaskTab('Completed')} style={{ padding: '8px 24px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTaskTab === 'Completed' ? '#3b82f6' : 'transparent', color: activeTaskTab === 'Completed' ? '#fff' : 'var(--text-muted)' }}>
                    Archived & Completed
                  </button>
                </div>

                {displayTasks.length === 0 ? (
                  <div className="empty-state-card" style={{ background: 'var(--card-bg)', padding: '60px', textAlign: 'center', borderRadius: '16px', border: '1px dashed var(--card-border)' }}>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>No {activeTaskTab.toLowerCase()} tasks found in the queue.</p>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                    {displayTasks.map((task, i) => (
                      <div key={i} className="hover-lift" style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer' }} onClick={() => { setSelectedTask(task); setIsWorkspaceOpen(true); }}>
                        
                        <div style={{ padding: '20px', display: 'flex', gap: '15px', alignItems: 'center', borderBottom: '1px solid var(--card-border)' }}>
                          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#1e293b', overflow: 'hidden', flexShrink: 0 }}>
                            {task.profilePhoto ? <img src={getDriveImage(task.profilePhoto)} alt="Student" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><User size={32} /></div>}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff' }}>{task.studentName}</h3>
                            <div style={{ fontSize: '0.8rem', color: '#ec4899', fontWeight: 'bold' }}>{task.designType}</div>
                          </div>
                        </div>

                        <div style={{ padding: '20px', flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}><Briefcase size={16} /> <span style={{ color: '#fff', fontWeight: 'bold' }}>{task.company}</span></div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}><Users size={16} /> <span>{task.position}</span></div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}><MapPinLine size={16} /> <span>{task.branch}</span></div>
                        </div>

                        <div style={{ padding: '15px 20px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: task.status === 'Completed' ? '#10b981' : '#f59e0b', padding: '4px 10px', borderRadius: '20px', background: task.status === 'Completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)' }}>
                            {task.status.toUpperCase()}
                          </span>
                          <span style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>Workspace <ArrowSquareOut size={16} /></span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}

            {/* ========================================================================= */}
            {/* 2. FILES VAULT VIEW */}
            {/* ========================================================================= */}
            {activeMainTab === 'Files' && (
              <div className="table-container">
                <table className="modern-table">
                  <thead><tr><th>File Reference</th><th>Design Task</th><th>Session Level</th><th>Timestamp</th><th style={{ textAlign: 'center' }}>View File</th></tr></thead>
                  <tbody>
                    {data.files.map((f, i) => (
                      <tr key={i}>
                        <td><span className="primary-text">{f.fileName}</span><span className="sub-text">{f.fileId}</span></td>
                        <td><span className="primary-text" style={{ color: '#ec4899' }}>{f.designId}</span></td>
                        <td><span className={`status-pill ${f.session.includes('2') || f.session.toLowerCase().includes('final') ? 'green' : 'blue'}`}>{f.session}</span></td>
                        <td><span className="sub-text">{f.date}</span></td>
                        <td style={{ textAlign: 'center' }}>
                          <a href={f.link} target="_blank" rel="noreferrer" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '6px 12px', borderRadius: '8px', textDecoration: 'none', fontSize: '0.8rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '5px' }}><Eye size={16}/> Preview</a>
                        </td>
                      </tr>
                    ))}
                    {data.files.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No files uploaded yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 3. SOCIAL MEDIA VIEW */}
            {/* ========================================================================= */}
            {activeMainTab === 'Social Media' && (
              <div className="table-container">
                <table className="modern-table">
                  <thead><tr><th>Platform</th><th>Post Details</th><th>Assoc. Task</th><th>Date Published</th><th style={{ textAlign: 'center' }}>Status</th></tr></thead>
                  <tbody>
                    {data.social.map((s, i) => (
                      <tr key={i}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {s.platform.toLowerCase().includes('insta') ? <InstagramLogo size={24} color="#e1306c" weight="fill" /> : <LinkedinLogo size={24} color="#0a66c2" weight="fill" />}
                            <span className="primary-text">{s.platform}</span>
                          </div>
                        </td>
                        <td><span className="primary-text">{s.postType}</span><a href={s.link} target="_blank" rel="noreferrer" style={{ display: 'block', fontSize: '0.75rem', color: '#3b82f6', textDecoration: 'none', marginTop: '3px' }}>View Live Link</a></td>
                        <td><span className="sub-text">{s.designId}</span></td>
                        <td><span className="sub-text">{s.date}</span></td>
                        <td style={{ textAlign: 'center' }}><span className="status-pill green">{s.status}</span></td>
                      </tr>
                    ))}
                    {data.social.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No social media posts tracked yet.</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {/* ========================================================================= */}
            {/* 4. ACTIVITY LOGS VIEW */}
            {/* ========================================================================= */}
            {activeMainTab === 'Activity Log' && (
              <div className="clean-list" style={{ maxWidth: '900px' }}>
                {data.logs.map((log, i) => (
                  <div key={i} className="clean-row hover-bg" style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '15px' }}>
                    <div className="cl-left">
                      <div className="cl-avatar" style={{ background: '#ec4899' }}>{String(log.user).charAt(0).toUpperCase()}</div>
                      <div><div className="cl-title" style={{ fontSize: '0.95rem' }}>{log.action}</div><div className="cl-sub">{log.user} • {log.date}</div></div>
                    </div>
                    <div className="cl-right"><span style={{ background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: '8px', fontSize: '0.75rem', color: '#94a3b8' }}>{log.designId}</span></div>
                  </div>
                ))}
                {data.logs.length === 0 && <div className="empty-state-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No activity recorded yet.</div>}
              </div>
            )}

            {/* ========================================================================= */}
            {/* 5. CONFIG / SETTINGS VIEW */}
            {/* ========================================================================= */}
            {activeMainTab === 'Settings' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '30px' }}>
                <div style={{ background: 'var(--card-bg)', padding: '25px', borderRadius: '16px', border: '1px solid var(--card-border)' }}>
                  <h3 style={{ margin: '0 0 15px 0', color: '#fff', fontSize: '1.2rem' }}>Automation Settings</h3>
                  <div style={{ padding: '15px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <CheckCircle size={28} color="#10b981" weight="fill" />
                    <div><div style={{ color: '#10b981', fontWeight: 'bold' }}>Auto-Creation Enabled</div><div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>When TPOs mark a student as Placed, they automatically appear in the Active Tasks queue.</div></div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* 🚨 CREATIVE WORKSPACE MODAL (POPS UP WHEN A TASK IS CLICKED) */}
      {isWorkspaceOpen && selectedTask && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '1100px', background: '#0f1523', borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', maxHeight: '95vh' }}>
            
            <div style={{ padding: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)' }}>
              <div>
                <h2 style={{ margin: 0, color: '#fff', fontSize: '1.6rem' }}>Workspace: {selectedTask.studentName}</h2>
                <div style={{ color: '#ec4899', fontSize: '0.9rem', fontWeight: 'bold', marginTop: '5px' }}>{selectedTask.designId} • {selectedTask.designType}</div>
              </div>
              <button onClick={() => setIsWorkspaceOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', transition: '0.2s' }}><X size={28} /></button>
            </div>

            <div style={{ padding: '25px', overflowY: 'auto', display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
              
              {/* Left Column: Data Snapshot & Final Preview */}
              <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '16px', border: '1px solid var(--card-border)' }}>
                  <h3 style={{ fontSize: '1rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '15px' }}>Placement Details</h3>
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px' }}>
                    <div style={{ width: '90px', height: '90px', borderRadius: '12px', background: '#1e293b', overflow: 'hidden' }}>
                      {selectedTask.profilePhoto ? <img src={getDriveImage(selectedTask.profilePhoto)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={40} color="#64748b" style={{ margin: '25px' }}/>}
                    </div>
                    {selectedTask.profilePhoto && (
                      <a href={selectedTask.profilePhoto} target="_blank" rel="noreferrer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', background: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', padding: '12px 15px', borderRadius: '12px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 'bold', border: '1px solid #0ea5e9', transition: '0.2s' }}>
                        <DownloadSimple size={24} weight="bold" /> Get Raw Photo
                      </a>
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: '10px' }}>
                    <div style={{ background: 'var(--bg-dark)', padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Company</span><span style={{ color: '#10b981', fontWeight: 'bold' }}>{selectedTask.company}</span></div>
                    <div style={{ background: 'var(--bg-dark)', padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Position</span><span style={{ color: '#fff', fontWeight: 'bold' }}>{selectedTask.position}</span></div>
                    <div style={{ background: 'var(--bg-dark)', padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Package</span><span style={{ color: '#fff', fontWeight: 'bold' }}>{selectedTask.package}</span></div>
                    <div style={{ background: 'var(--bg-dark)', padding: '10px 15px', borderRadius: '8px', border: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between' }}><span style={{ color: 'var(--text-muted)' }}>Branch</span><span style={{ color: '#fff', fontWeight: 'bold' }}>{selectedTask.branch}</span></div>
                  </div>
                </div>

                {/* Final Render Preview Box */}
                {selectedTask.session2File && (
                  <div style={{ background: '#1e293b', padding: '15px', borderRadius: '16px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                     <h3 style={{ fontSize: '0.9rem', color: '#10b981', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Final Render</h3>
                     <ImageSquare size={64} color="#94a3b8" weight="fill" />
                     <a href={selectedTask.session2File} target="_blank" rel="noreferrer" style={{ background: '#10b981', color: '#fff', padding: '10px 20px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', width: '100%', textAlign: 'center' }}>Preview Full Creative</a>
                  </div>
                )}
              </div>

              {/* Right Column: Workflow */}
              <div style={{ flex: '2 1 450px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* File Upload Block */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '25px', borderRadius: '16px', border: '1px solid var(--card-border)' }}>
                  <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: '0 0 20px 0', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>1. Upload Render</h3>
                  <form onSubmit={handleUpload}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold' }}>Session Level</label>
                        <select className="sleek-select" style={{ width: '100%', background: '#0f1523' }} value={sessionForm.sessionLevel} onChange={(e) => setSessionForm({...sessionForm, sessionLevel: e.target.value})}>
                          <option value="Session 1">Session 1 (Draft/Review)</option>
                          <option value="Session 2">Session 2 (Final Version)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold' }}>Task Status</label>
                        <select className="sleek-select" style={{ width: '100%', background: '#0f1523' }} value={sessionForm.status} onChange={(e) => setSessionForm({...sessionForm, status: e.target.value})}>
                          <option value="In Progress">In Progress (Working)</option>
                          <option value="Review">Ready for Review</option>
                          <option value="Completed">Completed (Approved) ✅</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                      <input type="file" className="sleek-input" style={{ width: '100%', padding: '10px', background: '#0f1523' }} onChange={(e) => setSessionForm({...sessionForm, file: e.target.files[0]})} />
                    </div>
                    <button type="submit" disabled={uploading} style={{ width: '100%', background: '#ec4899', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                      {uploading ? <CircleNotch size={24} className="ph-spin" /> : <><UploadSimple size={24} weight="bold" /> Push Update to Drive</>}
                    </button>
                  </form>
                  
                  {/* File History Links */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }}>
                    {selectedTask.session1File && (
                      <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: '#3b82f6', fontWeight: 'bold' }}>Session 1 File Attached</span>
                        <a href={selectedTask.session1File} target="_blank" rel="noreferrer" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.75rem', background: '#3b82f6', padding: '4px 8px', borderRadius: '6px' }}>View</a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Social Media Tracker */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '25px', borderRadius: '16px', border: '1px solid var(--card-border)', opacity: selectedTask.status === 'Completed' ? 1 : 0.5, pointerEvents: selectedTask.status === 'Completed' ? 'all' : 'none' }}>
                  <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: '0 0 20px 0', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                    <span>2. Social Media Release</span>
                    {selectedTask.status !== 'Completed' && <span style={{ fontSize: '0.75rem', color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '3px 8px', borderRadius: '8px' }}>Task must be 'Completed' first</span>}
                  </h3>
                  <form onSubmit={handleSocialPublish} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', alignItems: 'end' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Platform</label>
                      <select className="sleek-select" style={{ width: '100%', background: '#0f1523' }} value={socialForm.platform} onChange={(e) => setSocialForm({...socialForm, platform: e.target.value})}>
                        <option value="Instagram">Instagram</option>
                        <option value="LinkedIn">LinkedIn</option>
                        <option value="Facebook">Facebook</option>
                        <option value="YouTube">YouTube</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Post Type</label>
                      <select className="sleek-select" style={{ width: '100%', background: '#0f1523' }} value={socialForm.postType} onChange={(e) => setSocialForm({...socialForm, postType: e.target.value})}>
                        <option value="Post">Standard Post</option>
                        <option value="Story">Story</option>
                        <option value="Reel">Reel / Video</option>
                      </select>
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Live Post Link</label>
                      <input type="url" placeholder="https://..." className="sleek-input" style={{ width: '100%', background: '#0f1523' }} value={socialForm.postLink} onChange={(e) => setSocialForm({...socialForm, postLink: e.target.value})} required />
                    </div>
                    <button type="submit" disabled={uploading} style={{ gridColumn: 'span 2', background: '#3b82f6', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                      Log Publication
                    </button>
                  </form>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`
        .clean-list { display: flex; flex-direction: column; gap: 10px; }
        .clean-row { display: flex; justify-content: space-between; align-items: center; padding: 15px; background: rgba(0, 0, 0, 0.2); border-radius: 12px; border: 1px solid rgba(255,255,255,0.02); transition: 0.2s; }
        .hover-bg:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); }
        .cl-left { display: flex; align-items: center; gap: 15px; flex: 1; min-width: 0; }
        .cl-avatar { width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; flex-shrink: 0; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3); }
        .cl-title { font-size: 1rem; font-weight: 700; color: #fff; margin-bottom: 3px; }
        .cl-sub { font-size: 0.8rem; color: #94a3b8; }
        .status-pill { padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; font-weight: 800; display: inline-block; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
        .status-pill.green { background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); }
        .status-pill.blue { background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); }
      `}</style>
    </Layout>
  );
}