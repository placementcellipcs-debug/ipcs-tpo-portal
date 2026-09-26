import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, PaintBrush, UploadSimple, ArrowSquareOut, DownloadSimple, User, Briefcase, MapPin, X, Plus } from '@phosphor-icons/react';
import Layout from './Layout';
import MediaTopNav from './MediaTopNav';
import { API_BASE } from './apiConfig';

export default function MediaTasks() {
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [socialCount, setSocialCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState(null);
  const [activeTaskTab, setActiveTaskTab] = useState('Pending');
  
  // Modals
  const [selectedTask, setSelectedTask] = useState(null);
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  
  const [uploading, setUploading] = useState(false);
  const [sessionForm, setSessionForm] = useState({ sessionLevel: 'Session 1', status: 'Review', file: null });
  const [newTaskForm, setNewTaskForm] = useState({ studentName: '', company: '', designCategory: 'Social Media', designType: '', remarks: '' });

  const tpoData = (() => {
    try { return JSON.parse(localStorage.getItem('tpoData') || '{}'); }
    catch { return {}; }
  })();

  const fetchTasks = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/design/tasks`);
      if (res.data.success) {
        setLoadError('');
        setTasks(res.data.tasks || []);
        setCategories(res.data.categories || []);
        setSocialCount((res.data.social || []).length);
      }
    } catch (err) { setLoadError(err.response?.data?.message || 'Could not load the design queue.'); } finally { setLoading(false); }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void fetchTasks(); }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!sessionForm.file) {
      setNotice({ type: 'error', text: 'Attach the design file before saving this session.' });
      return;
    }
    if (sessionForm.status === 'Completed' && sessionForm.sessionLevel !== 'Session 2') {
      setNotice({ type: 'error', text: 'Complete a task only after uploading its final Session 2 file.' });
      return;
    }
    setUploading(true);
    setNotice(null);
    const formData = new FormData();
    formData.append('designId', selectedTask.designId);
    formData.append('sessionLevel', sessionForm.sessionLevel);
    formData.append('status', sessionForm.status);
    formData.append('user', tpoData.name);
    if (sessionForm.file) formData.append('file', sessionForm.file);

    try {
      const response = await axios.post(`${API_BASE}/api/design/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      if (!response.data.success) throw new Error(response.data.message || 'Could not save this design update.');
      setIsWorkspaceOpen(false);
      setSessionForm({ sessionLevel: 'Session 1', status: 'Review', file: null });
      fetchTasks();
      setNotice({ type: 'success', text: response.data.message || 'Design update saved.' });
    } catch (err) { setNotice({ type: 'error', text: err.response?.data?.message || err.message || 'Upload failed.' }); } finally { setUploading(false); }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTaskForm.designType.trim()) {
      setNotice({ type: 'error', text: 'Choose a design type before creating the task.' });
      return;
    }
    setUploading(true);
    setNotice(null);
    try {
      await axios.post(`${API_BASE}/api/design/task`, { ...newTaskForm, user: tpoData.name });
      setIsNewTaskOpen(false);
      setNewTaskForm({ studentName: '', company: '', designCategory: 'Social Media', designType: '', remarks: '' });
      fetchTasks();
      setNotice({ type: 'success', text: 'Task added to the design queue.' });
    } catch (err) { setNotice({ type: 'error', text: err.response?.data?.message || 'Failed to create task.' }); } finally { setUploading(false); }
  };

  const getDriveImage = (url) => {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
    return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
  };

  const pendingTasks = tasks.filter(t => String(t.status).toLowerCase() !== 'completed');
  const completedTasks = tasks.filter(t => String(t.status).toLowerCase() === 'completed');
  const displayTasks = activeTaskTab === 'Pending' ? pendingTasks : completedTasks;

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0, maxWidth: '1600px', margin: '0 auto' }}>
        <MediaTopNav title="Active Queues" subtitle="Manage incoming placement media tasks." pendingCount={pendingTasks.length} publishedCount={socialCount} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div className="segmented-tabs" style={{ display: 'flex', gap: '10px', background: 'var(--card-bg)', padding: '5px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
            <button onClick={() => setActiveTaskTab('Pending')} style={{ padding: '8px 24px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTaskTab === 'Pending' ? '#ec4899' : 'transparent', color: activeTaskTab === 'Pending' ? '#fff' : 'var(--text-muted)' }}>Active Board</button>
            <button onClick={() => setActiveTaskTab('Completed')} style={{ padding: '8px 24px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', background: activeTaskTab === 'Completed' ? '#3b82f6' : 'transparent', color: activeTaskTab === 'Completed' ? '#fff' : 'var(--text-muted)' }}>Archived</button>
          </div>
          <button onClick={() => setIsNewTaskOpen(true)} className="hover-lift" style={{ background: '#3b82f6', color: '#fff', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus weight="bold" /> Create Custom Task
          </button>
        </div>

        {notice && <div role="status" style={{ marginBottom: 16, padding: '12px 16px', borderRadius: 10, border: `1px solid ${notice.type === 'error' ? 'rgba(248,113,113,.35)' : 'rgba(52,211,153,.3)'}`, color: notice.type === 'error' ? '#fca5a5' : '#6ee7b7', background: notice.type === 'error' ? 'rgba(127,29,29,.2)' : 'rgba(6,78,59,.2)' }}>{notice.text}</div>}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '100px' }}><CircleNotch size={50} className="ph-spin" color="#ec4899" /></div>
        ) : loadError ? (
          <div style={{ background: 'var(--card-bg)', padding: '45px', textAlign: 'center', borderRadius: '16px', border: '1px solid rgba(248,113,113,.25)' }}>
            <p style={{ color: '#fca5a5', margin: '0 0 16px' }}>{loadError}</p>
            <button type="button" onClick={() => { setLoading(true); fetchTasks(); }} style={{ padding: '9px 17px', border: 0, borderRadius: 9, background: '#ec4899', color: '#fff', fontWeight: 800, cursor: 'pointer' }}>Retry</button>
          </div>
        ) : displayTasks.length === 0 ? (
          <div className="empty-state-card" style={{ background: 'var(--card-bg)', padding: '60px', textAlign: 'center', borderRadius: '16px', border: '1px dashed var(--card-border)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem', margin: 0 }}>No {activeTaskTab.toLowerCase()} tasks found in the queue.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {displayTasks.map((task, i) => (
                <div key={task.designId || i} className="hover-lift" style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', cursor: 'pointer' }} onClick={() => { setSelectedTask(task); setSessionForm({ sessionLevel: task.session1File ? 'Session 2' : 'Session 1', status: task.session1File ? 'Review' : 'In Progress', file: null }); setNotice(null); setIsWorkspaceOpen(true); }}>
                <div style={{ padding: '20px', display: 'flex', gap: '15px', alignItems: 'center', borderBottom: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.02)' }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#1e293b', overflow: 'hidden', flexShrink: 0, border: `2px solid ${task.source === 'Manual Request' ? '#3b82f6' : '#ec4899'}` }}>
                    {task.profilePhoto ? <img src={getDriveImage(task.profilePhoto)} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}><User size={32} /></div>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff' }}>{task.studentName || 'General Event'}</h3>
                    <div style={{ fontSize: '0.8rem', color: task.source === 'Manual Request' ? '#3b82f6' : '#ec4899', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{task.designType}</div>
                  </div>
                </div>
                <div style={{ padding: '20px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}><Briefcase size={16} /> <span style={{ color: '#10b981', fontWeight: 'bold' }}>{task.company || 'N/A'}</span></div>
                  {task.position && <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}><User size={16} /> <span style={{ color: '#e2e8f0' }}>{task.position}</span></div>}
                  {task.branch && <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}><MapPin size={16} /> <span style={{ color: '#e2e8f0' }}>{task.branch}</span></div>}
                </div>
                <div style={{ padding: '15px 20px', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: String(task.status || 'Pending').toLowerCase() === 'completed' ? '#10b981' : '#f59e0b', padding: '4px 10px', borderRadius: '20px', background: String(task.status || 'Pending').toLowerCase() === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)' }}>{String(task.status || 'Pending').toUpperCase()}</span>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 'bold' }}>Workspace <ArrowSquareOut size={16} /></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🚨 NEW TASK MODAL */}
      {isNewTaskOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(5px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '600px', background: '#0f1523', borderRadius: '24px', padding: '30px', border: '1px solid var(--card-border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, color: '#fff' }}>Create Custom Task</h2>
              <X size={24} color="#94a3b8" style={{ cursor: 'pointer' }} onClick={() => setIsNewTaskOpen(false)} />
            </div>
            <form onSubmit={handleCreateTask} style={{ display: 'grid', gap: '15px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Category</label>
                  <select className="sleek-select" style={{ width: '100%' }} value={newTaskForm.designCategory} onChange={e => setNewTaskForm({...newTaskForm, designCategory: e.target.value})}>
                    <option value="Social Media">Social Media</option>
                    <option value="Event">Event</option>
                    <option value="Activity">Campus Activity</option>
                    <option value="Company">Company / Client</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Specific Design Type</label>
                  <select required className="sleek-select" style={{ width: '100%' }} value={newTaskForm.designType} onChange={e => setNewTaskForm({...newTaskForm, designType: e.target.value})}>
                    <option value="">Select Type...</option>
                    {categories.filter(c => c.category === newTaskForm.designCategory).map((c, i) => (
                      <option key={i} value={c.designType}>{c.designType}</option>
                    ))}
                    <option value="Custom Graphic">Custom Graphic (Type below)</option>
                  </select>
                </div>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Subject / Event Name</label>
                  <input type="text" className="sleek-input" style={{ width: '100%' }} placeholder="e.g., Talentino Workshop" value={newTaskForm.studentName} onChange={e => setNewTaskForm({...newTaskForm, studentName: e.target.value})} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Company / Branch (Optional)</label>
                  <input type="text" className="sleek-input" style={{ width: '100%' }} placeholder="e.g., IPCS Bangalore" value={newTaskForm.company} onChange={e => setNewTaskForm({...newTaskForm, company: e.target.value})} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Design Brief / Remarks</label>
                <textarea rows="3" className="sleek-input" style={{ width: '100%', resize: 'none' }} placeholder="Provide specific instructions for the designer..." value={newTaskForm.remarks} onChange={e => setNewTaskForm({...newTaskForm, remarks: e.target.value})} />
              </div>

              <button type="submit" disabled={uploading} style={{ width: '100%', padding: '14px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' }}>
                {uploading ? 'Creating Task...' : 'Push to Queue'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 🚨 CREATIVE WORKSPACE MODAL */}
      {isWorkspaceOpen && selectedTask && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(2, 6, 23, 0.85)', backdropFilter: 'blur(10px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '1100px', background: '#0f1523', borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', maxHeight: '95vh', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)' }}>
            
            <div style={{ padding: '20px 30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.02)' }}>
              <div>
                <h2 style={{ margin: 0, color: '#fff', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}><PaintBrush color="#ec4899" /> Creative Workspace</h2>
                <div style={{ color: '#94a3b8', fontSize: '0.9rem', fontWeight: 'bold', marginTop: '5px' }}><span style={{ color: '#ec4899' }}>{selectedTask.designId}</span> • {selectedTask.designType}</div>
              </div>
              <button onClick={() => setIsWorkspaceOpen(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: '#94a3b8', cursor: 'pointer', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} weight="bold" /></button>
            </div>

            <div style={{ padding: '30px', overflowY: 'auto', display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 350px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '25px', borderRadius: '16px', border: '1px solid var(--card-border)' }}>
                  <h3 style={{ fontSize: '0.9rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '20px', letterSpacing: '1px', fontWeight: 'bold' }}>Provided Details Snapshot</h3>
                  <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '25px' }}>
                    <div style={{ width: '90px', height: '90px', borderRadius: '16px', background: '#1e293b', overflow: 'hidden', border: '2px solid #334155' }}>
                      {selectedTask.profilePhoto ? <img src={getDriveImage(selectedTask.profilePhoto)} alt="Student profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={40} color="#64748b" style={{ margin: '25px' }}/>}
                    </div>
                    {selectedTask.profilePhoto && (
                      <a href={selectedTask.profilePhoto} target="_blank" rel="noreferrer" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', background: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', padding: '12px 15px', borderRadius: '12px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 'bold', border: '1px solid rgba(14, 165, 233, 0.3)', flex: 1 }}>
                        <DownloadSimple size={24} weight="bold" /> Get Raw Photo
                      </a>
                    )}
                  </div>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <div style={{ background: 'var(--bg-dark)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Subject</span><span style={{ color: '#fff', fontWeight: 'bold', fontSize: '0.9rem' }}>{selectedTask.studentName || 'N/A'}</span></div>
                    <div style={{ background: 'var(--bg-dark)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Company</span><span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.9rem' }}>{selectedTask.company || 'N/A'}</span></div>
                    {selectedTask.remarks && <div style={{ background: 'var(--bg-dark)', padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', gap: '5px' }}><span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>Briefing Remarks</span><span style={{ color: '#fff', fontSize: '0.85rem', lineHeight: '1.4' }}>{selectedTask.remarks}</span></div>}
                  </div>
                </div>
              </div>

              <div style={{ flex: '2 1 450px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '25px', borderRadius: '16px', border: '1px solid var(--card-border)' }}>
                  <h3 style={{ fontSize: '1.1rem', color: '#fff', margin: '0 0 20px 0', borderBottom: '1px solid var(--card-border)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ background: '#ec4899', color: '#fff', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}>1</div> Upload Work & Status
                  </h3>
                  <form onSubmit={handleUpload}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {[['Session 1', selectedTask.session1Status, selectedTask.session1File], ['Session 2', selectedTask.session2Status, selectedTask.session2File]].map(([name, status, link]) => (
                          <div key={name} style={{ flex: '1 1 190px', padding: '11px 13px', background: 'var(--bg-dark)', border: '1px solid var(--card-border)', borderRadius: 10, color: '#cbd5e1', fontSize: '.78rem' }}>
                            <b style={{ color: '#fff' }}>{name}</b><span style={{ marginLeft: 8, color: status ? '#fbbf24' : '#64748b' }}>{status || 'Not started'}</span>
                            {link && <a href={link} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 6, color: '#60a5fa' }}>Open latest file</a>}
                          </div>
                        ))}
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold' }}>Update Target</label>
                        <select className="sleek-select" style={{ width: '100%', background: '#0f1523', padding: '12px' }} value={sessionForm.sessionLevel} onChange={(e) => setSessionForm({...sessionForm, sessionLevel: e.target.value, status: 'Review', file: null})}>
                          <option value="Session 1">Session 1 (Draft/Review)</option>
                          <option value="Session 2">Session 2 (Final Version)</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold' }}>Task Status</label>
                        <select className="sleek-select" style={{ width: '100%', background: '#0f1523', padding: '12px', color: sessionForm.status === 'Completed' ? '#10b981' : '#fff' }} value={sessionForm.status} onChange={(e) => setSessionForm({...sessionForm, status: e.target.value})}>
                          <option value="In Progress">In Progress (Working)</option>
                          <option value="Review">Ready for Review</option>
                          {sessionForm.sessionLevel === 'Session 2' && <option value="Completed">Completed (Final approved) ✅</option>}
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom: '20px' }}><input type="file" accept="image/*,video/*,.pdf" required className="sleek-input" style={{ width: '100%', padding: '12px', background: '#0f1523', borderStyle: 'dashed' }} onChange={(e) => setSessionForm({...sessionForm, file: e.target.files[0]})} /><small style={{ display: 'block', marginTop: 7, color: '#64748b' }}>Images, video, or PDF · maximum 50 MB</small></div>
                    <button type="submit" disabled={uploading} style={{ width: '100%', background: '#ec4899', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                      {uploading ? <CircleNotch size={24} className="ph-spin" /> : <><UploadSimple size={22} weight="bold" /> Publish to Drive Repository</>}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <style>{`.hover-lift { transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1); } .hover-lift:hover { transform: translateY(-4px); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.7); border-color: rgba(255, 255, 255, 0.1); }`}</style>
    </Layout>
  );
}
