import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Buildings, CalendarCheck, ChalkboardTeacher, CircleNotch, MagnifyingGlass, UsersFour } from '@phosphor-icons/react';
import Layout from './Layout';
import AcademicTopNav from './AcademicTopNav';
import { API_BASE } from './apiConfig';
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
  return Number.isNaN(parsed.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Calcutta' }).format(parsed);
};
const activeValue = value => ['active', 'ongoing', 'in progress', 'enrolled', 'current'].includes(normalized(value));

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

  useEffect(() => {
    let active = true;
    axios.get(`${API_BASE}/api/academic/data`)
      .then(response => { if (active && response.data?.success) setData({ ...EMPTY, ...response.data }); })
      .catch(requestError => { if (active) setError(requestError.response?.data?.message || 'Could not load Training & Academics data.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]);

  const scopedTraining = useMemo(() => {
    if (!trainerMode) return data.training;
    return data.training.filter(row => !row.trainerName || normalized(row.trainerName) === normalized(user.name));
  }, [data.training, trainerMode, user.name]);
  const activeTraining = useMemo(() => scopedTraining.filter(row => activeValue(row.status)), [scopedTraining]);
  const activeIds = useMemo(() => new Set(activeTraining.map(row => normalized(row.studentId)).filter(Boolean)), [activeTraining]);
  const activeStudents = useMemo(() => data.students.filter(student => {
    const state = normalized(student.status);
    return state ? activeValue(state) : activeIds.has(normalized(student.studentId));
  }), [data.students, activeIds]);
  const branchCounts = useMemo(() => {
    const totals = new Map();
    activeStudents.forEach(student => {
      const branch = String(student.branch || 'Branch not set').trim();
      totals.set(branch, (totals.get(branch) || 0) + 1);
    });
    return [...totals.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [activeStudents]);
  const branchStudents = useMemo(() => activeStudents.filter(student => !selectedBranch || normalized(student.branch) === normalized(selectedBranch)), [activeStudents, selectedBranch]);
  const filteredStudents = useMemo(() => branchStudents.filter(student => !search || [student.studentId, student.studentName, student.mainCourse, student.subCourse, student.branch].some(value => normalized(value).includes(normalized(search)))), [branchStudents, search]);
  const today = todayInIndia();
  const todaySessions = data.sessions.filter(session => sheetDateKey(session.date) === today);
  const todayAttendance = data.attendance.filter(record => sheetDateKey(record.date) === today);
  const present = todayAttendance.filter(record => normalized(record.attendanceStatus).startsWith('present')).length;
  const absent = todayAttendance.filter(record => normalized(record.attendanceStatus).startsWith('absent')).length;
  const canReviewLeaves = user.accessType === 'superadmin' || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'BRANCH MANAGER', 'MANAGER', 'RTH', 'REGIONAL TECHNICAL HEAD', 'TECHNICAL LEAD', 'TTH', 'TRAINER'].some(role => String(user.role || '').toUpperCase().includes(role));
  const leaveRequests = (data.leaveRequests || []).filter(item => !search || [item.studentName, item.studentId, item.branch, item.mainCourse, item.leaveStatus, item.reason].some(value => normalized(value).includes(normalized(search))));
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

  return (
    <Layout>
      <main className="academic-overview">
        <AcademicTopNav title={trainerMode ? 'Trainer workspace' : 'Training & Academics'} subtitle={trainerMode ? 'Your active classes, student progress, and today’s attendance.' : 'Academic operations, active learners, training sessions, and attendance in one workspace.'} />
        {error && <div className="academic-overview-error" role="alert">{error}</div>}
        {loading ? <div className="academic-overview-loading"><CircleNotch size={25} className="ph-spin" /> Loading academic records…</div> : <>
          {isLeavePage ? <>
            <div className="academic-overview-section-heading academic-branch-list-heading"><div><span>STUDENT REQUESTS</span><h2>Leave approvals</h2><p>Review requests from the student portal. Scope follows your assigned branch and course.</p></div><label className="academic-overview-search"><MagnifyingGlass size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search student, branch, or status" /></label></div>
            {notice && <div className="academic-overview-notice" role="status">{notice}</div>}
            <div className="academic-overview-table-wrap"><table><thead><tr><th>Student</th><th>Branch / course</th><th>Requested dates</th><th>Reason</th><th>Status</th><th>Review</th></tr></thead><tbody>
              {leaveRequests.map(request => { const status = request.leaveStatus || 'Pending'; const pending = !['approved', 'rejected'].includes(normalized(status)); return <tr key={request.leaveId}><td><b>{request.studentName || 'Student'}</b><small>{request.studentId}</small></td><td>{request.branch || '—'}<small>{request.mainCourse || ''}</small></td><td>{request.fromDate || '—'}<small>to {request.toDate || '—'}</small></td><td className="academic-leave-reason">{request.reason || '—'}{request.requestedAt && <small>Submitted {request.requestedAt}</small>}</td><td><span className={`academic-overview-status ${normalized(status)}`}>{status}</span></td><td>{pending && canReviewLeaves ? <div className="academic-leave-review"><input aria-label={`Review note for ${request.studentName || request.studentId}`} value={reviewNotes[request.leaveId] || ''} onChange={event => setReviewNotes(current => ({ ...current, [request.leaveId]: event.target.value }))} placeholder="Optional note" /><button type="button" onClick={() => reviewLeave(request, 'Approved')} disabled={reviewing === request.leaveId}>Approve</button><button type="button" className="reject" onClick={() => reviewLeave(request, 'Rejected')} disabled={reviewing === request.leaveId}>Reject</button></div> : <span>{request.approvedBy ? `Reviewed by ${request.approvedBy}` : 'Awaiting reviewer'}</span>}</td></tr>; })}
              {!leaveRequests.length && <tr><td colSpan="6" className="academic-overview-no-rows">{data.leaveRequestsAvailable ? 'No leave requests are waiting in this scope.' : 'Leave request tab not found. Add a leave tab such as “08_Leave_Requests” to the connected student leave spreadsheet.'}</td></tr>}
            </tbody></table></div>
          </> : !isBranchPage ? <>
            <section className="academic-overview-metrics" aria-label="Academic summary">
              <article><span><UsersFour size={18} /> Active students</span><strong>{activeStudents.length.toLocaleString()}</strong></article>
              <article><span><Buildings size={18} /> Branches with active students</span><strong>{branchCounts.length}</strong></article>
              <article><span><ChalkboardTeacher size={18} /> Classes today</span><strong>{todaySessions.length}</strong></article>
              <article><span><CalendarCheck size={18} /> Present / absent marked today</span><strong>{present} / {absent}</strong></article>
            </section>
            <div className="academic-overview-section-heading"><div><span>BRANCH DIRECTORY</span><h2>Active students by branch</h2><p>Choose a branch to open its current learner list.</p></div><button type="button" onClick={() => navigate('/academic/attendance')}>Open attendance register <ArrowRight size={16} /></button></div>
            <section className="academic-branch-cards" aria-label="Branches with active students">
              {branchCounts.map(([branch, count]) => <button type="button" key={branch} onClick={() => navigate(`/academic/branches?branch=${encodeURIComponent(branch)}`)}><span><Buildings size={21} /></span><b>{branch}</b><small>{count} active student{count === 1 ? '' : 's'}</small><i>View students <ArrowRight size={15} /></i></button>)}
              {!branchCounts.length && <div className="academic-overview-empty">No active training assignments are recorded yet.</div>}
            </section>
            <div className="academic-overview-shortcuts"><button type="button" onClick={() => navigate('/academic/training')}>Student training <ArrowRight size={16} /></button><button type="button" onClick={() => navigate('/academic/batches')}>Batch management <ArrowRight size={16} /></button><button type="button" onClick={() => navigate('/academic/sessions')}>Live sessions <ArrowRight size={16} /></button><button type="button" onClick={() => navigate('/academic/attendance')}>Attendance <ArrowRight size={16} /></button></div>
          </> : <>
            <div className="academic-overview-section-heading academic-branch-list-heading"><div><span>ACTIVE BRANCH ROSTER</span><h2>{selectedBranch || 'Current students'}</h2><p>{filteredStudents.length} active student records are visible for this branch.</p></div><label className="academic-overview-search"><MagnifyingGlass size={17} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, roll, or course" /></label></div>
            <div className="academic-overview-table-wrap"><table><thead><tr><th>Student</th><th>Roll number</th><th>Course</th><th>Branch</th><th>Training</th></tr></thead><tbody>
              {filteredStudents.map(student => <tr key={student.studentId}><td><b>{student.studentName || 'Unnamed student'}</b><small>{student.subCourse || ''}</small></td><td>{student.studentId}</td><td>{student.mainCourse || '—'}</td><td>{student.branch || '—'}</td><td><span className="academic-overview-status">Active</span></td></tr>)}
              {!filteredStudents.length && <tr><td colSpan="5" className="academic-overview-no-rows">No active students match this branch and search.</td></tr>}
            </tbody></table></div>
          </>}
        </>}
      </main>
    </Layout>
  );
}
