import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import axios from 'axios';
import {
  ArrowsClockwise, Briefcase, Buildings, CalendarBlank, CaretLeft, ChartLineUp,
  CheckCircle, CircleNotch, Clock, Files, Funnel, GraduationCap, MapPinLine,
  MagnifyingGlass, WarningCircle
} from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import { API_BASE } from '../../services/apiConfig';
import StatusBadge from '../../components/StatusBadge';

const normalizeStatus = value => String(value || 'Applied').trim() || 'Applied';
const getStatusCategory = value => {
  const status = normalizeStatus(value).toLowerCase();
  if (status.includes('company') && status.includes('reject')) return 'Company Rejected';
  if ((status.includes('student') && status.includes('reject')) || status.includes('offer rejected')) return 'Student Rejected';
  if (status.includes('reject')) return 'Rejected';
  return normalizeStatus(value);
};

const getStandardCourse = value => {
  const course = String(value || '').toLowerCase().trim();
  if (!course) return 'Others';
  if (course.includes('bms') || course.includes('cctv')) return 'BMS AND CCTV';
  if (course.includes('automation') || course.includes('plc') || course.includes('scada')) return 'Industrial Automation';
  if (course.includes('embed') || course.includes('iot')) return 'Embedded and IoT';
  if (course.includes('digital') || course.includes('dm') || course.includes('marketing')) return 'Digital Marketing';
  if (course.includes('it') || course.includes('python') || course.includes('software') || course.includes('data')) return 'Information technology (IT)';
  return 'Others';
};

const parseDate = value => {
  if (!value) return null;
  const text = String(value).split(' ')[0].replace(/,/g, '');
  const dayFirst = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dayFirst) return new Date(Number(dayFirst[3]), Number(dayFirst[2]) - 1, Number(dayFirst[1]));
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = value => {
  const date = parseDate(value);
  return date ? date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Date unavailable';
};

const getInitials = value => String(value || 'Student').trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase();

const STATUS_ORDER = ['Applied', 'Shortlisted', 'Interview Scheduled', 'Interview Attended', 'Interview Not Attended', 'Student Rejected', 'Company Rejected', 'Rejected', 'Offer Received', 'Placed'];
const STATUS_META = {
  Applied: { color: '#38bdf8', icon: Files, caption: 'Applications received' },
  Shortlisted: { color: '#a78bfa', icon: CheckCircle, caption: 'Candidates shortlisted' },
  'Interview Scheduled': { color: '#fbbf24', icon: CalendarBlank, caption: 'Interviews scheduled' },
  'Interview Attended': { color: '#34d399', icon: CheckCircle, caption: 'Interviews attended' },
  'Interview Not Attended': { color: '#fb923c', icon: Clock, caption: 'Missed interviews' },
  'Student Rejected': { color: '#fb7185', icon: WarningCircle, caption: 'Declined by student' },
  'Company Rejected': { color: '#f87171', icon: WarningCircle, caption: 'Declined by company' },
  Rejected: { color: '#f87171', icon: WarningCircle, caption: 'Rejected applications' },
  'Offer Received': { color: '#c084fc', icon: CheckCircle, caption: 'Offers received' },
  Placed: { color: '#2dd4bf', icon: GraduationCap, caption: 'Successful placements' }
};

export default function StudentApps() {
  const tpoData = useMemo(() => {
    try { return JSON.parse(localStorage.getItem('tpoData') || 'null'); }
    catch { return null; }
  }, []);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedBranch, setSelectedBranch] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const upperRole = String(tpoData?.role || '').toUpperCase();
  const accessType = String(tpoData?.accessType || '').toLowerCase();
  const isSuperAdmin = accessType === 'superadmin' || upperRole.includes('ADMIN') || upperRole.includes('HEAD') || upperRole.includes('MANAGER');
  const isCourseSpecific = upperRole.includes('RTH') || upperRole.includes('TTH') || upperRole.includes('TRAINER') || upperRole.includes('TECHNICAL LEAD');
  const displayCourse = tpoData?.assignedCourse || '';
  const allowedBranches = useMemo(() => Array.isArray(tpoData?.assignedBranchesArray)
    ? tpoData.assignedBranchesArray.map(branch => String(branch).trim().toLowerCase())
    : String(tpoData?.assignedBranchesArray || '').split(/[\n,;]+/).map(branch => branch.trim().toLowerCase()).filter(Boolean), [tpoData]);

  useEffect(() => {
    let active = true;
    const fetchApplications = async () => {
      if (!tpoData) {
        setLoadError('Your staff profile is not available. Sign in again and retry.');
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setLoadError('');
        const response = await axios.post(`${API_BASE}/api/tpo/applications`, {
          assignedBranchesArray: tpoData.assignedBranchesArray,
          tpoName: tpoData.name,
          role: tpoData.role,
          assignedCourse: tpoData.assignedCourse
        });
        if (!response.data?.success) throw new Error(response.data?.message || 'Could not load applications.');
        if (active) setApplications(Array.isArray(response.data.applications) ? response.data.applications : []);
      } catch (error) {
        if (active) setLoadError(error.response?.data?.message || error.message || 'Could not load student applications.');
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchApplications();
    return () => { active = false; };
  }, [tpoData]);

  const resetFilters = () => {
    setSearchQuery('');
    setMonthFilter('');
    setCourseFilter('All');
    setStatusFilter('All');
  };

  const globallyFiltered = useMemo(() => applications.filter(application => {
    if (!isSuperAdmin) {
      const branch = String(application.branch || '').toLowerCase();
      const hasBranchAccess = allowedBranches.includes('all') || allowedBranches.includes('all branches') || allowedBranches.some(assigned => branch.includes(assigned));
      if (!hasBranchAccess) return false;
    }
    if (isCourseSpecific && getStandardCourse(application.course) !== getStandardCourse(displayCourse)) return false;
    const date = parseDate(application.date);
    const monthKey = date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : '';
    const matchesMonth = !monthFilter || monthKey === monthFilter;
    const matchesCourse = courseFilter === 'All' || getStandardCourse(application.course) === getStandardCourse(courseFilter);
    return matchesMonth && matchesCourse;
  }), [applications, isSuperAdmin, allowedBranches, isCourseSpecific, displayCourse, monthFilter, courseFilter]);

  const branchData = useMemo(() => {
    const data = new Map();
    globallyFiltered.forEach(application => {
      const branch = application.branch || 'Unknown';
      const current = data.get(branch) || { total: 0, rejected: 0 };
      current.total += 1;
      if (['Student Rejected', 'Company Rejected', 'Rejected'].includes(getStatusCategory(application.status))) current.rejected += 1;
      data.set(branch, current);
    });
    return data;
  }, [globallyFiltered]);
  const branchList = [...branchData.keys()].sort((left, right) => left.localeCompare(right));
  const visibleBranches = branchList.filter(branch => !selectedBranch && (!searchQuery || branch.toLowerCase().includes(searchQuery.toLowerCase())));
  const activeApps = selectedBranch ? globallyFiltered.filter(application => application.branch === selectedBranch) : [];
  const statusCounts = activeApps.reduce((counts, application) => {
    const category = getStatusCategory(application.status);
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {});
  const statusOptions = [...new Set([...STATUS_ORDER, ...Object.keys(statusCounts)])]
    .filter(status => STATUS_ORDER.includes(status) || statusCounts[status] > 0)
    .sort((left, right) => STATUS_ORDER.indexOf(left) - STATUS_ORDER.indexOf(right) || left.localeCompare(right));

  const filteredApps = activeApps.filter(application => {
    const matchesStatus = statusFilter === 'All' || getStatusCategory(application.status) === statusFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query || [application.name, application.company, application.position, application.roll, application.jobId, application.tpoName]
      .some(value => String(value || '').toLowerCase().includes(query));
    return matchesStatus && matchesSearch;
  });
  const filterIsActive = Boolean(searchQuery || monthFilter || courseFilter !== 'All' || statusFilter !== 'All');

  return (
    <Layout>
      <main className="apps-page">
        <motion.section className="apps-hero" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35, ease: 'easeOut' }}>
          <div className="apps-hero-glow apps-hero-glow-one" /><div className="apps-hero-glow apps-hero-glow-two" />
          <div className="apps-hero-content">
            <div className="apps-eyebrow"><span className="apps-live-dot" /> PLACEMENT INTELLIGENCE <span className="apps-eyebrow-divider" /> LIVE REGISTER</div>
            <div className="apps-hero-heading-row">
              <div>
                <h1>{selectedBranch ? <><span>{selectedBranch}</span><br />applications</> : <>Student <span>applications</span></>}</h1>
                <p>{selectedBranch ? `Explore every student application and its latest hiring stage at ${selectedBranch}.` : 'One clear view of student applications, hiring progress, and outcomes across your branches.'}</p>
              </div>
              <div className="apps-hero-mark"><GraduationCap size={34} weight="duotone" /><span>IPCS<br />PLACEMENTS</span></div>
            </div>
            <div className="apps-hero-metrics">
              <div><span>Applications</span><strong>{globallyFiltered.length}</strong><small>in current view</small></div>
              <div><span>Branches</span><strong>{branchList.length}</strong><small>with applications</small></div>
              <div className="apps-rejected-metric"><span>Student rejected</span><strong>{globallyFiltered.filter(application => getStatusCategory(application.status) === 'Student Rejected').length}</strong><small>visible in status filters</small></div>
            </div>
          </div>
          <div className="apps-hero-art" aria-hidden="true"><div className="apps-art-orbit apps-orbit-one" /><div className="apps-art-orbit apps-orbit-two" /><div className="apps-art-core"><ChartLineUp size={45} weight="duotone" /></div><span className="apps-art-dot dot-one" /><span className="apps-art-dot dot-two" /><span className="apps-art-dot dot-three" /></div>
        </motion.section>

        <motion.section className="apps-filter-panel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08, duration: 0.3 }} aria-label="Filter applications">
          <div className="apps-search-wrap"><MagnifyingGlass size={19} /><input value={searchQuery} onChange={event => setSearchQuery(event.target.value)} placeholder={selectedBranch ? 'Search students, company, role, roll or job ID' : 'Search a branch'} /></div>
          {!isCourseSpecific && <label className="apps-select-wrap"><GraduationCap size={17} /><select value={courseFilter} onChange={event => setCourseFilter(event.target.value)}><option value="All">All courses</option><option value="Industrial Automation">Industrial Automation</option><option value="BMS AND CCTV">BMS and CCTV</option><option value="Embedded and IoT">Embedded and IoT</option><option value="Digital Marketing">Digital Marketing</option><option value="Information technology (IT)">Information technology (IT)</option></select></label>}
          <label className="apps-select-wrap"><CalendarBlank size={17} /><input type="month" aria-label="Filter by month" value={monthFilter} onChange={event => setMonthFilter(event.target.value)} /></label>
          {filterIsActive && <button type="button" className="apps-reset-button" onClick={resetFilters}><ArrowsClockwise size={16} /> Reset filters</button>}
        </motion.section>

        <AnimatePresence mode="wait" initial={false}>
          {loading ? (
            <motion.div key="loading" className="apps-state-card" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><CircleNotch size={34} className="ph-spin" /><strong>Gathering application records</strong><span>Preparing your branch overview…</span></motion.div>
          ) : loadError ? (
            <motion.div key="error" className="apps-state-card apps-state-error" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}><WarningCircle size={34} /><strong>Applications could not be loaded</strong><span>{loadError}</span><button type="button" onClick={() => window.location.reload()}><ArrowsClockwise size={16} /> Try again</button></motion.div>
          ) : selectedBranch ? (
            <motion.section key={`branch-${selectedBranch}`} className="apps-results-section" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.24 }}>
              <div className="apps-section-heading">
                <div><button type="button" className="apps-back-button" onClick={() => { setSelectedBranch(null); setStatusFilter('All'); setSearchQuery(''); }}><CaretLeft size={17} weight="bold" /> Branches</button><div className="apps-section-title"><span className="apps-section-kicker">BRANCH REGISTER</span><h2>{selectedBranch} <span>{activeApps.length} applications</span></h2></div></div>
                <div className="apps-branch-chip"><MapPinLine size={17} /> {selectedBranch}</div>
              </div>

              <div className="apps-status-section">
                <div className="apps-subheading"><div><span>HIRING PIPELINE</span><h3>Applications by status</h3></div><p>Choose a stage to narrow the list.</p></div>
                <div className="apps-status-grid">
                  <button type="button" className={`apps-status-card apps-status-all${statusFilter === 'All' ? ' active' : ''}`} onClick={() => setStatusFilter('All')} aria-pressed={statusFilter === 'All'}><span className="apps-status-icon"><Funnel size={19} /></span><span className="apps-status-label">All statuses</span><strong>{activeApps.length}</strong><small>Complete branch view</small></button>
                  {statusOptions.map((status, index) => {
                    const meta = STATUS_META[status] || { color: '#94a3b8', icon: Files, caption: 'Applications in this stage' };
                    const Icon = meta.icon;
                    return <motion.button key={status} type="button" className={`apps-status-card${statusFilter === status ? ' active' : ''}`} style={{ '--status-color': meta.color }} onClick={() => setStatusFilter(status)} aria-pressed={statusFilter === status} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.035, 0.25), duration: 0.22 }}><span className="apps-status-icon"><Icon size={19} weight="duotone" /></span><span className="apps-status-label">{status}</span><strong>{statusCounts[status] || 0}</strong><small>{meta.caption}</small></motion.button>;
                  })}
                </div>
              </div>

              <div className="apps-list-heading"><div><span>APPLICATION RECORDS</span><h3>{statusFilter === 'All' ? 'All students' : statusFilter} <small>{filteredApps.length} shown</small></h3></div><div className="apps-list-count"><Files size={16} /> {filteredApps.length} records</div></div>
              <div className="apps-student-list">
                {filteredApps.length === 0 ? <div className="apps-empty-state"><div><MagnifyingGlass size={25} /></div><strong>No applications in this view</strong><span>Try a different status or clear your search.</span></div> : filteredApps.map((application, index) => (
                  <motion.article key={application.rowNumber || `${application.roll}-${index}`} className="apps-student-card" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.025, 0.3), duration: 0.24 }} whileHover={{ y: -2, transition: { duration: 0.16 } }}>
                    <div className="apps-student-identity"><div className="apps-student-avatar">{getInitials(application.name)}</div><div><h4>{application.name || 'Unnamed student'}</h4><p>{application.roll || 'No roll number'} <span>·</span> {application.course || 'Course unavailable'}</p></div></div>
                    <div className="apps-job-info"><span><Briefcase size={15} /> ROLE &amp; COMPANY</span><strong>{application.position || 'Position unavailable'}</strong><small>{application.company || 'Company unavailable'} {application.jobId ? <em>· {application.jobId}</em> : null}</small></div>
                    <div className="apps-record-meta"><span><CalendarBlank size={15} /> APPLIED</span><strong>{formatDate(application.date)}</strong><small><Buildings size={14} /> {application.tpoName || 'Placement team'}</small></div>
                    <div className="apps-record-status"><StatusBadge status={application.status || 'Applied'} />{application.remarks && <span className="apps-remarks" title={application.remarks}>{application.remarks}</span>}</div>
                  </motion.article>
                ))}
              </div>
            </motion.section>
          ) : (
            <motion.section key="branch-overview" className="apps-results-section" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.24 }}>
              <div className="apps-section-heading"><div><span className="apps-section-kicker">YOUR COVERAGE</span><h2>Branch overview <span>{visibleBranches.length} branches</span></h2></div><div className="apps-branch-chip"><Buildings size={17} /> {globallyFiltered.length} applications</div></div>
              {visibleBranches.length === 0 ? <div className="apps-empty-state apps-empty-branches"><div><MagnifyingGlass size={25} /></div><strong>{branchList.length ? 'No matching branches' : 'No applications found'}</strong><span>{branchList.length ? 'Change your search to find a branch.' : 'Try a different course or month filter.'}</span></div> : (
                <div className="apps-branch-grid">
                  {visibleBranches.map((branch, index) => {
                    const data = branchData.get(branch);
                    return <motion.button type="button" key={branch} className="apps-branch-card" onClick={() => { setSelectedBranch(branch); setStatusFilter('All'); setSearchQuery(''); }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.045, 0.3), duration: 0.28 }} whileHover={{ y: -4, transition: { duration: 0.18 } }}>
                      <span className="apps-branch-card-top"><span className="apps-branch-icon"><MapPinLine size={21} weight="duotone" /></span><span className="apps-branch-arrow">↗</span></span>
                      <span className="apps-branch-name">{branch}</span><span className="apps-branch-caption">Placement applications</span>
                      <span className="apps-branch-card-bottom"><strong>{data.total}<small>applications</small></strong><span className="apps-branch-rejected"><WarningCircle size={15} /> {data.rejected} rejected</span></span>
                      <span className="apps-branch-progress"><i style={{ width: `${Math.max(8, Math.min(100, data.total / Math.max(1, globallyFiltered.length) * 100))}%` }} /></span>
                    </motion.button>;
                  })}
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      <style>{`
        .apps-page{max-width:1440px;margin:0 auto;padding:0 0 46px;color:var(--text-main);--apps-border:rgba(148,163,184,.16);--apps-muted:#94a3b8}
        .apps-hero{position:relative;isolation:isolate;min-height:300px;overflow:hidden;border:1px solid rgba(125,211,252,.16);border-radius:28px;padding:clamp(24px,4vw,42px);background:radial-gradient(ellipse at 12% 0%,rgba(14,165,233,.22),transparent 42%),radial-gradient(ellipse at 90% 100%,rgba(124,58,237,.22),transparent 45%),linear-gradient(125deg,#0d182a 0%,#111b30 54%,#111426 100%);box-shadow:0 24px 65px rgba(2,8,23,.32)}
        .apps-hero-glow{position:absolute;z-index:-1;width:240px;height:240px;border-radius:50%;filter:blur(70px);opacity:.18;pointer-events:none}.apps-hero-glow-one{right:21%;top:-155px;background:#22d3ee}.apps-hero-glow-two{right:-90px;bottom:-170px;background:#8b5cf6}
        .apps-hero-content{position:relative;z-index:1;max-width:790px}.apps-eyebrow{display:flex;align-items:center;gap:9px;color:#91a9c7;font-size:.68rem;font-weight:850;letter-spacing:.17em}.apps-live-dot{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 12px #34d399;animation:appsPulse 1.9s infinite}.apps-eyebrow-divider{height:14px;width:1px;margin:0 3px;background:rgba(148,163,184,.3)}
        .apps-hero-heading-row{display:flex;justify-content:space-between;align-items:center;gap:25px;margin-top:18px}.apps-hero h1{margin:0;color:#f8fafc;font-size:clamp(2.25rem,5vw,3.75rem);line-height:.99;letter-spacing:-.065em;font-weight:820}.apps-hero h1 span{color:transparent;background:linear-gradient(90deg,#67e8f9,#a5b4fc 56%,#c4b5fd);background-clip:text;-webkit-background-clip:text}.apps-hero p{max-width:580px;margin:14px 0 0;color:#a6b5ca;font-size:.96rem;line-height:1.65}.apps-hero-mark{display:flex;align-items:center;gap:9px;padding:12px 14px;border:1px solid rgba(125,211,252,.2);border-radius:16px;background:rgba(15,23,42,.44);color:#7dd3fc;font-size:.56rem;font-weight:900;letter-spacing:.13em;line-height:1.45}.apps-hero-mark svg{width:33px;height:33px}
        .apps-hero-metrics{display:flex;flex-wrap:wrap;gap:10px;margin-top:26px}.apps-hero-metrics>div{min-width:142px;padding:10px 14px;border:1px solid rgba(148,163,184,.13);border-radius:14px;background:rgba(15,23,42,.45);backdrop-filter:blur(10px)}.apps-hero-metrics span,.apps-hero-metrics small{display:block;color:#91a3bd;font-size:.67rem}.apps-hero-metrics strong{display:inline-block;margin:2px 7px 0 0;color:#f8fafc;font-size:1.25rem;letter-spacing:-.035em}.apps-hero-metrics small{display:inline-block}.apps-rejected-metric{border-color:rgba(251,113,133,.24)!important}.apps-rejected-metric strong{color:#fda4af}
        .apps-hero-art{position:absolute;right:7%;top:50%;width:195px;height:195px;transform:translateY(-50%);display:grid;place-items:center;opacity:.8}.apps-art-orbit{position:absolute;inset:14px;border:1px solid rgba(103,232,249,.2);border-radius:50%;transform:rotate(-22deg) scaleY(.58)}.apps-orbit-two{inset:0;border-color:rgba(196,181,253,.18);transform:rotate(40deg) scaleY(.58)}.apps-art-core{width:86px;height:86px;display:grid;place-items:center;border:1px solid rgba(125,211,252,.3);border-radius:28px;background:linear-gradient(145deg,rgba(14,165,233,.23),rgba(129,140,248,.1));color:#a5f3fc;box-shadow:0 0 55px rgba(34,211,238,.12);transform:rotate(-8deg)}.apps-art-dot{position:absolute;width:10px;height:10px;border:2px solid #0e1728;border-radius:50%;background:#67e8f9;box-shadow:0 0 17px #67e8f9}.dot-one{top:17px;left:72px}.dot-two{right:9px;bottom:63px;background:#c4b5fd;box-shadow:0 0 17px #c4b5fd}.dot-three{left:19px;bottom:44px;width:7px;height:7px;background:#34d399;box-shadow:0 0 14px #34d399}
        .apps-filter-panel{position:relative;z-index:2;display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:-20px 18px 30px;padding:12px;border:1px solid var(--apps-border);border-radius:19px;background:color-mix(in srgb,var(--card-bg) 90%,#0f172a);box-shadow:0 15px 35px rgba(2,8,23,.24);backdrop-filter:blur(18px)}.apps-search-wrap,.apps-select-wrap{height:46px;display:flex;align-items:center;gap:10px;padding:0 13px;border:1px solid var(--apps-border);border-radius:13px;background:rgba(2,8,23,.24);color:#7b91ac}.apps-search-wrap{flex:1 1 270px}.apps-search-wrap input,.apps-select-wrap select,.apps-select-wrap input{width:100%;min-width:0;border:0;outline:0;background:transparent;color:var(--text-main);font:inherit;font-size:.82rem}.apps-search-wrap input::placeholder{color:#73839b}.apps-select-wrap{flex:0 1 210px}.apps-select-wrap select{cursor:pointer}.apps-select-wrap option{background:#101827;color:#e2e8f0}.apps-select-wrap input[type=month]{color-scheme:dark}.apps-reset-button{height:42px;display:flex;align-items:center;gap:7px;padding:0 12px;border:1px solid rgba(125,211,252,.2);border-radius:12px;background:rgba(14,165,233,.08);color:#7dd3fc;font-size:.77rem;font-weight:800;cursor:pointer;transition:background .2s}.apps-reset-button:hover{background:rgba(14,165,233,.17)}
        .apps-results-section{min-height:180px}.apps-section-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:0 2px 18px}.apps-section-heading h2{margin:6px 0 0;font-size:1.6rem;letter-spacing:-.045em}.apps-section-heading h2 span{margin-left:8px;color:var(--apps-muted);font-size:.8rem;font-weight:600;letter-spacing:0}.apps-section-kicker,.apps-list-heading>div>span,.apps-subheading>div>span{color:#7791ae;font-size:.65rem;font-weight:850;letter-spacing:.16em}.apps-branch-chip{display:flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid var(--apps-border);border-radius:12px;background:var(--card-bg);color:#9fb1c8;font-size:.78rem}.apps-back-button{display:inline-flex;align-items:center;gap:4px;margin-bottom:13px;padding:7px 10px;border:1px solid var(--apps-border);border-radius:10px;background:var(--card-bg);color:#b6c5d8;font-size:.75rem;font-weight:750;cursor:pointer;transition:all .18s}.apps-back-button:hover{border-color:rgba(125,211,252,.4);color:#7dd3fc;transform:translateX(-2px)}
        .apps-status-section{margin:24px 0 28px}.apps-subheading,.apps-list-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin:0 2px 12px}.apps-subheading h3,.apps-list-heading h3{margin:4px 0 0;font-size:1.05rem;letter-spacing:-.025em}.apps-subheading p{margin:0;color:var(--apps-muted);font-size:.75rem}.apps-status-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px}.apps-status-card{position:relative;min-height:145px;overflow:hidden;display:grid;grid-template-columns:1fr auto;grid-template-rows:auto auto 1fr;align-items:start;gap:5px 8px;padding:15px;border:1px solid var(--apps-border);border-radius:17px;background:linear-gradient(145deg,rgba(30,41,59,.72),rgba(15,23,42,.68));color:var(--text-main);text-align:left;cursor:pointer;transition:transform .2s,border-color .2s,background .2s,box-shadow .2s}.apps-status-card::after{content:'';position:absolute;right:-30px;top:-36px;width:100px;height:100px;border-radius:50%;background:var(--status-color,#7dd3fc);opacity:.055;filter:blur(2px);transition:transform .25s,opacity .25s}.apps-status-card:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--status-color,#7dd3fc) 45%,transparent);box-shadow:0 12px 26px rgba(2,8,23,.2)}.apps-status-card.active{border-color:color-mix(in srgb,var(--status-color,#7dd3fc) 72%,transparent);background:linear-gradient(145deg,color-mix(in srgb,var(--status-color,#7dd3fc) 12%,#101827),rgba(15,23,42,.92));box-shadow:0 0 0 1px color-mix(in srgb,var(--status-color,#7dd3fc) 19%,transparent),0 12px 26px rgba(2,8,23,.2)}.apps-status-icon{grid-column:1;grid-row:1;width:34px;height:34px;display:grid;place-items:center;border:1px solid color-mix(in srgb,var(--status-color,#7dd3fc) 24%,transparent);border-radius:11px;background:color-mix(in srgb,var(--status-color,#7dd3fc) 10%,transparent);color:var(--status-color,#7dd3fc)}.apps-status-label{grid-column:1/-1;grid-row:2;overflow:hidden;color:#b7c5d8;font-size:.73rem;font-weight:750;text-overflow:ellipsis;white-space:nowrap}.apps-status-card strong{grid-column:2;grid-row:1;color:#f8fafc;font-size:1.55rem;letter-spacing:-.06em}.apps-status-card small{grid-column:1/-1;grid-row:3;align-self:end;color:#71839e;font-size:.66rem}.apps-status-all{--status-color:#7dd3fc}.apps-status-all .apps-status-icon{grid-column:1;grid-row:1}.apps-status-all .apps-status-label{grid-row:2}
        .apps-list-heading{margin-top:29px}.apps-list-heading h3 small{margin-left:6px;color:#8295ad;font-size:.72rem;font-weight:600}.apps-list-count{display:flex;align-items:center;gap:7px;color:#8ca0b8;font-size:.75rem}.apps-student-list{display:grid;gap:9px}.apps-student-card{display:grid;grid-template-columns:minmax(220px,1.15fr) minmax(180px,1fr) minmax(150px,.7fr) minmax(130px,.55fr);align-items:center;gap:18px;padding:15px 17px;border:1px solid var(--apps-border);border-radius:17px;background:linear-gradient(110deg,rgba(20,31,50,.92),rgba(13,21,36,.86));box-shadow:0 8px 22px rgba(2,8,23,.11);transition:border-color .18s,background .18s}.apps-student-card:hover{border-color:rgba(125,211,252,.27);background:linear-gradient(110deg,rgba(24,40,63,.96),rgba(16,25,43,.92))}.apps-student-identity{display:flex;align-items:center;gap:12px;min-width:0}.apps-student-avatar{width:43px;height:43px;flex:0 0 43px;display:grid;place-items:center;border:1px solid rgba(125,211,252,.23);border-radius:15px;background:linear-gradient(145deg,rgba(14,165,233,.2),rgba(129,140,248,.18));color:#b9f3ff;font-size:.78rem;font-weight:850}.apps-student-identity h4{overflow:hidden;margin:0;color:#f1f5f9;font-size:.9rem;text-overflow:ellipsis;white-space:nowrap}.apps-student-identity p{overflow:hidden;margin:4px 0 0;color:#7f92aa;font-size:.7rem;text-overflow:ellipsis;white-space:nowrap}.apps-student-identity p span{padding:0 3px;color:#52657e}.apps-job-info,.apps-record-meta{min-width:0}.apps-job-info>span,.apps-record-meta>span{display:flex;align-items:center;gap:6px;margin-bottom:6px;color:#6e829c;font-size:.6rem;font-weight:850;letter-spacing:.1em}.apps-job-info strong,.apps-record-meta strong{display:block;overflow:hidden;color:#dce7f4;font-size:.78rem;text-overflow:ellipsis;white-space:nowrap}.apps-job-info small,.apps-record-meta small{display:flex;align-items:center;gap:5px;overflow:hidden;margin-top:4px;color:#8294ac;font-size:.69rem;text-overflow:ellipsis;white-space:nowrap}.apps-job-info em{overflow:hidden;color:#657b97;font-style:normal;text-overflow:ellipsis}.apps-record-status{display:flex;flex-direction:column;align-items:flex-start;gap:8px}.apps-remarks{max-width:160px;overflow:hidden;color:#72849a;font-size:.65rem;text-overflow:ellipsis;white-space:nowrap}.apps-empty-state{min-height:215px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;border:1px dashed rgba(148,163,184,.2);border-radius:20px;background:rgba(15,23,42,.32);text-align:center}.apps-empty-state>div{width:48px;height:48px;display:grid;place-items:center;border:1px solid rgba(125,211,252,.18);border-radius:16px;background:rgba(14,165,233,.08);color:#7dd3fc}.apps-empty-state strong{margin-top:3px;color:#d9e4f2;font-size:.92rem}.apps-empty-state span{color:#7f91a9;font-size:.76rem}.apps-empty-branches{margin-top:14px}
        .apps-branch-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(245px,1fr));gap:13px}.apps-branch-card{position:relative;overflow:hidden;display:flex;flex-direction:column;align-items:stretch;min-height:214px;padding:18px;border:1px solid var(--apps-border);border-radius:20px;background:radial-gradient(circle at 100% 0%,rgba(56,189,248,.09),transparent 39%),linear-gradient(150deg,rgba(22,34,54,.94),rgba(13,20,34,.94));color:var(--text-main);text-align:left;cursor:pointer;box-shadow:0 10px 28px rgba(2,8,23,.14);transition:border-color .2s,box-shadow .2s}.apps-branch-card:hover{border-color:rgba(125,211,252,.32);box-shadow:0 17px 36px rgba(2,8,23,.26)}.apps-branch-card-top{display:flex;justify-content:space-between;align-items:center}.apps-branch-icon{width:43px;height:43px;display:grid;place-items:center;border:1px solid rgba(125,211,252,.22);border-radius:15px;background:rgba(14,165,233,.1);color:#7dd3fc}.apps-branch-arrow{color:#7087a4;font-size:1.15rem;transition:transform .2s}.apps-branch-card:hover .apps-branch-arrow{transform:translate(2px,-2px);color:#7dd3fc}.apps-branch-name{margin-top:18px;color:#f0f6ff;font-size:1.12rem;font-weight:820;letter-spacing:-.035em}.apps-branch-caption{margin-top:3px;color:#7f92aa;font-size:.7rem}.apps-branch-card-bottom{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;margin-top:auto;padding-top:17px}.apps-branch-card-bottom>strong{color:#e7f2ff;font-size:1.55rem;line-height:1}.apps-branch-card-bottom>strong small{display:block;margin-top:4px;color:#71839d;font-size:.63rem;font-weight:600}.apps-branch-rejected{display:flex;align-items:center;gap:5px;color:#fa9aa7;font-size:.67rem}.apps-branch-progress{height:3px;overflow:hidden;margin-top:14px;border-radius:10px;background:rgba(148,163,184,.1)}.apps-branch-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#22d3ee,#818cf8);box-shadow:0 0 10px rgba(34,211,238,.5)}
        .apps-state-card{min-height:250px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;border:1px solid var(--apps-border);border-radius:22px;background:var(--card-bg);color:#7dd3fc;text-align:center}.apps-state-card strong{color:#e2e8f0;font-size:.95rem}.apps-state-card>span{max-width:480px;color:#8395ac;font-size:.77rem}.apps-state-card button{display:inline-flex;align-items:center;gap:7px;margin-top:7px;padding:9px 12px;border:1px solid rgba(125,211,252,.23);border-radius:11px;background:rgba(14,165,233,.09);color:#7dd3fc;font-weight:750;cursor:pointer}.apps-state-error{color:#fb7185}
        @keyframes appsPulse{0%,100%{opacity:1;box-shadow:0 0 12px #34d399}50%{opacity:.48;box-shadow:0 0 3px #34d399}}
        @media(max-width:1050px){.apps-hero-art{right:4%;opacity:.4}.apps-hero-content{max-width:75%}.apps-student-card{grid-template-columns:minmax(190px,1.1fr) minmax(170px,1fr) minmax(140px,.7fr)}.apps-record-status{grid-column:2/-1;flex-direction:row;align-items:center}}
        @media(max-width:720px){.apps-page{padding-bottom:28px}.apps-hero{min-height:0;border-radius:22px;padding:25px 20px 23px}.apps-hero-content{max-width:100%}.apps-hero-art,.apps-hero-mark{display:none}.apps-hero h1{font-size:2.65rem}.apps-hero p{font-size:.84rem}.apps-hero-metrics{gap:7px;margin-top:20px}.apps-hero-metrics>div{min-width:calc(33.333% - 6px);flex:1;padding:9px}.apps-hero-metrics span{font-size:.59rem}.apps-hero-metrics small{display:none}.apps-filter-panel{margin:-13px 8px 23px;padding:9px}.apps-search-wrap{flex-basis:100%}.apps-select-wrap{flex:1 1 145px}.apps-reset-button{flex:1;justify-content:center}.apps-section-heading{align-items:flex-start;flex-direction:column}.apps-section-heading h2{font-size:1.35rem}.apps-branch-chip{display:none}.apps-subheading,.apps-list-heading{align-items:flex-start;flex-direction:column}.apps-subheading p{margin-top:0}.apps-status-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.apps-status-card{min-height:130px;padding:12px}.apps-student-card{grid-template-columns:1fr auto;gap:12px;padding:14px}.apps-student-identity{grid-column:1/-1}.apps-job-info{grid-column:1/-1}.apps-record-meta{grid-column:1}.apps-record-status{grid-column:2;grid-row:3;align-items:flex-end;flex-direction:column}.apps-remarks{max-width:120px}.apps-branch-grid{grid-template-columns:repeat(auto-fill,minmax(215px,1fr));gap:10px}}
        @media(max-width:420px){.apps-hero h1{font-size:2.25rem}.apps-hero-metrics>div{min-width:calc(50% - 5px)}.apps-status-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.apps-branch-grid{grid-template-columns:1fr}.apps-branch-card{min-height:195px}}
        @media(prefers-reduced-motion:reduce){.apps-live-dot{animation:none}.apps-back-button,.apps-reset-button,.apps-status-card,.apps-branch-card,.apps-student-card{transition:none}}
      `}</style>
    </Layout>
  );
}
