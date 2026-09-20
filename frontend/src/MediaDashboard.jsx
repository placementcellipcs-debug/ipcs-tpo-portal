import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { 
  CircleNotch, PaintBrush, CheckCircle, Clock, UploadSimple, ArrowSquareOut, 
  ImageSquare, VideoCamera, FilePdf, DownloadSimple, User, Briefcase, Plus, InstagramLogo, LinkedinLogo
} from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function MediaDashboard() {
  const [tasks, setTasks] = useState([]);
  const [socialStats, setSocialStats] = useState({ total: 0, pending: 0, published: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Pending');
  const [selectedTask, setSelectedTask] = useState(null);
  
  // Modals & Upload State
  const [isWorkspaceOpen, setIsWorkspaceOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sessionForm, setSessionForm] = useState({ sessionLevel: 'Session 1', status: 'In Progress', file: null });
  const [socialForm, setSocialForm] = useState({ platform: 'Instagram', postType: 'Post', postLink: '', status: 'Published' });

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_BASE}/api/design/tasks`);
      if (res.data.success) {
        setTasks(res.data.tasks || []);
        setSocialStats(res.data.socialStats || { total: 0, pending: 0, published: 0 });
      }
    } catch (err) {
      console.error('Error fetching design tasks', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, []);

  const pendingTasks = tasks.filter(t => String(t.status).toLowerCase() !== 'completed');
  const completedTasks = tasks.filter(t => String(t.status).toLowerCase() === 'completed');
  const displayTasks = activeTab === 'Pending' ? pendingTasks : completedTasks;

  const handleUpload = async (e) => {
    e.preventDefault();
    setUploading(true);
    const formData = new FormData();
    formData.append('designId', selectedTask.designId);
    formData.append('sessionLevel', sessionForm.sessionLevel);
    formData.append('status', sessionForm.status);
    if (sessionForm.file) formData.append('file', sessionForm.file);

    try {
      await axios.post(`${API_BASE}/api/design/upload`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      setIsWorkspaceOpen(false);
      fetchTasks();
    } catch (err) { alert("Upload failed."); } finally { setUploading(false); }
  };

  const handleSocialPublish = async (e) => {
    e.preventDefault();
    setUploading(true);
    try {
      await axios.post(`${API_BASE}/api/design/social`, { designId: selectedTask.designId, ...socialForm });
      alert("Social tracking updated!");
      fetchTasks();
    } catch (err) { alert("Failed to save social data."); } finally { setUploading(false); }
  };

  const getDriveImage = (url) => {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
    return match ? `https://lh3.googleusercontent.com/d/${match[1]}` : url;
  };

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0, maxWidth: '1600px', margin: '0 auto' }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <h1 style={{ fontSize: '2.2rem', display: 'flex', alignItems: 'center', gap: '10px', margin: '0 0 5px 0' }}>
              <PaintBrush weight="fill" color="#ec4899" /> Creative Studio
            </h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>Placement posters, videos, and social media tracking.</p>
          </div>
          
          <div style={{ display: 'flex', gap: '15px' }}>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '10px 20px', borderRadius: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>To Do</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#f59e0b' }}>{pendingTasks.length}</div>
            </div>
            <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', padding: '10px 20px', borderRadius: '12px', textAlign: 'center' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Social Posts</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color: '#10b981' }}>{socialStats.published}</div>
            </div>
          </div>
        </div>

        <div className="segmented-tabs" style={{ marginBottom: '25px', display: 'flex', gap: '10px', background: 'var(--card-bg)', padding: '5px', borderRadius: '12px', width: 'fit-content', border: '1px solid var(--card-border)' }}>
          <button onClick={() => setActiveTab('Pending')} style={{ padding: '8px 24px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', background: activeTab === 'Pending' ? '#ec4899' : 'transparent', color: activeTab === 'Pending' ? '#fff' : 'var(--text-muted)' }}>
            Active Queues
          </button>
          <button onClick={() => setActiveTab('Completed')} style={{ padding: '8px 24px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s', background: activeTab === 'Completed' ? '#3b82f6' : 'transparent', color: activeTab === 'Completed' ? '#fff' : 'var(--text-muted)' }}>
            Archived / Done
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '50px' }}><CircleNotch size={40} className="ph-spin" color="#ec4899" /></div>
        ) : displayTasks.length === 0 ? (
          <div style={{ background: 'var(--card-bg)', padding: '60px', textAlign: 'center', borderRadius: '16px', border: '1px dashed var(--card-border)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '1.1rem' }}>No {activeTab.toLowerCase()} design tasks currently assigned.</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
            {displayTasks.map((task, i) => (
              <div key={i} style={{ background: 'var(--card-bg)', borderRadius: '16px', border: '1px solid var(--card-border)', overflow: 'hidden', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s', cursor: 'pointer' }} onClick={() => { setSelectedTask(task); setIsWorkspaceOpen(true); }}>
                
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <Briefcase size={16} /> <span style={{ color: '#fff', fontWeight: 'bold' }}>{task.company}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <Users size={16} /> <span>{task.position}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    <Money size={16} /> <span style={{ color: '#10b981' }}>{task.package || 'N/A LPA'}</span>
                  </div>
                </div>

                <div style={{ padding: '15px 20px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid var(--card-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: task.status === 'Completed' ? '#10b981' : '#f59e0b', padding: '4px 10px', borderRadius: '20px', background: task.status === 'Completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)' }}>
                    {task.status.toUpperCase()}
                  </span>
                  <span style={{ color: '#94a3b8', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    Workspace <ArrowSquareOut size={16} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 🚨 CREATIVE WORKSPACE MODAL */}
      {isWorkspaceOpen && selectedTask && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '1000px', background: '#0f1523', borderRadius: '24px', overflow: 'hidden', border: '1px solid var(--card-border)', display: 'flex', flexDirection: 'column', maxHeight: '95vh' }}>
            
            <div style={{ padding: '25px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--card-border)' }}>
              <div>
                <h2 style={{ margin: 0, color: '#fff', fontSize: '1.6rem' }}>Workspace: {selectedTask.studentName}</h2>
                <div style={{ color: '#ec4899', fontSize: '0.9rem', fontWeight: 'bold', marginTop: '5px' }}>{selectedTask.designId} • {selectedTask.designType}</div>
              </div>
              <button onClick={() => setIsWorkspaceOpen(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}><X size={28} /></button>
            </div>

            <div style={{ padding: '25px', overflowY: 'auto', display: 'flex', gap: '30px', flexWrap: 'wrap' }}>
              
              {/* Left Column: Data Snapshot */}
              <div style={{ flex: '1 1 300px' }}>
                <h3 style={{ fontSize: '1rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '15px' }}>Snapshot Brief</h3>
                
                <div style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '25px' }}>
                  <div style={{ width: '100px', height: '100px', borderRadius: '16px', background: '#1e293b', overflow: 'hidden' }}>
                    {selectedTask.profilePhoto ? <img src={getDriveImage(selectedTask.profilePhoto)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={40} color="#64748b" style={{ margin: '30px' }}/>}
                  </div>
                  {selectedTask.profilePhoto && (
                    <a href={selectedTask.profilePhoto} target="_blank" rel="noreferrer" style={{ background: 'rgba(14, 165, 233, 0.1)', color: '#0ea5e9', padding: '10px 15px', borderRadius: '8px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 'bold', border: '1px solid #0ea5e9' }}>
                      <DownloadSimple size={16} weight="bold" /> Download Photo
                    </a>
                  )}
                </div>

                <div style={{ background: 'var(--bg-dark)', padding: '20px', borderRadius: '12px', border: '1px solid var(--card-border)', display: 'grid', gap: '15px' }}>
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Branch & Course</div><div style={{ color: '#fff', fontWeight: 'bold' }}>{selectedTask.branch} • {selectedTask.course}</div></div>
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Company</div><div style={{ color: '#10b981', fontWeight: 'bold' }}>{selectedTask.company}</div></div>
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Position</div><div style={{ color: '#fff', fontWeight: 'bold' }}>{selectedTask.position}</div></div>
                  <div><div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Package</div><div style={{ color: '#fff', fontWeight: 'bold' }}>{selectedTask.package}</div></div>
                </div>
              </div>

              {/* Right Column: Workflow */}
              <div style={{ flex: '2 1 450px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* File Upload Block */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '25px', borderRadius: '16px', border: '1px solid var(--card-border)' }}>
                  <h3 style={{ fontSize: '1rem', color: '#fff', margin: '0 0 20px 0', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>File Upload & Status</h3>
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
                          <option value="In Progress">In Progress</option>
                          <option value="Review">Ready for Review</option>
                          <option value="Completed">Completed</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ marginBottom: '20px' }}>
                      <input type="file" className="sleek-input" style={{ width: '100%', padding: '10px', background: '#0f1523' }} onChange={(e) => setSessionForm({...sessionForm, file: e.target.files[0]})} />
                    </div>
                    <button type="submit" disabled={uploading} style={{ width: '100%', background: '#ec4899', color: '#fff', border: 'none', padding: '14px', borderRadius: '12px', fontSize: '1rem', fontWeight: 'bold', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}>
                      {uploading ? <CircleNotch size={24} className="ph-spin" /> : <><UploadSimple size={24} weight="bold" /> Upload to Design Drive</>}
                    </button>
                  </form>
                  {selectedTask.session2File && (
                    <div style={{ marginTop: '15px', padding: '12px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 'bold' }}>Final File Available</span>
                      <a href={selectedTask.session2File} target="_blank" rel="noreferrer" style={{ color: '#fff', textDecoration: 'none', fontSize: '0.8rem', background: '#10b981', padding: '6px 12px', borderRadius: '6px' }}>View Final</a>
                    </div>
                  )}
                </div>

                {/* Social Media Tracker */}
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '25px', borderRadius: '16px', border: '1px solid var(--card-border)' }}>
                  <h3 style={{ fontSize: '1rem', color: '#fff', margin: '0 0 20px 0', borderBottom: '1px solid var(--card-border)', paddingBottom: '10px' }}>Social Media Logging</h3>
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
                      <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>Post Link</label>
                      <input type="url" placeholder="https://..." className="sleek-input" style={{ width: '100%', background: '#0f1523' }} value={socialForm.postLink} onChange={(e) => setSocialForm({...socialForm, postLink: e.target.value})} required />
                    </div>
                    <button type="submit" disabled={uploading} style={{ gridColumn: 'span 2', background: '#3b82f6', color: '#fff', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                      Mark as Published
                    </button>
                  </form>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}