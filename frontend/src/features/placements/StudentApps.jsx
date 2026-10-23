import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import axios from 'axios';
import {
  ArrowsClockwise, Briefcase, Buildings, CalendarBlank, CalendarCheck,
  CircleNotch, Files, Funnel, GraduationCap, MapPinLine, MagnifyingGlass,
  UsersThree, WarningCircle, X
} from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import StatusBadge from '../../components/StatusBadge';
import { API_BASE } from '../../services/apiConfig';
import { formatPortalDate, formatPortalDateTime, formatPortalTime, parsePortalDateTime } from '../../utils/dateFormat';
import { isPortalAdminAccount } from '../../utils/roleAccess';
import './StudentApps.css';

const SOURCE_FILTERS = [
  { id: 'all', label: 'All records' },
  { id: 'application', label: 'Job applications' },
  { id: 'drive', label: 'Drive registrations' },
  { id: 'manual', label: 'Manual additions' }
];
const normalizeText = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const normalizeStatus = value => String(value || 'Applied').trim() || 'Applied';
const getInitials = value => String(value || 'Student').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();
const getStandardCourse = value => {
  const course = String(value || '').toLowerCase().trim();
  if (course.includes('bms') || course.includes('cctv')) return 'BMS AND CCTV';
  if (course.includes('automation') || course.includes('plc') || course.includes('scada')) return 'Industrial Automation';
  if (course.includes('embed') || course.includes('iot')) return 'Embedded and IoT';
  if (course.includes('digital') || course.includes('marketing')) return 'Digital Marketing';
  if (course.includes('information technology') || /(^|[^a-z])it([^a-z]|$)/.test(course) || ['python', 'software', 'data', 'cyber security', 'web development', 'java', 'php'].some(term => course.includes(term))) return 'Information technology (IT)';
  return 'Others';
};
const parseDate = value => parsePortalDateTime(value);
const displayDate = value => {
  const date = parseDate(value);
  return date ? formatPortalDate(date) : 'Date unavailable';
};
const recordDate = record => record.sourceType === 'drive' ? record.regDate || record.driveDate : record.date;
const isInterview = status => /interview|assessment|screening/i.test(String(status || ''));
const isPositiveOutcome = status => /offer|placed|joined/i.test(String(status || '')) && !/not joined|not placed|offer rejected/i.test(String(status || ''));
const isManual = record => record.originType === 'manual';

export default function StudentApps() {
  const [tpoData] = useState(() => {
    try { return JSON.parse(localStorage.getItem('tpoData') || 'null'); }
    catch { return null; }
  });
  const [applications, setApplications] = useState([]);
  const [driveRegistrations, setDriveRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [driveLoadError, setDriveLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [courseFilter, setCourseFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedDetails, setSelectedDetails] = useState(null);

  const role = String(tpoData?.role || '').toUpperCase();
  const isSuperAdmin = isPortalAdminAccount(tpoData);
  const isCourseSpecific = role.includes('RTH') || role.includes('TTH') || role.includes('TRAINER') || role.includes('TECHNICAL LEAD');
  const displayCourse = tpoData?.assignedCourse || '';
  const allowedBranches = useMemo(() => {
    const values = Array.isArray(tpoData?.assignedBranchesArray) && tpoData.assignedBranchesArray.length
      ? tpoData.assignedBranchesArray
      : String(tpoData?.assignedBranchesArray || tpoData?.assignedBranches || '').split(/[\n,;]+/);
    return values.map(normalizeText).filter(Boolean);
  }, [tpoData]);

  const loadRecords = useCallback(async (quiet = false) => {
    if (!tpoData) {
      setLoadError('Your staff profile is not available. Sign in again and retry.');
      setLoading(false);
      return;
    }
    if (quiet) setRefreshing(true);
    else setLoading(true);
    setLoadError('');
    try {
      const [applicationResult, driveResult] = await Promise.allSettled([
        axios.post(`${API_BASE}/api/tpo/applications`, {
          assignedBranchesArray: tpoData.assignedBranchesArray,
          tpoName: tpoData.name,
          role: tpoData.role,
          assignedCourse: tpoData.assignedCourse,
          scope: 'branch'
        }),
        axios.get(`${API_BASE}/api/tpo/drives`, { params: { scope: 'branch' } })
      ]);
      if (applicationResult.status !== 'fulfilled' || !applicationResult.value.data?.success) {
        throw new Error(applicationResult.status === 'rejected'
          ? applicationResult.reason?.response?.data?.message || applicationResult.reason?.message || 'Could not load applications.'
          : applicationResult.value.data?.message || 'Could not load applications.');
      }
      setApplications(Array.isArray(applicationResult.value.data.applications) ? applicationResult.value.data.applications : []);
      if (driveResult.status === 'fulfilled' && driveResult.value.data?.success) {
        setDriveRegistrations(Array.isArray(driveResult.value.data.drives) ? driveResult.value.data.drives : []);
        setDriveLoadError('');
      } else {
        setDriveRegistrations([]);
        setDriveLoadError(driveResult.status === 'rejected'
          ? driveResult.reason?.response?.data?.message || driveResult.reason?.message || 'Drive registrations could not be loaded.'
          : driveResult.value?.data?.message || 'Drive registrations could not be loaded.');
      }
    } catch (error) {
      setLoadError(error.response?.data?.message || error.message || 'Could not load student placement records.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tpoData]);

  useEffect(() => { void loadRecords(); }, [loadRecords]);

  const allRecords = useMemo(() => {
    const applicationRecords = applications.map(application => {
      const origin = String(application.origin || '').toLowerCase();
      const manual = /manual|direct|referral/.test(origin) || /^(manual-add|direct-referral)$/i.test(application.jobId || '');
      return {
        ...application,
        sourceType: 'application',
        originType: manual ? 'manual' : 'application',
        company: application.company || 'Company not recorded',
        position: application.position || 'Position not recorded',
        status: normalizeStatus(application.status),
        date: application.date || '',
        recordKey: `application-${application.rowNumber}-${application.jobId || ''}`
      };
    });
    const driveRecords = driveRegistrations.map(registration => {
      const isEmptyDrive = registration.name === 'NO_APPLICANTS';
      return {
        ...registration,
        sourceType: 'drive',
        originType: 'drive',
        isEmptyDrive,
        company: registration.driveId || 'Placement drive',
        position: 'Placement drive registration',
        status: isEmptyDrive ? 'No registrations yet' : normalizeStatus(registration.studentStatus || registration.regStatus || 'Registered'),
        date: registration.regDate || registration.driveDate || '',
        tpoName: registration.driveTpo || registration.tpoName || '',
        recordKey: `drive-${registration.rowNumber}-${registration.driveId || ''}`
      };
    });
    return [...applicationRecords, ...driveRecords];
  }, [applications, driveRegistrations]);

  const scopedRecords = useMemo(() => allRecords.filter(record => {
    const branch = normalizeText(record.branch);
    if (!isSuperAdmin && (!branch || !allowedBranches.some(assigned => assigned === 'all' || assigned === 'allbranches' || branch.includes(assigned) || assigned.includes(branch)))) return false;
    if (isCourseSpecific && getStandardCourse(record.course) !== getStandardCourse(displayCourse)) return false;
    return true;
  }), [allRecords, isSuperAdmin, allowedBranches, isCourseSpecific, displayCourse]);

  const branches = useMemo(() => [...new Set(scopedRecords.map(record => record.branch).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [scopedRecords]);
  const statusOptions = useMemo(() => [...new Set(scopedRecords.filter(record => !record.isEmptyDrive).map(record => record.status))].sort((a, b) => a.localeCompare(b)), [scopedRecords]);
  const visibleRecords = useMemo(() => scopedRecords.filter(record => {
    if (sourceFilter === 'application' && (record.sourceType !== 'application' || isManual(record))) return false;
    if (sourceFilter === 'manual' && !isManual(record)) return false;
    if (sourceFilter === 'drive' && record.sourceType !== 'drive') return false;
    if (branchFilter !== 'all' && record.branch !== branchFilter) return false;
    if (courseFilter !== 'all' && getStandardCourse(record.course) !== courseFilter) return false;
    if (statusFilter !== 'all' && (record.isEmptyDrive || record.status !== statusFilter)) return false;
    const date = parseDate(recordDate(record));
    const month = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : '';
    if (monthFilter && month !== monthFilter) return false;
    const search = normalizeText(query);
    if (search && ![record.name, record.roll, record.branch, record.course, record.company, record.position, record.jobId, record.status, record.tpoName, record.remarks]
      .some(value => normalizeText(value).includes(search))) return false;
    return true;
  }).sort((a, b) => (parseDate(recordDate(b))?.getTime() || 0) - (parseDate(recordDate(a))?.getTime() || 0)), [scopedRecords, sourceFilter, branchFilter, courseFilter, statusFilter, monthFilter, query]);

  const candidateRecords = scopedRecords.filter(record => !record.isEmptyDrive);
  const applicationsCount = candidateRecords.filter(record => record.sourceType === 'application' && !isManual(record)).length;
  const driveCount = candidateRecords.filter(record => record.sourceType === 'drive').length;
  const scheduledCount = candidateRecords.filter(record => isInterview(record.status)).length;
  const placementsCount = candidateRecords.filter(record => isPositiveOutcome(record.status)).length;
  const hasActiveFilters = Boolean(query || branchFilter !== 'all' || courseFilter !== 'all' || monthFilter || statusFilter !== 'all' || sourceFilter !== 'all');
  const resetFilters = () => { setQuery(''); setBranchFilter('all'); setCourseFilter('all'); setMonthFilter(''); setStatusFilter('all'); setSourceFilter('all'); };

  return <Layout>
    <main className="student-apps-page">
      <section className="student-apps-hero">
        <div className="student-apps-hero-copy">
          <span className="student-apps-kicker"><span /> PLACEMENT WORKSPACE</span>
          <h1>Student <em>placement tracker</em></h1>
          <p>See job applications, drive registrations, and manual referrals together, with the latest status for each student.</p>
          <div className="student-apps-coverage"><MapPinLine size={17} /> {isSuperAdmin ? 'All branches' : allowedBranches.some(branch => branch === 'all' || branch === 'allbranches') ? 'All assigned branches' : `${allowedBranches.length} assigned ${allowedBranches.length === 1 ? 'branch' : 'branches'}`}</div>
        </div>
        <button type="button" className="student-apps-refresh" onClick={() => void loadRecords(true)} disabled={refreshing || loading}><ArrowsClockwise size={17} className={refreshing ? 'student-apps-spin' : ''} /> Refresh</button>
      </section>

      <section className="student-apps-metrics" aria-label="Placement overview">
        <div><span className="student-apps-metric-icon blue"><UsersThree size={18} /></span><small>Student records</small><strong>{candidateRecords.length}</strong><em>Applications and referrals</em></div>
        <div><span className="student-apps-metric-icon cyan"><Briefcase size={18} /></span><small>Job applications</small><strong>{applicationsCount}</strong><em>Across assigned branches</em></div>
        <div><span className="student-apps-metric-icon violet"><CalendarBlank size={18} /></span><small>Drive registrations</small><strong>{driveCount}</strong><em>Registered students</em></div>
        <div><span className="student-apps-metric-icon green"><CalendarCheck size={18} /></span><small>Interviews / outcomes</small><strong>{scheduledCount + placementsCount}</strong><em>{scheduledCount} interviews · {placementsCount} offers / placed</em></div>
      </section>

      <section className="student-apps-workspace" aria-label="Student placement records">
        <header className="student-apps-workspace-heading">
          <div><span>LIVE STUDENT RECORDS</span><h2>Applications &amp; drives <small>{visibleRecords.length} shown</small></h2></div>
          <div className="student-apps-total"><Files size={17} /> {candidateRecords.length} students</div>
        </header>
        <nav className="student-apps-source-tabs" aria-label="Filter by record type">
          {SOURCE_FILTERS.map(filter => {
            const count = filter.id === 'all' ? scopedRecords.length
              : filter.id === 'drive' ? scopedRecords.filter(record => record.sourceType === 'drive').length
                : filter.id === 'manual' ? scopedRecords.filter(isManual).length
                  : scopedRecords.filter(record => record.sourceType === 'application' && !isManual(record)).length;
            return <button key={filter.id} type="button" className={sourceFilter === filter.id ? 'active' : ''} onClick={() => setSourceFilter(filter.id)} aria-pressed={sourceFilter === filter.id}>{filter.label}<span>{count}</span></button>;
          })}
        </nav>
        <div className="student-apps-filters">
          <label className="student-apps-search"><MagnifyingGlass size={18} /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search student, company, role, roll or TPO" /></label>
          <label><MapPinLine size={16} /><select value={branchFilter} onChange={event => setBranchFilter(event.target.value)}><option value="all">All branches</option>{branches.map(branch => <option key={branch} value={branch}>{branch}</option>)}</select></label>
          {!isCourseSpecific && <label><GraduationCap size={16} /><select value={courseFilter} onChange={event => setCourseFilter(event.target.value)}><option value="all">All courses</option>{['Industrial Automation', 'BMS AND CCTV', 'Embedded and IoT', 'Digital Marketing', 'Information technology (IT)'].map(course => <option key={course} value={course}>{course}</option>)}</select></label>}
          <label><CalendarBlank size={16} /><input type="month" aria-label="Filter by month" value={monthFilter} onChange={event => setMonthFilter(event.target.value)} /></label>
          <label><Funnel size={16} /><select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option value="all">All statuses</option>{statusOptions.map(status => <option key={status} value={status}>{status}</option>)}</select></label>
          {hasActiveFilters && <button type="button" className="student-apps-clear" onClick={resetFilters}>Clear</button>}
        </div>

        {driveLoadError && <div className="student-apps-inline-warning"><WarningCircle size={18} /> {driveLoadError}</div>}
        {loading ? <div className="student-apps-state"><CircleNotch size={31} className="student-apps-spin" /><strong>Loading student records</strong><span>Combining applications and drive registrations…</span></div>
          : loadError ? <div className="student-apps-state error"><WarningCircle size={29} /><strong>Records could not be loaded</strong><span>{loadError}</span><button type="button" onClick={() => void loadRecords()}>Try again</button></div>
            : !visibleRecords.length ? <div className="student-apps-state"><MagnifyingGlass size={29} /><strong>{candidateRecords.length ? 'No records match these filters' : 'No student records found'}</strong><span>{candidateRecords.length ? 'Clear a filter or choose another record type.' : 'Applications and drive registrations for your branches will appear here.'}</span>{hasActiveFilters && <button type="button" onClick={resetFilters}>Clear filters</button>}</div>
              : <>
                <div className="student-apps-list-head"><span>STUDENT</span><span>OPPORTUNITY</span><span>RECORD TYPE / DATE</span><span>STATUS</span><span>DETAILS</span></div>
                <div className="student-apps-record-list">{visibleRecords.map((record, index) => (
                  <motion.article key={record.recordKey || `${record.sourceType}-${index}`} className={`student-apps-record${record.isEmptyDrive ? ' empty-drive' : ''}`} initial={{ opacity: 0, y: 7 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .012, .16), duration: .18 }}>
                    <div className="student-apps-student"><span className={`student-apps-avatar ${record.sourceType}`}>{record.isEmptyDrive ? <CalendarBlank size={18} /> : getInitials(record.name)}</span><div><strong>{record.isEmptyDrive ? 'No registrations yet' : record.name || 'Unnamed student'}</strong><small>{record.isEmptyDrive ? 'Drive opening' : [record.roll || 'No roll number', record.branch || 'Branch unavailable', record.course].filter(Boolean).join(' · ')}</small></div></div>
                    <div className="student-apps-opportunity"><span>{record.sourceType === 'drive' ? 'PLACEMENT DRIVE' : isManual(record) ? 'MANUAL ADD' : 'JOB APPLICATION'}</span><strong>{record.company}</strong><small>{record.position}{record.jobId && !isManual(record) ? ` · ${record.jobId}` : ''}</small></div>
                    <div className="student-apps-source"><span className={`student-apps-source-pill ${record.sourceType}`}>{record.sourceType === 'drive' ? 'Drive registration' : isManual(record) ? 'Manual add' : 'Job application'}</span><small><CalendarBlank size={13} /> {displayDate(recordDate(record))}</small><small><Buildings size={13} /> {record.tpoName || record.driveTpo || 'Placement team'}</small></div>
                    <div className="student-apps-status">{record.isEmptyDrive ? <span className="student-apps-no-registration">Waiting for students</span> : <><StatusBadge status={record.status} />{record.remarks && <small title={record.remarks}>{record.remarks}</small>}</>}</div>
                    <div className="student-apps-detail-action">{record.isEmptyDrive ? <span>—</span> : <button type="button" onClick={() => setSelectedDetails(record)}>View details <span>→</span></button>}</div>
                  </motion.article>
                ))}</div>
              </>}
      </section>
    </main>

    {typeof document !== 'undefined' && createPortal(<AnimatePresence>
      {selectedDetails && <motion.div className="student-apps-modal-backdrop" role="presentation" onClick={event => { if (event.target === event.currentTarget) setSelectedDetails(null); }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <motion.section className="student-apps-modal" role="dialog" aria-modal="true" aria-labelledby="student-apps-modal-title" initial={{ opacity: 0, y: 14, scale: .985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .985 }}>
          <header><div><span>{selectedDetails.sourceType === 'drive' ? 'DRIVE REGISTRATION' : isManual(selectedDetails) ? 'MANUAL REFERRAL' : 'JOB APPLICATION'}</span><h2 id="student-apps-modal-title">{selectedDetails.name || 'Student'}</h2><p>{[selectedDetails.company, selectedDetails.position, selectedDetails.roll].filter(Boolean).join(' · ')}</p></div><button type="button" onClick={() => setSelectedDetails(null)} aria-label="Close details"><X size={19} /></button></header>
          <div className="student-apps-modal-status"><StatusBadge status={selectedDetails.status} /><span>{selectedDetails.tpoName || selectedDetails.driveTpo || 'Placement team'}</span></div>
          {isInterview(selectedDetails.status) && <div className="student-apps-interview-grid"><div><small>INTERVIEW DATE</small><strong>{displayDate(selectedDetails.interviewDate)}</strong></div><div><small>TIME</small><strong>{formatPortalTime(selectedDetails.interviewTime, 'Not recorded')}</strong></div><div className="wide"><small>LOCATION / LINK</small><strong>{selectedDetails.interviewVenue || 'Not recorded'}</strong></div></div>}
          <section className="student-apps-modal-remarks"><h3>Latest remarks</h3><p>{selectedDetails.remarks || 'No remarks have been added.'}</p></section>
          <section className="student-apps-history"><h3>Status history <span>{(selectedDetails.statusHistory || []).length}</span></h3>
            {(selectedDetails.statusHistory || []).length ? <ol>{[...selectedDetails.statusHistory].reverse().map((entry, index) => <li key={`${entry.changedAt || 'history'}-${index}`}><i /><div><div className="student-apps-history-top"><strong>{entry.status || 'Record updated'}</strong><time>{formatPortalDateTime(entry.changedAt, '')}</time></div><small>{entry.event || 'Status update'}{entry.changedBy ? ` · ${entry.changedBy}` : ''}</small>{entry.interviewDate || entry.interviewTime || entry.interviewVenue ? <small>{[entry.interviewDate ? displayDate(entry.interviewDate) : '', entry.interviewTime ? formatPortalTime(entry.interviewTime, '') : '', entry.interviewVenue].filter(Boolean).join(' · ')}</small> : null}{entry.remarks && <p>{entry.remarks}</p>}</div></li>)}</ol> : <p>No saved status changes are available yet.</p>}
          </section>
        </motion.section>
      </motion.div>}
    </AnimatePresence>, document.body)}
  </Layout>;
}
