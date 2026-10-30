import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowUpRight, BookOpen, Buildings, CalendarBlank, CalendarCheck, CheckCircle, ChalkboardTeacher, CircleNotch, Clock, FloppyDisk, GraduationCap, MagnifyingGlass, Notebook, Plus, Sparkle, UsersFour, X } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import AcademicTopNav from './AcademicTopNav';
import DateInput from '../../components/DateInput';
import { API_BASE } from '../../services/apiConfig';
import { formatPortalDate, formatPortalTime, getTodayPortalDateInput } from '../../utils/dateFormat';
import { getTrainerAssignments, isWithinTrainerScope, normalizeAcademicBranch, standardizeAcademicCourse } from './academicScope';
import './AcademicWorkspace.css';

const CONFIG = {
  training: { title: 'Student Training', subtitle: 'Every learner, course plan, and training milestone in your teaching scope.', icon: GraduationCap, eyebrow: 'LEARNER JOURNEYS', heading: 'Progress, made visible.', accent: '#66e2bc', tint: 'rgba(102,226,188,.13)' },
  batches: { title: 'Batches', subtitle: 'Organize your assigned learners into clear, well-paced cohorts.', icon: UsersFour, eyebrow: 'COHORT PLANNING', heading: 'Build momentum together.', accent: '#a99bff', tint: 'rgba(169,155,255,.14)' },
  sessions: { title: 'Daily Sessions', subtitle: 'Keep a precise record of each class, topic, duration, and attendee.', icon: ChalkboardTeacher, eyebrow: 'CLASSROOM LOG', heading: 'Turn every class into progress.', accent: '#65d2f2', tint: 'rgba(101,210,242,.14)' },
  attendance: { title: 'Attendance', subtitle: 'Review attendance records and verify students in your assigned classes.', icon: CalendarCheck, eyebrow: 'ATTENDANCE CONTROL', heading: 'A clear view of every seat.', accent: '#ffbd70', tint: 'rgba(255,189,112,.14)' },
  topics: { title: 'Syllabus & Topics', subtitle: 'Explore the modules and learning topics available for your course.', icon: BookOpen, eyebrow: 'COURSE LIBRARY', heading: 'A syllabus built for clarity.', accent: '#5ed8cf', tint: 'rgba(94,216,207,.14)' },
  diary: { title: 'Digital Diary', subtitle: 'Capture observations, milestones, and follow-ups for your learners.', icon: Notebook, eyebrow: 'STUDENT JOURNAL', heading: 'Small notes. Meaningful growth.', accent: '#f18db9', tint: 'rgba(241,141,185,.14)' },
};

const EMPTY_DATA = { training: [], batches: [], topics: [], sessions: [], attendance: [], diary: [], students: [], topicProgress: [] };
const inputStyle = { width: '100%', padding: '11px 12px', color: '#e2e8f0', background: '#111827', border: '1px solid #334155', borderRadius: '9px', boxSizing: 'border-box' };
const labelStyle = { display: 'block', color: '#cbd5e1', fontSize: '0.8rem', fontWeight: 700, marginBottom: '6px' };
const buttonStyle = { border: 0, borderRadius: '9px', padding: '10px 14px', background: '#10b981', color: '#052e2b', fontWeight: 800, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '7px' };

const asList = value => (Array.isArray(value) ? value : String(value || '').split(/[,;\n]+/)).map(item => String(item || '').trim()).filter(Boolean);
const dateToday = getTodayPortalDateInput;
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

  const assignments = useMemo(() => getTrainerAssignments(tpoData), [tpoData]);
  const students = useMemo(() => data.students.filter(student => isWithinTrainerScope(student, assignments)), [data.students, assignments]);
  const studentIds = useMemo(() => new Set(students.map(student => String(student.studentId).toLowerCase())), [students]);
  const training = useMemo(() => data.training.filter(item => studentIds.has(String(item.studentId).toLowerCase()) && isWithinTrainerScope(item, assignments)), [data.training, studentIds, assignments]);
  const trainingIds = useMemo(() => new Set(training.map(item => String(item.trainingId))), [training]);
  const batches = useMemo(() => data.batches.filter(batch => isWithinTrainerScope(batch, assignments)), [data.batches, assignments]);
  const batchIds = useMemo(() => new Set(batches.map(item => String(item.batchId))), [batches]);
  const sessions = useMemo(() => data.sessions.filter(item =>
    (item.trainingId && trainingIds.has(String(item.trainingId))) ||
    (item.batchId && batchIds.has(String(item.batchId))) ||
    (item.studentId && studentIds.has(String(item.studentId).toLowerCase()))
  ), [data.sessions, trainingIds, batchIds, studentIds]);
  const sessionIds = useMemo(() => new Set(sessions.map(item => String(item.sessionId))), [sessions]);
  const attendance = useMemo(() => data.attendance.filter(item =>
    sessionIds.has(String(item.sessionId)) || (item.trainingId && trainingIds.has(String(item.trainingId))) || studentIds.has(String(item.studentId).toLowerCase())
  ), [data.attendance, sessionIds, trainingIds, studentIds]);
  const diary = useMemo(() => data.diary.filter(item =>
    (item.trainingId && trainingIds.has(String(item.trainingId))) || studentIds.has(String(item.studentId).toLowerCase())
  ), [data.diary, trainingIds, studentIds]);
  const topics = useMemo(() => data.topics.filter(item => {
    const topicCourse = standardizeAcademicCourse(item.mainCourse);
    return assignments.courses.some(course => !['all', 'all courses'].includes(normalizeAcademicBranch(course)) && standardizeAcademicCourse(course) === topicCourse);
  }), [data.topics, assignments.courses]);

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
  const visibleAttendance = attendance.filter(item => !q || `${item.studentName} ${item.studentId} ${item.sessionId} ${item.attendanceStatus}`.toLowerCase().includes(q));
  const visibleDiary = diary.filter(item => !q || `${item.studentName} ${item.studentId} ${item.title} ${item.eventType} ${item.description}`.toLowerCase().includes(q));
  const visibleSessions = sessions.filter(item => !q || `${item.sessionId} ${item.topic} ${item.studentId} ${item.batchId} ${item.trainerName}`.toLowerCase().includes(q));
  const visibleBatches = batches.filter(item => !q || `${item.batchName} ${item.batchId} ${item.mainCourse} ${item.branch} ${item.trainerName}`.toLowerCase().includes(q));
  const visibleTraining = training.filter(item => !q || `${item.studentName} ${item.studentId} ${item.mainCourse} ${item.subCourse} ${item.branch} ${item.trainerName}`.toLowerCase().includes(q));
  const visibleTopics = topics.filter(item => !q || `${item.mainCourse} ${item.subCourse} ${item.module} ${item.topic} ${item.subtopic}`.toLowerCase().includes(q));
  const courseOptions = [...new Set(students.map(student => student.mainCourse).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const branchOptions = [...new Set(students.map(student => student.branch).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  const activeTrainingCount = training.filter(item => ['active', 'ongoing', 'in progress'].includes(String(item.status || '').toLowerCase())).length;
  const completedHours = training.reduce((sum, item) => sum + (Number(item.completedHours) || 0), 0);
  const completionRate = training.length ? Math.round(training.reduce((sum, item) => sum + (Number.parseFloat(item.progress) || 0), 0) / training.length) : 0;
  const metricCards = module === 'training'
    ? [{ label: 'Active learners', value: activeTrainingCount, icon: UsersFour }, { label: 'Hours delivered', value: `${completedHours}h`, icon: Clock }, { label: 'Average progress', value: `${completionRate}%`, icon: Sparkle }]
    : module === 'batches'
      ? [{ label: 'Active cohorts', value: batches.filter(item => String(item.status || 'active').toLowerCase() === 'active').length, icon: UsersFour }, { label: 'Learners grouped', value: [...new Set(batches.flatMap(item => item.students || []))].length, icon: GraduationCap }, { label: 'Branches in scope', value: new Set(batches.map(item => item.branch).filter(Boolean)).size, icon: Buildings }]
      : module === 'sessions'
        ? [{ label: 'Sessions logged', value: sessions.length, icon: ChalkboardTeacher }, { label: 'Hours delivered', value: sessions.reduce((sum, item) => sum + (Number(item.actualHours) || 0), 0), icon: Clock }, { label: 'Learners reached', value: new Set(sessions.map(item => item.studentId).filter(Boolean)).size, icon: UsersFour }]
        : module === 'attendance'
          ? [{ label: 'Attendance records', value: attendance.length, icon: CalendarCheck }, { label: 'Present', value: attendance.filter(item => String(item.attendanceStatus).toLowerCase() === 'present').length, icon: CheckCircle }, { label: 'Needs review', value: attendance.filter(item => String(item.verified).toLowerCase() !== 'yes').length, icon: Sparkle }]
          : module === 'topics'
            ? [{ label: 'Course topics', value: topics.length, icon: BookOpen }, { label: 'Learning modules', value: new Set(topics.map(item => item.module).filter(Boolean)).size, icon: GraduationCap }, { label: 'Courses in scope', value: courseOptions.length, icon: Buildings }]
            : [{ label: 'Diary entries', value: diary.length, icon: Notebook }, { label: 'Learners noted', value: new Set(diary.map(item => item.studentId).filter(Boolean)).size, icon: UsersFour }, { label: 'Active learners', value: activeTrainingCount, icon: Sparkle }];
  const recordCount = module === 'training' ? training.length : module === 'batches' ? batches.length : module === 'sessions' ? sessions.length : module === 'attendance' ? attendance.length : module === 'topics' ? topics.length : diary.length;
  const visibleCount = module === 'training' ? visibleTraining.length : module === 'batches' ? visibleBatches.length : module === 'sessions' ? visibleSessions.length : module === 'attendance' ? visibleAttendance.length : module === 'topics' ? visibleTopics.length : visibleDiary.length;
  const createLabel = module === 'training' ? 'Assign Training' : module === 'batches' ? 'Create Batch' : module === 'sessions' ? 'Log a Session' : 'Add Diary Note';
  const studentById = new Map(students.map(student => [String(student.studentId).toLowerCase(), student]));
  const trainingById = new Map(training.map(item => [String(item.trainingId), item]));
  const batchById = new Map(batches.map(item => [String(item.batchId), item]));

  return (
    <Layout>
      <main className={`academic-workspace page-container academic-module-${module}`} style={{ '--module-accent': config.accent, '--module-tint': config.tint }}>
        <AcademicTopNav title={config.title} subtitle={config.subtitle} statLabel={module === 'topics' ? 'Topics in scope' : 'Records in scope'} statValue={recordCount} />

        <section className="academic-module-banner">
          <div className="academic-module-banner-copy"><span><Icon size={15} weight="fill" /> {config.eyebrow}</span><h2>{config.heading}</h2><p>{students.length.toLocaleString()} learner{students.length === 1 ? '' : 's'} across {branchOptions.length} assigned branch{branchOptions.length === 1 ? '' : 'es'} · {courseOptions.length} course{courseOptions.length === 1 ? '' : 's'}</p></div>
          <div className="academic-module-stamp"><Icon size={28} weight="duotone" /><small>IPCS<br />LEARNING</small></div>
          <div className="academic-module-decoration" aria-hidden="true"><i /><i /><i /></div>
        </section>

        <section className="academic-module-metrics" aria-label={`${config.title} summary`}>
          {metricCards.map((metric, index) => { const MetricIcon = metric.icon; return <article key={metric.label} className={`metric-tone-${index}`}><span className="academic-metric-icon"><MetricIcon size={18} weight="duotone" /></span><span className="academic-metric-label">{metric.label}</span><strong>{metric.value}</strong><small>ASSIGNED SCOPE</small></article>; })}
        </section>

        <div className="academic-toolbar">
          <label className="academic-search"><MagnifyingGlass size={18} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder={`Search ${module === 'topics' ? 'topics and modules' : 'students, records, and branches'}…`} /></label>
          {module !== 'attendance' && module !== 'topics' && <button type="button" className="academic-create-button" onClick={showModal}><Plus weight="bold" /> {createLabel}<ArrowUpRight size={16} /></button>}
        </div>

        {error && <div className="academic-message error" role="alert">{error}</div>}
        {loading ? <div className="academic-loading-panel"><CircleNotch size={28} className="ph-spin" /> Loading your assigned {module} records…</div> : (
          <>
            {module === 'training' && <div className="academic-training-grid">{visibleTraining.map((item, index) => {
              const progress = Math.max(0, Math.min(100, Number.parseFloat(item.progress) || (Number(item.plannedHours) ? Number(item.completedHours || 0) / Number(item.plannedHours) * 100 : 0)));
              return <article className="academic-training-card" key={item.trainingId} style={{ '--card-delay': `${Math.min(index * 35, 245)}ms` }}>
                <div className="academic-card-topline"><span className="academic-avatar">{String(item.studentName || item.studentId || 'S').split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase()}</span><select aria-label={`Training status for ${item.trainingId}`} value={item.status || 'Active'} onChange={event => updateTrainingStatus(item, event.target.value)}><option>Active</option><option>On Hold</option><option>Completed</option><option>Cancelled</option></select></div>
                <div className="academic-student-title"><h3>{item.studentName || 'Student record'}</h3><span>{item.studentId}</span></div>
                <div className="academic-course-label">{item.mainCourse || 'Course not set'}<small>{item.subCourse || 'General track'}</small></div>
                <div className="academic-training-meta"><span><Buildings size={14} /> {item.branch || 'Branch not set'}</span><span><GraduationCap size={14} /> {item.trainingType || 'Individual'}</span></div>
                <div className="academic-progress-label"><span>Learning progress</span><b>{Math.round(progress)}%</b></div><div className="academic-progress-track"><i style={{ width: `${progress}%` }} /></div>
                <div className="academic-card-footer"><span>{item.completedHours || 0} of {item.plannedHours || 0} hours</span><small>{item.trainerName || tpoData.name || 'Assigned trainer'}</small></div>
              </article>;
            })}</div>}

            {module === 'batches' && <div className="academic-batch-grid">{visibleBatches.map((item, index) => <article className="academic-batch-card" key={item.batchId} style={{ '--card-delay': `${Math.min(index * 35, 245)}ms` }}>
              <div className="academic-batch-cover"><span>{String(item.batchName || 'B').slice(0, 1).toUpperCase()}</span><small>{item.status || 'Active'}</small></div>
              <div className="academic-batch-body"><span className="academic-batch-id">COHORT · {item.batchId}</span><h3>{item.batchName || 'Untitled batch'}</h3><p>{item.mainCourse || 'Course not set'}{item.subCourse ? ` · ${item.subCourse}` : ''}</p>
                <div className="academic-batch-facts"><span><Buildings size={15} />{item.branch || 'Branch not set'}</span><span><CalendarBlank size={15} />{item.schedule || 'Schedule pending'}</span><span><Clock size={15} />{item.classTiming || 'Time not set'}</span></div>
                <div className="academic-batch-students"><div>{(item.students || []).slice(0, 4).map(id => <span key={id} title={studentName(id, students)}>{String(studentName(id, students) || id).split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase()}</span>)}</div><small>{(item.students || []).length} assigned learners</small></div>
              </div>
            </article>)}</div>}

            {module === 'sessions' && <div className="academic-session-list">{visibleSessions.map(item => {
              const linkedTraining = trainingById.get(String(item.trainingId));
              const linkedBatch = batchById.get(String(item.batchId));
              const learner = studentById.get(String(item.studentId || '').toLowerCase());
              const participants = linkedBatch?.students || (learner ? [learner.studentId] : []);
              return <article className="academic-session-card" key={item.sessionId}>
                <div className="academic-session-date"><span>{formatPortalDate(item.date, String(item.date || '')).split(' ')[0]}</span><small>{item.actualHours || 0}h</small></div>
                <div className="academic-session-main"><div className="academic-session-kicker"><span>{item.sessionType || (linkedBatch ? 'BATCH CLASS' : 'INDIVIDUAL CLASS')}</span><b>{item.sessionStatus || 'Logged'}</b></div><h3>{item.topic || 'Session topic'}</h3><p>{linkedBatch?.batchName || learner?.studentName || item.studentId || 'Assigned learners'} · {linkedTraining?.mainCourse || linkedBatch?.mainCourse || learner?.mainCourse || 'Course not set'}</p><div className="academic-session-meta"><span><Clock size={14} />{formatPortalTime(item.startTime, String(item.startTime || ''))}–{formatPortalTime(item.endTime, String(item.endTime || ''))}</span><span><Buildings size={14} />{linkedTraining?.branch || linkedBatch?.branch || learner?.branch || 'Assigned branch'}</span><span><UsersFour size={14} />{participants.length || 1} learner{(participants.length || 1) === 1 ? '' : 's'}</span></div></div>
                <div className="academic-session-code">{item.sessionId}<small>{item.trainingId || item.batchId || 'SESSION'}</small></div>
              </article>;
            })}</div>}

            {module === 'attendance' && <div className="academic-attendance-board"><div className="academic-board-heading"><div><span>LIVE REGISTER</span><h2>Student attendance</h2></div><small>{visibleAttendance.length} records</small></div><div className="academic-responsive-table"><table><thead><tr><th>Learner</th><th>Branch &amp; course</th><th>Session</th><th>Date</th><th>Attendance</th><th>Verification</th><th /></tr></thead><tbody>
              {visibleAttendance.map(item => {
                const draft = attendanceDraft[item.attendanceId] || { status: item.attendanceStatus || 'Present', verified: String(item.verified).toLowerCase() === 'yes' };
                const student = studentById.get(String(item.studentId).toLowerCase());
                return (
                  <tr key={item.attendanceId}>
                    <td><strong>{item.studentName || student?.studentName || item.studentId}</strong><small>{item.studentId}</small></td>
                    <td>{student?.branch || '—'}<small>{student?.mainCourse || '—'}{student?.subCourse ? ` · ${student.subCourse}` : ''}</small></td>
                    <td>{item.sessionId}</td>
                    <td>{formatPortalDate(item.date, String(item.date || ''))}</td>
                    <td><select className="academic-status-select" value={draft.status} onChange={event => setAttendanceDraft(current => ({ ...current, [item.attendanceId]: { ...draft, status: event.target.value } }))}><option>Present</option><option>Absent</option><option>Late</option><option>Leave</option></select></td>
                    <td><label className="academic-check"><input type="checkbox" checked={draft.verified} onChange={event => setAttendanceDraft(current => ({ ...current, [item.attendanceId]: { ...draft, verified: event.target.checked } }))} /> <span>{draft.verified ? 'Verified' : 'Pending'}</span></label></td>
                    <td><button type="button" className="academic-icon-button" title="Save attendance" onClick={() => saveAttendance(item)}><FloppyDisk size={17} /></button></td>
                  </tr>
                );
              })}
            </tbody></table></div></div>}

            {module === 'topics' && <div className="academic-topic-grid">{visibleTopics.map((item, index) => <article className="academic-topic-card" key={item.topicId || `${item.module}-${item.topic}-${index}`}><div className="academic-topic-number">{String(item.sequence || index + 1).padStart(2, '0')}</div><span>{item.module || item.mainCourse || 'COURSE TOPIC'}</span><h3>{item.topic || 'Untitled topic'}</h3><p>{item.subtopic || 'Build practical understanding through guided learning.'}</p><footer><span><BookOpen size={14} /> {item.mainCourse || courseOptions[0] || 'Assigned course'}</span><small>{item.plannedHours ? `${item.plannedHours} planned hours` : 'Learning outline'}</small></footer></article>)}</div>}

            {module === 'diary' && <div className="academic-diary-list">{visibleDiary.map(item => { const student = studentById.get(String(item.studentId).toLowerCase()); return <article key={item.diaryId} className="academic-diary-card"><div className="academic-diary-marker"><Icon size={18} weight="duotone" /></div><div className="academic-diary-content"><div className="academic-diary-meta"><span>{item.eventType || 'Trainer note'}</span><time>{formatPortalDate(item.date, String(item.date || ''))}</time></div><h3>{item.title}</h3><p>{item.description || 'No additional note was recorded.'}</p><footer><b>{item.studentName || student?.studentName || item.studentId}</b><span>{student?.mainCourse || 'Assigned course'} · {student?.branch || 'Assigned branch'}</span><small>{item.studentId}{item.createdBy ? ` · ${item.createdBy}` : ''}</small></footer></div></article>; })}</div>}

            {visibleCount === 0 && <div className="academic-empty-state"><span><Sparkle size={22} /></span><h3>{q && recordCount > 0 ? 'No matches in this view' : `Your ${config.title.toLowerCase()} will appear here`}</h3><p>{q && recordCount > 0 ? 'Try a different student, course, branch, or topic search.' : students.length ? 'Add a record to get started in your assigned scope.' : 'No students match the course and branch assignments on this trainer account yet.'}</p></div>}
          </>
        )}
      </main>

      {isModalOpen && <div className="academic-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setIsModalOpen(false); }}><div className="academic-modal"><div className="academic-modal-header"><div><span className="academic-modal-eyebrow">TRAINING &amp; ACADEMICS</span><h2>{module === 'training' ? 'Assign student training' : module === 'batches' ? 'Create training batch' : module === 'sessions' ? 'Log a live session' : 'Add student diary note'}</h2></div><button type="button" onClick={() => setIsModalOpen(false)} className="academic-icon-button" aria-label="Close"><X size={20} /></button></div>
        <form onSubmit={submit} className="academic-form">
          {module === 'training' && <>
            <label><span style={labelStyle}>Student *</span><select style={inputStyle} required value={form.studentId || ''} onChange={event => { const student = students.find(item => item.studentId === event.target.value); setForm(current => ({ ...current, studentId: event.target.value, mainCourse: student?.mainCourse || '', subCourse: student?.subCourse || '', branch: student?.branch || '' })); }}><option value="">Select an assigned learner</option>{students.map(student => <option key={student.studentId} value={student.studentId}>{student.studentName} · {student.studentId} · {student.branch}</option>)}</select></label>
            <div className="academic-form-grid"><label><span style={labelStyle}>Assigned course</span><input style={inputStyle} value={form.mainCourse || ''} readOnly placeholder="Select a learner first" /></label><label><span style={labelStyle}>Specialization</span><input style={inputStyle} value={form.subCourse || ''} readOnly placeholder="From student record" /></label></div>
            <div className="academic-form-grid"><label><span style={labelStyle}>Trainer</span><input style={inputStyle} value={tpoData.name || ''} readOnly /></label><label><span style={labelStyle}>Training type</span><select style={inputStyle} value={form.trainingType} onChange={event => setForm(current => ({ ...current, trainingType: event.target.value }))}><option>Individual</option><option>Batch</option></select></label></div>
            <div className="academic-form-grid"><label><span style={labelStyle}>Planned hours</span><input style={inputStyle} type="number" min="0" value={form.plannedHours || ''} onChange={event => setForm(current => ({ ...current, plannedHours: event.target.value }))} /></label><label><span style={labelStyle}>Expected completion</span><DateInput style={inputStyle} value={form.expectedEndDate || ''} onChange={event => setForm(current => ({ ...current, expectedEndDate: event.target.value }))} /></label></div>
            <label><span style={labelStyle}>Assigned branch</span><input style={inputStyle} value={form.branch || ''} readOnly placeholder="Selected learner branch" /></label>
          </>}

          {module === 'batches' && <>
            <label><span style={labelStyle}>Batch name *</span><input style={inputStyle} required value={form.batchName || ''} onChange={event => setForm(current => ({ ...current, batchName: event.target.value }))} /></label>
            <div className="academic-form-grid"><label><span style={labelStyle}>Assigned course *</span><select style={inputStyle} required value={form.mainCourse || ''} onChange={event => setForm(current => ({ ...current, mainCourse: event.target.value }))}><option value="">Select course</option>{courseOptions.map(course => <option key={course}>{course}</option>)}</select></label><label><span style={labelStyle}>Specialization</span><input style={inputStyle} value={form.subCourse || ''} onChange={event => setForm(current => ({ ...current, subCourse: event.target.value }))} /></label></div>
            <div className="academic-form-grid"><label><span style={labelStyle}>Assigned branch *</span><select style={inputStyle} required value={form.branch || ''} onChange={event => setForm(current => ({ ...current, branch: event.target.value }))}><option value="">Select branch</option>{branchOptions.map(branch => <option key={branch}>{branch}</option>)}</select></label><label><span style={labelStyle}>Trainer</span><input style={inputStyle} value={tpoData.name || ''} readOnly /></label></div>
            <div className="academic-form-grid"><label><span style={labelStyle}>Schedule</span><input style={inputStyle} placeholder="Mon, Wed, Fri" value={form.schedule || ''} onChange={event => setForm(current => ({ ...current, schedule: event.target.value }))} /></label><label><span style={labelStyle}>Class time</span><input style={inputStyle} placeholder="10:00 AM–12:00 PM" value={form.classTiming || ''} onChange={event => setForm(current => ({ ...current, classTiming: event.target.value }))} /></label></div>
            <label><span style={labelStyle}>Learners for this batch</span><select style={{ ...inputStyle, minHeight: 135 }} multiple value={asList(form.studentIds)} onChange={event => setForm(current => ({ ...current, studentIds: [...event.target.selectedOptions].map(option => option.value) }))}>{students.filter(student => (!form.mainCourse || standardizeAcademicCourse(student.mainCourse) === standardizeAcademicCourse(form.mainCourse)) && (!form.branch || normalizeAcademicBranch(student.branch) === normalizeAcademicBranch(form.branch))).map(student => <option key={student.studentId} value={student.studentId}>{student.studentName} · {student.studentId}</option>)}</select><small className="academic-form-hint">Hold Ctrl or Command to select multiple learners in the chosen branch and course.</small></label>
          </>}

          {module === 'sessions' && <>
            <div className="academic-form-grid"><label><span style={labelStyle}>Session type</span><select style={inputStyle} value={form.sessionType} onChange={event => setForm(current => ({ ...current, sessionType: event.target.value, trainingId: '', batchId: '' }))}><option>Individual</option><option>Batch</option></select></label><label><span style={labelStyle}>Session date *</span><DateInput style={inputStyle} required value={form.date || ''} onChange={event => setForm(current => ({ ...current, date: event.target.value }))} /></label></div>
            {form.sessionType === 'Batch' ? <label><span style={labelStyle}>Batch *</span><select style={inputStyle} required value={form.batchId || ''} onChange={event => setForm(current => ({ ...current, batchId: event.target.value }))}><option value="">Select batch</option>{batches.map(batch => <option key={batch.batchId} value={batch.batchId}>{batch.batchName} · {batch.batchId}</option>)}</select></label> : <label><span style={labelStyle}>Student training *</span><select style={inputStyle} required value={form.trainingId || ''} onChange={event => setForm(current => ({ ...current, trainingId: event.target.value }))}><option value="">Select active training</option>{training.map(item => <option key={item.trainingId} value={item.trainingId}>{item.studentName} · {item.studentId} · {item.subCourse}</option>)}</select></label>}
            <div className="academic-form-grid"><label><span style={labelStyle}>Start time *</span><input style={inputStyle} type="time" step="1" required value={form.startTime || ''} onChange={event => setForm(current => ({ ...current, startTime: event.target.value }))} /></label><label><span style={labelStyle}>End time *</span><input style={inputStyle} type="time" step="1" required value={form.endTime || ''} onChange={event => setForm(current => ({ ...current, endTime: event.target.value }))} /></label></div>
            <label><span style={labelStyle}>Topic taught *</span><input style={inputStyle} required value={form.topic || ''} onChange={event => setForm(current => ({ ...current, topic: event.target.value }))} list="academic-topics" /><datalist id="academic-topics">{topics.map(topic => <option key={topic.topicId} value={topic.topic}>{topic.module}</option>)}</datalist></label>
            <div className="academic-form-grid"><label><span style={labelStyle}>Trainer</span><input style={inputStyle} value={tpoData.name || ''} readOnly /></label><label><span style={labelStyle}>Comprehension</span><select style={inputStyle} value={form.comprehension || ''} onChange={event => setForm(current => ({ ...current, comprehension: event.target.value }))}><option value="">Not recorded</option><option>Excellent</option><option>Good</option><option>Average</option><option>Needs Improvement</option></select></label></div>
            {sessionStudents.length > 0 && <div className="academic-attendee-list"><span style={labelStyle}>Attendance · {sessionStudents.length} student{sessionStudents.length === 1 ? '' : 's'}</span>{sessionStudents.map(studentId => <label key={studentId} className="academic-attendee"><span>{studentName(studentId, students) || studentId}<small>{studentId}</small></span><select style={{ ...inputStyle, width: 145 }} value={attendanceDraft[studentId] || 'Present'} onChange={event => setAttendanceDraft(current => ({ ...current, [studentId]: event.target.value }))}><option>Present</option><option>Absent</option><option>Late</option><option>Leave</option></select></label>)}</div>}
            <label><span style={labelStyle}>Trainer remarks</span><textarea style={{ ...inputStyle, minHeight: 70 }} value={form.remarks || ''} onChange={event => setForm(current => ({ ...current, remarks: event.target.value }))} /></label>
          </>}

          {module === 'diary' && <>
            <label><span style={labelStyle}>Student *</span><select style={inputStyle} required value={form.studentId || ''} onChange={event => { const record = training.find(item => item.studentId === event.target.value); setForm(current => ({ ...current, studentId: event.target.value, trainingId: record?.trainingId || '' })); }}><option value="">Select an assigned learner</option>{students.map(student => <option key={student.studentId} value={student.studentId}>{student.studentName} · {student.studentId} · {student.branch}</option>)}</select></label>
            <div className="academic-form-grid"><label><span style={labelStyle}>Entry type</span><select style={inputStyle} value={form.eventType || 'Trainer Note'} onChange={event => setForm(current => ({ ...current, eventType: event.target.value }))}><option>Trainer Note</option><option>Assignment</option><option>Assessment</option><option>Training</option><option>Activity</option></select></label><label><span style={labelStyle}>Date</span><DateInput style={inputStyle} value={form.date || ''} onChange={event => setForm(current => ({ ...current, date: event.target.value }))} /></label></div>
            <label><span style={labelStyle}>Title *</span><input style={inputStyle} required value={form.title || ''} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} /></label>
            <label><span style={labelStyle}>Notes</span><textarea style={{ ...inputStyle, minHeight: 100 }} value={form.description || ''} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></label>
          </>}
          {error && <div className="academic-message error" role="alert">{error}</div>}
          <div className="academic-modal-actions"><button type="button" className="academic-secondary-button" onClick={() => setIsModalOpen(false)}>Cancel</button><button type="submit" style={buttonStyle} disabled={submitting}>{submitting ? <CircleNotch size={18} className="ph-spin" /> : <CheckCircle size={18} weight="bold" />} Save record</button></div>
        </form>
      </div></div>}

    </Layout>
  );
}
