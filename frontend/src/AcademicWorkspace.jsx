import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { CircleNotch, Plus, MagnifyingGlass, GraduationCap, UsersFour, ChalkboardTeacher, CalendarCheck, Notebook, CheckCircle, FloppyDisk, X } from '@phosphor-icons/react';
import Layout from './Layout';
import AcademicTopNav from './AcademicTopNav';
import { API_BASE } from './apiConfig';

const CONFIG = {
  training: { title: 'Student Training', subtitle: 'Assign students to individual or batch training and monitor their progress.', icon: GraduationCap },
  batches: { title: 'Batch Management', subtitle: 'Create cohorts, assign trainers, and track course schedules.', icon: UsersFour },
  sessions: { title: 'Live Sessions', subtitle: 'Record classes, attendance, delivered hours, and topic progress.', icon: ChalkboardTeacher },
  attendance: { title: 'Attendance Register', subtitle: 'Review, correct, and verify attendance against recorded sessions.', icon: CalendarCheck },
  diary: { title: 'Student Diary', subtitle: 'Search the academic timeline and add trainer notes for a student.', icon: Notebook },
};

const EMPTY_DATA = { training: [], batches: [], topics: [], sessions: [], attendance: [], diary: [], students: [] };
const inputStyle = { width: '100%', padding: '11px 12px', color: '#e2e8f0', background: '#111827', border: '1px solid #334155', borderRadius: '9px', boxSizing: 'border-box' };
const labelStyle = { display: 'block', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' };
const buttonStyle = { border: 0, borderRadius: '9px', padding: '10px 14px', background: '#10b981', color: '#052e2b', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px' };

const asList = (value) => String(value || '').split(/[,;\n]+/).map(item => item.trim()).filter(Boolean);
const dateToday = () => new Date().toISOString().slice(0, 10);
const studentName = (studentId, students = []) => students.find(student => String(student.studentId).toLowerCase() === String(studentId).toLowerCase())?.studentName || '';

export default function AcademicWorkspace({ module }) {
  const config = CONFIG[module] || CONFIG.training;
  const Icon = config.icon;
  const [data, setData] = useState(EMPTY_DATA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState({});
  const [attendanceDraft, setAttendanceDraft] = useState({});
  const tpoData = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('tpoData') || '{}'); } catch { return {}; }
  }, []);

  useEffect(() => {
    let active = true;
    axios.get(`${API_BASE}/api/academic/data`)
      .then(response => {
        if (active && response.data.success) setData({ ...EMPTY_DATA, ...response.data });
        if (active) setError('');
      })
      .catch(requestError => { if (active) setError(requestError.response?.data?.message || 'Could not load academic records.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  const training = useMemo(() => {
    const role = String(tpoData.role || '').toUpperCase();
    const courseString = String(tpoData.assignedCourse || '').toLowerCase();
    const branches = Array.isArray(tpoData.assignedBranchesArray) ? tpoData.assignedBranchesArray.map(value => String(value).toLowerCase()) : [];
    return data.training.filter(item => {
      const courseMatch = !courseString || courseString === 'all' || courseString === 'all courses' ||
        `${item.mainCourse || ''} ${item.subCourse || ''}`.toLowerCase().includes(courseString.split(/[\n,]+/)[0].trim());
      const branchMatch = branches.length === 0 || role.includes('GENERAL MANAGER') || branches.includes(String(item.branch || '').toLowerCase());
      return courseMatch && branchMatch;
    });
  }, [data.training, tpoData]);

  const batches = useMemo(() => data.batches.filter(batch => {
    const role = String(tpoData.role || '').toUpperCase();
    const assigned = Array.isArray(tpoData.assignedBranchesArray) ? tpoData.assignedBranchesArray.map(value => String(value).toLowerCase()) : [];
    return assigned.length === 0 || role.includes('GENERAL MANAGER') || assigned.includes(String(batch.branch || '').toLowerCase());
  }), [data.batches, tpoData]);

  const sessionStudents = useMemo(() => {
    if (form.sessionType === 'Batch') {
      const batch = batches.find(item => item.batchId === form.batchId);
      const fromBatch = batch?.students || [];
      const fromTraining = training.filter(item => item.batchId === form.batchId).map(item => item.studentId);
      return [...new Set([...fromBatch, ...fromTraining])];
    }
    const item = training.find(record => record.trainingId === form.trainingId);
    return item?.studentId ? [item.studentId] : [];
  }, [form.sessionType, form.batchId, form.trainingId, batches, training]);

  const showModal = () => {
    setError('');
    const defaults = {
      training: { trainingType: 'Individual', status: 'Active', plannedHours: '40', startDate: dateToday() },
      batches: { status: 'Active', startDate: dateToday() },
      sessions: { sessionType: 'Individual', date: dateToday(), startTime: '09:00', endTime: '10:00', sessionStatus: 'Completed', trainerName: tpoData.name || '' },
      diary: { date: dateToday(), eventType: 'Trainer Note' },
    };
    setForm(defaults[module] || {});
    setAttendanceDraft({});
    setIsModalOpen(true);
  };

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      let endpoint;
      let payload = { ...form, userName: tpoData.name || tpoData.username || '' };
      if (module === 'training') endpoint = 'training/add';
      if (module === 'batches') {
        endpoint = 'batches/add';
        payload.studentIds = asList(form.studentIds);
      }
      if (module === 'sessions') {
        endpoint = 'sessions/add';
        payload.studentIds = sessionStudents;
        payload.attendance = sessionStudents.map(studentId => ({ studentId, status: attendanceDraft[studentId] || 'Present' }));
        payload.actualHours = form.actualHours || undefined;
      }
      if (module === 'diary') endpoint = 'diary/add';
      const response = await axios.post(`${API_BASE}/api/academic/${endpoint}`, payload);
      if (!response.data.success) throw new Error(response.data.message || 'Could not save record.');
      setIsModalOpen(false);
      setRefreshKey(value => value + 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Could not save record.');
    } finally { setSubmitting(false); }
  };

  const updateTrainingStatus = async (record, status) => {
    try {
      await axios.post(`${API_BASE}/api/academic/training/update`, { trainingId: record.trainingId, status });
      setRefreshKey(value => value + 1);
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not update training status.'); }
  };

  const saveAttendance = async (record) => {
    const draft = attendanceDraft[record.attendanceId] || { status: record.attendanceStatus, verified: String(record.verified).toLowerCase() === 'yes' };
    try {
      await axios.post(`${API_BASE}/api/academic/attendance/update`, {
        attendanceId: record.attendanceId, status: draft.status, verified: draft.verified,
        userName: tpoData.name || tpoData.username || '', remarks: record.remarks || ''
      });
      setRefreshKey(value => value + 1);
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not update attendance.'); }
  };

  const q = search.trim().toLowerCase();
  const visibleAttendance = data.attendance.filter(item => !q || `${item.studentName} ${item.studentId} ${item.sessionId} ${item.attendanceStatus}`.toLowerCase().includes(q));
  const visibleDiary = data.diary.filter(item => !q || `${item.studentName} ${item.studentId} ${item.title} ${item.eventType} ${item.description}`.toLowerCase().includes(q));
  const visibleSessions = data.sessions.filter(item => !q || `${item.sessionId} ${item.topic} ${item.studentId} ${item.batchId} ${item.trainerName}`.toLowerCase().includes(q));
  const visibleBatches = batches.filter(item => !q || `${item.batchName} ${item.batchId} ${item.mainCourse} ${item.branch} ${item.trainerName}`.toLowerCase().includes(q));
  const visibleTraining = training.filter(item => !q || `${item.studentName} ${item.studentId} ${item.mainCourse} ${item.subCourse} ${item.branch} ${item.trainerName}`.toLowerCase().includes(q));

  return (
    <Layout>
      <div className="academic-workspace page-container" style={{ maxWidth: 1500, margin: '0 auto', padding: 0 }}>
        <AcademicTopNav title={config.title} subtitle={config.subtitle} statLabel={module === 'training' ? 'Training Records' : module === 'sessions' ? 'Sessions Logged' : module === 'batches' ? 'Active Batches' : module === 'attendance' ? 'Attendance Rows' : 'Diary Entries'} statValue={module === 'training' ? training.length : module === 'batches' ? batches.length : module === 'sessions' ? data.sessions.length : module === 'attendance' ? data.attendance.length : data.diary.length} />

        <div className="academic-toolbar">
          <label className="academic-search"><MagnifyingGlass size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search records, students, branches..." /></label>
          {module !== 'attendance' && <button type="button" style={buttonStyle} onClick={showModal}><Plus weight="bold" /> {module === 'training' ? 'Assign Training' : module === 'batches' ? 'Create Batch' : module === 'sessions' ? 'Log Session' : 'Add Diary Note'}</button>}
        </div>

        {error && <div className="academic-message error" role="alert">{error}</div>}
        {loading ? <div className="academic-empty"><CircleNotch size={32} className="ph-spin" /> Loading academic records…</div> : (
          <div className="academic-table-wrap">
            {module === 'training' && <table className="modern-table"><thead><tr><th>Student</th><th>Course</th><th>Trainer</th><th>Branch / Type</th><th>Hours / Progress</th><th>Status</th></tr></thead><tbody>
              {visibleTraining.map(item => <tr key={item.trainingId}><td><strong>{item.studentName || item.studentId}</strong><small>{item.studentId} · {item.trainingId}</small></td><td>{item.mainCourse}<small>{item.subCourse}</small></td><td>{item.trainerName || 'Unassigned'}</td><td>{item.branch}<small>{item.trainingType}</small></td><td>{item.completedHours || 0} / {item.plannedHours || 0} hrs<small>{item.progress || '0%'}</small></td><td><select aria-label={`Training status for ${item.trainingId}`} value={item.status || 'Active'} onChange={event => updateTrainingStatus(item, event.target.value)}><option>Active</option><option>On Hold</option><option>Completed</option><option>Cancelled</option></select></td></tr>)}
            </tbody></table>}

            {module === 'batches' && <table className="modern-table"><thead><tr><th>Batch</th><th>Course</th><th>Branch</th><th>Trainer</th><th>Schedule</th><th>Students</th><th>Status</th></tr></thead><tbody>
              {visibleBatches.map(item => <tr key={item.batchId}><td><strong>{item.batchName}</strong><small>{item.batchId}</small></td><td>{item.mainCourse}<small>{item.subCourse}</small></td><td>{item.branch}</td><td>{item.trainerName || 'Unassigned'}</td><td>{item.schedule || '—'}<small>{item.classTiming || item.startDate}</small></td><td>{item.students.length}</td><td><span className="academic-status">{item.status || 'Active'}</span></td></tr>)}
            </tbody></table>}

            {module === 'sessions' && <table className="modern-table"><thead><tr><th>Session</th><th>Target</th><th>Topic</th><th>Date &amp; Time</th><th>Hours</th><th>Status</th></tr></thead><tbody>
              {visibleSessions.map(item => <tr key={item.sessionId}><td><strong>{item.sessionId}</strong><small>{item.trainingId || item.batchId}</small></td><td>{item.studentId || item.batchId}</td><td>{item.topic}<small>{item.trainerName}</small></td><td>{item.date}<small>{item.startTime}–{item.endTime}</small></td><td>{item.actualHours || 0}</td><td><span className="academic-status">{item.sessionStatus || 'Logged'}</span></td></tr>)}
            </tbody></table>}

            {module === 'attendance' && <table className="modern-table"><thead><tr><th>Student</th><th>Session</th><th>Date</th><th>Attendance</th><th>Verified</th><th /></tr></thead><tbody>
              {visibleAttendance.map(item => { const draft = attendanceDraft[item.attendanceId] || { status: item.attendanceStatus || 'Present', verified: String(item.verified).toLowerCase() === 'yes' }; return <tr key={item.attendanceId}><td><strong>{item.studentName || item.studentId}</strong><small>{item.studentId}</small></td><td>{item.sessionId}</td><td>{item.date}</td><td><select value={draft.status} onChange={event => setAttendanceDraft(current => ({ ...current, [item.attendanceId]: { ...draft, status: event.target.value } }))}><option>Present</option><option>Absent</option><option>Late</option><option>Leave</option></select></td><td><label className="academic-check"><input type="checkbox" checked={draft.verified} onChange={event => setAttendanceDraft(current => ({ ...current, [item.attendanceId]: { ...draft, verified: event.target.checked } }))} /> Verified</label></td><td><button type="button" className="academic-icon-button" title="Save attendance" onClick={() => saveAttendance(item)}><FloppyDisk size={17} /></button></td></tr>; })}
            </tbody></table>}

            {module === 'diary' && <div className="academic-timeline">{visibleDiary.map(item => <article key={item.diaryId} className="academic-timeline-card"><div className="academic-timeline-icon"><Icon size={19} /></div><div className="academic-timeline-body"><div className="academic-timeline-meta"><b>{item.eventType || 'Academic'}</b><span>{item.date}</span></div><h3>{item.title}</h3><p>{item.description}</p><small>{item.studentName || item.studentId} · {item.studentId} {item.createdBy ? `· ${item.createdBy}` : ''}</small></div></article>)}</div>}

            {((module === 'training' && visibleTraining.length === 0) || (module === 'batches' && visibleBatches.length === 0) || (module === 'sessions' && visibleSessions.length === 0) || (module === 'attendance' && visibleAttendance.length === 0) || (module === 'diary' && visibleDiary.length === 0)) && <div className="academic-empty">No matching records. Add a record to begin.</div>}
          </div>
        )}
      </div>

      {isModalOpen && <div className="academic-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setIsModalOpen(false); }}><div className="academic-modal"><div className="academic-modal-header"><div><span className="academic-modal-eyebrow">TRAINING &amp; ACADEMICS</span><h2>{module === 'training' ? 'Assign student training' : module === 'batches' ? 'Create training batch' : module === 'sessions' ? 'Log a live session' : 'Add student diary note'}</h2></div><button type="button" onClick={() => setIsModalOpen(false)} className="academic-icon-button" aria-label="Close"><X size={20} /></button></div>
        <form onSubmit={submit} className="academic-form">
          {module === 'training' && <>
            <label><span style={labelStyle}>Student *</span><select style={inputStyle} required value={form.studentId || ''} onChange={event => setForm(current => ({ ...current, studentId: event.target.value }))}><option value="">Select student roll number</option>{data.students.map(student => <option key={student.studentId} value={student.studentId}>{student.studentName} · {student.studentId}</option>)}</select></label>
            <div className="academic-form-grid"><label><span style={labelStyle}>Main course *</span><input style={inputStyle} required value={form.mainCourse || ''} onChange={event => setForm(current => ({ ...current, mainCourse: event.target.value }))} /></label><label><span style={labelStyle}>Sub course</span><input style={inputStyle} value={form.subCourse || ''} onChange={event => setForm(current => ({ ...current, subCourse: event.target.value }))} /></label></div>
            <div className="academic-form-grid"><label><span style={labelStyle}>Trainer</span><input style={inputStyle} value={form.trainerName || ''} onChange={event => setForm(current => ({ ...current, trainerName: event.target.value }))} /></label><label><span style={labelStyle}>Training type</span><select style={inputStyle} value={form.trainingType} onChange={event => setForm(current => ({ ...current, trainingType: event.target.value }))}><option>Individual</option><option>Batch</option></select></label></div>
            <div className="academic-form-grid"><label><span style={labelStyle}>Planned hours</span><input style={inputStyle} type="number" min="0" value={form.plannedHours || ''} onChange={event => setForm(current => ({ ...current, plannedHours: event.target.value }))} /></label><label><span style={labelStyle}>Expected completion</span><input style={inputStyle} type="date" value={form.expectedEndDate || ''} onChange={event => setForm(current => ({ ...current, expectedEndDate: event.target.value }))} /></label></div>
            <label><span style={labelStyle}>Branch *</span><input style={inputStyle} required value={form.branch || ''} onChange={event => setForm(current => ({ ...current, branch: event.target.value }))} /></label>
          </>}

          {module === 'batches' && <>
            <label><span style={labelStyle}>Batch name *</span><input style={inputStyle} required value={form.batchName || ''} onChange={event => setForm(current => ({ ...current, batchName: event.target.value }))} /></label>
            <div className="academic-form-grid"><label><span style={labelStyle}>Main course *</span><input style={inputStyle} required value={form.mainCourse || ''} onChange={event => setForm(current => ({ ...current, mainCourse: event.target.value }))} /></label><label><span style={labelStyle}>Sub course</span><input style={inputStyle} value={form.subCourse || ''} onChange={event => setForm(current => ({ ...current, subCourse: event.target.value }))} /></label></div>
            <div className="academic-form-grid"><label><span style={labelStyle}>Branch *</span><input style={inputStyle} required value={form.branch || ''} onChange={event => setForm(current => ({ ...current, branch: event.target.value }))} /></label><label><span style={labelStyle}>Trainer</span><input style={inputStyle} value={form.trainerName || ''} onChange={event => setForm(current => ({ ...current, trainerName: event.target.value }))} /></label></div>
            <div className="academic-form-grid"><label><span style={labelStyle}>Schedule</span><input style={inputStyle} placeholder="Mon, Wed, Fri" value={form.schedule || ''} onChange={event => setForm(current => ({ ...current, schedule: event.target.value }))} /></label><label><span style={labelStyle}>Class time</span><input style={inputStyle} placeholder="10:00 AM–12:00 PM" value={form.classTiming || ''} onChange={event => setForm(current => ({ ...current, classTiming: event.target.value }))} /></label></div>
            <label><span style={labelStyle}>Student roll numbers (comma separated)</span><textarea style={{ ...inputStyle, minHeight: 74 }} value={form.studentIds || ''} onChange={event => setForm(current => ({ ...current, studentIds: event.target.value }))} placeholder="IPCS00124, IPCS00125" /></label>
          </>}

          {module === 'sessions' && <>
            <div className="academic-form-grid"><label><span style={labelStyle}>Session type</span><select style={inputStyle} value={form.sessionType} onChange={event => setForm(current => ({ ...current, sessionType: event.target.value, trainingId: '', batchId: '' }))}><option>Individual</option><option>Batch</option></select></label><label><span style={labelStyle}>Session date *</span><input style={inputStyle} type="date" required value={form.date || ''} onChange={event => setForm(current => ({ ...current, date: event.target.value }))} /></label></div>
            {form.sessionType === 'Batch' ? <label><span style={labelStyle}>Batch *</span><select style={inputStyle} required value={form.batchId || ''} onChange={event => setForm(current => ({ ...current, batchId: event.target.value }))}><option value="">Select batch</option>{batches.map(batch => <option key={batch.batchId} value={batch.batchId}>{batch.batchName} · {batch.batchId}</option>)}</select></label> : <label><span style={labelStyle}>Student training *</span><select style={inputStyle} required value={form.trainingId || ''} onChange={event => setForm(current => ({ ...current, trainingId: event.target.value }))}><option value="">Select active training</option>{training.map(item => <option key={item.trainingId} value={item.trainingId}>{item.studentName} · {item.studentId} · {item.subCourse}</option>)}</select></label>}
            <div className="academic-form-grid"><label><span style={labelStyle}>Start time *</span><input style={inputStyle} type="time" required value={form.startTime || ''} onChange={event => setForm(current => ({ ...current, startTime: event.target.value }))} /></label><label><span style={labelStyle}>End time *</span><input style={inputStyle} type="time" required value={form.endTime || ''} onChange={event => setForm(current => ({ ...current, endTime: event.target.value }))} /></label></div>
            <label><span style={labelStyle}>Topic taught *</span><input style={inputStyle} required value={form.topic || ''} onChange={event => setForm(current => ({ ...current, topic: event.target.value }))} list="academic-topics" /><datalist id="academic-topics">{data.topics.map(topic => <option key={topic.topicId} value={topic.topic}>{topic.module}</option>)}</datalist></label>
            <div className="academic-form-grid"><label><span style={labelStyle}>Trainer</span><input style={inputStyle} value={form.trainerName || ''} onChange={event => setForm(current => ({ ...current, trainerName: event.target.value }))} /></label><label><span style={labelStyle}>Comprehension</span><select style={inputStyle} value={form.comprehension || ''} onChange={event => setForm(current => ({ ...current, comprehension: event.target.value }))}><option value="">Not recorded</option><option>Excellent</option><option>Good</option><option>Average</option><option>Needs Improvement</option></select></label></div>
            {sessionStudents.length > 0 && <div className="academic-attendee-list"><span style={labelStyle}>Attendance · {sessionStudents.length} student{sessionStudents.length === 1 ? '' : 's'}</span>{sessionStudents.map(studentId => <label key={studentId} className="academic-attendee"><span>{studentName(studentId, data.students) || studentId}<small>{studentId}</small></span><select style={{ ...inputStyle, width: 145 }} value={attendanceDraft[studentId] || 'Present'} onChange={event => setAttendanceDraft(current => ({ ...current, [studentId]: event.target.value }))}><option>Present</option><option>Absent</option><option>Late</option><option>Leave</option></select></label>)}</div>}
            <label><span style={labelStyle}>Trainer remarks</span><textarea style={{ ...inputStyle, minHeight: 70 }} value={form.remarks || ''} onChange={event => setForm(current => ({ ...current, remarks: event.target.value }))} /></label>
          </>}

          {module === 'diary' && <>
            <label><span style={labelStyle}>Student *</span><select style={inputStyle} required value={form.studentId || ''} onChange={event => { const record = training.find(item => item.studentId === event.target.value); setForm(current => ({ ...current, studentId: event.target.value, trainingId: record?.trainingId || '' })); }}><option value="">Select student roll number</option>{[...new Map(training.map(item => [item.studentId, item])).values()].map(student => <option key={student.studentId} value={student.studentId}>{student.studentName} · {student.studentId}</option>)}</select></label>
            <div className="academic-form-grid"><label><span style={labelStyle}>Entry type</span><select style={inputStyle} value={form.eventType || 'Trainer Note'} onChange={event => setForm(current => ({ ...current, eventType: event.target.value }))}><option>Trainer Note</option><option>Assignment</option><option>Assessment</option><option>Training</option><option>Activity</option></select></label><label><span style={labelStyle}>Date</span><input style={inputStyle} type="date" value={form.date || ''} onChange={event => setForm(current => ({ ...current, date: event.target.value }))} /></label></div>
            <label><span style={labelStyle}>Title *</span><input style={inputStyle} required value={form.title || ''} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} /></label>
            <label><span style={labelStyle}>Notes</span><textarea style={{ ...inputStyle, minHeight: 100 }} value={form.description || ''} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></label>
          </>}
          {error && <div className="academic-message error" role="alert">{error}</div>}
          <div className="academic-modal-actions"><button type="button" className="academic-secondary-button" onClick={() => setIsModalOpen(false)}>Cancel</button><button type="submit" style={buttonStyle} disabled={submitting}>{submitting ? <CircleNotch size={18} className="ph-spin" /> : <CheckCircle size={18} weight="bold" />} Save record</button></div>
        </form>
      </div></div>}

      <style>{`
        .academic-workspace { color: #e2e8f0; }
        .academic-toolbar { display:flex; justify-content:space-between; align-items:center; gap:14px; flex-wrap:wrap; margin: 18px 0; }
        .academic-search { display:flex; align-items:center; gap:10px; width:min(450px,100%); color:#94a3b8; background:var(--card-bg); border:1px solid var(--card-border); border-radius:10px; padding:0 12px; }
        .academic-search input { width:100%; border:0; outline:0; background:transparent; color:#fff; padding:12px 0; }
        .academic-table-wrap { background:var(--card-bg); border:1px solid var(--card-border); border-radius:15px; overflow:auto; min-height:130px; }
        .academic-table-wrap .modern-table { width:100%; min-width:760px; }
        .academic-table-wrap td strong,.academic-table-wrap td small { display:block; }
        .academic-table-wrap td small { margin-top:4px; color:#94a3b8; font-size:.75rem; }
        .academic-table-wrap select { color:#e2e8f0; background:#111827; border:1px solid #334155; border-radius:7px; padding:7px 9px; }
        .academic-empty { display:flex; align-items:center; justify-content:center; gap:10px; min-height:160px; padding:35px; color:#94a3b8; text-align:center; }
        .academic-status { display:inline-flex; border-radius:20px; padding:5px 9px; color:#a7f3d0; background:rgba(16,185,129,.12); font-size:.76rem; font-weight:800; }
        .academic-message { padding:11px 14px; border-radius:9px; margin:12px 0; }
        .academic-message.error { color:#fecaca; border:1px solid rgba(239,68,68,.35); background:rgba(127,29,29,.2); }
        .academic-check { display:flex; align-items:center; gap:7px; color:#cbd5e1; font-size:.83rem; }
        .academic-icon-button { width:36px; height:36px; display:inline-flex; align-items:center; justify-content:center; color:#d1fae5; background:rgba(16,185,129,.12); border:1px solid rgba(16,185,129,.3); border-radius:9px; cursor:pointer; }
        .academic-timeline { max-width:900px; margin:0 auto; padding:20px; display:flex; flex-direction:column; gap:14px; }
        .academic-timeline-card { display:flex; gap:14px; padding:17px; background:rgba(15,23,42,.72); border:1px solid var(--card-border); border-radius:14px; }
        .academic-timeline-icon { width:38px; height:38px; flex:none; display:grid; place-items:center; color:#10b981; border-radius:11px; background:rgba(16,185,129,.12); }
        .academic-timeline-body { min-width:0; flex:1; }
        .academic-timeline-meta { display:flex; justify-content:space-between; gap:12px; color:#10b981; font-size:.78rem; }
        .academic-timeline-meta span,.academic-timeline-body small { color:#94a3b8; }
        .academic-timeline-body h3 { margin:8px 0 5px; color:#fff; font-size:1rem; }
        .academic-timeline-body p { margin:0 0 8px; color:#cbd5e1; line-height:1.5; white-space:pre-wrap; }
        .academic-modal-backdrop { position:fixed; inset:0; z-index:100000; display:flex; align-items:center; justify-content:center; padding:18px; background:rgba(2,6,23,.82); backdrop-filter:blur(7px); }
        .academic-modal { width:min(680px,100%); max-height:92vh; overflow:auto; padding:23px; color:#e2e8f0; background:#0f172a; border:1px solid #334155; border-radius:18px; box-shadow:0 25px 80px rgba(0,0,0,.5); }
        .academic-modal-header { display:flex; justify-content:space-between; gap:16px; align-items:flex-start; margin-bottom:20px; }
        .academic-modal-header h2 { margin:5px 0 0; color:#fff; font-size:1.35rem; }
        .academic-modal-eyebrow { color:#10b981; font-size:.68rem; font-weight:900; letter-spacing:1.2px; }
        .academic-form { display:flex; flex-direction:column; gap:14px; }
        .academic-form-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:12px; }
        .academic-attendee-list { padding:12px; background:#0b1220; border:1px solid #263449; border-radius:12px; }
        .academic-attendee { display:flex; align-items:center; justify-content:space-between; gap:12px; border-top:1px solid #1e293b; padding:9px 0; }
        .academic-attendee span,.academic-attendee small { display:block; }
        .academic-attendee small { margin-top:3px; color:#94a3b8; font-size:.74rem; }
        .academic-modal-actions { display:flex; justify-content:flex-end; gap:10px; padding-top:8px; }
        .academic-secondary-button { padding:10px 14px; color:#cbd5e1; background:transparent; border:1px solid #475569; border-radius:9px; font-weight:700; cursor:pointer; }
        @media(max-width:600px) { .academic-form-grid { grid-template-columns:1fr; } .academic-modal { padding:17px; } }
      `}</style>
    </Layout>
  );
}
