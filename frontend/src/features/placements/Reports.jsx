import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { CircleNotch, Target, ChartLineUp, Buildings, ShieldCheck, Briefcase, UsersThree, Plus, PaperPlaneTilt, Trash } from '@phosphor-icons/react';
import Layout from '../../layouts/Layout';
import DataSourceStatus from '../../components/DataSourceStatus';
import { PortalToast } from '../../components/PortalFeedback';
import { API_BASE } from '../../services/apiConfig';
import { normalizePlacementText } from '../../utils/placementRecords';
import { isPlacedStatus, isPlacementEligiblePending, placementOutcome } from '../../utils/placementMetrics';
import { parsePortalDateTime } from '../../utils/dateFormat';

const REPORT_MAIN_COURSES = [
  'Industrial Automation',
  'BMS AND CCTV',
  'Information technology (IT)',
  'Digital Marketing',
  'Embedded and IoT'
];
const reportMainCourse = value => {
  const course = String(value || '').trim().toLowerCase().replace(/[_&/+-]+/g, ' ').replace(/\s+/g, ' ');
  if (!course) return '';
  if (course.includes('bms') || course.includes('cctv') || course.includes('building management')) return 'BMS AND CCTV';
  if (course.includes('embedded') || course.includes('internet of things') || /(^|[^a-z])iot([^a-z]|$)/.test(course)
    || ['microcontroller', 'vlsi'].some(token => course.includes(token))) return 'Embedded and IoT';
  if (course.includes('automation') || course.includes('industrial') || course.includes('plc') || course.includes('scada')
    || course.includes('robotics') || course.includes('mechatronics')) return 'Industrial Automation';
  if (course.includes('digital') || course.includes('marketing') || /(^|[^a-z])dm([^a-z]|$)/.test(course)
    || ['accdm', 'aidm', 'pdmdm'].includes(course.replace(/[^a-z]/g, ''))
    || ['seo', 'social media marketing', 'content marketing'].some(token => course.includes(token))) return 'Digital Marketing';
  if (course.includes('information technology') || /(^|[^a-z])it([^a-z]|$)/.test(course)
    || ['python', 'java', 'software', 'data science', 'data analytics', 'artificial intelligence', 'machine learning',
      'cyber security', 'web development', 'full stack', 'mern', 'mean stack', 'cloud computing', 'networking',
      'programming', 'dotnet', '.net', 'php', 'bde'].some(token => course.includes(token))) return 'Information technology (IT)';
  return '';
};

const getVal = (obj, searchStr) => {
  const key = Object.keys(obj || {}).find(k => k.toLowerCase().replace(/\s/g, '').includes(searchStr.toLowerCase().replace(/\s/g, '')));
  return key ? obj[key] : '';
};
const normalizeHeader = value => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const effectiveJoiningStatus = row => {
  const status = String(getVal(row, 'joiningstatus') || '').trim();
  if (status) return status;
  // Legacy records from the former checkbox UI are interpreted as the new
  // single dropdown value only if this placement row has no saved dropdown.
  if (/^(yes|true|1|marked)$/i.test(String(getVal(row, 'multipleplacement') || '').trim())) return 'Multiple Placement';
  if (/^(yes|true|1|marked)$/i.test(String(getVal(row, 'dualplacement') || '').trim())) return 'Dual Placement';
  return '';
};
const isPlacementTypeMarked = (row, type) => normalizePlacementText(effectiveJoiningStatus(row)) === `${type}placement`;
const tpoDisplayName = tpo => String(tpo?.userName || tpo?.name || tpo?.email || tpo?.username || tpo?.loginId || tpo?.empId || tpo?.employeeId || 'Unassigned TPO').trim();
const tpoIdentityValues = tpo => [tpo?.userName, tpo?.name, tpo?.email, tpo?.username, tpo?.loginId, tpo?.empId, tpo?.employeeId].map(normalizePlacementText).filter(Boolean);
const reportTpoKey = tpo => normalizePlacementText(tpo?.email || tpo?.userName || tpo?.name || tpo?.username || tpo?.loginId || tpo?.empId || tpo?.employeeId);
const placementOwnerValue = row => {
  const keys = Object.keys(row || {}).filter(key => !key.startsWith('_'));
  for (const field of ['placementofficer', 'tponame', 'tpo', 'createdby', 'createdbyname', 'owner', 'postedby', 'addedby']) {
    const key = keys.find(candidate => normalizeHeader(candidate) === field);
    const value = key ? String(row[key] || '').trim() : '';
    if (value) return value;
  }
  return '';
};
const normalizeBranch = value => normalizePlacementText(String(value || '').trim());
const uniqueBranches = values => {
  const branches = new Map();
  (values || []).forEach(value => {
    const label = String(value || '').trim();
    const key = normalizeBranch(label);
    if (key && !branches.has(key)) branches.set(key, label);
  });
  return [...branches.values()].sort((a, b) => a.localeCompare(b));
};
const safeReportLinks = value => String(value || '').split(/\r?\n/).map(link => link.trim()).filter(link => {
  try { return ['http:', 'https:'].includes(new URL(link).protocol); } catch { return false; }
});
const MONTHLY_ACTIVITY_TYPES = [
  { value: 'company_visit', label: 'Company visit', kind: 'companies' },
  { value: 'instagram_poster', label: 'Instagram poster', kind: 'link' },
  { value: 'instagram_video', label: 'Instagram video', kind: 'link' },
  { value: 'linkedin_post', label: 'LinkedIn post', kind: 'link' },
  { value: 'linkedin_video', label: 'LinkedIn video', kind: 'link' }
];
const MAX_MONTHLY_ACTIVITY_ITEMS = 100;
const createActivityItem = (type = 'company_visit') => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  type,
  companies: type === 'company_visit' ? Array(10).fill('') : [],
  title: '',
  value: '',
  postingStatus: 'pending'
});
const getActivityPostingStatus = item => item?.postingStatus === 'completed' || (!item?.postingStatus && item?.value) ? 'completed' : 'pending';
const getActivityTypeLabel = type => MONTHLY_ACTIVITY_TYPES.find(item => item.value === type)?.label || 'Activity';
const parseActivityItems = (serialized, legacy = {}) => {
  try {
    const saved = JSON.parse(String(serialized || ''));
    if (Array.isArray(saved)) return saved.map(item => ({
      ...createActivityItem(item.type),
      type: MONTHLY_ACTIVITY_TYPES.some(type => type.value === item.type) ? item.type : 'company_visit',
      companies: Array.from({ length: 10 }, (_, index) => String(item.companies?.[index] || '')),
      title: String(item.title || ''),
      value: String(item.value || ''),
      postingStatus: item.postingStatus === 'completed' || item.postingStatus === 'pending'
        ? item.postingStatus
        : (item.value ? 'completed' : 'pending')
    }));
  } catch { /* Older TPO_Stats rows use the legacy text columns. */ }

  const companyNames = String(legacy.companyNamesVisited || '').split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  const items = [];
  for (let index = 0; index < companyNames.length; index += 10) {
    items.push({ ...createActivityItem('company_visit'), companies: Array.from({ length: 10 }, (_, offset) => companyNames[index + offset] || '') });
  }

  const links = new Map();
  [
    ['posterLinks', 'instagram_poster'],
    ['videoLinks', 'instagram_video'],
    ['linkedinLinks', 'linkedin_post'],
    ['instagramLinks', 'instagram_poster']
  ].forEach(([field, fallbackType]) => safeReportLinks(legacy[field]).forEach(link => {
    const lower = link.toLowerCase();
    const type = /instagram\.com/.test(lower)
      ? (/\/(reel|reels|tv|video)\//.test(lower) ? 'instagram_video' : 'instagram_poster')
      : /linkedin\.com/.test(lower)
        ? (/video|clip/.test(lower) ? 'linkedin_video' : 'linkedin_post')
        : fallbackType;
    if (!links.has(lower)) links.set(lower, { ...createActivityItem(type), type, value: link });
  }));
  items.push(...links.values());
  return items;
};
const getTpoActivityMonth = stat => {
  const reportMonth = String(getVal(stat, 'reportmonth') || '').trim();
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(reportMonth)) return reportMonth;
  const reportMonthDate = parsePortalDateTime(reportMonth);
  if (reportMonthDate) return `${reportMonthDate.getFullYear()}-${String(reportMonthDate.getMonth() + 1).padStart(2, '0')}`;
  const date = parsePortalDateTime(getVal(stat, 'timestamp'));
  return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` : '';
};
const activityItemsFromStats = stat => parseActivityItems(stat ? getVal(stat, 'activityitems') : '', {
  companyNamesVisited: stat ? getVal(stat, 'companynamesvisited') : '',
  posterLinks: stat ? getVal(stat, 'posterlinks') : '',
  videoLinks: stat ? getVal(stat, 'videolinks') : '',
  linkedinLinks: stat ? getVal(stat, 'linkedinlinks') : '',
  instagramLinks: stat ? getVal(stat, 'instagramlinks') : ''
});

export default function Reports() {
  const navigate = useNavigate();
  const tpoDataStr = localStorage.getItem('tpoData');
  let tpoData = null;
  try { tpoData = tpoDataStr ? JSON.parse(tpoDataStr) : null; } catch { tpoData = null; }
  const role = String(tpoData?.role || '').toUpperCase();
  const isSuperAdmin = tpoData?.accessType === 'superadmin' || role.includes('ADMIN') || role.includes('PLACEMENT TEAM') || ['GENERAL MANAGER', 'ZONAL PLACEMENT HEAD', 'TECHNICAL HEAD'].some(adminRole => role.includes(adminRole));
  const isTpo = /\b(TPO|PLACEMENT OFFICER)\b/.test(role);
  const canSendMonthlyReport = isSuperAdmin || isTpo;
  const myName = (tpoData?.name || '').toLowerCase().trim();
  const myIdentities = tpoIdentityValues(tpoData);
  
  const [activeTab, setActiveTab] = useState(1);

  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [monthFilter, setMonthFilter] = useState(currentMonthStr);
  const [reportTpoFilter, setReportTpoFilter] = useState('all');

  const [students, setStudents] = useState([]);
  const [applications, setApplications] = useState([]);
  const [events, setEvents] = useState([]);
  const [placementReportLogs, setPlacementReportLogs] = useState([]);
  
  const [tpoList, setTpoList] = useState(() => !isSuperAdmin && tpoData ? [tpoData] : []);
  const [allBranchesList, setAllBranchesList] = useState([]);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportError, setReportError] = useState('');
  const [reportReloadKey, setReportReloadKey] = useState(0);
  const [dataMeta, setDataMeta] = useState(null);
  const [portalPlacementPending, setPortalPlacementPending] = useState(0);
  const [sendingReport, setSendingReport] = useState('');
  const [sendReportMessage, setSendReportMessage] = useState('');
  const [toast, setToast] = useState(null);
  const mainCourses = REPORT_MAIN_COURSES;

  // 🚨 NEW STATES FOR TPO ACTIVITY
  const [tpoStatsData, setTpoStatsData] = useState([]);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityForm, setActivityForm] = useState({ tpoName: '', reportMonth: currentMonthStr, activityItems: [], mode: 'add' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setReportLoading(true);
    setReportError('');

    axios.post(`${API_BASE}/api/tpo/reports`, {}, { timeout: 45000 })
      .then(response => {
        if (!active) return;
        if (!response.data?.success) throw new Error(response.data?.message || 'Could not load report data.');
        const data = response.data;
        const reportStudents = data.students || [];
        const reportApplications = data.applications || [];
        const reportLogs = data.tpoLogs || [];
        setDataMeta(data.dataMeta || null);
        setPortalPlacementPending(Number(data.portalPlacementPending || 0));
        setStudents(reportStudents);
        setApplications(reportApplications);
        setEvents(data.events || []);
        setPlacementReportLogs(Array.isArray(data.placementReportLogs) ? data.placementReportLogs : []);
        setTpoStatsData(data.tpoStats || []);
        setAllBranchesList(uniqueBranches([...reportStudents, ...reportLogs, ...(Array.isArray(data.placementReportLogs) ? data.placementReportLogs : [])]
          .map(item => item?.branch)));
        if (isSuperAdmin) {
          const loggedTpos = [...new Set(reportLogs.map(placementOwnerValue).filter(Boolean))]
            .map(name => ({ name, userName: name }));
          setTpoList(current => current.length ? current : loggedTpos);
        }
      })
      .catch(error => {
        if (active) {
          console.error('Failed to fetch reports', error);
          setReportError(error.response?.data?.message || error.message || 'Could not load report data.');
        }
      })
      .finally(() => { if (active) setReportLoading(false); });

    const auxiliaryRequests = [
      isSuperAdmin ? axios.get(`${API_BASE}/api/admin/users`, { params: { month: monthFilter } }) : Promise.resolve(null),
      isSuperAdmin ? axios.get(`${API_BASE}/api/admin/branches`) : Promise.resolve(null)
    ];
    Promise.allSettled(auxiliaryRequests).then(([usersResult, branchesResult]) => {
      if (!active) return;
      if (isSuperAdmin && usersResult.status === 'fulfilled' && usersResult.value?.data?.success) {
        const tpos = (usersResult.value.data.users || []).filter(user => /tpo|placement officer/i.test(user.role || ''));
        if (tpos.length) setTpoList(tpos);
      }
      if (isSuperAdmin && branchesResult.status === 'fulfilled' && branchesResult.value?.data?.success) {
        const branches = (branchesResult.value.data.branches || []).map(branch => branch.branch).filter(Boolean).sort((a, b) => a.localeCompare(b));
        if (branches.length) setAllBranchesList(current => uniqueBranches([...current, ...branches]));
      }
    });

    return () => { active = false; };
  }, [isSuperAdmin, myName, reportReloadKey, monthFilter]);

  const getCourse = course => reportMainCourse(course) || 'Information technology (IT)';
  const getMonthlyTarget = (tpo, reportMonth) => {
    const identities = new Set(tpoIdentityValues(tpo));
    const matchingRows = tpoStatsData.filter(stat => identities.has(normalizePlacementText(getVal(stat, 'user')))
      && getTpoActivityMonth(stat) === reportMonth);
    const rowsWithTarget = matchingRows.filter(stat => String(getVal(stat, 'monthlytarget') ?? '').trim() !== '');
    const savedTarget = rowsWithTarget.length ? getVal(rowsWithTarget[rowsWithTarget.length - 1], 'monthlytarget') : '';
    return String(savedTarget ?? '').trim() !== ''
      ? savedTarget
      : (String(tpo?.targetMonth || '') === reportMonth ? tpo?.target : '');
  };
  const getPlacementCourse = placement => {
    const course = reportMainCourse(getVal(placement, 'course'));
    if (course) return course;
    const roll = normalizePlacementText(getVal(placement, 'rollnumber'));
    const name = normalizePlacementText(getVal(placement, 'studentname'));
    const branch = normalizeBranch(getVal(placement, 'branch'));
    const student = students.find(row => {
      const rowRoll = normalizePlacementText(row.roll);
      const rowName = normalizePlacementText(row.name);
      return roll ? rowRoll === roll : Boolean(name && rowName === name && (!branch || normalizeBranch(row.branch) === branch));
    });
    return reportMainCourse(student?.course) || 'Information technology (IT)';
  };

  const checkMonth = (dateStr) => {
    if (!monthFilter) return true;
    const date = parsePortalDateTime(dateStr);
    if (!date) return false;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}` === monthFilter;
  };

  const getPlacementDate = row => ['dateplaced', 'timestamp', 'date']
    .map(field => parsePortalDateTime(getVal(row, field)))
    .find(Boolean) || null;
  const checkPlacementMonth = row => checkMonth(getPlacementDate(row));

  const selectedReportTpo = isSuperAdmin && reportTpoFilter !== 'all'
    ? tpoList.find(tpo => reportTpoKey(tpo) === reportTpoFilter || tpoIdentityValues(tpo).includes(reportTpoFilter))
    : null;
  const selectedTpoIdentities = new Set(tpoIdentityValues(selectedReportTpo));
  const isSelectedTpoLog = log => !selectedReportTpo || selectedTpoIdentities.has(normalizePlacementText(placementOwnerValue(log)));
  const visibleTpoList = selectedReportTpo ? [selectedReportTpo] : tpoList;
  const placementLogs = selectedReportTpo ? placementReportLogs.filter(isSelectedTpoLog) : placementReportLogs;
  const isAssignedBranch = (b) => {
    if (!tpoData) return false;
    if (isSuperAdmin && !selectedReportTpo) return true;
    const scopeUser = selectedReportTpo || tpoData;
    const assignedBranches = Array.isArray(scopeUser.assignedBranchesArray)
      ? scopeUser.assignedBranchesArray
      : String(scopeUser.assignedBranchesArray || scopeUser.assignedBranches || scopeUser.sittingBranch || '').split(/[\n,;]+/);
    const target = String(b || '').trim().toLowerCase();
    return assignedBranches.some(value => {
      const assigned = String(value || '').trim().toLowerCase();
      return assigned === 'all' || assigned === 'all branches' || Boolean(assigned && target && (target.includes(assigned) || assigned.includes(target)));
    });
  };

  const displayMonthName = new Date(monthFilter + '-01').toLocaleString('default', { month: 'long', year: 'numeric' });
  const targetSourceRows = placementLogs.filter(log => isPlacedStatus(getVal(log, 'status')));
  const targetSourceRowsThisMonth = targetSourceRows.filter(checkPlacementMonth);
  const internationalRowsThisMonth = targetSourceRowsThisMonth.filter(log => log.isInternationalPlacement === true);
  const dualPlacementsThisMonth = targetSourceRowsThisMonth.filter(log => isPlacementTypeMarked(log, 'dual')).length;
  const multiplePlacementsThisMonth = targetSourceRowsThisMonth.filter(log => isPlacementTypeMarked(log, 'multiple')).length;
  const reportTpoIdentities = new Set(tpoList.flatMap(tpoIdentityValues));
  const currentMonthRowsWithoutMatchedTpo = targetSourceRowsThisMonth.filter(log => !reportTpoIdentities.has(normalizePlacementText(placementOwnerValue(log)))).length;
  const placedRowsWithoutUsableDate = targetSourceRows.filter(log => !getPlacementDate(log)).length;
  const targetLogHealthy = dataMeta?.tpoLogSourceHealthy ?? dataMeta?.sheetHealth?.tpoLogs;
  const targetLogLastSyncedAt = dataMeta?.tpoLogSourceReadAt || dataMeta?.sheetLastSuccessfulSyncAt?.tpoLogs || '';

  // 1. BRANCH ENROLLMENTS
  const canonicalBranch = value => {
    const target = normalizeBranch(value);
    return allBranchesList.find(branch => normalizeBranch(branch) === target) || String(value || '').trim();
  };
  const assignedBranches = [...new Set(students.filter(s => isAssignedBranch(s.branch)).map(s => canonicalBranch(s.branch)))].filter(Boolean).sort((a, b) => a.localeCompare(b));
  const branchEnrolls = {};
  const enrollTotals = { Total: 0 };
  mainCourses.forEach(c => enrollTotals[c] = 0);

  assignedBranches.forEach(b => {
    branchEnrolls[b] = { Total: 0 };
    mainCourses.forEach(c => branchEnrolls[b][c] = 0);
  });

  students.forEach(s => {
    const branch = canonicalBranch(s.branch);
    if (isAssignedBranch(s.branch) && branchEnrolls[branch]) {
      const c = getCourse(s.course);
      branchEnrolls[branch][c]++;
      enrollTotals[c]++;
      branchEnrolls[branch].Total++;
      enrollTotals.Total++;
    }
  });

  // 2. BRANCH PLACEMENT MATRIX
  const branchPlaces = {};
  const placeTotals = { International: 0, Total: 0 };
  mainCourses.forEach(c => placeTotals[c] = 0);

  allBranchesList.forEach(b => {
    branchPlaces[b] = { International: 0, Total: 0 };
    mainCourses.forEach(c => branchPlaces[b][c] = 0);
  });

  placementLogs.forEach(log => {
    const b = canonicalBranch(getVal(log, 'branch'));
    const logTpo = normalizePlacementText(placementOwnerValue(log));
    
    // Admins see all, TPOs see only their own placements
    const hasAccessToLog = isSuperAdmin || !logTpo || myIdentities.includes(logTpo);

    if (branchPlaces[b] && checkPlacementMonth(log) && hasAccessToLog) {
      const outcome = placementOutcome(getVal(log, 'status'), effectiveJoiningStatus(log));
      if (outcome.placed) {
        const c = getPlacementCourse(log);
        branchPlaces[b][c]++;
        placeTotals[c]++;
        branchPlaces[b].Total++;
        placeTotals.Total++;
        if (log.isInternationalPlacement === true) {
          branchPlaces[b].International++;
          placeTotals.International++;
        }
      }
    }
  });

  // 3. BRANCH VS TPO STATUS
  const branchTPO = {};
  // Determine which TPOs to show as columns based on access level
  const displayTpos = isSuperAdmin
    ? visibleTpoList.map(person => ({ key: reportTpoKey(person) || normalizePlacementText(tpoDisplayName(person)), label: tpoDisplayName(person), person }))
      .filter((entry, index, list) => entry.key && list.findIndex(item => item.key === entry.key) === index)
    : [{ key: reportTpoKey(tpoData) || 'my-placements', label: tpoDisplayName(tpoData), person: tpoData }];
  
  allBranchesList.forEach(b => {
    branchTPO[b] = { Total: 0 };
    displayTpos.forEach(tpo => branchTPO[b][tpo.key] = 0);
  });

  placementLogs.forEach(log => {
    const b = canonicalBranch(getVal(log, 'branch'));
    const dStr = getVal(log, 'dateplaced') || getVal(log, 'timestamp');
    const logTpoRaw = placementOwnerValue(log);
    const logTpo = normalizePlacementText(logTpoRaw);

    if (branchTPO[b] && checkMonth(dStr)) {
      const outcome = placementOutcome(getVal(log, 'status'), effectiveJoiningStatus(log));
      if (outcome.placed) {
        
        // Find matching column
        const matchedTpoColumn = displayTpos.find(tpo => {
           const identities = tpoIdentityValues(tpo.person);
           return identities.includes(logTpo);
        });

        if (matchedTpoColumn && branchTPO[b][matchedTpoColumn.key] !== undefined) {
          branchTPO[b][matchedTpoColumn.key]++;
          branchTPO[b].Total++;
        }
      }
    }
  });

  // 4. PIPELINE TRACKER
  const pipeline = {};
  mainCourses.forEach(c => pipeline[c] = { placed: 0, joined: 0, offers: 0, notJoined: 0, pendingJoining: 0, dual: 0, multiple: 0 });

  placementLogs.forEach(log => {
    const dStr = getVal(log, 'dateplaced') || getVal(log, 'timestamp');
    const logTpo = normalizePlacementText(placementOwnerValue(log));
    const hasAccessToLog = isSuperAdmin || !logTpo || myIdentities.includes(logTpo);

    if (!checkMonth(dStr) || !hasAccessToLog) return;
    
    const c = getPlacementCourse(log);
    if (!pipeline[c]) return;
    const outcome = placementOutcome(getVal(log, 'status'), effectiveJoiningStatus(log));
    if (outcome.placed) pipeline[c].placed++;
    if (isPlacementTypeMarked(log, 'dual')) pipeline[c].dual++;
    if (isPlacementTypeMarked(log, 'multiple')) pipeline[c].multiple++;
    if (outcome.joined) pipeline[c].joined++;
    if (outcome.offer) pipeline[c].offers++;
    if (outcome.notJoined) pipeline[c].notJoined++;
    if (normalizePlacementText(effectiveJoiningStatus(log)) === 'pendingjoining') pipeline[c].pendingJoining++;
  });

  // 5. PENDING STUDENTS
  const pendingByCourse = {};
  const pendTotals = { Total: 0 };
  mainCourses.forEach(c => pendTotals[c] = 0);

  assignedBranches.forEach(b => {
    pendingByCourse[b] = { Total: 0 };
    mainCourses.forEach(c => pendingByCourse[b][c] = 0);
  });
  
  students.forEach(s => {
    const branch = canonicalBranch(s.branch);
    if (isAssignedBranch(s.branch) && pendingByCourse[branch]) {
      if (isPlacementEligiblePending(s.placementStatus, s.coursePercentage)) {
        const c = getCourse(s.course);
        pendingByCourse[branch][c]++;
        pendTotals[c]++;
        pendingByCourse[branch].Total++;
        pendTotals.Total++;
      }
    }
  });

  // TPO ACTIVITY LOGIC
  const tpoActivity = visibleTpoList.map(t => {
    const targetName = normalizePlacementText(tpoDisplayName(t));
    const tpoIdentities = tpoIdentityValues(t);
    
    // 🚨 Find manual stats for this TPO in the selected month
    const currentMonthPrefix = monthFilter; // "YYYY-MM" format
    const manualStats = tpoStatsData.filter(stat => {
      const statUser = normalizePlacementText(getVal(stat, 'user'));
      return tpoIdentities.includes(statUser) && getTpoActivityMonth(stat) === currentMonthPrefix;
    }).at(-1);
    const reportTarget = getMonthlyTarget(t, currentMonthPrefix);

    // Application totals come from OpeningApplied; TPO_Log is only the status history.
    const appsForTpo = applications.filter(application => {
      const owner = normalizePlacementText(getVal(application, 'tponame'));
      return owner && tpoIdentities.includes(owner) && checkMonth(getVal(application, 'date') || getVal(application, 'timestamp'));
    });

    // Joining Status from TPO Logs
    const logs = placementLogs.filter(log => {
       const logTpo = normalizePlacementText(placementOwnerValue(log));
       const dStr = getVal(log, 'dateplaced') || getVal(log, 'timestamp');
       return checkMonth(dStr) && tpoIdentities.includes(logTpo);
    });
    
    const joined = logs.filter(log => placementOutcome(getVal(log, 'status'), effectiveJoiningStatus(log)).joined).length;
    const notJoined = logs.filter(log => placementOutcome(getVal(log, 'status'), effectiveJoiningStatus(log)).notJoined).length;
    const autoUniqueCompanies = new Set(logs.map(log => normalizePlacementText(getVal(log, 'companyname') || getVal(log, 'company'))).filter(Boolean)).size;

    // Drives Conducted from Event Sheet
    const tpoEvents = events.filter(e => checkMonth(e.date) && tpoIdentities.includes(normalizePlacementText(e.tpo)));
    const drivesConducted = tpoEvents.filter(e => (e.type || '').toLowerCase().includes('drive')).length;

    const legacyActivity = {
      companyNamesVisited: manualStats ? getVal(manualStats, 'companynamesvisited') : '',
      posterLinks: manualStats ? getVal(manualStats, 'posterlinks') : '',
      videoLinks: manualStats ? getVal(manualStats, 'videolinks') : '',
      linkedinLinks: manualStats ? getVal(manualStats, 'linkedinlinks') : '',
      instagramLinks: manualStats ? getVal(manualStats, 'instagramlinks') : ''
    };
    const activityItems = activityItemsFromStats(manualStats);
    const companyItems = [...new Map(activityItems.flatMap(item => item.type === 'company_visit' ? item.companies || [] : [])
      .map(name => [normalizePlacementText(name), name]).filter(([key]) => key)).values()];

    return {
      tpo: tpoDisplayName(t),
      reportTarget,
      reportMonth: currentMonthPrefix,
      hasActivitySession: Boolean(manualStats),
      companiesVisited: manualStats ? (companyItems.length || parseInt(manualStats['Companies Visited'] || 0, 10) || 0) : autoUniqueCompanies,
      branchVideos: manualStats ? (activityItems.some(item => ['instagram_video', 'linkedin_video'].includes(item.type))
        ? activityItems.filter(item => ['instagram_video', 'linkedin_video'].includes(item.type) && getActivityPostingStatus(item) === 'completed' && item.value).length
        : parseInt(manualStats['Branch Videos'] || 0, 10) || 0) : 0,
      branchPosters: manualStats ? (activityItems.some(item => ['instagram_poster', 'linkedin_post'].includes(item.type))
        ? activityItems.filter(item => ['instagram_poster', 'linkedin_post'].includes(item.type) && getActivityPostingStatus(item) === 'completed' && item.value).length
        : parseInt(manualStats['Branch Posters'] || 0, 10) || 0) : 0,
      ...legacyActivity,
      activityItems,
      companyItems,
      posterItems: activityItems.filter(item => ['instagram_poster', 'linkedin_post'].includes(item.type)),
      videoItems: activityItems.filter(item => ['instagram_video', 'linkedin_video'].includes(item.type)),
      drivesConducted: drivesConducted,
      joining: joined,
      notJoining: notJoined,
      totalApps: appsForTpo.length
    };
  });

  const submitActivityStats = async (e) => {
    e.preventDefault();
    const activityItems = activityForm.activityItems.map(item => item.type === 'company_visit'
      ? { type: item.type, companies: (item.companies || []).slice(0, 10).map(company => String(company || '').trim()).filter(Boolean) }
      : { type: item.type, title: String(item.title || '').trim(), value: String(item.value || '').trim(), postingStatus: getActivityPostingStatus(item) })
      .filter(item => item.type === 'company_visit' ? item.companies.length > 0 : (item.title || item.value));
    const invalidLinkItem = activityItems.find(item => {
      if (item.type === 'company_visit') return false;
      if (item.postingStatus === 'completed' && !item.value) return true;
      if (!item.value) return false;
      try { return !['http:', 'https:'].includes(new URL(item.value).protocol); } catch { return true; }
    });
    if (invalidLinkItem) {
      setToast({ type: 'error', title: 'Check the activity link', message: invalidLinkItem.postingStatus === 'completed' && !invalidLinkItem.value
        ? `Add the published link or set ${getActivityTypeLabel(invalidLinkItem.type)} to Pending to post.`
        : `Enter a valid http or https link for ${getActivityTypeLabel(invalidLinkItem.type)}.` });
      return;
    }
    const companyNames = activityItems.filter(item => item.type === 'company_visit').flatMap(item => item.companies);
    const uniqueCompanyNames = [...new Map(companyNames.map(company => [company.toLowerCase(), company])).values()];
    const instagramPostLinks = activityItems.filter(item => item.type === 'instagram_poster' && item.postingStatus === 'completed' && item.value).map(item => item.value);
    const instagramVideoLinks = activityItems.filter(item => item.type === 'instagram_video' && item.postingStatus === 'completed' && item.value).map(item => item.value);
    const linkedinPostLinks = activityItems.filter(item => item.type === 'linkedin_post' && item.postingStatus === 'completed' && item.value).map(item => item.value);
    const linkedinVideoLinks = activityItems.filter(item => item.type === 'linkedin_video' && item.postingStatus === 'completed' && item.value).map(item => item.value);
    const posterLinks = [...instagramPostLinks, ...linkedinPostLinks];
    const videoLinks = [...instagramVideoLinks, ...linkedinVideoLinks];
    setIsSubmitting(true);
    try {
      const res = await axios.post(`${API_BASE}/api/tpo/activity`, {
        tpoName: activityForm.tpoName || tpoData?.name || tpoData?.userName,
        companiesVisited: uniqueCompanyNames.length,
        branchVideos: videoLinks.length,
        branchPosters: posterLinks.length,
        reportMonth: activityForm.reportMonth,
        activityItems,
        companyNamesVisited: uniqueCompanyNames.join('\n'),
        posterLinks: posterLinks.join('\n'),
        videoLinks: videoLinks.join('\n'),
        linkedinLinks: [...linkedinPostLinks, ...linkedinVideoLinks].join('\n'),
        instagramLinks: [...instagramPostLinks, ...instagramVideoLinks].join('\n')
      });
      if (res.data.success) {
        setMonthFilter(activityForm.reportMonth);
        const ownerName = activityForm.tpoName || tpoData?.name || tpoData?.userName;
        const updatedStats = {
          USER: ownerName,
          'Report Month': activityForm.reportMonth,
          'Activity Items': JSON.stringify(activityItems),
          'Company Names Visited': uniqueCompanyNames.join('\n'),
          'Poster Links': posterLinks.join('\n'),
          'Video Links': videoLinks.join('\n'),
          'LinkedIn Links': [...linkedinPostLinks, ...linkedinVideoLinks].join('\n'),
          'Instagram Links': [...instagramPostLinks, ...instagramVideoLinks].join('\n'),
          'Companies Visited': uniqueCompanyNames.length,
          'Branch Videos': videoLinks.length,
          'Branch Posters': posterLinks.length
        };
        setTpoStatsData(current => {
          const matchingIndex = current.findIndex(stat =>
            normalizePlacementText(getVal(stat, 'user')) === normalizePlacementText(ownerName)
            && getTpoActivityMonth(stat) === activityForm.reportMonth
          );
          if (matchingIndex < 0) return [...current, updatedStats];
          return current.map((stat, index) => index === matchingIndex ? { ...stat, ...updatedStats } : stat);
        });
        setShowActivityModal(false);
        setToast({ type: 'success', title: activityForm.mode === 'edit' ? 'Activity updated' : 'Activity saved', message: `${activityItems.length} item${activityItems.length === 1 ? '' : 's'} saved for ${activityForm.reportMonth}.` });
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || "Unknown error occurred";
      setToast({ type: 'error', title: 'Activity could not be saved', message: errorMsg });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddActivityClick = () => {
    const targetName = tpoData?.name || tpoData?.userName || myName;
    const currentMyStat = tpoActivity.find(t => normalizePlacementText(t.tpo) === normalizePlacementText(targetName));
    setActivityForm({
      tpoName: targetName,
      reportMonth: monthFilter,
      activityItems: (currentMyStat?.activityItems || []).map(item => ({ ...item, companies: [...(item.companies || [])] })),
      mode: currentMyStat?.hasActivitySession ? 'edit' : 'add'
    });
    setShowActivityModal(true);
  };

  const handleEditActivityClick = activity => {
    setActivityForm({
      tpoName: activity.tpo,
      reportMonth: activity.reportMonth || monthFilter,
      activityItems: activity.activityItems.map(item => ({ ...item, companies: [...(item.companies || [])] })),
      mode: 'edit'
    });
    setShowActivityModal(true);
  };

  const sendMonthlyReport = async (deliveryMode = 'gifty') => {
    if (!monthFilter || sendingReport) return;
    setSendingReport(deliveryMode);
    setSendReportMessage('');
    try {
      const response = await axios.post(`${API_BASE}/api/tpo/reports/send`, { month: monthFilter, deliveryMode }, { timeout: 60000 });
      if (!response.data?.success) throw new Error(response.data?.message || 'The report could not be sent.');
      const cc = Array.isArray(response.data.cc) ? response.data.cc : [];
      const delivery = response.data.queued ? 'queued as a new email' : 'sent as a new email';
      const message = `Monthly report ${delivery} to ${response.data.to || 'gifty@ipcsglobal.com'}${cc.length ? ` · CC: ${cc.join(', ')}` : ''} (${displayMonthName}).`;
      setSendReportMessage(message);
      setToast({ type: 'success', title: 'Monthly report sent', message });
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'The report could not be sent.';
      setSendReportMessage(message);
      setToast({ type: 'error', title: 'Monthly report could not be sent', message });
    } finally {
      setSendingReport('');
    }
  };

  const reportStyles = `
    .rt-tabs { display: flex; gap: 15px; margin-bottom: 30px; overflow-x: auto; padding-bottom: 10px; }
    .rt-tab { background: var(--card-bg); border: 1px solid var(--card-border); color: var(--text-muted); padding: 14px 28px; border-radius: 30px; cursor: pointer; white-space: nowrap; font-weight: bold; font-size: 1.05rem; transition: all 0.2s; display: flex; align-items: center; gap: 10px; }
    .rt-tab:hover { background: #1e293b; color: #fff; }
    .rt-tab.active { background: rgba(56, 189, 248, 0.15); color: var(--accent-primary); border-color: var(--accent-primary); box-shadow: 0 4px 15px rgba(56, 189, 248, 0.2); }
    
    .hero-card { background: #0f1523; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; margin-bottom: 3rem; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
    .hc-header { background: linear-gradient(90deg, #0284c7, #3b82f6); color: #fff; padding: 22px 30px; font-size: 1.4rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; display: flex; justify-content: space-between; align-items: center; }
    .hc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1px; background: #1e293b; }
    .hc-item { background: #0f1523; padding: 25px 30px; }
    .hc-label { font-size: 0.9rem; color: #94a3b8; text-transform: uppercase; margin-bottom: 10px; font-weight: bold; letter-spacing: 0.5px; }
    .hc-value { font-size: 1.4rem; color: #fff; font-weight: 700; word-break: break-word; }
    .hc-subheader { background: #161e2e; color: var(--accent-primary); padding: 18px 30px; font-weight: bold; font-size: 1.2rem; border-top: 1px solid #1e293b; border-bottom: 1px solid #1e293b; display: flex; align-items: center; gap: 10px; }
    
    .data-table-wrap { background: #0f1523; border: 1px solid #1e293b; border-radius: 16px; overflow: hidden; margin-bottom: 3rem; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
    .data-table-head { background: #161e2e; padding: 22px 30px; font-weight: bold; font-size: 1.25rem; color: #fff; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; }
    .dt { width: 100%; border-collapse: collapse; }
    .dt th { background: #0f1523; color: #94a3b8; padding: 18px 25px; text-align: center; font-size: 1rem; text-transform: uppercase; border-bottom: 1px solid #1e293b; white-space: nowrap; font-weight: 800; border-right: 1px solid #1e293b; }
    .dt th:first-child { text-align: left; }
    .dt td { padding: 18px 25px; color: #cbd5e1; border-bottom: 1px solid #1e293b; font-size: 1.15rem; text-align: center; border-right: 1px solid #1e293b; font-weight: 600; }
    .dt td:first-child { text-align: left; color: #fff; }
    .dt tr:hover td { background: #161e2e; }
    .dt .dt-total { color: var(--accent-primary); font-weight: 800; background: rgba(56, 189, 248, 0.05); }
    .dt .dt-zero { color: #475569; font-weight: 400; }
    .dt tfoot td { background: rgba(255,255,255,0.05); font-weight: 800; color: #fff; font-size: 1.25rem; border-top: 2px solid var(--accent-primary); border-bottom: none; }
  `;

  return (
    <Layout>
      <style>{reportStyles}</style>
      <div className="page-container" style={{ padding: 0 }}>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '25px', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h1 style={{ fontSize: '2.4rem', margin: '0 0 8px 0' }}>Live Analytics Reports</h1>
            <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1.1rem' }}>Comprehensive tracking, matrices, and placement data.</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <input type="month" className="sleek-input" style={{ background: '#0f1523', border: '1px solid var(--accent-primary)', color: 'var(--accent-primary)', fontWeight: 'bold', fontSize: '1.15rem', padding: '12px 20px' }} value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} />
            {isSuperAdmin && <select aria-label="Filter reports by TPO" className="sleek-input" style={{ background: '#0f1523', border: '1px solid var(--card-border)', color: 'var(--text-main)', fontWeight: 700, padding: '12px 16px', minWidth: '210px' }} value={reportTpoFilter} onChange={event => setReportTpoFilter(event.target.value)}>
              <option value="all">All TPOs</option>
              {tpoList.map((tpo, index) => <option key={`${reportTpoKey(tpo)}-${index}`} value={reportTpoKey(tpo)}>{tpo.userName || tpo.name || tpo.email}</option>)}
            </select>}
            {canSendMonthlyReport && <>
              <button type="button" onClick={() => sendMonthlyReport('gifty')} disabled={reportLoading || Boolean(sendingReport) || !monthFilter} title="To Gifty · CC the sending account" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(52,211,153,.4)', background: 'linear-gradient(120deg, rgba(16,185,129,.2), rgba(14,165,233,.17))', color: '#a7f3d0', fontWeight: 800, cursor: reportLoading || sendingReport ? 'wait' : 'pointer', opacity: reportLoading || sendingReport ? .65 : 1 }}>
                {sendingReport === 'gifty' ? <CircleNotch size={17} className="ph-spin" /> : <PaperPlaneTilt size={17} weight="fill" />}
                {sendingReport === 'gifty' ? 'Sending…' : 'Send monthly report'}
              </button>
              <button type="button" onClick={() => sendMonthlyReport('gifty_rakesh_cc')} disabled={reportLoading || Boolean(sendingReport) || !monthFilter} title="To Gifty · CC the sending account and Rakesh" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(96,165,250,.42)', background: 'linear-gradient(120deg, rgba(59,130,246,.2), rgba(139,92,246,.17))', color: '#bfdbfe', fontWeight: 800, cursor: reportLoading || sendingReport ? 'wait' : 'pointer', opacity: reportLoading || sendingReport ? .65 : 1 }}>
                {sendingReport === 'gifty_rakesh_cc' ? <CircleNotch size={17} className="ph-spin" /> : <PaperPlaneTilt size={17} weight="fill" />}
                {sendingReport === 'gifty_rakesh_cc' ? 'Sending…' : 'Send with Rakesh in CC'}
              </button>
            </>}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '18px', padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(245,158,11,.28)', background: 'rgba(120,75,17,.12)' }}>
          <span style={{ color: '#fcd79a', fontWeight: 750 }}>{selectedReportTpo ? `Eligible pending · assigned branches for ${selectedReportTpo.userName || selectedReportTpo.name}` : 'Portal-wide placement pending'} · only students marked Pending / Placement Needed at 90%+ course completion</span>
          <strong style={{ color: '#fff', fontSize: '1.35rem' }}>{(selectedReportTpo ? pendTotals.Total : portalPlacementPending).toLocaleString('en-IN')}</strong>
        </div>
        {sendReportMessage && <div role="status" style={{ marginBottom: '18px', padding: '12px 15px', borderRadius: '10px', border: `1px solid ${sendReportMessage.includes('could not') || sendReportMessage.includes('failed') ? 'rgba(248,113,113,.4)' : 'rgba(52,211,153,.35)'}`, color: sendReportMessage.includes('could not') || sendReportMessage.includes('failed') ? '#fecaca' : '#a7f3d0', background: sendReportMessage.includes('could not') || sendReportMessage.includes('failed') ? 'rgba(127,29,29,.18)' : 'rgba(6,78,59,.18)' }}>{sendReportMessage}</div>}

        {reportLoading && <div role="status" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px', color: 'var(--text-muted)' }}><CircleNotch className="ph-spin" size={20} />Loading report data…</div>}
        {reportError && <div role="alert" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '18px', padding: '13px 16px', border: '1px solid rgba(248,113,113,.35)', borderRadius: '10px', color: '#fecaca', background: 'rgba(127,29,29,.2)' }}><span>Report data could not be loaded: {reportError}</span><button type="button" onClick={() => setReportReloadKey(value => value + 1)} style={{ padding: '7px 12px', borderRadius: '8px', border: '1px solid rgba(248,113,113,.5)', background: 'transparent', color: '#fecaca', cursor: 'pointer' }}>Retry</button></div>}

        {dataMeta && <DataSourceStatus
          source="TPO_Log"
          detail="Monthly targets count every canonical TPO_Log row with Status = Placed, including repeat placements. Action-history snapshots are excluded. Date Placed is used, then Timestamp if blank."
          health={targetLogHealthy}
          lastSyncedAt={targetLogLastSyncedAt}
          lastAttemptAt={dataMeta.lastRefreshAttemptAt}
          onRefresh={() => setReportReloadKey(value => value + 1)}
          refreshing={reportLoading}
        />}

        <div className="rt-tabs">
          <button className={`rt-tab ${activeTab === 1 ? 'active' : ''}`} onClick={() => setActiveTab(1)}>
            <Target size={24} weight={activeTab === 1 ? "fill" : "regular"} /> {isSuperAdmin ? 'TPO Target Reports' : 'My Target Report'}
          </button>
          <button className={`rt-tab ${activeTab === 2 ? 'active' : ''}`} onClick={() => setActiveTab(2)}>
            <Buildings size={24} weight={activeTab === 2 ? "fill" : "regular"} /> Branch Matrices
          </button>
          <button className={`rt-tab ${activeTab === 3 ? 'active' : ''}`} onClick={() => setActiveTab(3)}>
            <ChartLineUp size={24} weight={activeTab === 3 ? "fill" : "regular"} /> Placement Tracker
          </button>
          <button className={`rt-tab ${activeTab === 4 ? 'active' : ''}`} onClick={() => setActiveTab(4)}>
            <ShieldCheck size={24} weight={activeTab === 4 ? "fill" : "regular"} /> TPO Activities
          </button>
        </div>

        {/* ========================================================= */}
        {/* TAB 1: DYNAMIC STACKED TPO TARGET REPORTS                 */}
        {/* ========================================================= */}
        {activeTab === 1 && (
          <div className="fade-in">
            {isSuperAdmin && !reportLoading && tpoList.length > 0 && (
              <section aria-label="Placement count reconciliation" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '10px', margin: '0 0 22px', padding: '14px', borderRadius: '12px', border: '1px solid var(--card-border)', background: 'var(--card-bg)' }}>
                <div><small style={{ color: 'var(--text-muted)' }}>TPO_Log Placed rows · {displayMonthName}</small><strong style={{ display: 'block', fontSize: '1.3rem', color: 'var(--text-main)' }}>{targetSourceRowsThisMonth.length}</strong></div>
                <div><small style={{ color: 'var(--text-muted)' }}>Rows matched to listed TPOs</small><strong style={{ display: 'block', fontSize: '1.3rem', color: 'var(--text-main)' }}>{targetSourceRowsThisMonth.length - currentMonthRowsWithoutMatchedTpo}</strong></div>
                <div><small style={{ color: 'var(--text-muted)' }}>Rows without a recognized TPO</small><strong style={{ display: 'block', fontSize: '1.3rem', color: currentMonthRowsWithoutMatchedTpo ? '#fbbf24' : 'var(--text-main)' }}>{currentMonthRowsWithoutMatchedTpo}</strong></div>
                <div><small style={{ color: 'var(--text-muted)' }}>Placed rows missing a usable date · all months</small><strong style={{ display: 'block', fontSize: '1.3rem', color: placedRowsWithoutUsableDate ? '#fbbf24' : 'var(--text-main)' }}>{placedRowsWithoutUsableDate}</strong></div>
                <p style={{ gridColumn: '1 / -1', margin: 0, color: 'var(--text-muted)', fontSize: '.85rem' }}>This compares source rows with the TPO accounts shown below. Rows without a matching owner or usable date cannot be assigned to a TPO/month total.</p>
              </section>
            )}
            <section aria-label="Placement classifications for selected month" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', flexWrap: 'wrap', margin: '0 0 22px', padding: '15px 18px', borderRadius: '12px', border: '1px solid rgba(56,189,248,.38)', background: 'linear-gradient(100deg, rgba(14,116,144,.2), rgba(15,23,42,.68))' }}>
              <div><div style={{ color: '#7dd3fc', fontWeight: 800 }}>Placements · {displayMonthName}</div><small style={{ color: 'var(--text-muted)' }}>Joined, Not Joined, Pending Joining, Dual, and Multiple counts come from the single Joining Status dropdown.</small></div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}><strong style={{ color: '#7dd3fc', fontSize: '1rem', padding: '7px 10px', borderRadius: '9px', background: 'rgba(14,116,144,.16)' }}>International · {internationalRowsThisMonth.length}</strong><strong style={{ color: '#c4b5fd', fontSize: '1rem', padding: '7px 10px', borderRadius: '9px', background: 'rgba(109,40,217,.16)' }}>Dual · {dualPlacementsThisMonth}</strong><strong style={{ color: '#f9a8d4', fontSize: '1rem', padding: '7px 10px', borderRadius: '9px', background: 'rgba(190,24,93,.15)' }}>Multiple · {multiplePlacementsThisMonth}</strong></div>
              <button type="button" onClick={() => navigate('/placed?international=1')} style={{ padding: '8px 12px', borderRadius: '9px', border: '1px solid rgba(56,189,248,.48)', color: '#bae6fd', background: 'rgba(14,116,144,.18)', cursor: 'pointer', fontWeight: 750 }}>View international records →</button>
            </section>
            {visibleTpoList.map((tpo, idx) => {
              const placedStudentsLog = placementLogs.filter(log => {
                const logTpo = normalizePlacementText(placementOwnerValue(log));
                const identities = tpoIdentityValues(tpo);
                if (!logTpo || !identities.includes(logTpo)) return false;
                if (!isPlacedStatus(getVal(log, 'status'))) return false;

                return checkPlacementMonth(log);
              });

              const counts = Object.fromEntries(mainCourses.map(course => [course, 0]));
              placedStudentsLog.forEach(placement => {
                const course = getPlacementCourse(placement);
                counts[course] = (counts[course] || 0) + 1;
              });
              const totalPlacements = placedStudentsLog.length;
              const tpoIdentities = tpoIdentityValues(tpo);
              const reportTarget = getMonthlyTarget(tpo, monthFilter);
              const parsedTarget = Number.parseInt(reportTarget, 10);
              const targetGoal = Number.isFinite(parsedTarget) ? parsedTarget : 0;
              const hasTarget = targetGoal > 0;
              const dualCount = placedStudentsLog.filter(log => isPlacementTypeMarked(log, 'dual')).length;
              const multipleCount = placedStudentsLog.filter(log => isPlacementTypeMarked(log, 'multiple')).length;
              const progressPercent = targetGoal > 0 ? Math.min((totalPlacements / targetGoal) * 100, 100) : 0;

              return (
                <div key={idx} style={{ marginBottom: '4rem' }}>
                  <div className="hero-card">
                    <div className="hc-header">
                      <span>Placement Report</span>
                      <span style={{ color: '#bae6fd' }}>{displayMonthName.toUpperCase()}</span>
                    </div>
                    
                    <div className="hc-grid">
                      <div className="hc-item"><div className="hc-label">Name of the Employee</div><div className="hc-value">{tpo.userName || tpo.name || 'Officer'}</div></div>
                      <div className="hc-item"><div className="hc-label">Sitting Branch</div><div className="hc-value">{tpo.sittingBranch || 'N/A'}</div></div>
                      <div className="hc-item"><div className="hc-label">Emp ID</div><div className="hc-value">{tpo.empId}</div></div>
                      <div className="hc-item"><div className="hc-label">Assigned Branches</div><div className="hc-value" style={{ fontSize: '1rem' }}>{Array.isArray(tpo.assignedBranchesArray) ? tpo.assignedBranchesArray.join(', ').toUpperCase() : (tpo.assignedBranches || '').toUpperCase()}</div></div>
                      <div className="hc-item" style={{ background: 'rgba(16, 185, 129, 0.05)' }}>
                        <div className="hc-label" style={{ color: '#10b981' }}>Target For The Month</div>
                        <div className="hc-value" style={{ color: '#10b981', fontSize: hasTarget ? '2rem' : '1.2rem' }}>{hasTarget ? targetGoal : 'Not set'}</div>
                      </div>
                    </div>

                    <div className="hc-subheader" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}><span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}><Briefcase size={24} weight="fill" /> Current Status On Placements</span><div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}><span style={{ color: '#7dd3fc', fontSize: '.82rem', padding: '6px 10px', border: '1px solid rgba(56,189,248,.35)', borderRadius: '999px', background: 'rgba(14,116,144,.14)' }}>International · {placedStudentsLog.filter(log => log.isInternationalPlacement === true).length}</span><span style={{ color: '#c4b5fd', fontSize: '.82rem', padding: '6px 10px', border: '1px solid rgba(167,139,250,.35)', borderRadius: '999px', background: 'rgba(109,40,217,.13)' }}>Dual placement · {dualCount}</span><span style={{ color: '#f9a8d4', fontSize: '.82rem', padding: '6px 10px', border: '1px solid rgba(244,114,182,.35)', borderRadius: '999px', background: 'rgba(190,24,93,.12)' }}>Multiple placement · {multipleCount}</span></div></div>
                    
                    <div className="hc-grid" style={{ gridTemplateColumns: 'repeat(5, minmax(0, 1fr))' }}>
                      {mainCourses.map(c => (
                        <div key={c} className="hc-item" style={{ textAlign: 'center' }}>
                          <div className="hc-label">{c}</div>
                          <div className="hc-value" style={{ fontSize: '2.4rem', color: counts[c] > 0 ? 'var(--accent-primary)' : '#475569' }}>{counts[c]}</div>
                        </div>
                      ))}
                    </div>

                    <div style={{ background: '#0f1523', padding: '25px 30px', borderTop: '1px solid #1e293b' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                        <span style={{ color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '1.1rem' }}>Progress to Target</span>
                        <span style={{ color: '#fff', fontSize: '1.4rem', fontWeight: 'bold' }}>{hasTarget ? `${totalPlacements} / ${targetGoal} Placements` : `${totalPlacements} placements · No target set`}</span>
                      </div>
                      {hasTarget ? <div style={{ width: '100%', height: '14px', background: '#1e293b', borderRadius: '10px', overflow: 'hidden' }}>
                        <div style={{ width: `${progressPercent}%`, height: '100%', background: progressPercent >= 100 ? '#10b981' : 'var(--accent-primary)', transition: 'width 1s ease-in-out' }}></div>
                      </div> : <div style={{ width: '100%', padding: '11px 14px', boxSizing: 'border-box', borderRadius: '10px', border: '1px dashed #475569', color: 'var(--text-muted)', fontSize: '.85rem' }}>No monthly target is recorded for {displayMonthName}.</div>}
                      <div style={{ marginTop: '8px', color: 'var(--text-muted)', fontSize: '.82rem' }}>{placedStudentsLog.length} placement records counted for this TPO and month.</div>
                    </div>
                  </div>

                  <div className="data-table-wrap">
                    <div className="data-table-head">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Target size={26} color="#10b981" weight="fill"/> Logged Placements</div>
                      <div style={{ fontSize: '1rem', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', padding: '6px 16px', borderRadius: '20px' }}>By {tpo.userName || tpo.name}</div>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="dt" style={{ textAlign: 'left' }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', paddingLeft: '30px' }}>Student Details</th>
                            <th style={{ textAlign: 'left' }}>Company & Role</th>
                            <th style={{ textAlign: 'left' }}>Salary Package</th>
                            <th style={{ textAlign: 'left' }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {placedStudentsLog.length === 0 ? (
                            <tr>
                              <td colSpan="4" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '1.1rem' }}>
                                No placements recorded for this month.
                              </td>
                            </tr>
                          ) : (
                            placedStudentsLog.map((log, i) => (
                              <tr key={i}>
                                <td style={{ textAlign: 'left', paddingLeft: '30px' }}>
                                  <strong style={{ display: 'block', color: '#fff', fontSize: '1.2rem', marginBottom: '5px' }}>{getVal(log, 'studentname')}</strong>
                                  <span style={{ fontSize: '0.95rem', color: '#94a3b8' }}>{getVal(log, 'branch')} • {getVal(log, 'course')}</span>
                                </td>
                                <td style={{ textAlign: 'left' }}>
                                  <strong style={{ display: 'block', color: 'var(--accent-primary)', fontSize: '1.2rem', marginBottom: '5px' }}>{getVal(log, 'companyname')}</strong>
                                  <span style={{ fontSize: '0.95rem', color: 'var(--text-muted)' }}>{getVal(log, 'position') || 'N/A'}</span>
                                </td>
                                <td style={{ textAlign: 'left', color: '#10b981', fontWeight: 'bold', fontSize: '1.2rem' }}>
                                  {getVal(log, 'package') ? `${getVal(log, 'package')} LPA` : '-'}
                                </td>
                                <td style={{ textAlign: 'left' }}>
                                  <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '6px 14px', borderRadius: '12px', fontSize: '0.9rem', fontWeight: 'bold' }}>
                                    {(getVal(log, 'status') || 'Placed').toUpperCase()}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 2: BRANCH MATRICES                                    */}
        {/* ========================================================= */}
        {activeTab === 2 && (
          <div className="fade-in">
            <div className="data-table-wrap">
              <div className="data-table-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><UsersThree size={26} color="#f59e0b" weight="fill"/> Branchwise Student Enrollment</div>
                <div style={{ fontSize: '1rem', color: '#94a3b8' }}>{isSuperAdmin ? `All branches · ${portalPlacementPending} portal-wide` : 'My Assigned Branches'}</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dt">
                  <thead>
                    <tr><th>Branch Name</th>{mainCourses.map(c => <th key={c}>{c}</th>)}<th className="dt-total">Total Students</th></tr>
                  </thead>
                  <tbody>
                    {assignedBranches.length === 0 ? <tr><td colSpan={mainCourses.length + 2} style={{textAlign:'center', padding: '2rem'}}>No students found in assigned branches.</td></tr> : 
                    assignedBranches.map(b => (
                      <tr key={`en-${b}`}>
                        <td>{b}</td>
                        {mainCourses.map(c => <td key={c} className={branchEnrolls[b][c] === 0 ? 'dt-zero' : ''}>{branchEnrolls[b][c]}</td>)}
                        <td className="dt-total">{branchEnrolls[b].Total}</td>
                      </tr>
                    ))}
                  </tbody>
                  {assignedBranches.length > 0 && (
                    <tfoot>
                      <tr>
                        <td>TOTAL ENROLLMENT</td>
                        {mainCourses.map(c => <td key={`foot-${c}`}>{enrollTotals[c]}</td>)}
                        <td style={{ color: 'var(--accent-primary)' }}>{enrollTotals.Total}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            <div className="data-table-wrap">
              <div className="data-table-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Target size={26} color="#10b981" weight="fill"/> Branchwise Placement Matrix</div>
                <div style={{ fontSize: '1rem', color: '#94a3b8' }}>All Branches • {displayMonthName}</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dt">
                  <thead>
                    <tr><th>Branch Name</th>{mainCourses.map(c => <th key={c}>{c}</th>)}<th style={{ color: '#7dd3fc' }}>International</th><th className="dt-total" style={{ color: '#10b981' }}>Total Placed</th></tr>
                  </thead>
                  <tbody>
                    {allBranchesList.map(b => (
                      <tr key={`pl-${b}`}>
                        <td>{b}</td>
                        {mainCourses.map(c => <td key={c} className={(branchPlaces[b]?.[c] ?? 0) === 0 ? 'dt-zero' : ''}>{branchPlaces[b]?.[c] ?? 0}</td>)}
                        <td style={{ color: (branchPlaces[b]?.International ?? 0) > 0 ? '#7dd3fc' : '' }} className={(branchPlaces[b]?.International ?? 0) === 0 ? 'dt-zero' : ''}>{branchPlaces[b]?.International ?? 0}</td>
                        <td className="dt-total" style={{ color: '#10b981' }}>{branchPlaces[b]?.Total ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>TOTAL PLACED</td>
                      {mainCourses.map(c => <td key={`pfoot-${c}`}>{placeTotals[c]}</td>)}
                      <td style={{ color: '#7dd3fc' }}>{placeTotals.International}</td>
                      <td style={{ color: '#10b981' }}>{placeTotals.Total}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="data-table-wrap">
              <div className="data-table-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><Buildings size={26} color="var(--accent-primary)" weight="fill"/> Branch vs TPO Status</div>
                <div style={{ fontSize: '1rem', color: '#94a3b8' }}>All Branches • {displayMonthName}</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dt">
                  <thead>
                    <tr>
                      <th>Branch Name</th>
                      {displayTpos.map(tpo => <th key={tpo.key} style={{ color: '#fff' }}>{tpo.label.toUpperCase()}</th>)}
                      <th className="dt-total" style={{ color: 'var(--accent-primary)' }}>Branch Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allBranchesList.map(b => (
                      <tr key={`tpo-${b}`}>
                        <td>{b}</td>
                        {displayTpos.map(tpo => (
                          <td key={tpo.key} className={(branchTPO[b]?.[tpo.key] ?? 0) === 0 ? 'dt-zero' : ''} style={{ color: (branchTPO[b]?.[tpo.key] ?? 0) > 0 ? '#fff' : '' }}>
                            {branchTPO[b]?.[tpo.key] ?? 0}
                          </td>
                        ))}
                        <td className="dt-total" style={{ color: 'var(--accent-primary)' }}>{branchTPO[b]?.Total ?? 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 3: PLACEMENT TRACKER                                  */}
        {/* ========================================================= */}
        {activeTab === 3 && (
          <div className="fade-in">
            <div className="data-table-wrap">
              <div className="data-table-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><ChartLineUp size={26} color="#ec4899" weight="fill"/> Placement Data Tracking</div>
                <div style={{ fontSize: '1rem', color: '#94a3b8' }}>{displayMonthName}</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dt">
                  <thead>
                    <tr>
                      <th>Course Name</th>
                      <th style={{ color: '#10b981' }}>Status = Placed</th>
                      <th>Students Joined</th>
                      <th>Offers</th>
                      <th>Not Joined</th>
                      <th>Pending Joining</th>
                      <th style={{ color: '#c4b5fd' }}>Dual Placement</th>
                      <th style={{ color: '#f9a8d4' }}>Multiple Placement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mainCourses.map(c => {
                      const d = pipeline[c];
                      return (
                        <tr key={`trk-${c}`}>
                          <td>{c}</td>
                          <td style={{ color: '#10b981', fontWeight: 'bold' }} className={d.placed === 0 ? 'dt-zero' : ''}>{d.placed}</td>
                          <td className={d.joined === 0 ? 'dt-zero' : ''}>{d.joined}</td>
                          <td className={d.offers === 0 ? 'dt-zero' : ''}>{d.offers}</td>
                          <td className={d.notJoined === 0 ? 'dt-zero' : ''}>{d.notJoined}</td>
                          <td className={d.pendingJoining === 0 ? 'dt-zero' : ''}>{d.pendingJoining}</td>
                          <td style={{ color: d.dual ? '#c4b5fd' : undefined }} className={d.dual === 0 ? 'dt-zero' : ''}>{d.dual}</td>
                          <td style={{ color: d.multiple ? '#f9a8d4' : undefined }} className={d.multiple === 0 ? 'dt-zero' : ''}>{d.multiple}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="data-table-wrap">
              <div className="data-table-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}><CircleNotch size={26} color="#f59e0b" weight="fill"/> Placement Pending Students</div>
                <div style={{ fontSize: '1rem', color: '#94a3b8' }}>My Assigned Branches</div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dt">
                  <thead>
                    <tr><th>Branch Name</th>{mainCourses.map(c => <th key={c}>{c}</th>)}<th className="dt-total" style={{ color: '#f59e0b' }}>Total Pending</th></tr>
                  </thead>
                  <tbody>
                    {assignedBranches.length === 0 ? <tr><td colSpan={mainCourses.length + 2} style={{textAlign:'center', padding: '2rem'}}>No pending students in assigned branches.</td></tr> : 
                    assignedBranches.map(b => (
                      <tr key={`pend-${b}`}>
                        <td>{b}</td>
                        {mainCourses.map(c => <td key={c} className={pendingByCourse[b][c] === 0 ? 'dt-zero' : ''}>{pendingByCourse[b][c]}</td>)}
                        <td className="dt-total" style={{ color: '#f59e0b' }}>{pendingByCourse[b].Total}</td>
                      </tr>
                    ))}
                  </tbody>
                  {assignedBranches.length > 0 && (
                    <tfoot>
                      <tr>
                        <td>TOTAL PENDING</td>
                        {mainCourses.map(c => <td key={`pdfoot-${c}`}>{pendTotals[c]}</td>)}
                        <td style={{ color: '#f59e0b' }}>{pendTotals.Total}</td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* TAB 4: TPO ACTIVITIES                                     */}
        {/* ========================================================= */}
        {activeTab === 4 && (
          <div className="fade-in">
            <div className="data-table-wrap">
              <div className="data-table-head">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <ShieldCheck size={26} color="#0ea5e9" weight="fill"/> Placement Officer Activities & Logs
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                  <div style={{ fontSize: '1rem', color: '#94a3b8' }}>{displayMonthName}</div>
                  {canSendMonthlyReport && <button
                    onClick={handleAddActivityClick}
                    style={{ background: '#0284c7', border: 'none', color: 'white', padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Plus weight="bold" /> Add Activity Count
                  </button>}
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="dt">
                  <thead>
                    <tr>
                      <th>Placement Officer</th>
                      <th>Month</th>
                      <th>Company Count</th>
                      <th>Companies visited · S.No.</th>
                      <th>Drives Conducted</th>
                      <th>Poster Count</th>
                      <th>Posters · S.No. / Title</th>
                      <th>Video Count</th>
                      <th>Videos · S.No. / Title</th>
                      <th style={{ color: '#10b981' }}>Total Joined</th>
                      <th style={{ color: '#ef4444' }}>Not Joining</th>
                      <th className="dt-total">Total Apps Handled</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tpoActivity.length === 0 ? <tr><td colSpan="13" style={{textAlign:'center', padding: '2rem'}}>No TPO activities logged this month.</td></tr> :
                    tpoActivity.map(t => (
                      <tr key={`act-${t.tpo}`}>
                        <td>{t.tpo}</td>
                        <td>{t.reportMonth}</td>
                        <td className={t.companiesVisited === 0 ? 'dt-zero' : ''}>{t.companiesVisited}</td>
                        <td style={{ textAlign: 'left', minWidth: '190px' }}>
                          {t.companyItems.length ? <ol style={{ margin: 0, paddingLeft: '24px' }}>{t.companyItems.map((company, index) => <li key={`${company}-${index}`} style={{ padding: '2px 0' }}>{company}</li>)}</ol> : '—'}
                        </td>
                        <td className={t.drivesConducted === 0 ? 'dt-zero' : ''}>{t.drivesConducted}</td>
                        <td className={t.branchPosters === 0 ? 'dt-zero' : ''}>{t.branchPosters}</td>
                        <td style={{ textAlign: 'left', minWidth: '210px' }}>
                          {t.posterItems.length ? <ol style={{ margin: 0, paddingLeft: '24px' }}>{t.posterItems.map((item, index) => <li key={`${item.id || item.value || item.title}-${index}`} style={{ padding: '2px 0' }}>
                            {getActivityPostingStatus(item) === 'completed' && item.value
                              ? <a href={item.value} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)' }}>{item.title || getActivityTypeLabel(item.type)}</a>
                              : <span style={{ color: '#cbd5e1' }}>{item.title || getActivityTypeLabel(item.type)}</span>}
                            <span style={{ marginLeft: 7, fontSize: '.72rem', color: getActivityPostingStatus(item) === 'completed' ? '#6ee7b7' : '#fbbf24' }}>{getActivityPostingStatus(item) === 'completed' ? 'Post completed' : 'Pending to post'}</span>
                          </li>)}</ol> : '—'}
                        </td>
                        <td className={t.branchVideos === 0 ? 'dt-zero' : ''}>{t.branchVideos}</td>
                        <td style={{ textAlign: 'left', minWidth: '210px' }}>
                          {t.videoItems.length ? <ol style={{ margin: 0, paddingLeft: '24px' }}>{t.videoItems.map((item, index) => <li key={`${item.id || item.value || item.title}-${index}`} style={{ padding: '2px 0' }}>
                            {getActivityPostingStatus(item) === 'completed' && item.value
                              ? <a href={item.value} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-primary)' }}>{item.title || getActivityTypeLabel(item.type)}</a>
                              : <span style={{ color: '#cbd5e1' }}>{item.title || getActivityTypeLabel(item.type)}</span>}
                            <span style={{ marginLeft: 7, fontSize: '.72rem', color: getActivityPostingStatus(item) === 'completed' ? '#6ee7b7' : '#fbbf24' }}>{getActivityPostingStatus(item) === 'completed' ? 'Post completed' : 'Pending to post'}</span>
                          </li>)}</ol> : '—'}
                        </td>
                        <td style={{ color: '#10b981', fontWeight: 'bold' }} className={t.joining === 0 ? 'dt-zero' : ''}>{t.joining}</td>
                        <td style={{ color: '#ef4444', fontWeight: 'bold' }} className={t.notJoining === 0 ? 'dt-zero' : ''}>{t.notJoining}</td>
                        <td className="dt-total">{t.totalApps}</td>
                        <td>
                          {(isSuperAdmin || myIdentities.includes(normalizePlacementText(t.tpo))) && t.hasActivitySession
                            ? <button type="button" onClick={() => handleEditActivityClick(t)} style={{ border: '1px solid rgba(56,189,248,.35)', borderRadius: '7px', padding: '7px 11px', color: '#bae6fd', background: 'rgba(2,132,199,.12)', fontWeight: 750, cursor: 'pointer' }}>Edit</button>
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>

      {/* 🚨 TPO ACTIVITY MODAL */}
      {showActivityModal && (
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.8)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }} onClick={event => { if (event.target === event.currentTarget) setShowActivityModal(false); }}>
          <div style={{ background: '#0f1523', padding: '30px', borderRadius: '12px', border: '1px solid #1e293b', width: '680px', maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginTop: 0, color: '#fff', borderBottom: '1px solid #1e293b', paddingBottom: '15px' }}>{activityForm.mode === 'edit' ? 'Edit activity session' : 'Add activity session'}</h2>
            <form onSubmit={submitActivityStats}>
              <p style={{ color: '#94a3b8', fontSize: '.9rem', margin: '0 0 18px' }}>Choose the month, then add company visits and titled social posts or videos. Completed posts are counted; pending posts stay listed until they are published.</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px', marginBottom: '18px' }}>
                <label style={{ display: 'grid', gap: '6px', color: '#94a3b8', fontSize: '.8rem' }}>
                  Report month
                  <input type="month" required value={activityForm.reportMonth || monthFilter} onChange={event => {
                    const reportMonth = event.target.value;
                    const ownerKey = normalizePlacementText(activityForm.tpoName);
                    const matchingSession = tpoStatsData.find(stat => normalizePlacementText(getVal(stat, 'user')) === ownerKey && getTpoActivityMonth(stat) === reportMonth);
                    setActivityForm(current => ({
                      ...current,
                      reportMonth,
                      activityItems: activityItemsFromStats(matchingSession).map(item => ({ ...item, companies: [...(item.companies || [])] })),
                      mode: matchingSession ? 'edit' : 'add'
                    }));
                  }} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }} />
                </label>
                <div style={{ display: 'grid', gap: '6px', color: '#94a3b8', fontSize: '.8rem' }}>
                  Activity owner
                  <div style={{ padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: '#121c2c', color: '#e2e8f0' }}>{activityForm.tpoName || tpoData?.name || 'Trainer'}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '14px', marginBottom: '16px' }}>
                {activityForm.activityItems.map((item, itemIndex) => (
                  <section key={item.id} style={{ padding: '15px', border: '1px solid #29384f', borderRadius: '10px', background: '#121c2c' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 1fr) auto', alignItems: 'end', gap: '10px', marginBottom: '13px' }}>
                      <div>
                        <label htmlFor={`activity-type-${item.id}`} style={{ display: 'block', color: '#94a3b8', fontSize: '.8rem', marginBottom: '6px' }}>Activity type</label>
                        <select id={`activity-type-${item.id}`} value={item.type} onChange={event => {
                          const type = event.target.value;
                          setActivityForm(current => ({ ...current, activityItems: current.activityItems.map(entry => entry.id === item.id ? { ...createActivityItem(type), id: item.id } : entry) }));
                        }} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }}>
                          {MONTHLY_ACTIVITY_TYPES.map(type => <option key={type.value} value={type.value}>{type.label}</option>)}
                        </select>
                      </div>
                      <button type="button" aria-label={`Remove activity ${itemIndex + 1}`} onClick={() => setActivityForm(current => ({ ...current, activityItems: current.activityItems.filter(entry => entry.id !== item.id) }))} style={{ width: '39px', height: '39px', display: 'grid', placeItems: 'center', borderRadius: '7px', border: '1px solid #693b4a', background: 'rgba(127,29,29,.2)', color: '#fda4af', cursor: 'pointer' }}><Trash size={17} /></button>
                    </div>
                    {item.type === 'company_visit' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '9px' }}>
                        {Array.from({ length: 10 }, (_, companyIndex) => <input key={companyIndex} aria-label={`Company name ${companyIndex + 1} for visit ${itemIndex + 1}`} value={item.companies?.[companyIndex] || ''} onChange={event => setActivityForm(current => ({ ...current, activityItems: current.activityItems.map(entry => entry.id === item.id ? { ...entry, companies: Array.from({ length: 10 }, (_, index) => index === companyIndex ? event.target.value : entry.companies?.[index] || '') } : entry) }))} placeholder={`Company ${companyIndex + 1}`} style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: '#0d1522', color: '#fff' }} />)}
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: '10px' }}>
                        <label htmlFor={`activity-title-${item.id}`} style={{ display: 'grid', gap: '6px', color: '#94a3b8', fontSize: '.8rem' }}>{getActivityTypeLabel(item.type)} title / name <span style={{ color: '#64748b', fontSize: '.7rem' }}>Optional</span>
                          <input id={`activity-title-${item.id}`} type="text" maxLength={180} value={item.title || ''} onChange={event => setActivityForm(current => ({ ...current, activityItems: current.activityItems.map(entry => entry.id === item.id ? { ...entry, title: event.target.value } : entry) }))} placeholder={`Optional: name this ${item.type.includes('video') ? 'video' : 'poster'}`} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: '#0d1522', color: '#fff' }} />
                        </label>
                        <label htmlFor={`activity-link-${item.id}`} style={{ display: 'grid', gap: '6px', color: '#94a3b8', fontSize: '.8rem' }}>{getActivityTypeLabel(item.type)} link
                          <input id={`activity-link-${item.id}`} type="url" inputMode="url" value={item.value || ''} onChange={event => setActivityForm(current => ({ ...current, activityItems: current.activityItems.map(entry => entry.id === item.id ? { ...entry, value: event.target.value } : entry) }))} placeholder={item.postingStatus === 'pending' ? 'Optional until posted' : 'https://...'} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: '#0d1522', color: '#fff' }} />
                        </label>
                        <label htmlFor={`activity-status-${item.id}`} style={{ display: 'grid', gap: '6px', color: '#94a3b8', fontSize: '.8rem' }}>Posting status
                          <select id={`activity-status-${item.id}`} value={getActivityPostingStatus(item)} onChange={event => setActivityForm(current => ({ ...current, activityItems: current.activityItems.map(entry => entry.id === item.id ? { ...entry, postingStatus: event.target.value } : entry) }))} style={{ width: '100%', boxSizing: 'border-box', padding: '10px', borderRadius: '6px', border: '1px solid #334155', background: '#1e293b', color: '#fff' }}>
                            <option value="completed">Post completed</option>
                            <option value="pending">Pending to post</option>
                          </select>
                        </label>
                      </div>
                    )}
                  </section>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
                <button type="button" disabled={activityForm.activityItems.length >= MAX_MONTHLY_ACTIVITY_ITEMS} onClick={() => setActivityForm(current => ({ ...current, activityItems: [...current.activityItems, createActivityItem()] }))} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '9px 13px', borderRadius: '7px', border: '1px solid rgba(45,212,191,.4)', background: 'rgba(13,148,136,.15)', color: '#99f6e4', fontWeight: 700, cursor: activityForm.activityItems.length >= MAX_MONTHLY_ACTIVITY_ITEMS ? 'not-allowed' : 'pointer', opacity: activityForm.activityItems.length >= MAX_MONTHLY_ACTIVITY_ITEMS ? .55 : 1 }}><Plus size={17} weight="bold" /> Add activity</button>
                <small style={{ color: '#94a3b8' }}>{activityForm.activityItems.length} of {MAX_MONTHLY_ACTIVITY_ITEMS} entries</small>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowActivityModal(false)} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #334155', background: 'transparent', color: '#fff', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" disabled={isSubmitting} style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', background: 'var(--accent-primary)', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                  {isSubmitting ? 'Saving...' : activityForm.mode === 'edit' ? 'Save changes' : 'Save activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PortalToast toast={toast} onDismiss={() => setToast(null)} />
    </Layout>
  );
}
