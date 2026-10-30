import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Buildings, CalendarBlank, CalendarCheck, ChalkboardTeacher, CircleNotch, Clock, EnvelopeSimple, GraduationCap, MagnifyingGlass, MapPin, Phone, Sparkle, UsersFour } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import AcademicTopNav from './AcademicTopNav';
import { API_BASE } from '../../services/apiConfig';
import { getTrainerAssignments, isWithinTrainerScope } from './academicScope';
import './AcademicOverview.css';

const EMPTY = { students: [], training: [], sessions: [], attendance: [], batches: [], leaveRequests: [], leaveRequestsAvailable: false };
const normalized = value => String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
const todayInIndia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const sheetDateKey = value => {
  const text = String(value || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parts = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (parts) return `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(parsed);
};
const activeValue = value => ['active', 'ongoing', 'in progress', 'enrolled', 'current'].includes(normalized(value));
const progressOf = record => Math.max(0, Math.min(100, Number.parseFloat(record?.progress) || (Number(record?.plannedHours) ? (Number(record?.completedHours || 0) / Number(record.plannedHours)) * 100 : 0)));
const initials = value => String(value || 'Student').trim().split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase();

export default function AcademicOverview({ trainerMode = false }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isBranchPage = location.pathname === '/academic/branches';
  const isLeavePage = location.pathname === '/academic/leaves';
  const selectedBranch = new URLSearchParams(location.search).get('branch') || '';
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [reviewNotes, setReviewNotes] = useState({});
  const [notice, setNotice] = useState('');
  const [reviewing, setReviewing] = useState('');
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('tpoData') || '{}'); } catch { return {}; } }, []);
  const assignments = useMemo(() => getTrainerAssignments(user), [user]);

  useEffect(() => {
    let active = true;
    axios.get(`${API_BASE}/api/academic/data`)
      .then(response => { if (active && response.data?.success) setData({ ...EMPTY, ...response.data }); })
      .catch(requestError => { if (active) setError(requestError.response?.data?.message || 'Could not load Training & Academics data.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  const scopedStudents = useMemo(() => data.students.filter(student => isWithinTrainerScope(student, assignments)), [data.students, assignments]);
  const scopedTraining = useMemo(() => data.training.filter(record => isWithinTrainerScope(record, assignments)), [data.training, assignments]);
  const trainingByStudent = useMemo(() => {
    const map = new Map();
    scopedTraining.forEach(record => {
      const key = normalized(record.studentId);
      const records = map.get(key) || [];
      records.push(record);
      map.set(key, records);
    });
    return map;
  }, [scopedTraining]);
  const branchCounts = useMemo(() => {
    const totals = new Map();
    scopedStudents.forEach(student => {
      const branch = String(student.branch || 'Branch not set').trim();
      totals.set(branch, (totals.get(branch) || 0) + 1);
    });
    return [...totals.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [scopedStudents]);
  const visibleRoster = useMemo(() => scopedStudents.filter(student => {
    const branchMatches = !selectedBranch || normalized(student.branch) === normalized(selectedBranch);
    const haystack = [student.studentId, student.studentName, student.mainCourse, student.subCourse, student.branch, student.phone, student.email, student.qualification, student.stream].map(normalized).join(' ');
    return branchMatches && (!search || haystack.includes(normalized(search)));
  }), [scopedStudents, selectedBranch, search]);
  const studentIds = useMemo(() => new Set(scopedStudents.map(student => normalized(student.studentId))), [scopedStudents]);
  const scopedTrainingIds = useMemo(() => new Set(scopedTraining.map(record => String(record.trainingId))), [scopedTraining]);
  const scopedBatchIds = useMemo(() => new Set(data.batches.filter(batch => isWithinTrainerScope(batch, assignments)).map(batch => String(batch.batchId))), [data.batches, assignments]);
  const scopedSessions = useMemo(() => data.sessions.filter(session =>
    (session.trainingId && scopedTrainingIds.has(String(session.trainingId))) ||
    (session.batchId && scopedBatchIds.has(String(session.batchId))) ||
    (session.studentId && studentIds.has(normalized(session.studentId)))
  ), [data.sessions, scopedTrainingIds, scopedBatchIds, studentIds]);
  const today = todayInIndia();
  const todaySessions = scopedSessions.filter(session => sheetDateKey(session.date) === today).sort((a, b) => String(a.startTime || '').localeCompare(String(b.startTime || '')));
  const todaySessionIds = new Set(todaySessions.map(session => String(session.sessionId)));
  const attendanceRecords = data.attendance.filter(record => studentIds.has(normalized(record.studentId)));
  const todayAttendance = attendanceRecords.filter(record => sheetDateKey(record.date) === today || todaySessionIds.has(String(record.sessionId)));
  const present = todayAttendance.filter(record => normalized(record.attendanceStatus).startsWith('present')).length;
  const absent = todayAttendance.filter(record => normalized(record.attendanceStatus).startsWith('absent')).length;
  const activeTraining = scopedTraining.filter(record => activeValue(record.status));
  const activeStudentIds = new Set(activeTraining.map(record => normalized(record.studentId)));
  const activeStudents = scopedStudents.filter(student => activeStudentIds.has(normalized(student.studentId)) || activeValue(student.status));
  const canReviewLeaves = user.accessType === 'superadmin' || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'BRANCH MANAGER', 'MANAGER', 'RTH', 'REGIONAL TECHNICAL HEAD', 'TECHNICAL LEAD', 'TTH', 'TRAINER'].some(role => String(user.role || '').toUpperCase().includes(role));
  const leaveRequests = (data.leaveRequests || []).filter(item => isWithinTrainerScope(item, assignments) && (!search || [item.studentName, item.studentId, item.branch, item.mainCourse, item.leaveStatus, item.reason].some(value => normalized(value).includes(normalized(search)))));
  const reviewLeave = async (request, status) => {
    const requestId = request.leaveId;
    setReviewing(requestId);
    setNotice('');
    try {
      const response = await axios.post(`${API_BASE}/api/academic/leaves/review`, { leaveId: requestId, status, notes: reviewNotes[requestId] || '' });
      setNotice(response.data?.message || `Leave request ${status.toLowerCase()}.`);
      setRefreshKey(value => value + 1);
    } catch (requestError) { setNotice(requestError.response?.data?.message || 'Could not update this leave request.'); }
    finally { setReviewing(''); }
  };

  const title = isLeavePage ? 'Leave approvals' : isBranchPage ? 'Branch directory' : trainerMode ? 'Trainer workspace' : 'Training & Academics';
  const subtitle = isLeavePage ? 'Review student requests from the branches and courses assigned to you.' : isBranchPage ? 'Explore your assigned branches and the learners studying in each one.' : 'Your teaching scope, daily sessions, and learner progress in one place.';

  return (
    <Layout>
      <main className={`academic-overview ${isLeavePage ? 'page-kind-leaves' : isBranchPage ? 'page-kind-branches' : 'page-kind-dashboard'}`}>
        <AcademicTopNav title={title} subtitle={subtitle} statLabel={isLeavePage ? 'Requests in scope' : isBranchPage ? 'Assigned learners' : 'Active learners'} statValue={isLeavePage ? leaveRequests.length : isBranchPage ? visibleRoster.length : activeStudents.length} />
        {error && <div className="academic-overview-error" role="alert">{error}</div>}
        {loading ? <div className="academic-overview-loading"><CircleNotch size={25} className="ph-spin" /> Loading your assigned academic records…</div> : <>
          {isLeavePage ? <>
            <section className="academic-page-intro leave-intro"><span><CalendarCheck size={16} /> STUDENT SERVICES</span><h2>Leave, handled with clarity.</h2><p>Review learner requests and record decisions for your assigned course and branch.</p><div className="academic-intro-stats"><b>{leaveRequests.filter(item => !['approved', 'rejected'].includes(normalized(item.leaveStatus))).length}<small>Pending review</small></b><b>{leaveRequests.filter(item => normalized(item.leaveStatus) === 'approved').length}<small>Approved</small></b><b>{leaveRequests.filter(item => normalized(item.leaveStatus) === 'rejected').length}<small>Declined</small></b></div></section>
            <div className="academic-overview-section-heading academic-branch-list-heading"><div><span>REQUEST REGISTER</span><h2>Assigned student requests</h2><p>Every request shown here falls within your trainer scope.</p></div><label className="academic-overview-search"><MagnifyingGlass size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search learner, branch, or status" /></label></div>
            {notice && <div className="academic-overview-notice" role="status">{notice}</div>}
            <div className="academic-overview-table-wrap leave-table"><table><thead><tr><th>Student</th><th>Branch / course</th><th>Requested dates</th><th>Reason</th><th>Status</th><th>Review action</th></tr></thead><tbody>
              {leaveRequests.map(request => { const status = request.leaveStatus || 'Pending'; const pending = !['approved', 'rejected'].includes(normalized(status)); return <tr key={request.leaveId}><td><b>{request.studentName || 'Student'}</b><small>{request.studentId}</small></td><td>{request.branch || '—'}<small>{request.mainCourse || ''}</small></td><td>{request.fromDate || '—'}<small>to {request.toDate || '—'}</small></td><td className="academic-leave-reason">{request.reason || '—'}{request.requestedAt && <small>Submitted {request.requestedAt}</small>}</td><td><span className={`academic-overview-status ${normalized(status)}`}>{status}</span></td><td>{pending && canReviewLeaves ? <div className="academic-leave-review"><input aria-label={`Review note for ${request.studentName || request.studentId}`} value={reviewNotes[request.leaveId] || ''} onChange={event => setReviewNotes(current => ({ ...current, [request.leaveId]: event.target.value }))} placeholder="Optional note" /><button type="button" onClick={() => reviewLeave(request, 'Approved')} disabled={reviewing === request.leaveId}>Approve</button><button type="button" className="reject" onClick={() => reviewLeave(request, 'Rejected')} disabled={reviewing === request.leaveId}>Decline</button></div> : <span>{request.approvedBy ? `Reviewed by ${request.approvedBy}` : 'Awaiting reviewer'}</span>}</td></tr>; })}
              {!leaveRequests.length && <tr><td colSpan="6" className="academic-overview-no-rows">{data.leaveRequestsAvailable ? 'No leave requests match this trainer scope.' : 'Leave requests are not connected yet. Add a leave request tab to the student leave spreadsheet.'}</td></tr>}
            </tbody></table></div>
          </> : isBranchPage ? <>
            <section className="academic-page-intro branch-intro"><span><Buildings size={16} /> YOUR BRANCH NETWORK</span><h2>Every learner, in the right place.</h2><p>Browse your branch roster with each student’s course, training progress, contact, and academic profile.</p><div className="academic-branch-pill-row">{branchCounts.map(([branch, count]) => <button type="button" className={normalized(selectedBranch) === normalized(branch) ? 'selected' : ''} key={branch} onClick={() => navigate(`/academic/branches?branch=${encodeURIComponent(branch)}`)}><MapPin size={14} />{branch}<b>{count}</b></button>)}</div></section>
            <div className="academic-overview-section-heading academic-branch-list-heading"><div><span>LEARNER DIRECTORY</span><h2>{selectedBranch || 'All assigned branches'}</h2><p>{visibleRoster.length} learner{visibleRoster.length === 1 ? '' : 's'} in your assigned course and branch scope.</p></div><label className="academic-overview-search"><MagnifyingGlass size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, roll, course, or phone" /></label></div>
            <div className="academic-overview-table-wrap roster-table"><table><thead><tr><th>Learner</th><th>Course &amp; specialization</th><th>Branch</th><th>Contact</th><th>Education</th><th>Training progress</th><th>Attendance</th></tr></thead><tbody>
              {visibleRoster.map(student => {
                const records = trainingByStudent.get(normalized(student.studentId)) || [];
                const latest = records.find(record => activeValue(record.status)) || records[0];
                const learnerAttendance = attendanceRecords.filter(record => normalized(record.studentId) === normalized(student.studentId));
                const presentCount = learnerAttendance.filter(record => normalized(record.attendanceStatus).startsWith('present')).length;
                const attendanceRate = learnerAttendance.length ? Math.round((presentCount / learnerAttendance.length) * 100) : null;
                const progress = progressOf(latest);
                return <tr key={student.studentId}><td><div className="roster-name"><span>{initials(student.studentName)}</span><div><b>{student.studentName || 'Unnamed learner'}</b><small>{student.studentId} · {student.status || 'Student'}</small></div></div></td><td><b>{student.mainCourse || '—'}</b><small>{student.subCourse || 'General track'}</small></td><td>{student.branch || '—'}</td><td><div className="roster-contact">{student.phone && <a href={`tel:${student.phone}`}><Phone size={13} />{student.phone}</a>}{student.email && <a href={`mailto:${student.email}`}><EnvelopeSimple size={13} />{student.email}</a>}{!student.phone && !student.email && <span>Contact not listed</span>}</div></td><td><b>{student.qualification || '—'}</b><small>{student.stream || student.experience || 'Profile details unavailable'}</small></td><td>{latest ? <><div className="roster-progress-label"><span>{latest.status || 'Training'}</span><b>{Math.round(progress)}%</b></div><div className="roster-progress"><i style={{ width: `${progress}%` }} /></div><small>{latest.completedHours || 0} / {latest.plannedHours || 0} training hours</small></> : <span className="roster-not-started">No training plan yet</span>}</td><td>{attendanceRate === null ? <span className="roster-not-started">Not marked</span> : <><b className="roster-attendance-value">{attendanceRate}% present</b><small>{presentCount} of {learnerAttendance.length} sessions</small></>}</td></tr>;
              })}
              {!visibleRoster.length && <tr><td colSpan="7" className="academic-overview-no-rows">No learners match this branch and search.</td></tr>}
            </tbody></table></div>
          </> : <>
            <section className="academic-dashboard-banner"><div className="academic-dashboard-copy"><span><Sparkle size={15} weight="fill" /> YOUR TEACHING STUDIO</span><h2>Teach clearly.<br /><em>Track every step.</em></h2><p>A focused view of your assigned learners, live sessions, and learning progress.</p><div className="academic-dashboard-actions"><button type="button" onClick={() => navigate('/academic/branches')}>Explore learner roster <ArrowRight size={16} /></button><small>{todayInIndia()}</small></div></div><div className="academic-dashboard-art" aria-hidden="true"><div className="academic-art-ring ring-one"/><div className="academic-art-ring ring-two"/><div className="academic-art-center"><GraduationCap size={48} weight="duotone" /></div><span>LEARN</span><i>GROW</i></div></section>
            <section className="academic-overview-metrics" aria-label="Academic summary"><article><span><UsersFour size={18} /> Active learners</span><strong>{activeStudents.length.toLocaleString()}</strong><small>Across your assigned scope</small></article><article><span><Buildings size={18} /> Branches</span><strong>{branchCounts.length}</strong><small>{assignments.courses.length} assigned course{assignments.courses.length === 1 ? '' : 's'}</small></article><article><span><ChalkboardTeacher size={18} /> Classes today</span><strong>{todaySessions.length}</strong><small>{todaySessions.reduce((sum, session) => sum + (Number(session.actualHours) || 0), 0)} learning hours logged</small></article><article><span><CalendarCheck size={18} /> Present / absent</span><strong>{present} <i>/</i> {absent}</strong><small>Attendance marked today</small></article></section>
            <div className="academic-dashboard-grid">
              <section className="academic-panel academic-schedule-panel"><div className="academic-panel-heading"><div><span>TODAY'S CLASSROOM</span><h2>Your session plan</h2></div><button type="button" onClick={() => navigate('/academic/sessions')}>All sessions <ArrowRight size={15} /></button></div><div className="academic-schedule-list">{todaySessions.map(session => {
                const batch = data.batches.find(item => String(item.batchId) === String(session.batchId));
                const learner = scopedStudents.find(item => normalized(item.studentId) === normalized(session.studentId));
                return <article key={session.sessionId} className="academic-schedule-item"><div className="academic-schedule-time"><Clock size={15} /><span>{session.startTime || 'Time TBD'}</span><small>{session.actualHours || 0}h</small></div><div className="academic-schedule-detail"><span>{session.sessionType || (batch ? 'BATCH CLASS' : 'CLASS')}</span><h3>{session.topic || 'Learning session'}</h3><p>{batch?.batchName || learner?.studentName || session.studentId || 'Assigned learners'} · {session.mainCourse || learner?.mainCourse || batch?.mainCourse || 'Assigned course'}</p></div><span className="academic-session-status">{session.sessionStatus || 'Scheduled'}</span></article>;
              })}{!todaySessions.length && <div className="academic-schedule-empty"><CalendarBlank size={24} /><b>No classes logged today</b><span>Your sessions will appear here once recorded.</span></div>}</div></section>
              <section className="academic-panel academic-scope-panel"><div className="academic-panel-heading"><div><span>YOUR ASSIGNMENT</span><h2>Teaching footprint</h2></div><span className="academic-footprint-icon"><MapPin size={18} /></span></div><div className="academic-scope-block"><span>COURSES</span><div>{assignments.courses.length ? assignments.courses.map(course => <i key={course}><BookOpen size={14} />{course}</i>) : <small>Course assignment pending</small>}</div></div><div className="academic-scope-block branch-scope-block"><span>BRANCHES</span><div>{branchCounts.length ? branchCounts.map(([branch, count]) => <button type="button" key={branch} onClick={() => navigate(`/academic/branches?branch=${encodeURIComponent(branch)}`)}><MapPin size={14} /><b>{branch}</b><small>{count} learner{count === 1 ? '' : 's'}</small></button>) : <small>Branch assignment pending</small>}</div></div><button type="button" className="academic-scope-cta" onClick={() => navigate('/academic/branches')}>View full roster <ArrowRight size={15} /></button></section>
            </div>
            <section className="academic-panel academic-learners-panel"><div className="academic-panel-heading"><div><span>LEARNER MOMENTUM</span><h2>Active students</h2><p>Progress from the courses and branches assigned to you.</p></div><button type="button" onClick={() => navigate('/academic/branches')}>Open directory <ArrowRight size={15} /></button></div><div className="academic-dashboard-roster">{activeStudents.slice(0, 6).map(student => {
              const records = trainingByStudent.get(normalized(student.studentId)) || [];
              const record = records.find(item => activeValue(item.status)) || records[0];
              const progress = progressOf(record);
              return <article key={student.studentId}><div className="dashboard-learner-head"><span>{initials(student.studentName)}</span><div><b>{student.studentName || 'Learner'}</b><small>{student.studentId}</small></div><i>{record?.status || student.status || 'Enrolled'}</i></div><p>{student.mainCourse || 'Course not set'}{student.subCourse ? ` · ${student.subCourse}` : ''}</p><div className="dashboard-learner-progress"><span style={{ width: `${progress}%` }} /></div><footer><span>{student.branch || 'Branch not set'}</span><b>{record ? `${Math.round(progress)}%` : 'Plan pending'}</b></footer></article>;
            })}{!activeStudents.length && <div className="academic-overview-empty">No learner records match your current course and branch assignments.</div>}</div></section>
          </>}
        </>}
      </main>
    </Layout>
  );
}
