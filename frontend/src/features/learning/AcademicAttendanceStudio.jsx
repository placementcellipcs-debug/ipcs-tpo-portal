import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { ArrowDownRight, ArrowUpRight, BookOpen, Buildings, CalendarBlank, CalendarCheck, Check, CheckCircle, Clock, EnvelopeSimple, FloppyDisk, GraduationCap, MagnifyingGlass, Phone, Sparkle, UsersFour, X } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import AcademicTopNav from './AcademicTopNav';
import { API_BASE } from '../../services/apiConfig';
import { getTrainerAssignments, normalizeAcademicBranch, standardizeAcademicCourse } from './academicScope';
import './AcademicAttendanceStudio.css';

const MONTHS = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2020, index, 1)));
const MARKS = [
  { code: 'P', label: 'Present', tone: 'present' },
  { code: 'A', label: 'Absent', tone: 'absent' },
  { code: 'H', label: 'Holiday / leave', tone: 'holiday' },
  { code: 'S', label: 'Sunday', tone: 'sunday' },
  { code: 'X', label: 'No class', tone: 'noclass' },
];
const todayIndia = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
const initials = value => String(value || 'Learner').trim().split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase();
const defaultMarkForDay = (mark, year, month, day) => mark || (new Date(year, month - 1, day).getDay() === 0 ? 'S' : '');
const percentageValue = student => Math.max(0, Math.min(100, Number.parseFloat(student?.training?.progress || student?.coursePercentage || student?.syllabusCompleted) || 0));
const profileFields = [
  ['Phone number', 'phone', Phone], ['Mail ID', 'email', EnvelopeSimple], ['Parent phone', 'parentPhone', Phone],
  ['Qualification', 'qualification', GraduationCap], ['Course track', 'subCourse', BookOpen], ['Course duration', 'courseDuration', Clock],
  ['Mode of class', 'modeOfClass', UsersFour], ['Joining date', 'joiningDate', CalendarBlank], ['Batch', 'batch', UsersFour],
  ['Batch timing', 'batchStartTime', Clock, 'batchEndTime'], ['Course status', 'courseStatus', CheckCircle],
  ['Course completed', 'courseCompletedDate', CalendarCheck], ['Fees status', 'feesStatus', CheckCircle],
  ['Trainer remarks', 'reasonRemarks', BookOpen], ['Placement', 'placement', GraduationCap], ['Placement status', 'placementStatus', CheckCircle],
  ['Certificate applied', 'certificateApplied', CheckCircle], ['Certificate received', 'certificateReceived', CheckCircle],
  ['Feedback', 'feedback', Sparkle], ['Months absent', 'absentMonths', CalendarBlank], ['Absence reason', 'absenceReason', BookOpen],
];

export default function AcademicAttendanceStudio() {
  const user = useMemo(() => { try { return JSON.parse(localStorage.getItem('tpoData') || '{}'); } catch { return {}; } }, []);
  const scope = useMemo(() => getTrainerAssignments(user), [user]);
  const branchOptions = useMemo(() => [...new Set(scope.branches.filter(value => !/^all( branches)?$/i.test(value)))], [scope.branches]);
  const courseOptions = useMemo(() => [...new Set((scope.courses.length ? scope.courses : [user.department || '']).filter(Boolean))], [scope.courses, user.department]);
  const now = todayIndia();
  const [branch, setBranch] = useState(branchOptions.includes(user.sittingBranch) ? user.sittingBranch : branchOptions[0] || '');
  const [course, setCourse] = useState(courseOptions[0] || '');
  const [month, setMonth] = useState(Number(now.slice(5, 7)));
  const [year, setYear] = useState(Number(now.slice(0, 4)));
  const [day, setDay] = useState(Number(now.slice(8, 10)));
  const [register, setRegister] = useState(null);
  const [draft, setDraft] = useState({});
  const [search, setSearch] = useState('');
  const [view, setView] = useState('day');
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [progressDraft, setProgressDraft] = useState(0);
  const [showTopicForm, setShowTopicForm] = useState(false);
  const [topicDraft, setTopicDraft] = useState({ module: '', topic: '', courseDuration: '', plannedHours: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState(false);
  const [savingTopic, setSavingTopic] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const daysInMonth = new Date(year, month, 0).getDate();
  const selectedDate = `${monthKey}-${String(Math.min(day, daysInMonth)).padStart(2, '0')}`;
  const years = Array.from({ length: Math.max(8, Number(now.slice(0, 4)) - 2019) }, (_, index) => Number(now.slice(0, 4)) - index);

  useEffect(() => {
    if (!branch || !course) { setLoading(false); return undefined; }
    let active = true;
    setLoading(true);
    setError('');
    axios.get(`${API_BASE}/api/academic/attendance/register`, { params: { branch, course, month, year } })
      .then(response => {
        if (!active || !response.data?.success) return;
        setRegister(response.data);
        setDraft(Object.fromEntries((response.data.students || []).map(student => [String(student.studentId), defaultMarkForDay(student.monthlyAttendance?.dayMarks?.[Math.min(day, response.data.daysInMonth)], year, month, Math.min(day, response.data.daysInMonth))])));
      })
      .catch(requestError => { if (active) setError(requestError.response?.data?.message || 'Could not load this monthly attendance register.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [branch, course, month, year]);

  useEffect(() => {
    if (!register?.students?.length) return;
    setDraft(Object.fromEntries(register.students.map(student => [
      String(student.studentId), defaultMarkForDay(student.monthlyAttendance?.dayMarks?.[Math.min(day, register.daysInMonth)], year, month, Math.min(day, register.daysInMonth)),
    ])));
  }, [day, month, register, year]);

  const selectedStudent = register?.students?.find(student => String(student.studentId) === selectedStudentId) || null;
  const topics = useMemo(() => {
    const learner = selectedStudent;
    if (!learner) return [];
    return (register?.topics || []).filter(topic => {
      if (standardizeAcademicCourse(topic.mainCourse) !== standardizeAcademicCourse(learner.mainCourse)) return false;
      if (topic.branch && normalizeAcademicBranch(topic.branch) !== normalizeAcademicBranch(learner.branch)) return false;
      if (topic.subCourse && normalizeAcademicBranch(topic.subCourse) !== normalizeAcademicBranch(learner.subCourse)) return false;
      if (topic.courseDuration && learner.courseDuration && normalizeAcademicBranch(topic.courseDuration) !== normalizeAcademicBranch(learner.courseDuration)) return false;
      return true;
    }).sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0));
  }, [register, selectedStudent]);
  const filteredStudents = useMemo(() => (register?.students || []).filter(student => !search || `${student.studentName} ${student.studentId} ${student.subCourse} ${student.batch}`.toLowerCase().includes(search.trim().toLowerCase())), [register, search]);
  const markedCount = Object.values(draft).filter(Boolean).length;
  const presentToday = filteredStudents.filter(student => (draft[String(student.studentId)] || student.monthlyAttendance?.dayMarks?.[day]) === 'P').length;
  const absentToday = filteredStudents.filter(student => (draft[String(student.studentId)] || student.monthlyAttendance?.dayMarks?.[day]) === 'A').length;
  const completedTopics = topics.filter(topic => selectedStudent?.topicProgress?.some(progress => progress.topicId === topic.topicId && String(progress.completed).toLowerCase() === 'yes')).length;

  const reloadRegister = async () => {
    const response = await axios.get(`${API_BASE}/api/academic/attendance/register`, { params: { branch, course, month, year } });
    if (response.data?.success) {
      setRegister(response.data);
    setDraft(Object.fromEntries((response.data.students || []).map(student => [String(student.studentId), defaultMarkForDay(student.monthlyAttendance?.dayMarks?.[day], year, month, day)])));
    }
  };

  const saveDay = async () => {
    const marks = (register?.students || []).map(student => ({ studentId: student.studentId, status: draft[String(student.studentId)] || '' }));
    if (!marks.length) { setError('Choose an attendance mark for at least one learner first.'); return; }
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await axios.post(`${API_BASE}/api/academic/attendance/mark-day`, { date: selectedDate, branch, course, marks });
      setNotice(`${response.data?.message || `${marks.length} attendance marks saved.`} · ${selectedDate}`);
      await reloadRegister();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not save the daily register.'); }
    finally { setSaving(false); }
  };

  const markAllPresent = () => setDraft(current => Object.fromEntries((register?.students || []).map(student => [String(student.studentId), current[String(student.studentId)] || 'P'])));

  const openStudent = student => {
    setSelectedStudentId(String(student.studentId));
    setProgressDraft(percentageValue(student));
    setTopicDraft(current => ({ ...current, courseDuration: student.courseDuration || current.courseDuration }));
  };

  const saveProgress = async () => {
    if (!selectedStudent) return;
    setSavingProgress(true); setError(''); setNotice('');
    try {
      const response = await axios.post(`${API_BASE}/api/academic/students/update`, { studentId: selectedStudent.studentId, branch, course, coursePercentage: Number(progressDraft) });
      setNotice(response.data?.message || 'Course completion saved.');
      await reloadRegister();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not save course completion.'); }
    finally { setSavingProgress(false); }
  };

  const toggleTopic = async (topic, completed) => {
    if (!selectedStudent) return;
    setError(''); setNotice('');
    try {
      const response = await axios.post(`${API_BASE}/api/academic/students/update`, { studentId: selectedStudent.studentId, branch, course, topicId: topic.topicId, completed });
      setNotice(response.data?.message || 'Topic progress saved.');
      await reloadRegister();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not update this topic.'); }
  };

  const addTopic = async event => {
    event.preventDefault();
    if (!selectedStudent) return;
    setSavingTopic(true); setError(''); setNotice('');
    try {
      const response = await axios.post(`${API_BASE}/api/academic/topics/add`, {
        branch, course, subCourse: selectedStudent.subCourse || 'General', courseDuration: topicDraft.courseDuration,
        module: topicDraft.module, topic: topicDraft.topic, plannedHours: topicDraft.plannedHours,
      });
      setNotice(response.data?.message || 'Topic added to this course plan.');
      setTopicDraft(current => ({ ...current, module: '', topic: '', plannedHours: '' }));
      await reloadRegister();
    } catch (requestError) { setError(requestError.response?.data?.message || 'Could not add this syllabus topic.'); }
    finally { setSavingTopic(false); }
  };

  const selectMark = (student, code) => setDraft(current => ({ ...current, [String(student.studentId)]: code }));

  return (
    <Layout>
      <main className="academic-workspace page-container academic-module-attendance academic-attendance-studio">
        <AcademicTopNav title="Attendance & progress" subtitle="Mark a day, follow each learner’s syllabus, and review the monthly register in one connected workspace." statLabel="Assigned learners" statValue={register?.students?.length || 0} />

        <section className="attendance-command-bar">
          <div className="attendance-command-copy"><span><CalendarCheck size={15} weight="fill" /> TRAINER REGISTER</span><h2>{register?.monthLabel || MONTHS[month - 1]} <em>{year}</em></h2><p>{branch || 'Branch'} <i /> {course || 'Course'} <i /> Daily marks and imported history are stored together in the portal attendance register.</p></div>
          <div className="attendance-command-filters">
            <label><small>BRANCH</small><select value={branch} onChange={event => setBranch(event.target.value)}>{branchOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
            <label><small>COURSE</small><select value={course} onChange={event => setCourse(event.target.value)}>{courseOptions.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
          </div>
          <div className="attendance-command-art"><div className="attendance-orbit orbit-a" /><div className="attendance-orbit orbit-b" /><span><CalendarCheck size={28} weight="duotone" /></span></div>
        </section>

        <section className="attendance-filter-row">
          <div className="attendance-period-control"><CalendarBlank size={17} /><select aria-label="Month" value={month} onChange={event => { setMonth(Number(event.target.value)); setDay(1); }}>{MONTHS.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}</select><select aria-label="Year" value={year} onChange={event => { setYear(Number(event.target.value)); setDay(1); }}>{years.map(value => <option key={value}>{value}</option>)}</select></div>
          <div className="attendance-view-switch" role="tablist" aria-label="Attendance view"><button type="button" className={view === 'day' ? 'selected' : ''} onClick={() => setView('day')}>Day register</button><button type="button" className={view === 'month' ? 'selected' : ''} onClick={() => setView('month')}>Month matrix</button></div>
          <label className="attendance-search"><MagnifyingGlass size={16} /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Find learner or roll number" /></label>
        </section>

        <section className="attendance-insight-grid">
          <article className="attendance-insight tone-learners"><span><UsersFour size={17} /></span><small>LEARNERS IN SCOPE</small><b>{register?.students?.length || 0}</b><i>Assigned to this course</i></article>
          <article className="attendance-insight tone-present"><span><CheckCircle size={17} /></span><small>PRESENT · DAY {day}</small><b>{presentToday}</b><i>{register?.monthLabel || MONTHS[month - 1]} register</i></article>
          <article className="attendance-insight tone-absent"><span><ArrowDownRight size={17} /></span><small>ABSENT · DAY {day}</small><b>{absentToday}</b><i>Review before submit</i></article>
          <article className="attendance-insight tone-syllabus"><span><BookOpen size={17} /></span><small>TOPICS IN THIS PLAN</small><b>{register?.topics?.length || 0}</b><i>Filtered by course, branch, and duration</i></article>
        </section>

        <section className="attendance-ledger-card">
          <div className="attendance-ledger-head">
            <div><span>{view === 'day' ? 'DAILY CLASSROOM' : 'MONTHLY OVERVIEW'}</span><h2>{view === 'day' ? 'Take today’s register' : `${register?.monthLabel || MONTHS[month - 1]} attendance`}</h2><p>{view === 'day' ? 'Select the day, open a learner for their profile, then mark the class register.' : 'Review attendance history imported from the master sheet and marks recorded in the portal.'}</p></div>
            <div className="attendance-ledger-actions">
              {view === 'day' && <label className="attendance-day-select"><small>DAY</small><select value={Math.min(day, daysInMonth)} onChange={event => setDay(Number(event.target.value))}>{Array.from({ length: daysInMonth }, (_, index) => index + 1).map(value => <option key={value}>{value}</option>)}</select><span>{new Intl.DateTimeFormat('en', { weekday: 'short' }).format(new Date(year, month - 1, Math.min(day, daysInMonth)))}</span></label>}
              <button type="button" className="attendance-mark-all" onClick={markAllPresent} disabled={loading || !register?.students?.length}><Check size={15} /> Mark remaining present</button>
              <button type="button" className="attendance-save-button" onClick={saveDay} disabled={saving || loading || !markedCount}>{saving ? <span className="attendance-loader" /> : <FloppyDisk size={17} />} Save day’s register <ArrowUpRight size={15} /></button>
            </div>
          </div>

          <div className="attendance-source-strip"><span className="attendance-source-led" /><span>SAVED TO</span><b>{register?.sourceSheet || 'Loading register'}</b>{register?.dailySheet && <i>· selected-date roster: {register.dailySheet}</i>}{register?.sourceWorkbookTitle && <i>· {register.sourceWorkbookTitle}</i>}{register?.sourceUrl && <a href={register.sourceUrl} target="_blank" rel="noreferrer">Open workbook <ArrowUpRight size={12} /></a>}<small>{selectedDate}</small></div>
          {error && <div className="attendance-feedback error" role="alert">{error}</div>}
          {notice && <div className="attendance-feedback success" role="status"><CheckCircle size={16} />{notice}</div>}

          {loading ? <div className="attendance-loading"><span className="attendance-loader" /> Loading your assigned monthly register…</div> : !register?.students?.length ? <div className="attendance-empty"><span><UsersFour size={22} /></span><b>No learners found in this assignment</b><small>Confirm the student course and branch assignments for this trainer.</small></div> : view === 'day' ? (
            <div className="attendance-roster-wrap"><table className="attendance-roster-table"><thead><tr><th><span>LEARNER</span></th><th><span>COURSE &amp; BATCH</span></th><th><span>COURSE PROGRESS</span></th><th><span>MONTH TOTAL</span></th><th><span>DAY {day} · {selectedDate.slice(8)}</span></th></tr></thead><tbody>
              {filteredStudents.map((student, index) => {
                const mark = draft[String(student.studentId)] || '';
                const monthly = student.monthlyAttendance;
                const studentPresent = monthly?.present || 0;
                const studentAbsent = monthly?.absent || 0;
                const progress = percentageValue(student);
                return <tr key={student.studentId} style={{ '--row-delay': `${Math.min(index * 20, 200)}ms` }}>
                  <td><button type="button" className="attendance-learner-trigger" onClick={() => openStudent(student)}><span>{initials(student.studentName)}</span><i><b>{student.studentName || 'Unnamed learner'}</b><small>{student.studentId} · {student.courseStatus || student.status || 'Enrolled'}</small></i><ArrowUpRight size={13} /></button></td>
                  <td><b>{student.subCourse || student.mainCourse || 'Course not set'}</b><small>{student.batch || 'No batch'}{student.courseDuration ? ` · ${student.courseDuration}` : ''}</small></td>
                  <td><div className="attendance-progress-line"><span>{progress}%</span><div><i style={{ width: `${progress}%` }} /></div><button type="button" aria-label={`Open ${student.studentName} progress`} onClick={() => openStudent(student)}><ArrowUpRight size={13} /></button></div></td>
                  <td><b className="attendance-totals"><span>{studentPresent} P</span><i>/</i><span>{studentAbsent} A</span></b><small>{studentPresent + studentAbsent} marked days</small></td>
                  <td><div className="attendance-mark-picker" aria-label={`Attendance for ${student.studentName}`}>
                    {MARKS.map(option => <button key={option.code} type="button" className={`mark-chip mark-${option.tone}${mark === option.code ? ' selected' : ''}`} aria-label={`${option.label}${mark === option.code ? ', selected' : ''}`} title={option.label} onClick={() => selectMark(student, option.code)}>{option.code}</button>)}
                  </div></td>
                </tr>;
              })}
              {!filteredStudents.length && <tr><td className="attendance-no-results" colSpan="5">No learners match this search.</td></tr>}
            </tbody></table></div>
          ) : (
            <div className="attendance-matrix-wrap"><table className="attendance-month-matrix"><thead><tr><th className="matrix-sticky-student">LEARNER</th>{Array.from({ length: daysInMonth }, (_, index) => index + 1).map(value => <th key={value}><button type="button" className={value === day ? 'current-day' : ''} onClick={() => { setDay(value); setView('day'); }}>{String(value).padStart(2, '0')}</button></th>)}<th>P</th><th>A</th><th>COURSE</th></tr></thead><tbody>
              {filteredStudents.map(student => { const progress = percentageValue(student); return <tr key={student.studentId}><td className="matrix-sticky-student"><button type="button" className="matrix-learner" onClick={() => openStudent(student)}><span>{initials(student.studentName)}</span><i><b>{student.studentName}</b><small>{student.studentId}</small></i></button></td>{Array.from({ length: daysInMonth }, (_, index) => index + 1).map(value => { const code = student.monthlyAttendance?.dayMarks?.[value] || ''; return <td key={value}><button type="button" className={`matrix-mark ${code ? `mark-${(MARKS.find(item => item.code === code)?.tone || 'empty')}` : 'mark-empty'}`} title={`${student.studentName} · ${value} ${MONTHS[month - 1]} · ${MARKS.find(item => item.code === code)?.label || 'Not marked'}`} onClick={() => { setDay(value); setView('day'); }}>{code || '·'}</button></td>; })}<td className="matrix-total matrix-present">{student.monthlyAttendance?.present || 0}</td><td className="matrix-total matrix-absent">{student.monthlyAttendance?.absent || 0}</td><td className="matrix-course-progress"><b>{progress}%</b><i><span style={{ width: `${progress}%` }} /></i></td></tr>; })}
            </tbody></table></div>
          )}

          <footer className="attendance-ledger-foot"><div className="attendance-legend">{MARKS.map(item => <span key={item.code}><i className={`mark-${item.tone}`}>{item.code}</i>{item.label}</span>)}</div><small>{register?.students?.length || 0} learners · {register?.monthLabel || MONTHS[month - 1]} {year}</small></footer>
        </section>
      </main>

      {selectedStudent && <div className="attendance-profile-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedStudentId(''); }}><aside className="attendance-profile-drawer" aria-label={`${selectedStudent.studentName} student details`}>
        <header className="attendance-profile-head"><button type="button" className="attendance-profile-close" aria-label="Close student details" onClick={() => setSelectedStudentId('')}><X size={18} /></button><span className="attendance-profile-avatar">{initials(selectedStudent.studentName)}</span><div><span>LEARNER PROFILE</span><h2>{selectedStudent.studentName}</h2><p>{selectedStudent.studentId} · {selectedStudent.courseStatus || selectedStudent.status || 'Enrolled'}</p></div></header>
        <div className="attendance-profile-course"><span><GraduationCap size={17} /> ASSIGNED COURSE</span><b>{selectedStudent.mainCourse || course}</b><small>{selectedStudent.subCourse || 'General track'} · {selectedStudent.branch || branch}</small></div>
        <section className="attendance-progress-editor"><div className="attendance-drawer-section-title"><span>COURSE COMPLETION</span><b>{Math.round(progressDraft)}%</b></div><div className="attendance-slider-track"><input type="range" min="0" max="100" value={progressDraft} onChange={event => setProgressDraft(Number(event.target.value))} aria-label="Course completion percentage" style={{ '--completion': `${progressDraft}%` }} /></div><div className="attendance-progress-editor-foot"><small>{selectedStudent.syllabusCompleted || selectedStudent.training?.progress || 'No percentage recorded'}</small><button type="button" onClick={saveProgress} disabled={savingProgress}>{savingProgress ? 'Saving…' : 'Save percentage'} <ArrowUpRight size={14} /></button></div></section>
        <section className="attendance-profile-facts"><div className="attendance-drawer-section-title"><span>STUDENT DETAILS</span><small>{selectedStudent.courseDuration || 'COURSE PROFILE'}</small></div><div className="attendance-fact-grid">{profileFields.map(([label, key, Icon, extra]) => { const value = selectedStudent[key]; const tail = extra ? selectedStudent[extra] : ''; if (!value && !tail) return null; return <article key={key}><span><Icon size={14} />{label}</span>{key === 'email' && value ? <a href={`mailto:${value}`}>{value}</a> : key === 'phone' && value ? <a href={`tel:${value}`}>{value}</a> : <b>{value || '—'}{tail ? ` – ${tail}` : ''}</b>}</article>; })}</div></section>
        <section className="attendance-syllabus-section"><div className="attendance-drawer-section-title"><span>SYLLABUS TRACKER</span><small>{completedTopics}/{topics.length} TOPICS</small><button type="button" className="attendance-add-topic" onClick={() => setShowTopicForm(open => !open)}>{showTopicForm ? 'Close' : 'Add topic'}</button></div>
          {showTopicForm && <form className="attendance-topic-form" onSubmit={addTopic}><label className="topic-duration-field"><span>COURSE DURATION</span><input value={topicDraft.courseDuration} onChange={event => setTopicDraft(current => ({ ...current, courseDuration: event.target.value }))} placeholder="e.g. 6 Months" required /></label><label><span>MODULE</span><input value={topicDraft.module} onChange={event => setTopicDraft(current => ({ ...current, module: event.target.value }))} placeholder="Module name" /></label><label className="topic-title-field"><span>TOPIC</span><input value={topicDraft.topic} onChange={event => setTopicDraft(current => ({ ...current, topic: event.target.value }))} placeholder="Topic to add to this plan" required /></label><label><span>HOURS</span><input type="number" min="0" step="0.5" value={topicDraft.plannedHours} onChange={event => setTopicDraft(current => ({ ...current, plannedHours: event.target.value }))} placeholder="Optional" /></label><button type="submit" disabled={savingTopic}>{savingTopic ? 'Saving…' : 'Add for this duration'}</button></form>}
          {topics.length ? <div className="attendance-topic-checklist">{topics.map((topic, index) => { const completed = selectedStudent.topicProgress?.some(progress => progress.topicId === topic.topicId && String(progress.completed).toLowerCase() === 'yes'); return <label key={topic.topicId || `${topic.topic}-${index}`} className={completed ? 'topic-complete' : ''}><span className="topic-check-number">{completed ? <Check size={13} weight="bold" /> : String(topic.sequence || index + 1).padStart(2, '0')}</span><span className="topic-check-copy"><b>{topic.topic}</b><small>{topic.module || 'COURSE MODULE'}{topic.plannedHours ? ` · ${topic.plannedHours}H` : ''}</small></span><input type="checkbox" checked={Boolean(completed)} onChange={event => toggleTopic(topic, event.target.checked)} aria-label={`${topic.topic} completed`} /></label>; })}</div> : <div className="attendance-topics-empty"><BookOpen size={18} /><span>No syllabus topics match this learner’s course, branch, track, and duration. Add a topic to create this duration-specific plan.</span></div>}</section>
        <footer className="attendance-profile-footer"><span><Buildings size={14} /> {selectedStudent.branch || branch}</span><span><CalendarCheck size={14} /> {selectedStudent.attendedDays || selectedStudent.monthlyAttendance?.present || 0} attended days</span></footer>
      </aside></div>}
    </Layout>
  );
}
