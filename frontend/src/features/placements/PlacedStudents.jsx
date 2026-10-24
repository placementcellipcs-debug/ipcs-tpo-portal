import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import axios from 'axios';
import { 
  CircleNotch, Plus, PencilSimple, X, FloppyDisk, 
  CaretLeft, ArrowsClockwise, FilePdf
} from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import DateInput from '../../components/DateInput';
import DataSourceStatus from '../../components/DataSourceStatus';
import { formatPortalDate, getTodayPortalDateInput, parsePortalDateTime } from '../../utils/dateFormat';
import { API_BASE } from '../../services/apiConfig';
import StatusBadge from '../../components/StatusBadge';
import { normalizePlacementText } from '../../utils/placementRecords';

const TILE_COLORS = ['#3b82f6', 'var(--accent-primary)', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#0ea5e9', '#f43f5e'];

const readTpoData = () => {
  try { return JSON.parse(localStorage.getItem('tpoData') || 'null'); }
  catch { return null; }
};

const getStandardCourse = (c) => {
  if (!c) return 'Others';
  const lower = c.toLowerCase().trim();
  if (lower.includes('bms') || lower.includes('cctv')) return 'BMS AND CCTV';
  if (lower.includes('automation') || lower.includes('plc') || lower.includes('scada')) return 'Industrial Automation';
  if (lower.includes('embed') || lower.includes('iot')) return 'Embedded and IoT';
  if (lower.includes('digital') || lower.includes('dm') || lower.includes('marketing')) return 'Digital Marketing';
  if (lower.includes('information technology') || /(^|[^a-z])it([^a-z]|$)/.test(lower) || lower.includes('python') || lower.includes('software') || lower.includes('data science') || lower.includes('data analytics') || lower.includes('artificial intelligence') || lower.includes('cyber security') || lower.includes('web development') || lower.includes('java') || lower.includes('php')) return 'Information technology (IT)';
  return 'Others';
};

const parseDate = dStr => parsePortalDateTime(dStr);

const getDrivePdf = (url) => {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/(?:file\/d\/|id=|\/d\/)([\w-]{25,})/);
  return match ? `https://drive.google.com/file/d/${match[1]}/view` : url;
};

export default function PlacedStudents() {
  const tpoData = readTpoData();
  
  const [applications, setApplications] = useState([]);
  const [existingApplications, setExistingApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [dataMeta, setDataMeta] = useState(null);
  
  const upperRole = (tpoData?.role || '').toUpperCase();
  const isTpo = upperRole.includes('TPO') || upperRole.includes('PLACEMENT OFFICER');
  const isPlacementTeam = upperRole.includes('PLACEMENT TEAM');
  const isAdmin = tpoData?.accessType === 'superadmin' || upperRole.includes('ADMIN') || upperRole.includes('GENERAL MANAGER') || upperRole.includes('ZONAL PLACEMENT HEAD') || upperRole === 'TECHNICAL HEAD';
  const canEditPlacement = isTpo || isPlacementTeam || isAdmin;

  const isRth = upperRole.includes('RTH') || upperRole.includes('REGIONAL TECHNICAL HEAD');
  const isTth = upperRole.includes('TTH') || upperRole.includes('TERRITORY TECHNICAL HEAD');
  const isTrainer = upperRole.includes('TRAINER');
  const isCourseSpecific = isRth || isTth || isTrainer;
  
  // 🚨 FIXED: Parse multiple assigned courses splitting by comma and newline
  const rawCourse = tpoData?.assignedCourse || 'All';
  const courseValues = (Array.isArray(rawCourse) ? rawCourse : String(rawCourse).split(/[\n,;]+/)).map(course => String(course).trim()).filter(Boolean);
  const assignedCoursesArray = courseValues.some(course => /^all( courses)?$/i.test(course)) ? ['All'] : [...new Set(courseValues.map(getStandardCourse).filter(Boolean))];
  
  const assignedBranchesArray = Array.isArray(tpoData?.assignedBranchesArray)
    ? tpoData.assignedBranchesArray.map(branch => String(branch).trim().toLowerCase()).filter(Boolean)
    : String(tpoData?.assignedBranchesArray || '').split(/[\n,;]+/).map(branch => branch.trim().replace(/^\d+\.\s*/, '').toLowerCase()).filter(Boolean);
  const hasAssignedBranch = branch => isAdmin || isPlacementTeam || assignedBranchesArray.includes('all') || assignedBranchesArray.some(assigned => {
    const rowBranch = String(branch || '').trim().toLowerCase();
    return rowBranch && (rowBranch === assigned || rowBranch.includes(assigned) || assigned.includes(rowBranch));
  });
  const [selectedMonth, setSelectedMonth] = useState('');
  const [branchFilter, setBranchFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [courseFilter, setCourseFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All'); 
  const [sortOrder, setSortOrder] = useState('newest');

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [savingStatus, setSavingStatus] = useState(false);

  const [editForm, setEditForm] = useState({});
  const [addForm, setAddForm] = useState({ 
    name: '', phone: '', email: '', roll: '', course: 'Industrial Automation', branch: '', 
    company: '', position: '', status: 'Placed', remarks: '', 
    datePlaced: getTodayPortalDateInput(), packageLpa: '', joiningStatus: 'Joined', offerLetterFile: null
  });

  useEffect(() => {
    if (!isEditModalOpen && !isAddModalOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isEditModalOpen, isAddModalOpen]);

  const fetchData = async () => {
    setLoading(true);
    setLoadError('');
    try {
      if (!tpoData) throw new Error('Your sign-in session is missing or invalid. Please sign in again.');
      const localTpo = tpoData;
      const payload = {
        assignedBranchesArray: localTpo.assignedBranchesArray,
        tpoName: localTpo.name,
        role: localTpo.role,
        assignedCourse: localTpo.assignedCourse
      };

      // This list is only used to warn about duplicate manual entries. It must
      // not hold up the source-of-truth TPO_Log records from rendering.
      void axios.post(`${API_BASE}/api/tpo/applications`, payload, { timeout: 30000 })
        .then(appRes => {
          if (appRes.data?.success && Array.isArray(appRes.data.applications)) setExistingApplications(appRes.data.applications);
        })
        .catch(error => console.warn('Could not load applications for duplicate checking:', error.message));

      const placedResponse = await axios.post(`${API_BASE}/api/tpo/placed-students`, payload, { timeout: 30000 });
      if (!placedResponse.data?.success) throw new Error(placedResponse.data?.message || 'Placed student records could not be loaded.');
      setDataMeta(placedResponse.data.dataMeta || null);

      const getVal = (row, searchStrs) => {
        const keys = Object.keys(row || {});
        for (const search of searchStrs) {
          const clean = search.toLowerCase().replace(/[^a-z0-9]/g, '');
          const found = keys.find(key => key.toLowerCase().replace(/[^a-z0-9]/g, '') === clean);
          if (found && row[found] && row[found] !== 'N/A') return row[found];
        }
        return '';
      };

      const placedRecords = (placedResponse.data.records || []).map(row => ({
        rowNumber: row.rowNumber,
        sourceSheet: row.sourceSheet || 'TPO_Log',
        name: getVal(row, ['studentname', 'name']),
        phone: getVal(row, ['contact', 'phone']),
        email: getVal(row, ['mailid', 'email']),
        roll: getVal(row, ['rollnumber', 'roll', 'ipcsroll']),
        course: getVal(row, ['course']),
        branch: getVal(row, ['branch']),
        qual: getVal(row, ['qualification', 'qual']),
        company: getVal(row, ['companyname', 'company']),
        position: getVal(row, ['position', 'role']),
        status: getVal(row, ['status']) || 'Placed',
        remarks: getVal(row, ['remarks']),
        datePlaced: getVal(row, ['dateplaced', 'timestamp', 'date']),
        packageLpa: getVal(row, ['package', 'package(lpa)']),
        joiningStatus: getVal(row, ['joiningstatus']),
        offerLetter: getVal(row, ['offerletterstatus', 'offerletter']),
        tpoName: getVal(row, ['placementofficer', 'tpo']),
        date: getVal(row, ['dateplaced']),
        jobId: getVal(row, ['jobid'])
      }));
      // Status=Placed in TPO_Log is authoritative, even when the row lacks
      // a student name or roll number. Keep every source row visible/countable.
      const finalApps = placedRecords;
      setApplications(finalApps);
    } catch (error) { 
      console.error("Failed to load placed applications", error); 
      const message = error.response?.data?.message || (error.code === 'ECONNABORTED' ? 'Loading placed student records took too long. Please retry.' : error.message);
      setLoadError(message || 'Placed student records could not be loaded. Please retry.');
    } finally { setLoading(false); }
  };

  // This page loads once from the account stored at login; role assignments stay fixed for the session.
  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const resetFilters = () => {
    setSearchQuery(''); setCourseFilter('All'); setStatusFilter('All'); setBranchFilter('All'); setSortOrder('newest');
  };

  // 🚨 MULTI-COURSE SCOPING
  const scopedApps = applications.filter(a => {
    if (isCourseSpecific && assignedCoursesArray[0] !== 'All') {
      if (!assignedCoursesArray.some(ac => getStandardCourse(a.course) === ac)) return false;
    }
    if (isTpo) return a.tpoName
      ? [tpoData?.name, tpoData?.email].map(normalizePlacementText).includes(normalizePlacementText(a.tpoName))
      : hasAssignedBranch(a.branch);
    return hasAssignedBranch(a.branch);
  });

  const globallyFiltered = scopedApps.filter(a => {
    let cMatch = courseFilter === 'All' || getStandardCourse(a.course) === getStandardCourse(courseFilter);
    let sMatch = true;
    if (statusFilter !== 'All') {
      const stat = (a.status || '').toLowerCase();
      const join = (a.joiningStatus || '').toLowerCase();
      
      if (statusFilter === 'Joined') sMatch = join.includes('joined') && !join.includes('not');
      else if (statusFilter === 'Not Joined') sMatch = join.includes('not joined');
      else if (statusFilter === 'Got Offer') sMatch = stat.includes('offer');
      else if (statusFilter === 'Placed') sMatch = stat.includes('placed');
    }
    
    return cMatch && sMatch;
  });

  const getMonthKey = app => {
    const date = parseDate(app.datePlaced || app.date);
    return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : 'undated';
  };
  const formatMonthKey = key => key === 'undated'
    ? 'Date not recorded'
    : new Date(`${key}-01T12:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const monthCounts = new Map();
  globallyFiltered.forEach(app => {
    const key = getMonthKey(app);
    monthCounts.set(key, (monthCounts.get(key) || 0) + 1);
  });
  const monthOptions = [...monthCounts.entries()].sort(([left], [right]) => {
    if (left === 'undated') return 1;
    if (right === 'undated') return -1;
    return right.localeCompare(left);
  });
  const activeMonthApps = selectedMonth
    ? globallyFiltered.filter(app => getMonthKey(app) === selectedMonth)
    : [];
  const branchList = [...new Set(activeMonthApps.map(app => app.branch || 'Unknown'))].sort((a, b) => a.localeCompare(b));
  const branchFilteredApps = branchFilter === 'All'
    ? activeMonthApps
    : activeMonthApps.filter(app => String(app.branch || 'Unknown').trim().toLowerCase() === branchFilter.trim().toLowerCase());

  const filteredApps = branchFilteredApps.filter(a => {
    return searchQuery === '' || 
      (a.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (a.company || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      (a.roll || '').toLowerCase().includes(searchQuery.toLowerCase());
  }).sort((a, b) => {
    if (sortOrder === 'newest') return (parseDate(b.datePlaced || b.date) || 0) - (parseDate(a.datePlaced || a.date) || 0);
    if (sortOrder === 'az') return (a.name || '').localeCompare(b.name || '');
    if (sortOrder === 'za') return (b.name || '').localeCompare(a.name || '');
    return 0;
  });

  const openEditModal = (app) => {
    if (!app.rowNumber) {
      alert('This placement record has no editable row in the placement log. Refresh the list and try again.');
      return;
    }
    setSelectedApp(app);
    setEditForm({ remarks: app.remarks, datePlaced: app.datePlaced, packageLpa: app.packageLpa, offerLetterFile: null, joiningStatus: app.joiningStatus });
    setIsEditModalOpen(true);
  };

  const submitEdit = async () => {
    setSavingStatus(true);
    try {
      const formData = new FormData();
      formData.append('rowNumber', selectedApp.rowNumber);
      formData.append('sourceSheet', selectedApp.sourceSheet || 'Opening_Applied');
      formData.append('fullApp', JSON.stringify(selectedApp));
      formData.append('status', selectedApp.status || 'Placed'); 
      formData.append('remarks', editForm.remarks || '');
      formData.append('datePlaced', editForm.datePlaced || '');
      formData.append('packageLpa', editForm.packageLpa || '');
      formData.append('joiningStatus', editForm.joiningStatus || '');
      if (editForm.offerLetterFile) formData.append('offerLetterFile', editForm.offerLetterFile);

      const updatePath = selectedApp.sourceSheet === 'Placed_Students' ? 'update-placed' : selectedApp.sourceSheet === 'TPO_Log' ? 'update-log' : 'update';
      const response = await axios.post(`${API_BASE}/api/tpo/applications/${updatePath}`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      if (!response.data?.success) throw new Error(response.data?.message || 'The placement update was rejected.');
      setIsEditModalOpen(false);
      if (response.data.warning) alert(`Placement updated. ${response.data.warning}`);
      fetchData();
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'The placement service could not be reached.';
      alert(`Failed to save placement updates: ${message}`);
    } finally { setSavingStatus(false); }
  };

  const submitAdd = async () => {
    if (!addForm.roll || !addForm.name || !addForm.company) return alert("Student Name, Roll Number, and Company Name are required.");
    const targetRoll = normalizePlacementText(addForm.roll);
    const targetName = normalizePlacementText(addForm.name);
    const targetCompany = normalizePlacementText(addForm.company);
    const duplicateExists = [...applications, ...existingApplications].some(application => {
      const company = normalizePlacementText(application.company || application.companyName);
      if (!targetCompany || company !== targetCompany) return false;
      const existingRoll = normalizePlacementText(application.roll || application.rollNumber || application.ipcsRollNumber);
      return targetRoll && existingRoll ? targetRoll === existingRoll : targetName === normalizePlacementText(application.name || application.studentName);
    });
    if (duplicateExists) return alert('This student is already recorded for this company. Please find their name on the list and use the Edit button instead.');
    setSavingStatus(true);
    try {
      const formData = new FormData();
      formData.append('tpoName', tpoData?.name || 'Admin');
      formData.append('appData', JSON.stringify(addForm));
      if (addForm.offerLetterFile) formData.append('offerLetterFile', addForm.offerLetterFile);

      const response = await axios.post(`${API_BASE}/api/tpo/applications/add`, formData, { headers: { 'Content-Type': 'multipart/form-data' }});
      if (!response.data?.success) throw new Error(response.data?.message || 'The placement could not be added.');
      setIsAddModalOpen(false);
      setAddForm({ name: '', phone: '', email: '', roll: '', course: 'Industrial Automation', branch: '', company: '', position: '', status: 'Placed', remarks: '', datePlaced: getTodayPortalDateInput(), packageLpa: '', joiningStatus: 'Joined', offerLetterFile: null });
      if (response.data.warning) alert(`Placement added. ${response.data.warning}`);
      fetchData();
    } catch (error) {
      console.error('Failed to add manual placement:', error);
      const serverMessage = error.response?.data?.message;
      const message = serverMessage || (error.response
        ? `The server returned an error (${error.response.status}).`
        : `${error.message || 'The placement service could not be reached.'} Check your connection and try again.`);
      alert(`Failed to add placement: ${message}`);
    } finally { setSavingStatus(false); }
  };

  return (
    <Layout>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            {selectedMonth && <button type="button" onClick={() => { setSelectedMonth(''); setBranchFilter('All'); setSearchQuery(''); }} style={{ marginBottom: '12px', background: 'var(--card-bg)', border: '1px solid var(--card-border)', color: '#fff', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <CaretLeft weight="bold" size={18} /> Back to Months
            </button>}
            <h1 style={{ fontSize: '2rem', margin: '0 0 5px' }}>{selectedMonth ? formatMonthKey(selectedMonth) : 'Placed Students'}</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0 }}>{selectedMonth ? 'Placement records for this month.' : 'Choose a month to view its placement records.'}</p>
          </div>
          
          {canEditPlacement && (
            <button className="btn-action" style={{ background: '#10b981', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', width: 'auto' }} onClick={() => setIsAddModalOpen(true)}>
              <Plus weight="bold" /> Add Placement
            </button>
          )}
        </div>

        {dataMeta && <DataSourceStatus
          source={`${dataMeta.sourceSheet} · ${dataMeta.sourceStatusColumn}`}
          detail="Each matching source row is shown; placement and joining fields do not override Status."
          health={dataMeta.sourceHealthy}
          lastSyncedAt={dataMeta.lastSuccessfulSyncAt}
          lastAttemptAt={dataMeta.lastRefreshAttemptAt}
          onRefresh={() => void fetchData()}
          refreshing={loading}
        />}

        <div className="header-controls" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '1.5rem', alignItems: 'center', background: 'var(--card-bg)', padding: '14px 18px', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
          {/* 🚨 DYNAMIC COURSE FILTER FOR MULTI-ASSIGNMENT */}
          {(!isCourseSpecific || assignedCoursesArray.length > 1) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Course:</span>
              <select className="sleek-select" style={{ minWidth: '190px' }} value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
                {isCourseSpecific ? (
                  <>
                    <option value="All">All My Courses</option>
                    {assignedCoursesArray.map(c => <option key={c} value={c}>{c}</option>)}
                  </>
                ) : (
                  <>
                    <option value="All">All Main Courses</option>
                    <option value="Industrial Automation">Industrial Automation</option>
                    <option value="BMS AND CCTV">BMS AND CCTV</option>
                    <option value="Embedded and IoT">Embedded and IoT</option>
                    <option value="Digital Marketing">Digital Marketing</option>
                    <option value="Information technology (IT)">Information technology (IT)</option>
                  </>
                )}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Status:</span>
            <select className="sleek-select" style={{ minWidth: '140px' }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="All">All Statuses</option>
              <option value="Placed">Placed</option>
              <option value="Got Offer">Got Offer</option>
              <option value="Joined">Joined Company</option>
              <option value="Not Joined">Not Joined</option>
            </select>
          </div>

          {selectedMonth && (
            <>
              <input type="text" className="sleek-input" placeholder="Search student, roll, or company..." style={{ minWidth: '220px', flex: 1 }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              <select className="sleek-select" style={{ minWidth: '160px' }} value={branchFilter} onChange={e => setBranchFilter(e.target.value)}>
                <option value="All">All branches</option>
                {branchList.map(branch => <option key={branch} value={branch}>{branch}</option>)}
              </select>
            <select className="sleek-select" value={sortOrder} onChange={(e) => setSortOrder(e.target.value)}>
              <option value="newest">Sort: Date Placed</option>
              <option value="az">Sort: Student A-Z</option>
              <option value="za">Sort: Student Z-A</option>
            </select>
            </>
          )}

          {(courseFilter !== 'All' || statusFilter !== 'All' || searchQuery !== '' || branchFilter !== 'All') && (
            <button onClick={resetFilters} style={{ background: 'transparent', border: '1px solid #64748b', color: '#94a3b8', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.85rem' }}>
              <ArrowsClockwise size={14} /> Reset
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', marginTop: '4rem', color: '#10b981' }}>
            <CircleNotch size={50} className="ph-spin" />
            <p style={{ marginTop: '10px', color: 'var(--text-muted)' }}>Loading records from TPO_Log...</p>
          </div>
        ) : loadError ? (
          <div role="alert" style={{ maxWidth: '620px', margin: '3rem auto', padding: '24px', textAlign: 'center', color: 'var(--text-main)', background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '16px' }}>
            <p style={{ margin: '0 0 16px', color: 'var(--text-muted)' }}>{loadError}</p>
            <button type="button" onClick={fetchData} style={{ padding: '9px 18px', border: 0, borderRadius: '9px', background: 'var(--accent-primary)', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>Retry</button>
          </div>
        ) : !selectedMonth ? (
          monthOptions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
              <p style={{ fontSize: '1.1rem', color: 'var(--text-muted)', margin: 0 }}>No placed students matched these filters.</p>
            </div>
          ) : (
            <section aria-label="Placement months" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(245px, 1fr))', gap: '16px', marginTop: '15px' }}>
              {monthOptions.map(([monthKey, count], index) => {
                const color = TILE_COLORS[index % TILE_COLORS.length];
                return (
                  <button key={monthKey} type="button" onClick={() => { setSelectedMonth(monthKey); setBranchFilter('All'); setSearchQuery(''); }} style={{ textAlign: 'left', background: 'linear-gradient(145deg, color-mix(in srgb, var(--card-bg) 82%, white), var(--card-bg))', border: '1px solid var(--card-border)', borderLeft: `4px solid ${color}`, borderRadius: '15px', padding: '20px', cursor: 'pointer', color: 'var(--text-main)', boxShadow: '0 8px 24px rgba(0,0,0,.16)', transition: 'transform .15s ease, border-color .15s ease' }}>
                    <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '10px' }}>Placement month</span>
                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <strong style={{ fontSize: '1.25rem' }}>{formatMonthKey(monthKey)}</strong>
                      <span style={{ flexShrink: 0, padding: '5px 10px', borderRadius: '999px', background: color, color: '#fff', fontWeight: 700 }}>{count}</span>
                    </span>
                    <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '.88rem', marginTop: '10px' }}>{count === 1 ? '1 placement' : `${count} placements`} · Click to open</span>
                  </button>
                );
              })}
            </section>
          )
        ) : (
          <div style={{ marginTop: '1.5rem' }}>
            <section className="placed-overview" aria-label={`${formatMonthKey(selectedMonth)} placement summary`} style={{ marginBottom: '18px' }}>
              <div><span>Placed rows</span><strong>{activeMonthApps.length}</strong><small>From TPO_Log Status = Placed</small></div>
              <div><span>Companies</span><strong>{new Set(activeMonthApps.map(item => (item.company || '').trim().toLowerCase()).filter(Boolean)).size}</strong><small>Unique employers this month</small></div>
              <div><span>Branches</span><strong>{branchList.length}</strong><small>With placement records</small></div>
              <div><span>Average Package</span><strong>{(() => { const values = activeMonthApps.map(item => Number.parseFloat(String(item.packageLpa || '').replace(/[^\d.]/g, ''))).filter(value => Number.isFinite(value) && value > 0); return values.length ? `${(values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)} LPA` : '—'; })()}</strong><small>Where reported</small></div>
            </section>
            {filteredApps.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--card-border)' }}>
                No placed students found in {formatMonthKey(selectedMonth)} matching these filters.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 2fr 0.5fr', padding: '0 1.5rem', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.5px' }}>
                  <span>STUDENT DETAILS</span><span>COMPANY & POSITION</span><span>PLACED DATE & LPA</span><span>STATUS & JOINING</span><span style={{ textAlign: 'center' }}>ACTION</span>
                </div>

                {filteredApps.map((app, i) => (
                  <div key={app.rowNumber || i} style={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: '12px', padding: '1rem 1.5rem', display: 'grid', gridTemplateColumns: '2fr 2fr 1.5fr 2fr 0.5fr', alignItems: 'center', gap: '15px' }}>
                    <div>
                      <strong style={{ display: 'block', color: '#fff', fontSize: '1.05rem', marginBottom: '4px' }}>{app.name || `Student details missing · row ${app.rowNumber}`}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{app.roll || 'No Roll #'} • {app.course}</span>
                    </div>
                    <div>
                      <strong style={{ display: 'block', color: '#fff', fontSize: '1rem', marginBottom: '4px' }}>{app.company || 'Company details missing'}</strong>
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{app.position || 'Position N/A'}</span>
                    </div>
                    <div>
                      <strong style={{ display: 'block', color: '#fff', fontSize: '1rem', marginBottom: '4px' }}>
                        {app.datePlaced ? formatPortalDate(app.datePlaced, 'N/A') : 'N/A'}
                      </strong>
                      <span style={{ color: '#10b981', fontSize: '0.85rem', fontWeight: 600 }}>{app.packageLpa ? `${app.packageLpa} LPA` : 'N/A LPA'}</span>
                    </div>
                    <div>
                      <StatusBadge status={app.status || 'Placed'} />
                      <div style={{ marginTop: '6px' }}><StatusBadge status={app.joiningStatus || 'Joined'} /></div>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                      {canEditPlacement && app.rowNumber ? (
                        <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.8rem', display: 'flex', justifyContent: 'center', gap: '6px' }} onClick={() => openEditModal(app)}>
                          <PencilSimple weight="bold" size={14} /> Edit
                        </button>
                      ) : (
                        (app.offerLetter && app.offerLetter !== 'N/A') ? (
                          <button className="btn-secondary" style={{ padding: '6px 14px', fontSize: '0.75rem', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--accent-primary)', borderColor: 'var(--accent-primary)', display: 'flex', alignItems: 'center', gap: '5px' }} onClick={() => window.open(getDrivePdf(app.offerLetter) || app.offerLetter, '_blank')}>
                            <FilePdf weight="fill" size={14} /> Offer Letter
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>No File</span>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {isEditModalOpen && selectedApp && createPortal((
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }} onClick={(e) => { if(e.target === e.currentTarget) setIsEditModalOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: '500px', width: '100%', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: '0 0 5px 0', fontSize: '1.4rem' }}>Update {selectedApp.name || 'student'}'s Placement</h2>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsEditModalOpen(false)} />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label className="data-label">Date Placed</label>
                <DateInput className="sleek-input" style={{ width: '100%' }} value={editForm.datePlaced || ''} onChange={e => setEditForm({...editForm, datePlaced: e.target.value})} />
              </div>
              <div>
                <label className="data-label">Package (LPA)</label>
                <input type="number" step="0.1" className="sleek-input" placeholder="e.g. 4.5" style={{ width: '100%' }} value={editForm.packageLpa || ''} onChange={e => setEditForm({...editForm, packageLpa: e.target.value})} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
              <div>
                <label className="data-label">Joining Status</label>
                <select className="sleek-select" style={{ width: '100%' }} value={editForm.joiningStatus || 'Joined'} onChange={e => setEditForm({...editForm, joiningStatus: e.target.value})}>
                  <option value="Joined">Joined</option>
                  <option value="Not Joined">Not Joined</option>
                  <option value="Pending Joining">Pending Joining</option>
                </select>
              </div>
              <div>
                <label className="data-label">Upload Offer Letter</label>
                <input type="file" className="sleek-input" style={{ width: '100%', padding: '6px' }} onChange={e => setEditForm({...editForm, offerLetterFile: e.target.files[0]})} />
              </div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="data-label">Remarks</label>
              <input type="text" className="sleek-input" placeholder="Add remarks..." style={{ width: '100%' }} value={editForm.remarks || ''} onChange={e => setEditForm({...editForm, remarks: e.target.value})} />
            </div>

            <button className="btn-action" style={{ background: '#10b981', color: '#fff', width: '100%' }} onClick={submitEdit} disabled={savingStatus}>
              {savingStatus ? <CircleNotch size={20} className="ph-spin" /> : <><FloppyDisk size={20} weight="bold"/> Save Updates</>}
            </button>
          </div>
        </div>
      ), document.body)}

      {isAddModalOpen && canEditPlacement && createPortal((
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }} onClick={(e) => { if(e.target === e.currentTarget) setIsAddModalOpen(false); }}>
          <div className="modal-card" style={{ maxWidth: '800px', width: '100%', maxHeight: '90vh', overflowY: 'auto', background: '#0f1523', border: '1px solid var(--card-border)', borderRadius: '16px', padding: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Add Manual Placement</h2>
              <X size={24} style={{ cursor: 'pointer', color: 'var(--text-muted)' }} onClick={() => setIsAddModalOpen(false)} />
            </div>
            
            <h3 style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: '10px' }}>Student Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div><label className="data-label">Student Name *</label><input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.name} onChange={e=>setAddForm({...addForm, name: e.target.value})} /></div>
              <div><label className="data-label">Roll Number *</label><input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.roll} onChange={e=>setAddForm({...addForm, roll: e.target.value})} /></div>
              <div><label className="data-label">Contact No.</label><input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.phone} onChange={e=>setAddForm({...addForm, phone: e.target.value})} /></div>
              <div><label className="data-label">Mail ID</label><input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.email} onChange={e=>setAddForm({...addForm, email: e.target.value})} /></div>
              <div>
                <label className="data-label">Course</label>
                <select className="sleek-select" style={{ width: '100%' }} value={addForm.course} onChange={e=>setAddForm({...addForm, course: e.target.value})}>
                  <option value="Industrial Automation">Industrial Automation</option>
                  <option value="BMS AND CCTV">BMS AND CCTV</option>
                  <option value="Embedded and IoT">Embedded and IoT</option>
                  <option value="Digital Marketing">Digital Marketing</option>
                  <option value="Information technology (IT)">Information technology (IT)</option>
                </select>
              </div>
              <div><label className="data-label">Branch</label><input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.branch} onChange={e=>setAddForm({...addForm, branch: e.target.value})} /></div>
            </div>

            <h3 style={{ fontSize: '0.85rem', color: 'var(--accent-primary)', textTransform: 'uppercase', marginBottom: '10px' }}>Placement Details</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
              <div><label className="data-label">Company Name *</label><input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.company} onChange={e=>setAddForm({...addForm, company: e.target.value})} /></div>
              <div><label className="data-label">Position / Role</label><input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.position} onChange={e=>setAddForm({...addForm, position: e.target.value})} /></div>
              <div><label className="data-label">Date Placed</label><DateInput className="sleek-input" style={{ width: '100%' }} value={addForm.datePlaced} onChange={e=>setAddForm({...addForm, datePlaced: e.target.value})} /></div>
              <div><label className="data-label">Package (LPA)</label><input type="number" step="0.1" className="sleek-input" style={{ width: '100%' }} value={addForm.packageLpa} onChange={e=>setAddForm({...addForm, packageLpa: e.target.value})} /></div>
              <div>
                <label className="data-label">Joining Status</label>
                <select className="sleek-select" style={{ width: '100%' }} value={addForm.joiningStatus} onChange={e=>setAddForm({...addForm, joiningStatus: e.target.value})}>
                  <option value="Joined">Joined</option>
                  <option value="Not Joined">Not Joined</option>
                </select>
              </div>
              <div><label className="data-label">Upload Offer Letter</label><input type="file" className="sleek-input" style={{ width: '100%', padding: '6px' }} onChange={e=>setAddForm({...addForm, offerLetterFile: e.target.files[0]})} /></div>
            </div>

            <div style={{ marginBottom: '1.5rem' }}>
              <label className="data-label">Remarks</label>
              <input type="text" className="sleek-input" style={{ width: '100%' }} value={addForm.remarks} onChange={e=>setAddForm({...addForm, remarks: e.target.value})} />
            </div>

            <button className="btn-action" style={{ background: '#10b981', color: '#fff', width: '100%' }} onClick={submitAdd} disabled={savingStatus}>
              {savingStatus ? <CircleNotch size={20} className="ph-spin" /> : <><FloppyDisk size={20} weight="bold"/> Save New Placement</>}
            </button>
          </div>
        </div>
      ), document.body)}
    </Layout>
  );
}
