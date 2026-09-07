import { useEffect, useState } from 'react';
import axios from 'axios';
import { CircleNotch, Plus, FloppyDisk, PencilSimple, X, Notebook, ChartBar, Users } from '@phosphor-icons/react';
import Layout from './Layout';
import { API_BASE } from './apiConfig';

export default function TrainerLog() {
  const tpoData = JSON.parse(localStorage.getItem('tpoData'));
  const upperRole = (tpoData?.role || '').toUpperCase();
  
  const isTrainer = upperRole.includes('TRAINER');
  const isSuperAdmin = tpoData?.accessType === 'superadmin';
  // 🚨 FIXED: Super Admins can NO LONGER update logs. Only TLs/Managers can.
  const isTL = (upperRole.includes('TECHNICAL LEAD') || upperRole.includes('TTH') || upperRole.includes('MANAGER')) && !isSuperAdmin;

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 🚨 NEW ADMIN FILTERS
  const [monthFilter, setMonthFilter] = useState('All');
  const [courseFilter, setCourseFilter] = useState('All');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [addForm, setAddForm] = useState({ studentCount: '', present: '', absentees: '', feedbacks: '' });
  const [tlForm, setTlForm] = useState({ resignations: '', vacancy: '', tuv: '', mockTest: '' });

  const fetchLogs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/admin/trainer-logs`);
      if (res.data.success) {
        let fetchedLogs = res.data.logs;
        if (!isSuperAdmin && !tpoData.assignedBranchesArray.includes('all')) {
          fetchedLogs = fetchedLogs.filter(l => tpoData.assignedBranchesArray.some(b => (l.branch||'').toLowerCase().includes(b.toLowerCase())));
        }
        setLogs(fetchedLogs);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, []);

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await axios.post(`${API_BASE}/api/admin/trainer-logs/add`, {
        ...addForm,
        branch: tpoData.sittingBranch || tpoData.assignedBranchesArray[0] || 'Unknown',
        trainerName: tpoData.name,
        course: tpoData.assignedCourse || 'Unknown'
      });
      setIsAddModalOpen(false);
      setAddForm({ studentCount: '', present: '', absentees: '', feedbacks: '' });
      fetchLogs();
    } catch (err) { alert("Failed to submit: " + (err.response?.data?.message || err.message)); } finally { setIsSubmitting(false); }
  };

  const handleTlSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await axios.post(`${API_BASE}/api/admin/trainer-logs/update`, {
        rowNumber: selectedLog.rowNumber,
        ...tlForm
      });
      setIsEditModalOpen(false);
      fetchLogs();
    } catch (err) { alert("Failed to update: " + (err.response?.data?.message || err.message)); } finally { setIsSubmitting(false); }
  };

  const uniqueMonths = ['All', ...new Set(logs.map(l => {
    const d = new Date(l.timestamp);
    return isNaN(d) ? null : d.toLocaleString('default', { month: 'long', year: 'numeric' });
  }).filter(Boolean))];
  
  const uniqueCourses = ['All', ...new Set(logs.map(l => l.course).filter(Boolean))];

  const filteredLogs = logs.filter(l => {
    const m = new Date(l.timestamp).toLocaleString('default', { month: 'long', year: 'numeric' });
    const matchMonth = monthFilter === 'All' || m === monthFilter;
    const matchCourse = courseFilter === 'All' || (l.course || '') === courseFilter;
    return matchMonth && matchCourse;
  });

  const totalStudents = filteredLogs.reduce((acc, curr) => acc + (parseInt(curr.studentCount) || 0), 0);
  const totalPresent = filteredLogs.reduce((acc, curr) => acc + (parseInt(curr.present) || 0), 0);
  const totalAbsent = filteredLogs.reduce((acc, curr) => acc + (parseInt(curr.absentees) || 0), 0);
  const avgAttendance = totalStudents > 0 ? ((totalPresent / totalStudents) * 100).toFixed(1) : 0;

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '2rem', margin: '0 0 5px 0', display: 'flex', alignItems: 'center', gap: '10px' }}><Notebook color="#38bdf8" weight="fill"/> Trainer Daily Report</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>{isSuperAdmin ? 'Global overview of academic logs and trainer analytics.' : 'Daily academic logs and Technical Lead reviews.'}</p>
          </div>
          {isTrainer && (
            <button className="btn-action" style={{ width: 'auto', background: '#38bdf8', color: '#0f172a' }} onClick={() => setIsAddModalOpen(true)}>
              <Plus weight="bold" /> Submit Daily Log
            </button>
          )}
        </div>

        {/* 🚨 ADMIN ANALYTICS DASHBOARD */}
        {isSuperAdmin && (
          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '20px', marginBottom: '25px' }}>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <select className="sleek-input" style={{ width: '200px' }} value={monthFilter} onChange={e => setMonthFilter(e.target.value)}>
                {uniqueMonths.map(m => <option key={m} value={m}>{m === 'All' ? 'All Months' : m}</option>)}
              </select>
              <select className="sleek-input" style={{ width: '250px' }} value={courseFilter} onChange={e => setCourseFilter(e.target.value)}>
                {uniqueCourses.map(c => <option key={c} value={c}>{c === 'All' ? 'All Courses' : c}</option>)}
              </select>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div style={{ background: '#0f1523', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '5px' }}>Total Enrolled Students</div>
                <div style={{ fontSize: '2rem', color: '#38bdf8', fontWeight: 'bold' }}>{totalStudents}</div>
              </div>
              <div style={{ background: '#0f1523', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '5px' }}>Total Present</div>
                <div style={{ fontSize: '2rem', color: '#10b981', fontWeight: 'bold' }}>{totalPresent}</div>
              </div>
              <div style={{ background: '#0f1523', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '5px' }}>Total Absentees</div>
                <div style={{ fontSize: '2rem', color: '#ef4444', fontWeight: 'bold' }}>{totalAbsent}</div>
              </div>
              <div style={{ background: '#0f1523', padding: '20px', borderRadius: '12px', border: '1px solid #1e293b' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '5px' }}>Avg. Attendance Rate</div>
                <div style={{ fontSize: '2rem', color: '#f59e0b', fontWeight: 'bold' }}>{avgAttendance}%</div>
              </div>
            </div>
          </div>
        )}

        <div className="table-container">
          <table className="modern-table" style={{ whiteSpace: 'nowrap' }}>
            <thead>
              <tr>
                <th>Date & Trainer</th>
                <th style={{ textAlign: 'center' }}>Total / Present / Absent</th>
                <th>Feedback / Course</th>
                {(isTL || isSuperAdmin) && (
                  <>
                    <th style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>TL: Resign/Vacancy</th>
                    <th style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b' }}>TL: TUV / Mock Test</th>
                    {/* 🚨 ADMIN CAN NOT SEE THE REVIEW COLUMN HEADER */}
                    {isTL && <th style={{ textAlign: 'center', background: 'rgba(245, 158, 11, 0.1)' }}>Review</th>}
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem' }}><CircleNotch size={32} className="ph-spin" color="#38bdf8" /></td></tr>
              ) : filteredLogs.length === 0 ? (
                <tr><td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>No logs submitted yet.</td></tr>
              ) : (
                filteredLogs.map((log, i) => (
                  <tr key={i}>
                    <td>
                      <span className="primary-text">{log.timestamp.split(' ')[0]}</span>
                      {/* 🚨 FIXED: Fallback if TrainerName just says "Trainer" */}
                      <span className="sub-text">
                        {(log.trainerName && log.trainerName !== 'Trainer') ? log.trainerName : `${log.branch} Trainer`} • {log.branch}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontWeight: 'bold', color: '#38bdf8' }}>{log.studentCount}</span> / <span style={{ fontWeight: 'bold', color: '#10b981' }}>{log.present}</span> / <span style={{ fontWeight: 'bold', color: '#ef4444' }}>{log.absentees}</span>
                    </td>
                    <td style={{ color: '#cbd5e1', whiteSpace: 'normal', minWidth: '200px' }}>
                      <div style={{ fontSize: '0.8rem', color: '#38bdf8', marginBottom: '4px', fontWeight: 'bold' }}>{log.course}</div>
                      {log.feedbacks || '-'}
                    </td>
                    
                    {(isTL || isSuperAdmin) && (
                      <>
                        <td style={{ background: 'rgba(245, 158, 11, 0.02)' }}>
                          <span style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1' }}>Resign: {log.resignations || '-'}</span>
                          <span style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1' }}>Vacancy: {log.vacancy || '-'}</span>
                        </td>
                        <td style={{ background: 'rgba(245, 158, 11, 0.02)' }}>
                          <span style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1' }}>TUV: {log.tuv || '-'}</span>
                          <span style={{ display: 'block', fontSize: '0.8rem', color: '#cbd5e1' }}>Mock: {log.mockTest || '-'}</span>
                        </td>
                        
                        {/* 🚨 FIXED: ADMIN CAN NOT SEE THE UPDATE BUTTON */}
                        {isTL && (
                          <td style={{ textAlign: 'center', background: 'rgba(245, 158, 11, 0.02)' }}>
                            <button 
                              onClick={() => { setSelectedLog(log); setTlForm({ resignations: log.resignations, vacancy: log.vacancy, tuv: log.tuv, mockTest: log.mockTest }); setIsEditModalOpen(true); }}
                              style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid #f59e0b', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.8rem', fontWeight: 'bold' }}
                            >
                              <PencilSimple weight="bold" /> Update
                            </button>
                          </td>
                        )}
                      </>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* MODALS REMAIN THE SAME */}
        {isAddModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
            <div className="modal-card" style={{ maxWidth: '500px', width: '100%', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#fff' }}>Submit Daily Log</h3>
                <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsAddModalOpen(false)} />
              </div>
              <form onSubmit={handleAddSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div className="form-group"><label>Total Students</label><input type="number" className="sleek-input" style={{ width: '100%' }} value={addForm.studentCount} onChange={e => setAddForm({...addForm, studentCount: e.target.value})} required /></div>
                  <div className="form-group"><label>Present in Lab</label><input type="number" className="sleek-input" style={{ width: '100%' }} value={addForm.present} onChange={e => setAddForm({...addForm, present: e.target.value})} required /></div>
                  <div className="form-group"><label>Absentees</label><input type="number" className="sleek-input" style={{ width: '100%' }} value={addForm.absentees} onChange={e => setAddForm({...addForm, absentees: e.target.value})} required /></div>
                </div>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label>Any Feedbacks / Remarks</label>
                  <textarea className="sleek-input" style={{ width: '100%', minHeight: '80px' }} value={addForm.feedbacks} onChange={e => setAddForm({...addForm, feedbacks: e.target.value})} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #1e293b', paddingTop: '1.5rem' }}>
                  <button type="button" className="btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-action" style={{ width: 'auto', background: '#38bdf8', color: '#0f172a' }} disabled={isSubmitting}>{isSubmitting ? <CircleNotch className="ph-spin"/> : 'Submit Log'}</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {isEditModalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
            <div className="modal-card" style={{ maxWidth: '500px', width: '100%', background: '#0f1523', border: '1px solid #f59e0b', borderRadius: '16px', padding: '2rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid #1e293b', paddingBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '1.3rem', color: '#f59e0b' }}>Update TL Records</h3>
                <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsEditModalOpen(false)} />
              </div>
              <form onSubmit={handleTlSubmit}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                  <div className="form-group"><label>Staff Resignations</label><input type="text" className="sleek-input" style={{ width: '100%' }} value={tlForm.resignations} onChange={e => setTlForm({...tlForm, resignations: e.target.value})} /></div>
                  <div className="form-group"><label>Trainer Vacancy</label><input type="text" className="sleek-input" style={{ width: '100%' }} value={tlForm.vacancy} onChange={e => setTlForm({...tlForm, vacancy: e.target.value})} /></div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                  <div className="form-group"><label>TUV Registration</label><input type="text" className="sleek-input" style={{ width: '100%' }} value={tlForm.tuv} onChange={e => setTlForm({...tlForm, tuv: e.target.value})} /></div>
                  <div className="form-group"><label>Mock Test Conducted</label><input type="text" className="sleek-input" style={{ width: '100%' }} value={tlForm.mockTest} onChange={e => setTlForm({...tlForm, mockTest: e.target.value})} /></div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #1e293b', paddingTop: '1.5rem' }}>
                  <button type="button" className="btn-secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
                  <button type="submit" className="btn-action" style={{ width: 'auto', background: '#f59e0b', color: '#0f172a' }} disabled={isSubmitting}>{isSubmitting ? <CircleNotch className="ph-spin"/> : 'Save TL Details'}</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}