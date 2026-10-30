const { doc: academicDoc, getCache, hasAccess, loadDocInfo, google, serviceAccountAuth } = require('./config');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { formatIndiaTimestamp } = require('./utils/dateTime');
const { createHash } = require('crypto');

let loadPromise;
let cachedData;
let cachedAt = 0;
let dataPromise;
const CACHE_TTL_MS = 5 * 60 * 1000;
const BANGALORE_ATTENDANCE_SPREADSHEET_ID = String(
  process.env.BANGALORE_ATTENDANCE_SPREADSHEET_ID || process.env.ATTENDANCE_SPREADSHEET_ID ||
  '1Ba2Nk8IiMmBh-jvxbBKLosCLi_De-uMHEzgeNz0mRik'
).trim();
const attendanceWorkbooks = new Map();
const legacyMasterGridCache = new Map();
const LEGACY_COURSE_SHEETS = [
  { name: 'Embedded_&_IoT', course: 'Embedded & IoT', dailyColumn: 1, statusColumn: 16 },
  { name: 'Information_Technology', course: 'Information Technology', dailyColumn: 6, statusColumn: 16 },
  { name: 'Industrial_Automation', course: 'Industrial Automation', dailyColumn: 11, statusColumn: 17 },
  { name: 'BMS_&_CCTV', course: 'BMS & CCTV', dailyColumn: 16, statusColumn: 17 },
  { name: 'Digital_Marketing', course: 'Digital Marketing', dailyColumn: 21, statusColumn: 16 },
];

const SHEET_TITLES = {
  training: ['01_Training', 'training'],
  batches: ['02_Batches', 'batches'],
  topics: ['03_Topics', 'topics'],
  sessions: ['04_Sessions', 'sessions'],
  attendance: ['05_Attendance', 'Attendance', 'attendance'],
  topicProgress: ['06_Topic_Progress', 'topicprogress'],
  diary: ['07_Diary', 'diary'],
  leaveRequests: ['08_Leave_Requests', 'Leave Requests', 'Student Leaves', 'Student Leave Requests', 'Leave Form Responses', 'Form Responses 1', 'Form Responses 2', 'leave requests', 'leaves'],
};

const FIELD_HEADERS = {
  trainingId: ['trainingid'], studentId: ['studentid', 'rollnumber', 'ipcsrollnumber'],
  studentName: ['studentname', 'name'], mainCourse: ['maincourse', 'course'],
  subCourse: ['subcourse', 'specialization', 'track', 'coursetrack'], branch: ['branch'],
  trainingType: ['trainingtype', 'type'], trainerId: ['trainerid'],
  trainerName: ['trainername', 'trainer'], plannedHours: ['plannedhours', 'totalhours'],
  completedHours: ['completedhours', 'actualhours'], progress: ['progress', 'progresspercentage', 'progress%'],
  status: ['trainingstatus', 'status'], startDate: ['startdate'], expectedEndDate: ['expectedenddate', 'enddate'],
  batchId: ['batchid'], batchName: ['batchname', 'batchtitle', 'title', 'name'],
  schedule: ['schedule', 'trainingschedule'], classTiming: ['classtiming', 'classtime'],
  studentIds: ['studentids', 'students', 'rollnumbers', 'studentrollnumbers'],
  topicId: ['topicid'], module: ['module', 'modulename'], topic: ['topic', 'topictitle'],
  subtopic: ['subtopic', 'subtopics'], sequence: ['sequence', 'sequencenumber'],
  sessionId: ['sessionid'], date: ['date', 'sessiondate', 'eventdate'],
  startTime: ['starttime'], endTime: ['endtime'], actualHours: ['actualhours', 'completedhours'],
  sessionStatus: ['sessionstatus', 'status'], remarks: ['remarks', 'notes'],
  attendanceId: ['attendanceid'], attendanceStatus: ['attendancestatus', 'status'],
  markingMethod: ['markingmethod', 'method'], verified: ['verified', 'verificationstatus'],
  verifiedBy: ['verifiedby', 'verifierid'], diaryId: ['diaryid'], eventType: ['eventtype', 'type'],
  title: ['title'], description: ['description', 'notes'], createdBy: ['createdby', 'trainername'],
  comprehension: ['comprehension', 'understanding'], completed: ['completed', 'topicstatus'],
  courseDuration: ['durationofthecourse', 'courseduration', 'duration'], modeOfClass: ['modeofclass', 'classmode', 'mode'],
  parentPhone: ['parentphone', 'parentphonenumber', 'guardianphone'], syllabusCompleted: ['syllabuscompleted', 'coursecompletedpercentage', 'completedpercentage'],
  attendedDays: ['totalnumberofdaysattendedtheclass', 'attendeddays', 'totalattendancedays'],
  batchStartTime: ['batchstarttime', 'starttime'], batchEndTime: ['batchendtime', 'endtime'],
  courseCompletedDate: ['coursecompleteddate', 'completeddate'], reasonRemarks: ['reasonremarks', 'reason', 'remarks'],
  feesStatus: ['feesstatus', 'feestatus'], certificateApplied: ['certificateapplied'], certificateReceived: ['certificatereceived', 'certificaterecieved'],
  feedback: ['feedback'], placement: ['placement'], placementStatus: ['placementstatus'], absentMonths: ['noofmonthabsent', 'monthabsent', 'absentmonths'],
  absenceReason: ['reasonforabsent', 'absencereason'], masterCourse: ['mastercourse', 'department'],
  leaveId: ['leaveid', 'requestid', 'applicationid'],
  leaveStatus: ['leavestatus', 'approvalstatus', 'requeststatus', 'status'],
  fromDate: ['fromdate', 'startdate', 'leavefrom'], toDate: ['todate', 'enddate', 'leaveto'],
  reason: ['leavereason', 'reason', 'notes'],
  requestedAt: ['requestedat', 'submittedat', 'requestdate', 'createdat'],
  approvedBy: ['approvedby', 'reviewedby', 'decidedby', 'reviewer'], decisionDate: ['decisiondate', 'reviewedat', 'approvedat'],
  approvalNotes: ['approvalnotes', 'reviewremarks', 'decisionremarks', 'adminremarks'],
};

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function loadAcademicDoc() {
  if (!loadPromise) loadPromise = loadDocInfo().catch(error => { loadPromise = null; throw error; });
  await loadPromise;
}

function findSheet(key) {
  const titles = SHEET_TITLES[key] || [key];
  for (const title of titles) {
    if (academicDoc.sheetsByTitle[title]) return academicDoc.sheetsByTitle[title];
  }
  const candidates = titles.map(normalize);
  return academicDoc.sheetsByIndex.find(sheet => {
    const name = normalize(sheet.title);
    return candidates.some(candidate => name === candidate || name.includes(candidate));
  }) || null;
}

function getFieldHeader(headers, field) {
  const aliases = FIELD_HEADERS[field] || [field];
  const cleaned = headers.map(header => ({ header, name: normalize(header) }));
  for (const alias of aliases) {
    const target = normalize(alias);
    const exact = cleaned.find(item => item.name === target);
    if (exact) return exact.header;
  }
  for (const alias of aliases) {
    const target = normalize(alias);
    const partial = cleaned.find(item => item.name.includes(target));
    if (partial) return partial.header;
  }
  return null;
}

function readField(row, field, fallback = '') {
  const headers = row?._worksheet?.headerValues || Object.keys(row?.toObject?.() || {});
  const header = getFieldHeader(headers, field);
  return header ? (row.get(header) ?? fallback) : fallback;
}

function makeRow(sheet, values) {
  const row = {};
  const headers = sheet.headerValues || [];
  for (const [field, value] of Object.entries(values)) {
    if (value === undefined) continue;
    const header = getFieldHeader(headers, field);
    if (header) row[header] = value;
  }
  return row;
}

async function ensureLeaveReviewHeaders(sheet) {
  await sheet.loadHeaderRow();
  const headers = [...(sheet.headerValues || [])];
  const required = [
    ['leaveStatus', 'Leave Status'],
    ['approvedBy', 'Reviewed By'],
    ['decisionDate', 'Decision Date'],
    ['approvalNotes', 'Approval Notes'],
  ];
  let changed = false;
  for (const [field, label] of required) {
    if (!getFieldHeader(headers, field)) { headers.push(label); changed = true; }
  }
  if (changed) {
    await sheet.setHeaderRow(headers);
    await sheet.loadHeaderRow();
  }
}

function mapRow(row, fields) {
  return Object.fromEntries(fields.map(field => [field, readField(row, field)]));
}

async function readRows(sheet) {
  if (!sheet) return [];
  try {
    return await sheet.getRows();
  } catch (error) {
    if (String(error.message || '').includes('No values in the header row')) return [];
    throw error;
  }
}

function mapStudent(row) {
  const headers = row._worksheet?.headerValues || [];
  const read = (aliases, excluded = []) => {
    const normalizedAliases = aliases.map(normalize);
    const normalizedExclusions = excluded.map(normalize);
    const exact = headers.find(item => normalizedAliases.includes(normalize(item)));
    const header = exact || headers.find(item => {
      const candidate = normalize(item);
      return normalizedAliases.some(alias => candidate.includes(alias))
        && !normalizedExclusions.some(exclusion => candidate.includes(exclusion));
    });
    return header ? (row.get(header) || '') : '';
  };
  return {
    studentId: read(['ipcsrollnumber', 'rollnumber', 'roll']),
    studentName: read(['studentname', 'name']),
    mainCourse: read(['course', 'maincourse']),
    subCourse: read(['subcourse', 'specialization']),
    branch: read(['branch']),
    status: read(['studentstatus', 'enrollmentstatus', 'coursestatus', 'status']),
    phone: read(['phone', 'mobilenumber', 'contactnumber', 'contactno'], ['parent', 'father', 'mother', 'friend', 'reference', 'emergency']),
    email: read(['email', 'mailid', 'mail'], ['parent', 'father', 'mother', 'friend', 'reference']),
    parentPhone: read(['parentphone', 'parentphonenumber', 'guardianphone', 'fatherphone', 'motherphone']),
    qualification: read(['qualification', 'qual']),
    stream: read(['stream', 'discipline']),
    joiningDate: read(['joiningdate', 'dateofjoining']),
    courseDuration: read(['durationofthecourse', 'courseduration', 'duration']),
    modeOfClass: read(['modeofclass', 'classmode', 'mode']),
    syllabusCompleted: read(['syllabuscompleted', 'coursecompletedpercentage', 'completedpercentage']),
    attendedDays: read(['totalnumberofdaysattendedtheclass', 'attendeddays', 'totalattendancedays']),
    batch: read(['batch', 'batchname']),
    batchStartTime: read(['batchstarttime', 'starttime']),
    batchEndTime: read(['batchendtime', 'endtime']),
    courseStatus: read(['coursestatus', 'statuscurrently', 'studentstatus', 'enrollmentstatus', 'status']),
    courseCompletedDate: read(['coursecompleteddate', 'completeddate']),
    reasonRemarks: read(['reasonremarks', 'reason', 'remarks']),
    feesStatus: read(['feesstatus', 'feestatus']),
    certificateApplied: read(['certificateapplied']),
    certificateReceived: read(['certificatereceived', 'certificaterecieved']),
    feedback: read(['feedback']),
    placement: read(['placement']),
    placementStatus: read(['placementstatus']),
    absentMonths: read(['noofmonthabsent', 'monthabsent', 'absentmonths']),
    absenceReason: read(['reasonforabsent', 'absencereason']),
    coursePercentage: read(['coursepercentage', 'coursepercent', 'progresspercentage']) || read(['syllabuscompleted']),
    experience: read(['experience', 'fresher', 'experiencestatus']),
  };
}

function mapRecords(rows, fields) {
  return rows.map(row => ({ rowNumber: row.rowNumber, ...mapRow(row, fields) }));
}

async function readAllAcademicData(force = false) {
  if (!force && cachedData && Date.now() - cachedAt < CACHE_TTL_MS) return cachedData;
  if (dataPromise) return dataPromise;
  dataPromise = (async () => {
    await loadAcademicDoc();
    const keys = ['training', 'batches', 'topics', 'sessions', 'attendance', 'topicProgress', 'diary', 'leaveRequests'];
    const leaveSheet = findSheet('leaveRequests');
    const [trainingRows, batchRows, topicRows, sessionRows, attendanceRows, progressRows, diaryRows, leaveRows] = await Promise.all(
      keys.map(key => readRows(key === 'leaveRequests' ? leaveSheet : findSheet(key)))
    );
    const masterStudents = getCache()?.students || [];
    const students = masterStudents.map(mapStudent).filter(student => student.studentId);
    const studentMap = new Map(students.map(student => [String(student.studentId).trim().toLowerCase(), student]));

    const training = mapRecords(trainingRows, [
      'trainingId', 'studentId', 'studentName', 'mainCourse', 'subCourse', 'branch', 'trainingType',
      'trainerId', 'trainerName', 'plannedHours', 'completedHours', 'progress', 'status', 'startDate',
      'expectedEndDate', 'batchId'
    ]).map(record => {
      const student = studentMap.get(String(record.studentId).trim().toLowerCase()) || {};
      return {
        ...record,
        studentName: record.studentName || student.studentName || '',
        mainCourse: record.mainCourse || student.mainCourse || '',
        subCourse: record.subCourse || student.subCourse || '',
        branch: record.branch || student.branch || '',
      };
    });
    const batches = mapRecords(batchRows, [
      'batchId', 'batchName', 'mainCourse', 'subCourse', 'branch', 'trainerId', 'trainerName',
      'schedule', 'classTiming', 'startDate', 'expectedEndDate', 'studentIds', 'status'
    ]).map(batch => ({ ...batch, students: String(batch.studentIds || '').split(/[,;\n]+/).map(id => id.trim()).filter(Boolean) }));
    const topics = mapRecords(topicRows, ['topicId', 'mainCourse', 'subCourse', 'branch', 'courseDuration', 'module', 'topic', 'subtopic', 'sequence', 'plannedHours']);
    const sessions = mapRecords(sessionRows, [
      'sessionId', 'trainingId', 'batchId', 'studentId', 'date', 'startTime', 'endTime', 'trainerId',
      'trainerName', 'topicId', 'topic', 'actualHours', 'sessionStatus', 'remarks'
    ]);
    const attendance = mapRecords(attendanceRows, [
      'attendanceId', 'sessionId', 'trainingId', 'studentId', 'studentName', 'mainCourse', 'subCourse', 'branch', 'date', 'attendanceStatus', 'markingMethod',
      'verified', 'verifiedBy', 'remarks'
    ]).map(record => {
      const student = studentMap.get(String(record.studentId).trim().toLowerCase()) || {};
      return {
        ...record,
        studentName: record.studentName || student.studentName || '',
        mainCourse: record.mainCourse || student.mainCourse || '',
        subCourse: record.subCourse || student.subCourse || '',
        branch: record.branch || student.branch || '',
      };
    });
    const topicProgress = mapRecords(progressRows, ['trainingId', 'studentId', 'topicId', 'topic', 'completed', 'comprehension', 'remarks']);
    const diary = mapRecords(diaryRows, ['diaryId', 'studentId', 'trainingId', 'date', 'eventType', 'title', 'description', 'createdBy'])
      .map(record => ({ ...record, studentName: studentMap.get(String(record.studentId).trim().toLowerCase())?.studentName || '' }));
    const leaveRequests = mapRecords(leaveRows, ['leaveId', 'studentId', 'studentName', 'mainCourse', 'branch', 'fromDate', 'toDate', 'reason', 'leaveStatus', 'requestedAt', 'approvedBy', 'decisionDate', 'approvalNotes'])
      .map(record => {
        const student = studentMap.get(String(record.studentId).trim().toLowerCase()) || {};
        return { ...record, leaveId: record.leaveId || `ROW-${record.rowNumber}`, studentName: record.studentName || student.studentName || '', mainCourse: record.mainCourse || student.mainCourse || '', branch: record.branch || student.branch || '' };
      });

    cachedData = { training, batches, topics, sessions, attendance, topicProgress, diary, leaveRequests, leaveRequestsAvailable: Boolean(leaveSheet), students };
    cachedAt = Date.now();
    return cachedData;
  })();
  try {
    return await dataPromise;
  } finally {
    dataPromise = null;
  }
}

function invalidateAcademicCache() {
  cachedData = null;
  cachedAt = 0;
}

function respondError(res, error) {
  console.error('Academic operation failed:', error.message);
  return res.status(500).json({ success: false, message: error.message || 'Academic data operation failed.' });
}

function requireSheet(key, res) {
  const sheet = findSheet(key);
  if (!sheet) {
    res.status(503).json({ success: false, message: `Academic sheet for ${key} is not available.` });
    return null;
  }
  return sheet;
}

function nextId(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

function cleanText(value) {
  return String(value || '').trim();
}

function normalizeAttendanceBranch(value) {
  const branch = normalize(value).replace(/branch$/, '');
  return branch.includes('bangalore') ? 'bangalore' : branch;
}

function getAttendanceSpreadsheetId(branch) {
  const configured = String(process.env.ACADEMIC_BRANCH_ATTENDANCE_SPREADSHEETS || '').trim();
  if (configured) {
    try {
      const map = JSON.parse(configured);
      const match = Object.entries(map).find(([name]) => normalizeAttendanceBranch(name) === normalizeAttendanceBranch(branch));
      if (match && cleanText(match[1])) return cleanText(match[1]);
    } catch (error) {
      console.warn('ACADEMIC_BRANCH_ATTENDANCE_SPREADSHEETS is not valid JSON.');
    }
  }
  return normalizeAttendanceBranch(branch) === 'bangalore' ? BANGALORE_ATTENDANCE_SPREADSHEET_ID : '';
}

async function getAttendanceWorkbook(branch) {
  const spreadsheetId = getAttendanceSpreadsheetId(branch);
  if (!spreadsheetId) return null;
  if (!attendanceWorkbooks.has(spreadsheetId)) {
    const workbook = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
    const promise = workbook.loadInfo().then(() => workbook).catch(error => {
      attendanceWorkbooks.delete(spreadsheetId);
      throw error;
    });
    attendanceWorkbooks.set(spreadsheetId, promise);
  }
  return attendanceWorkbooks.get(spreadsheetId);
}

function readHeaderValue(row, aliases, excluded = []) {
  const headers = row?._worksheet?.headerValues || Object.keys(row?.toObject?.() || {});
  const targets = aliases.map(normalize);
  const excludedTargets = excluded.map(normalize);
  const header = headers.find(item => targets.includes(normalize(item))) || headers.find(item => {
    const candidate = normalize(item);
    return targets.some(target => candidate.includes(target)) && !excludedTargets.some(target => candidate.includes(target));
  });
  return header ? (row.get(header) ?? '') : '';
}

function findHeader(headers, aliases) {
  const targets = aliases.map(normalize);
  return headers.find(header => targets.includes(normalize(header))) || headers.find(header => {
    const candidate = normalize(header);
    return targets.some(target => candidate.includes(target));
  }) || null;
}

function findHeaderIndex(headers, aliases, excluded = []) {
  const targets = aliases.map(normalize);
  const excludedTargets = excluded.map(normalize);
  const exact = headers.findIndex(header => targets.includes(normalize(header)));
  if (exact >= 0) return exact;
  return headers.findIndex(header => {
    const candidate = normalize(header);
    return targets.some(target => candidate.includes(target)) && !excludedTargets.some(target => candidate.includes(target));
  });
}

function readGridField(headers, row, aliases, excluded = []) {
  const index = findHeaderIndex(headers, aliases, excluded);
  return index >= 0 ? cleanText(row[index]) : '';
}

function monthYearKey(value) {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  const text = cleanText(value);
  const iso = text.match(/^(\d{4})[-/](\d{1,2})(?:[-/]\d{1,2})?/);
  if (iso) return `${iso[1]}-${String(Number(iso[2])).padStart(2, '0')}`;
  const monthFirst = text.match(/^([A-Za-z]+)\s+(\d{4})$/);
  if (monthFirst) {
    const month = new Date(`${monthFirst[1]} 1, ${monthFirst[2]}`).getMonth() + 1;
    return Number.isNaN(month) ? '' : `${monthFirst[2]}-${String(month).padStart(2, '0')}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
}

function monthYearLabel(key) {
  const [year, month] = String(key || '').split('-').map(Number);
  return year && month ? new Date(year, month - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }) : '';
}

function attendanceCourseConfig(course) {
  return LEGACY_COURSE_SHEETS.find(item => normalize(item.course) === normalize(course) || normalize(item.name) === normalize(course)) || null;
}

async function readLegacyCourseRoster(workbook, branch, courseFilter = '') {
  const courses = LEGACY_COURSE_SHEETS.filter(item => !courseFilter || normalize(item.course) === normalize(courseFilter) || normalize(item.name) === normalize(courseFilter));
  const spreadsheetId = getAttendanceSpreadsheetId(branch);
  const sheetsApi = google.sheets({ version: 'v4', auth: serviceAccountAuth });
  const groups = await Promise.all(courses.map(async item => {
    const sheet = workbook.sheetsByTitle[item.name];
    if (!sheet) return [];
    // Course tabs contain three side-by-side tables with repeated headings such
    // as Sl.No, Name, Phone No, and Course. Read the roster grid directly so
    // duplicate headers do not prevent the trainer roster from loading.
    const response = await sheetsApi.spreadsheets.values.get({
      spreadsheetId,
      range: `'${item.name}'!A5:AJ`,
    });
    const grid = response.data.values || [];
    const headers = grid[0] || [];
    const rows = grid.slice(1);
    const validStatuses = new Set(['activeregular', 'activeirregular', 'transferstudentactiveregular', 'transferstudentactiveirregular', 'transferstudentaciveirregular', 'active']);
    return rows.map((values, index) => {
      const statusValues = [values[14], values[15], values[16]].map(cleanText).filter(Boolean);
      const rawStatus = statusValues.find(value => validStatuses.has(normalize(value))) || values[item.statusColumn - 1] || '';
      const read = (aliases, excluded = []) => readGridField(headers, values, aliases, excluded);
      const student = {
        studentId: read(['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']),
        studentName: read(['studentname', 'name']),
        phone: read(['phoneno', 'phone', 'mobilenumber', 'contactnumber'], ['parent', 'father', 'mother']),
        email: read(['mailid', 'email', 'mail'], ['parent', 'father', 'mother']),
        parentPhone: read(['parentphone', 'parentphonenumber', 'guardianphone', 'fatherphone', 'motherphone']),
        mainCourse: item.course,
        subCourse: read(['course', 'subcourse', 'specialization'], ['master']),
        branch,
        courseDuration: read(['durationofthecourse', 'courseduration', 'duration']),
        modeOfClass: read(['modeofclass', 'classmode', 'mode']),
        syllabusCompleted: read(['syllabuscompleted', 'coursecompletedpercentage', 'completedpercentage']),
        attendedDays: read(['totalnumberofdaysattendedtheclass', 'attendeddays', 'totalattendancedays']),
        joiningDate: read(['joiningdate', 'dateofjoining']),
        batch: read(['batch', 'batchname']),
        batchStartTime: read(['batchstarttime', 'starttime']),
        batchEndTime: read(['batchendtime', 'endtime']),
        courseStatus: cleanText(rawStatus),
        courseCompletedDate: read(['coursecompleteddate', 'completeddate']),
        reasonRemarks: read(['reasonremarks', 'reason', 'remarks']),
        feesStatus: read(['feesstatus', 'feestatus']),
        qualification: read(['qualification', 'qual']),
        certificateApplied: read(['certificateapplied']),
        certificateReceived: read(['certificatereceived', 'certificaterecieved']),
        feedback: read(['feedback']),
        placement: read(['placement']),
        placementStatus: read(['placementstatus']),
        absentMonths: read(['noofmonthabsent', 'monthabsent', 'absentmonths']),
        absenceReason: read(['reasonforabsent', 'absencereason']),
        legacySheet: item.name,
        legacyRowNumber: index + 6,
      };
      return student.studentId && student.studentName ? student : null;
    }).filter(Boolean);
  }));
  return groups.flat();
}

async function readLegacyMasterRows(workbook) {
  const sheet = workbook.sheetsByTitle.Master_Attendance_Database;
  if (!sheet) throw new Error('The Bangalore workbook is missing Master_Attendance_Database.');
  await sheet.loadHeaderRow(2);
  const rows = await readRows(sheet);
  return { sheet, rows, headers: sheet.headerValues || [] };
}

async function readLegacyMasterGrid(branch) {
  const spreadsheetId = getAttendanceSpreadsheetId(branch);
  const cacheKey = `${spreadsheetId}:Master_Attendance_Database`;
  const cached = legacyMasterGridCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  const sheetsApi = google.sheets({ version: 'v4', auth: serviceAccountAuth });
  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range: 'Master_Attendance_Database!A2:AZ',
  });
  const grid = response.data.values || [];
  const value = { headers: grid[0] || [], rows: grid.slice(1) };
  legacyMasterGridCache.set(cacheKey, { value, expiresAt: Date.now() + 30000 });
  return value;
}

function legacyMonthlyRecord(row, headers, student, key) {
  const dayMarks = {};
  for (let day = 1; day <= 31; day += 1) {
    const header = findHeader(headers, [String(day)]);
    dayMarks[day] = header ? cleanText(row.get(header)).toUpperCase() : '';
  }
  const present = Object.values(dayMarks).filter(mark => mark === 'P').length;
  const absent = Object.values(dayMarks).filter(mark => mark === 'A').length;
  const matchRoll = cleanText(readHeaderValue(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
  return {
    studentId: matchRoll || student.studentId,
    studentName: cleanText(readHeaderValue(row, ['studentname', 'name'])) || student.studentName,
    mainCourse: cleanText(readHeaderValue(row, ['mastercourse', 'department'])) || student.mainCourse,
    subCourse: cleanText(readHeaderValue(row, ['course', 'subcourse', 'specialization'])) || student.subCourse,
    month: key,
    monthLabel: monthYearLabel(key),
    dayMarks,
    present,
    absent,
    rowNumber: row.rowNumber,
    studentStatus: cleanText(readHeaderValue(row, ['studentstatus', 'enrollmentstatus', 'status'])),
    placementStatus: cleanText(readHeaderValue(row, ['placementstatus', 'placement'])) || student.placementStatus || '',
  };
}

function indiaTodayKey() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

function formatDailySheetDate(dateValue) {
  const [year, month, day] = String(dateValue || '').split('-').map(Number);
  if (!year || !month || !day) return '';
  return new Date(year, month - 1, day).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' }).replace(/\s+/g, ' ');
}

function canAccessAcademicRecord(user, record = {}) {
  if (!user) return false;
  if (user.accessType === 'superadmin') return true;
  return hasAccess(record.branch || '', record.mainCourse || record.course || '', user.role, user.assignedBranchesArray, user.assignedCourse, user.department);
}

function canAccessAcademicRow(user, row) {
  const studentId = cleanText(readField(row, 'studentId')).toLowerCase();
  const student = (cachedData?.students || []).find(item => cleanText(item.studentId).toLowerCase() === studentId) || {};
  return canAccessAcademicRecord(user, {
    branch: readField(row, 'branch') || student.branch,
    mainCourse: readField(row, 'mainCourse') || readField(row, 'course') || student.mainCourse,
  });
}

function scopeAcademicData(data, user) {
  const students = data.students.filter(student => canAccessAcademicRecord(user, student));
  const studentIds = new Set(students.map(student => cleanText(student.studentId).toLowerCase()));
  const training = data.training.filter(record => canAccessAcademicRecord(user, record) && studentIds.has(cleanText(record.studentId).toLowerCase()));
  const trainingIds = new Set(training.map(record => cleanText(record.trainingId)));
  const batches = data.batches.filter(batch => canAccessAcademicRecord(user, batch));
  const batchIds = new Set(batches.map(batch => cleanText(batch.batchId)));
  const topics = data.topics.filter(topic => {
    const branches = (Array.isArray(user?.assignedBranchesArray) ? user.assignedBranchesArray : []).filter(value => String(value).toLowerCase() !== 'all');
    if (user?.accessType === 'superadmin') return true;
    if (topic.branch) return canAccessAcademicRecord(user, { branch: topic.branch, mainCourse: topic.mainCourse });
    return (branches.length ? branches : [user?.sittingBranch || '']).some(branch => hasAccess(branch, topic.mainCourse, user?.role, user?.assignedBranchesArray, user?.assignedCourse, user?.department));
  });
  const sessions = data.sessions.filter(session =>
    (session.trainingId && trainingIds.has(cleanText(session.trainingId))) ||
    (session.batchId && batchIds.has(cleanText(session.batchId))) ||
    (session.studentId && studentIds.has(cleanText(session.studentId).toLowerCase()))
  );
  const sessionIds = new Set(sessions.map(session => cleanText(session.sessionId)));
  const attendance = data.attendance.filter(record =>
    sessionIds.has(cleanText(record.sessionId)) || trainingIds.has(cleanText(record.trainingId)) ||
    studentIds.has(cleanText(record.studentId).toLowerCase()) ||
    (record.branch && record.mainCourse && canAccessAcademicRecord(user, record))
  );
  return {
    training,
    batches,
    topics,
    sessions,
    attendance,
    leaveRequests: data.leaveRequests.filter(record => canAccessAcademicRecord(user, record)),
    leaveRequestsAvailable: data.leaveRequestsAvailable,
    topicProgress: data.topicProgress.filter(record => trainingIds.has(cleanText(record.trainingId)) || studentIds.has(cleanText(record.studentId).toLowerCase())),
    diary: data.diary.filter(record => trainingIds.has(cleanText(record.trainingId)) || studentIds.has(cleanText(record.studentId).toLowerCase())),
    students,
  };
}

async function findRowBy(sheet, field, value) {
  const target = cleanText(value).toLowerCase();
  return (await readRows(sheet)).find(row => cleanText(readField(row, field)).toLowerCase() === target) || null;
}

exports.getAcademicData = async (req, res) => {
  try {
    const data = scopeAcademicData(await readAllAcademicData(), req.portalUser);
    res.json({ success: true, ...data });
  } catch (error) { respondError(res, error); }
};

function trainerBranches(user, students = []) {
  const assigned = (Array.isArray(user?.assignedBranchesArray) ? user.assignedBranchesArray : [])
    .map(cleanText).filter(value => value && !['all', 'all branches'].includes(value.toLowerCase()));
  if (assigned.length) return [...new Set(assigned)];
  const sittingBranch = cleanText(user?.sittingBranch || user?.branch);
  if (sittingBranch) return [sittingBranch];
  return [...new Set(students.map(student => cleanText(student.branch)).filter(Boolean))];
}

function mergeLegacyStudentProfiles(legacyRoster, scopedStudents) {
  const byId = new Map(scopedStudents.map(student => [cleanText(student.studentId).toLowerCase(), student]));
  return legacyRoster.map(legacy => {
    const current = byId.get(cleanText(legacy.studentId).toLowerCase()) || {};
    const merged = { ...current, ...legacy };
    for (const field of ['phone', 'email', 'parentPhone', 'qualification', 'stream', 'joiningDate', 'courseDuration', 'modeOfClass', 'syllabusCompleted', 'attendedDays', 'batch', 'batchStartTime', 'batchEndTime', 'courseStatus', 'courseCompletedDate', 'reasonRemarks', 'feesStatus', 'certificateApplied', 'certificateReceived', 'feedback', 'placement', 'placementStatus', 'absentMonths', 'absenceReason']) {
      if (!cleanText(legacy[field]) && cleanText(current[field])) merged[field] = current[field];
    }
    return merged;
  });
}

exports.getAttendanceRegister = async (req, res) => {
  try {
    const scopedData = scopeAcademicData(await readAllAcademicData(), req.portalUser);
    const branches = trainerBranches(req.portalUser, scopedData.students);
    const branch = cleanText(req.query.branch) || branches[0] || '';
    if (!branch || !canAccessAcademicRecord(req.portalUser, { branch, mainCourse: cleanText(req.query.course) || req.portalUser?.assignedCourse || req.portalUser?.department })) {
      return res.status(403).json({ success: false, message: 'Choose a branch and course inside your trainer assignment.' });
    }
    const course = cleanText(req.query.course);
    if (course && !canAccessAcademicRecord(req.portalUser, { branch, mainCourse: course })) return res.status(403).json({ success: false, message: 'That course is outside your trainer assignment.' });

    const dateInput = cleanText(req.query.date);
    const requestedKey = dateInput.match(/^\d{4}-\d{2}-\d{2}$/)
      ? dateInput.slice(0, 7)
      : `${String(req.query.year || indiaTodayKey().slice(0, 4))}-${String(req.query.month || Number(indiaTodayKey().slice(5, 7))).padStart(2, '0')}`;
    const [year, month] = requestedKey.split('-').map(Number);
    if (!year || month < 1 || month > 12) return res.status(400).json({ success: false, message: 'Choose a valid month and year.' });

    const workbook = await getAttendanceWorkbook(branch);
    let roster = scopedData.students.filter(student => normalizeAttendanceBranch(student.branch) === normalizeAttendanceBranch(branch));
    let sourceSheet = '05_Attendance';
    let sourceWorkbookTitle = '';
    let sourceType = 'portal';
    let dailySheet = '';
    let monthlyRecords = [];

    if (workbook) {
      sourceWorkbookTitle = workbook.title;
      sourceSheet = 'Master_Attendance_Database';
      dailySheet = 'Daily_Attendance';
      sourceType = 'monthly-master';
      const legacyRoster = await readLegacyCourseRoster(workbook, branch, course);
      if (legacyRoster.length) roster = mergeLegacyStudentProfiles(legacyRoster, scopedData.students);
      const { rows, headers } = await readLegacyMasterRows(workbook);
      const masterRows = rows.filter(row => monthYearKey(readHeaderValue(row, ['monthyear', 'month & year', 'month'])) === requestedKey);
      const rosterById = new Map(roster.map(student => [cleanText(student.studentId).toLowerCase(), student]));
      monthlyRecords = masterRows.map(row => {
        const studentId = cleanText(readHeaderValue(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
        const student = rosterById.get(studentId.toLowerCase());
        if (!student) return null;
        const record = legacyMonthlyRecord(row, headers, student, requestedKey);
        if (!canAccessAcademicRecord(req.portalUser, { branch, mainCourse: record.mainCourse || student.mainCourse })) return null;
        if (course && normalize(record.mainCourse) !== normalize(course)) return null;
        return record;
      }).filter(Boolean);
    } else {
      const rosterById = new Map(roster.map(student => [cleanText(student.studentId).toLowerCase(), student]));
      const attendanceByStudent = new Map();
      const markCode = value => ({
        p: 'P', present: 'P', a: 'A', absent: 'A', late: 'A',
        h: 'H', leave: 'H', holiday: 'H', holidayleave: 'H', s: 'S', sunday: 'S',
        x: 'X', 'no class': 'X', noclass: 'X',
      })[normalize(value)] || '';
      scopedData.attendance
        .filter(record => monthYearKey(record.date) === requestedKey && (!course || normalize(record.mainCourse) === normalize(course)))
        .forEach(record => {
          const student = rosterById.get(cleanText(record.studentId).toLowerCase());
          if (!student) return;
          const day = Number(String(record.date || '').slice(8, 10)) || new Date(record.date).getDate();
          if (day < 1 || day > 31) return;
          const id = cleanText(student.studentId).toLowerCase();
          if (!attendanceByStudent.has(id)) attendanceByStudent.set(id, {
            studentId: student.studentId, studentName: student.studentName, mainCourse: student.mainCourse,
            subCourse: student.subCourse || '', month: requestedKey, monthLabel: monthYearLabel(requestedKey), dayMarks: {},
            present: 0, absent: 0, rowNumber: record.rowNumber,
          });
          const monthly = attendanceByStudent.get(id);
          monthly.dayMarks[day] = markCode(record.attendanceStatus);
          monthly.present = Object.values(monthly.dayMarks).filter(mark => mark === 'P').length;
          monthly.absent = Object.values(monthly.dayMarks).filter(mark => mark === 'A').length;
        });
      monthlyRecords = [...attendanceByStudent.values()];
    }

    if (course) roster = roster.filter(student => normalize(student.mainCourse) === normalize(course));
    roster = roster.filter(student => canAccessAcademicRecord(req.portalUser, { branch, mainCourse: student.mainCourse }));
    const recordById = new Map(monthlyRecords.map(record => [cleanText(record.studentId).toLowerCase(), record]));
    const trainingById = new Map(scopedData.training.map(record => [cleanText(record.studentId).toLowerCase(), record]));
    const progressByStudent = new Map();
    scopedData.topicProgress.forEach(record => {
      const key = cleanText(record.studentId).toLowerCase();
      if (!progressByStudent.has(key)) progressByStudent.set(key, []);
      progressByStudent.get(key).push(record);
    });
    const students = roster.map(student => ({
      ...student,
      monthlyAttendance: recordById.get(cleanText(student.studentId).toLowerCase()) || null,
      training: trainingById.get(cleanText(student.studentId).toLowerCase()) || null,
      topicProgress: progressByStudent.get(cleanText(student.studentId).toLowerCase()) || [],
    }));
    const topics = scopedData.topics.filter(topic =>
      normalize(topic.mainCourse) === normalize(course || req.portalUser?.assignedCourse || req.portalUser?.department) &&
      (!topic.branch || normalizeAttendanceBranch(topic.branch) === normalizeAttendanceBranch(branch))
    );
    res.json({
      success: true, branch, course, month: String(month).padStart(2, '0'), year, monthKey: requestedKey,
      monthLabel: monthYearLabel(requestedKey), daysInMonth: new Date(year, month, 0).getDate(),
      sourceSheet, dailySheet, sourceWorkbookTitle, sourceType, sourceUrl: workbook
        ? `https://docs.google.com/spreadsheets/d/${getAttendanceSpreadsheetId(branch)}/edit${normalizeAttendanceBranch(branch) === 'bangalore' ? '#gid=2114306315' : ''}`
        : '',
      canMark: true, students, topics,
      summary: {
        total: students.length,
        present: students.reduce((sum, student) => sum + (student.monthlyAttendance?.present || 0), 0),
        absent: students.reduce((sum, student) => sum + (student.monthlyAttendance?.absent || 0), 0),
      },
    });
  } catch (error) {
    console.error('Attendance register could not be loaded:', error.message);
    return res.status(503).json({ success: false, message: 'The assigned attendance workbook could not be read. Check that the portal service account has access to the branch workbook.' });
  }
};

async function ensureLegacyAttendanceImportHeaders(sheet) {
  let headers = [];
  try {
    await sheet.loadHeaderRow();
    headers = [...(sheet.headerValues || [])];
  } catch {
    // The portal Attendance tab is currently empty, so initialize a usable header row.
  }
  while (headers.length && !cleanText(headers[headers.length - 1])) headers.pop();
  const required = [
    ['attendanceId', 'Attendance ID'], ['sessionId', 'Session ID'], ['trainingId', 'Training ID'],
    ['studentId', 'Student ID'], ['studentName', 'Student Name'], ['mainCourse', 'Main Course'],
    ['subCourse', 'Sub Course'], ['branch', 'Branch'], ['date', 'Date'],
    ['attendanceStatus', 'Attendance Status'], ['markingMethod', 'Marking Method'],
    ['verified', 'Verified'], ['verifiedBy', 'Verified By'], ['remarks', 'Remarks'],
  ];
  let changed = false;
  for (const [field, label] of required) {
    if (!getFieldHeader(headers, field)) { headers.push(label); changed = true; }
  }
  if (changed || !sheet.headerValues?.length) {
    if ((Number(sheet.columnCount) || 0) < headers.length) await sheet.resize({ columnCount: headers.length });
    await sheet.setHeaderRow(headers);
    await sheet.loadHeaderRow();
  }
  return headers;
}

exports.importLegacyMasterAttendance = async (req, res) => {
  try {
    const branch = cleanText(req.body?.branch);
    const course = cleanText(req.body?.course);
    if (!branch || !course || !canAccessAcademicRecord(req.portalUser, { branch, mainCourse: course })) {
      return res.status(403).json({ success: false, message: 'Choose a branch and course inside your trainer assignment.' });
    }
    const workbook = await getAttendanceWorkbook(branch);
    if (!workbook) return res.status(404).json({ success: false, message: 'No legacy master attendance workbook is configured for this branch.' });
    if (!attendanceCourseConfig(course)) return res.status(400).json({ success: false, message: 'This course does not have a legacy attendance mapping.' });

    const targetSheet = requireSheet('attendance', res);
    if (!targetSheet) return;
    await ensureLegacyAttendanceImportHeaders(targetSheet);

    const [legacyRoster, masterGrid, existingRows] = await Promise.all([
      readLegacyCourseRoster(workbook, branch, course),
      readLegacyMasterGrid(branch),
      readRows(targetSheet),
    ]);
    const { rows: masterRows, headers: masterHeaders } = masterGrid;
    const rosterById = new Map(legacyRoster.map(student => [cleanText(student.studentId).toLowerCase(), student]));
    const importedIds = new Set(existingRows.map(row => cleanText(readField(row, 'attendanceId'))));
    const targetRows = [];
    let duplicateCount = 0;
    let skippedRows = 0;
    const attendanceStatus = { P: 'Present', A: 'Absent', H: 'Holiday', S: 'Sunday', X: 'No Class' };

    for (const sourceRow of masterRows) {
      const studentId = readGridField(masterHeaders, sourceRow, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']);
      if (!studentId) { skippedRows++; continue; }
      const sourceCourse = readGridField(masterHeaders, sourceRow, ['mastercourse', 'department']);
      const matchedStudent = rosterById.get(studentId.toLowerCase());
      const rowCourse = sourceCourse || matchedStudent?.mainCourse || '';
      if (normalize(rowCourse) !== normalize(course)) continue;
      const monthKey = monthYearKey(readGridField(masterHeaders, sourceRow, ['monthyear', 'month & year', 'month']));
      if (!monthKey) { skippedRows++; continue; }
      const [year, month] = monthKey.split('-').map(Number);
      const dayCount = new Date(year, month, 0).getDate();
      const studentName = readGridField(masterHeaders, sourceRow, ['studentname', 'name']) || matchedStudent?.studentName || '';
      const student = matchedStudent || {
        studentId, studentName, mainCourse: course,
        subCourse: readGridField(masterHeaders, sourceRow, ['course', 'subcourse', 'specialization']),
        branch,
      };
      if (!studentName || !canAccessAcademicRecord(req.portalUser, { branch, mainCourse: course })) { skippedRows++; continue; }

      for (let day = 1; day <= dayCount; day++) {
        const dayIndex = findHeaderIndex(masterHeaders, [String(day)]);
        const legacyCode = dayIndex >= 0 ? cleanText(sourceRow[dayIndex]).toUpperCase() : '';
        const status = attendanceStatus[legacyCode];
        if (!status) continue;
        const date = `${monthKey}-${String(day).padStart(2, '0')}`;
        const identity = createHash('sha256').update(`${normalizeAttendanceBranch(branch)}|${normalize(course)}|${studentId.toLowerCase()}|${date}`).digest('hex').slice(0, 24).toUpperCase();
        const attendanceId = `LEGACY-${identity}`;
        if (importedIds.has(attendanceId)) { duplicateCount++; continue; }
        importedIds.add(attendanceId);
        targetRows.push(makeRow(targetSheet, {
          attendanceId, studentId, studentName, mainCourse: course,
          subCourse: student.subCourse || readGridField(masterHeaders, sourceRow, ['course', 'subcourse', 'specialization']),
          branch, date, attendanceStatus: status, markingMethod: 'Legacy Master Import',
          verified: 'Yes', verifiedBy: 'Master_Attendance_Database',
          remarks: `Imported legacy mark ${legacyCode} from Master_Attendance_Database.`,
        }));
      }
    }

    for (let offset = 0; offset < targetRows.length; offset += 500) {
      await targetSheet.addRows(targetRows.slice(offset, offset + 500));
    }
    invalidateAcademicCache();
    return res.json({
      success: true, branch, course, imported: targetRows.length, alreadyImported: duplicateCount, skippedRows,
      destination: targetSheet.title,
      message: targetRows.length
        ? `Imported ${targetRows.length} historical attendance marks into ${targetSheet.title}.`
        : `No new historical marks to import; ${duplicateCount} marks were already in ${targetSheet.title}.`,
    });
  } catch (error) {
    console.error('Legacy attendance import failed:', error.message);
    return res.status(503).json({ success: false, message: 'Could not import the master attendance. Check that the portal service account can edit both workbooks.' });
  }
};

function attendanceRowValues(sheet, student, monthKey) {
  const row = {};
  const headers = sheet.headerValues || [];
  const set = (aliases, value) => {
    const header = findHeader(headers, aliases);
    if (header && value !== undefined && value !== '') row[header] = value;
  };
  set(['monthyear', 'month & year', 'month'], monthYearLabel(monthKey));
  set(['ipcsrollnumber', 'rollnumber', 'rollno', 'roll'], student.studentId);
  set(['studentname', 'name'], student.studentName);
  set(['mastercourse', 'department'], student.mainCourse);
  set(['course', 'subcourse', 'specialization'], student.subCourse);
  set(['batch', 'batchname'], student.batch);
  set(['durationofthecourse', 'courseduration', 'duration'], student.courseDuration);
  set(['studentstatus', 'enrollmentstatus', 'status'], student.courseStatus || student.status || 'Active');
  return row;
}

exports.markDailyAttendance = async (req, res) => {
  try {
    const body = req.body || {};
    const date = cleanText(body.date);
    const branch = cleanText(body.branch);
    const course = cleanText(body.course);
    const marks = Array.isArray(body.marks) ? body.marks : [];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !branch || !course || !marks.length) return res.status(400).json({ success: false, message: 'Choose a date, course, and at least one student mark.' });
    const [dateYear, dateMonth, dateDay] = date.split('-').map(Number);
    if (new Date(Date.UTC(dateYear, dateMonth - 1, dateDay)).toISOString().slice(0, 10) !== date) return res.status(400).json({ success: false, message: 'Choose a valid attendance date.' });
    if (date > indiaTodayKey()) return res.status(400).json({ success: false, message: 'Attendance cannot be recorded for a future date.' });
    if (!canAccessAcademicRecord(req.portalUser, { branch, mainCourse: course })) return res.status(403).json({ success: false, message: 'That branch or course is outside your trainer assignment.' });
    const allowedMarks = new Set(['', 'P', 'A', 'H', 'S', 'X']);
    if (marks.some(item => !item || !allowedMarks.has(cleanText(item.status).toUpperCase()))) return res.status(400).json({ success: false, message: 'Attendance marks must be P, A, H, S, X, or blank.' });

    const scopedData = scopeAcademicData(await readAllAcademicData(), req.portalUser);
    const workbook = await getAttendanceWorkbook(branch);
    let attendanceRoster = scopedData.students.filter(student => normalizeAttendanceBranch(student.branch) === normalizeAttendanceBranch(branch) && normalize(student.mainCourse) === normalize(course));
    if (workbook) {
      const legacyRoster = await readLegacyCourseRoster(workbook, branch, course);
      if (legacyRoster.length) attendanceRoster = mergeLegacyStudentProfiles(legacyRoster, scopedData.students);
    }
    const allowedStudents = new Map(attendanceRoster.filter(student => normalizeAttendanceBranch(student.branch) === normalizeAttendanceBranch(branch) && normalize(student.mainCourse) === normalize(course)).map(student => [cleanText(student.studentId).toLowerCase(), student]));
    let saved = 0;
    let destination = '05_Attendance';

    if (workbook) {
      const dailySheet = workbook.sheetsByTitle.Daily_Attendance;
      if (!dailySheet) return res.status(503).json({ success: false, message: 'The branch workbook is missing Daily_Attendance.' });
      const courseConfig = attendanceCourseConfig(course);
      if (!courseConfig) return res.status(400).json({ success: false, message: 'This course has no daily attendance column mapping.' });
      const marksById = new Map();
      for (const item of marks) {
        const student = allowedStudents.get(cleanText(item.studentId).toLowerCase());
        if (!student || !canAccessAcademicRecord(req.portalUser, { branch, mainCourse: student.mainCourse })) return res.status(403).json({ success: false, message: 'One or more learners are outside your assigned scope.' });
        const studentKey = cleanText(item.studentId).toLowerCase();
        if (marksById.has(studentKey)) return res.status(400).json({ success: false, message: 'A learner can only have one attendance mark per save.' });
        marksById.set(studentKey, cleanText(item.status).toUpperCase());
      }
      const roster = [...allowedStudents.values()].map(student => ({
        ...student,
        status: marksById.get(cleanText(student.studentId).toLowerCase()) || '',
      }));
      if (!roster.length) return res.status(400).json({ success: false, message: 'No assigned learners are available for this course.' });
      const isSunday = new Date(Date.UTC(dateYear, dateMonth - 1, dateDay)).getUTCDay() === 0;
      if (isSunday) roster.forEach(student => { if (!student.status) student.status = 'S'; });
      if (!roster.some(student => student.status)) return res.status(400).json({ success: false, message: 'Choose at least one attendance mark before saving.' });

      const monthKey = date.slice(0, 7);
      const { sheet: masterSheet, rows: masterRows, headers } = await readLegacyMasterRows(workbook);
      const monthRows = masterRows.filter(row => monthYearKey(readHeaderValue(row, ['monthyear', 'month & year', 'month'])) === monthKey);
      const day = Number(date.slice(8, 10));
      const dayHeader = findHeader(headers, [String(day)]);
      if (!dayHeader) return res.status(503).json({ success: false, message: `The master attendance sheet is missing the day ${day} column.` });

      const pendingRows = [];
      const matchedById = new Map();
      for (const student of roster) {
        const match = monthRows.find(row => cleanText(readHeaderValue(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll'])).toLowerCase() === cleanText(student.studentId).toLowerCase()
          && normalize(readHeaderValue(row, ['mastercourse', 'department']) || student.mainCourse) === normalize(student.mainCourse));
        if (match) matchedById.set(cleanText(student.studentId).toLowerCase(), match);
        else pendingRows.push(attendanceRowValues(masterSheet, student, monthKey));
      }
      if (pendingRows.length) {
        await masterSheet.addRows(pendingRows);
        const refreshed = await masterSheet.getRows();
        const refreshedMonthRows = refreshed.filter(row => monthYearKey(readHeaderValue(row, ['monthyear', 'month & year', 'month'])) === monthKey);
        roster.forEach(student => {
          if (matchedById.has(cleanText(student.studentId).toLowerCase())) return;
          const match = refreshedMonthRows.find(row => cleanText(readHeaderValue(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll'])).toLowerCase() === cleanText(student.studentId).toLowerCase()
            && normalize(readHeaderValue(row, ['mastercourse', 'department']) || student.mainCourse) === normalize(student.mainCourse));
          if (match) matchedById.set(cleanText(student.studentId).toLowerCase(), match);
        });
      }
      if (roster.some(student => !matchedById.has(cleanText(student.studentId).toLowerCase()))) return res.status(409).json({ success: false, message: 'Some learners could not be added to the monthly master register. Refresh the master database before saving.' });

      const sheetsApi = google.sheets({ version: 'v4', auth: serviceAccountAuth });
      const requests = [];
      {
        const lastRow = Math.max(Number(dailySheet.rowCount) || 0, roster.length + 2, 100);
        const startColumnIndex = courseConfig.dailyColumn - 1;
        const dailyDate = new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', day: '2-digit', month: 'long', year: 'numeric' })
          .format(new Date(`${date}T00:00:00Z`)).replace(/\s(\d{4})$/, ' , $1');
        requests.push({ updateCells: { range: { sheetId: dailySheet.sheetId, startRowIndex: 2, endRowIndex: lastRow, startColumnIndex, endColumnIndex: startColumnIndex + 4 }, fields: 'userEnteredValue' } });
        requests.push({ updateCells: {
          start: { sheetId: dailySheet.sheetId, rowIndex: 2, columnIndex: startColumnIndex },
          rows: roster.map(student => ({ values: [dailyDate, student.studentId, student.studentName, student.status].map(value => ({ userEnteredValue: { stringValue: String(value ?? '') } })) })),
          fields: 'userEnteredValue',
        } });
      }
      const dayCol = headers.indexOf(dayHeader);
      for (const student of roster) {
        if (!student.status) continue;
        const row = matchedById.get(cleanText(student.studentId).toLowerCase());
        const rowIndex = Math.max(0, Number(row.rowNumber) - 1);
        requests.push({ updateCells: { start: { sheetId: masterSheet.sheetId, rowIndex, columnIndex: dayCol }, rows: [{ values: [{ userEnteredValue: { stringValue: student.status } }] }], fields: 'userEnteredValue' } });
        const updatedMarks = [];
        for (let dayNumber = 1; dayNumber <= 31; dayNumber += 1) {
          const header = findHeader(headers, [String(dayNumber)]);
          updatedMarks.push(dayNumber === day ? student.status : (header ? cleanText(row.get(header)).toUpperCase() : ''));
        }
        const totalPresentHeader = findHeader(headers, ['totalpresent']);
        const totalAbsentHeader = findHeader(headers, ['totalabsent']);
        if (totalPresentHeader) requests.push({ updateCells: { start: { sheetId: masterSheet.sheetId, rowIndex, columnIndex: headers.indexOf(totalPresentHeader) }, rows: [{ values: [{ userEnteredValue: { numberValue: updatedMarks.filter(mark => mark === 'P').length } }] }], fields: 'userEnteredValue' } });
        if (totalAbsentHeader) requests.push({ updateCells: { start: { sheetId: masterSheet.sheetId, rowIndex, columnIndex: headers.indexOf(totalAbsentHeader) }, rows: [{ values: [{ userEnteredValue: { numberValue: updatedMarks.filter(mark => mark === 'A').length } }] }], fields: 'userEnteredValue' } });
      }
      if (requests.length) await sheetsApi.spreadsheets.batchUpdate({ spreadsheetId: getAttendanceSpreadsheetId(branch), requestBody: { requests } });
      destination = 'Daily_Attendance + Master_Attendance_Database';
      saved = roster.filter(student => student.status).length;
    } else {
      const sheet = requireSheet('attendance', res);
      if (!sheet) return;
      const submittedIds = new Set();
      for (const item of marks) {
        const studentId = cleanText(item.studentId).toLowerCase();
        if (!allowedStudents.has(studentId)) return res.status(403).json({ success: false, message: 'One or more learners are outside your assigned scope.' });
        if (submittedIds.has(studentId)) return res.status(400).json({ success: false, message: 'A learner can only have one attendance mark per save.' });
        submittedIds.add(studentId);
      }
      const records = marks.map(item => {
        const student = allowedStudents.get(cleanText(item.studentId).toLowerCase());
        if (!student || !cleanText(item.status)) return null;
        const status = ({ P: 'Present', A: 'Absent', H: 'Leave', S: 'Holiday', X: 'No Class' })[cleanText(item.status).toUpperCase()];
        return makeRow(sheet, { attendanceId: nextId('ATT'), studentId: student.studentId, date, attendanceStatus: status, markingMethod: 'Trainer', verified: 'Yes', verifiedBy: cleanText(req.portalUser?.name), remarks: cleanText(item.remarks) });
      }).filter(Boolean);
      await sheet.addRows(records);
      saved = records.length;
    }

    invalidateAcademicCache();
    return res.json({ success: true, saved, date, branch, course, destination, message: `${saved} attendance marks saved to ${destination}.` });
  } catch (error) {
    console.error('Daily attendance save failed:', error.message);
    return res.status(503).json({ success: false, message: 'Could not save to the branch attendance workbook. Check that the portal service account has editor access.' });
  }
};

exports.reviewLeaveRequest = async (req, res) => {
  try {
    const body = req.body || {};
    const role = String(req.portalUser?.role || '').toUpperCase();
    const canReview = req.portalUser?.accessType === 'superadmin' || ['SYSTEM ADMIN', 'GENERAL MANAGER', 'ZONAL PLACEMENT HEAD'].some(value => role.includes(value)) || ['BRANCH MANAGER', 'MANAGER', 'RTH', 'REGIONAL TECHNICAL HEAD', 'TECHNICAL LEAD', 'TTH', 'TRAINER'].some(value => role.includes(value));
    if (!canReview) return res.status(403).json({ success: false, message: 'Your role cannot review leave requests.' });
    const leaveId = cleanText(body.leaveId);
    const decision = cleanText(body.status);
    if (!leaveId || !['Approved', 'Rejected'].includes(decision)) return res.status(400).json({ success: false, message: 'Choose a leave request and approve or reject it.' });
    const sheet = requireSheet('leaveRequests', res);
    if (!sheet) return;
    await ensureLeaveReviewHeaders(sheet);
    const rows = await readRows(sheet);
    const row = leaveId.startsWith('ROW-')
      ? rows.find(item => Number(item.rowNumber) === Number(leaveId.slice(4)))
      : rows.find(item => cleanText(readField(item, 'leaveId')).toLowerCase() === leaveId.toLowerCase());
    if (!row) return res.status(404).json({ success: false, message: 'Leave request not found.' });
    const scoped = scopeAcademicData(await readAllAcademicData(true), req.portalUser);
    if (!scoped.leaveRequests.some(record => cleanText(record.leaveId) === leaveId)) return res.status(403).json({ success: false, message: 'This leave request is outside your branch or course assignment.' });
    row.assign(makeRow(sheet, {
      leaveStatus: decision,
      approvedBy: cleanText(req.portalUser?.name),
      decisionDate: formatIndiaTimestamp(),
      approvalNotes: cleanText(body.notes),
    }));
    await row.save();
    invalidateAcademicCache();
    res.json({ success: true, message: `Leave request ${decision.toLowerCase()}.` });
  } catch (error) { respondError(res, error); }
};

exports.getTrainingData = async (req, res) => {
  try {
    const { training, students } = scopeAcademicData(await readAllAcademicData(), req.portalUser);
    res.json({ success: true, training, students });
  } catch (error) { respondError(res, error); }
};

exports.addTraining = async (req, res) => {
  try {
    const body = req.body || {};
    const studentId = cleanText(body.studentId);
    if (!studentId) return res.status(400).json({ success: false, message: 'Student roll number is required.' });
    const sheet = requireSheet('training', res);
    if (!sheet) return;

    const data = scopeAcademicData(await readAllAcademicData(), req.portalUser);
    const student = data.students.find(item => item.studentId.toLowerCase() === studentId.toLowerCase());
    if (!student) return res.status(404).json({ success: false, message: 'Student was not found in the Placement Master.' });
    const duplicate = data.training.some(record => record.studentId.toLowerCase() === studentId.toLowerCase() && record.mainCourse.toLowerCase() === student.mainCourse.toLowerCase() && record.subCourse.toLowerCase() === cleanText(body.subCourse || student.subCourse).toLowerCase() && String(record.status).toLowerCase() === 'active');
    if (duplicate) return res.status(409).json({ success: false, message: 'This student already has an active training assignment for that course.' });
    const trainingId = nextId('TRN');
    const plannedHours = Math.max(0, Number(body.plannedHours) || 0);
    await sheet.addRow(makeRow(sheet, {
      trainingId, studentId, studentName: student.studentName, mainCourse: cleanText(student.mainCourse),
      subCourse: cleanText(body.subCourse || student.subCourse), branch: cleanText(student.branch),
      trainingType: cleanText(body.trainingType) || 'Individual', trainerId: cleanText(req.portalUser?.empId),
      trainerName: cleanText(req.portalUser?.name), plannedHours, completedHours: 0, progress: '0%',
      status: cleanText(body.status) || 'Active', startDate: cleanText(body.startDate),
      expectedEndDate: cleanText(body.expectedEndDate), batchId: cleanText(body.batchId)
    }));
    invalidateAcademicCache();
    res.status(201).json({ success: true, trainingId, message: 'Training assignment created.' });
  } catch (error) { respondError(res, error); }
};

exports.updateTraining = async (req, res) => {
  try {
    const body = req.body || {};
    if (!cleanText(body.trainingId)) return res.status(400).json({ success: false, message: 'Training ID is required.' });
    const sheet = requireSheet('training', res);
    if (!sheet) return;
    const row = await findRowBy(sheet, 'trainingId', body.trainingId);
    if (!row) return res.status(404).json({ success: false, message: 'Training record not found.' });
    if (!canAccessAcademicRow(req.portalUser, row)) return res.status(403).json({ success: false, message: 'This training record is outside your course or branch assignment.' });
    const fields = ['trainerId', 'trainerName', 'plannedHours', 'completedHours', 'progress', 'status', 'startDate', 'expectedEndDate', 'batchId'];
    const values = Object.fromEntries(fields.filter(field => body[field] !== undefined).map(field => [field, body[field]]));
    row.assign(makeRow(sheet, values));
    await row.save();
    invalidateAcademicCache();
    res.json({ success: true, message: 'Training record updated.' });
  } catch (error) { respondError(res, error); }
};

exports.addBatch = async (req, res) => {
  try {
    const body = req.body || {};
    if (!cleanText(body.batchName) || !cleanText(body.mainCourse) || !cleanText(body.branch)) return res.status(400).json({ success: false, message: 'Batch name, main course, and branch are required.' });
    const sheet = requireSheet('batches', res);
    if (!sheet) return;
    const studentIds = [...new Set((Array.isArray(body.studentIds) ? body.studentIds : String(body.studentIds || '').split(/[,;\n]+/)).map(cleanText).filter(Boolean))];
    const data = scopeAcademicData(await readAllAcademicData(), req.portalUser);
    if (!canAccessAcademicRecord(req.portalUser, { branch: body.branch, mainCourse: body.mainCourse })) return res.status(403).json({ success: false, message: 'That course or branch is outside your assignment.' });
    const visibleStudents = new Map(data.students.map(student => [student.studentId.toLowerCase(), student]));
    if (studentIds.some(id => {
      const student = visibleStudents.get(id.toLowerCase());
      return !student || cleanText(student.branch).toLowerCase() !== cleanText(body.branch).toLowerCase() || cleanText(student.mainCourse).toLowerCase() !== cleanText(body.mainCourse).toLowerCase();
    })) return res.status(403).json({ success: false, message: 'Every batch student must match your assignment, the selected branch, and course.' });
    const batchId = nextId('BAT');
    await sheet.addRow(makeRow(sheet, {
      batchId, batchName: cleanText(body.batchName), mainCourse: cleanText(body.mainCourse), subCourse: cleanText(body.subCourse),
      branch: cleanText(body.branch), trainerId: cleanText(req.portalUser?.empId), trainerName: cleanText(req.portalUser?.name),
      schedule: cleanText(body.schedule), classTiming: cleanText(body.classTiming), startDate: cleanText(body.startDate),
      expectedEndDate: cleanText(body.expectedEndDate), studentIds: studentIds.join(', '), status: cleanText(body.status) || 'Active'
    }));

    const trainingSheet = findSheet('training');
    let assignedCount = 0;
    if (trainingSheet && studentIds.length) {
      const wanted = new Set(studentIds.map(id => id.toLowerCase()));
      const rows = await readRows(trainingSheet);
      for (const row of rows) {
        if (wanted.has(cleanText(readField(row, 'studentId')).toLowerCase()) &&
            cleanText(readField(row, 'mainCourse')).toLowerCase() === cleanText(body.mainCourse).toLowerCase()) {
          row.assign(makeRow(trainingSheet, { batchId, trainingType: 'Batch' }));
          await row.save();
          assignedCount++;
        }
      }
    }
    invalidateAcademicCache();
    res.status(201).json({ success: true, batchId, assignedCount, message: 'Training batch created.' });
  } catch (error) { respondError(res, error); }
};

exports.updateBatch = async (req, res) => {
  try {
    const body = req.body || {};
    if (!cleanText(body.batchId)) return res.status(400).json({ success: false, message: 'Batch ID is required.' });
    const sheet = requireSheet('batches', res);
    if (!sheet) return;
    const row = await findRowBy(sheet, 'batchId', body.batchId);
    if (!row) return res.status(404).json({ success: false, message: 'Batch not found.' });
    if (!canAccessAcademicRow(req.portalUser, row)) return res.status(403).json({ success: false, message: 'This batch is outside your course or branch assignment.' });
    const fields = ['batchName', 'mainCourse', 'subCourse', 'branch', 'trainerId', 'trainerName', 'schedule', 'classTiming', 'startDate', 'expectedEndDate', 'studentIds', 'status'];
    const values = Object.fromEntries(fields.filter(field => body[field] !== undefined).map(field => [field, body[field]]));
    const nextCourse = cleanText(body.mainCourse ?? readField(row, 'mainCourse'));
    const nextBranch = cleanText(body.branch ?? readField(row, 'branch'));
    if (!canAccessAcademicRecord(req.portalUser, { branch: nextBranch, mainCourse: nextCourse })) return res.status(403).json({ success: false, message: 'The updated course or branch is outside your assignment.' });
    if (body.studentIds !== undefined) {
      const requestedIds = [...new Set((Array.isArray(body.studentIds) ? body.studentIds : String(body.studentIds).split(/[,;\n]+/)).map(cleanText).filter(Boolean))];
      const scopedData = scopeAcademicData(await readAllAcademicData(), req.portalUser);
      const studentMap = new Map(scopedData.students.map(student => [student.studentId.toLowerCase(), student]));
      if (requestedIds.some(id => {
        const student = studentMap.get(id.toLowerCase());
        return !student || cleanText(student.branch).toLowerCase() !== nextBranch.toLowerCase() || cleanText(student.mainCourse).toLowerCase() !== nextCourse.toLowerCase();
      })) return res.status(403).json({ success: false, message: 'Every batch student must match the updated branch and course.' });
      values.studentIds = requestedIds.join(', ');
    }
    row.assign(makeRow(sheet, values));
    await row.save();
    invalidateAcademicCache();
    res.json({ success: true, message: 'Batch updated.' });
  } catch (error) { respondError(res, error); }
};

function durationHours(start, end, supplied) {
  const explicit = Number(supplied);
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit * 100) / 100;
  const parse = (value) => {
    const [hours, minutes] = String(value || '').split(':').map(Number);
    return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : NaN;
  };
  const startMinutes = parse(start);
  let endMinutes = parse(end);
  if (!Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) return 0;
  if (endMinutes <= startMinutes) endMinutes += 24 * 60;
  return Math.round(((endMinutes - startMinutes) / 60) * 100) / 100;
}

exports.addSession = async (req, res) => {
  try {
    const body = req.body || {};
    const mode = cleanText(body.sessionType).toLowerCase() === 'batch' ? 'batch' : 'individual';
    const sessionDate = cleanText(body.date);
    const topic = cleanText(body.topic);
    if (!sessionDate || !topic) return res.status(400).json({ success: false, message: 'Session date and topic are required.' });

    const sessionSheet = requireSheet('sessions', res);
    const trainingSheet = requireSheet('training', res);
    if (!sessionSheet || !trainingSheet) return;
    const scopedData = scopeAcademicData(await readAllAcademicData(), req.portalUser);
    const allowedTrainingIds = new Set(scopedData.training.map(record => cleanText(record.trainingId)));
    const trainingRows = await readRows(trainingSheet);
    const selectedTraining = trainingRows.find(row => cleanText(readField(row, 'trainingId')) === cleanText(body.trainingId) && allowedTrainingIds.has(cleanText(readField(row, 'trainingId'))));
    let batch = null;
    if (mode === 'individual' && !selectedTraining) return res.status(404).json({ success: false, message: 'Select an active training record.' });
    if (mode === 'individual' && ['completed', 'cancelled', 'inactive'].includes(cleanText(readField(selectedTraining, 'status')).toLowerCase())) return res.status(409).json({ success: false, message: 'This training assignment is not active.' });

    if (mode === 'batch') {
      const batchSheet = requireSheet('batches', res);
      if (!batchSheet) return;
      batch = await findRowBy(batchSheet, 'batchId', body.batchId);
      if (!batch) return res.status(404).json({ success: false, message: 'Select an existing batch.' });
      if (!scopedData.batches.some(record => cleanText(record.batchId) === cleanText(body.batchId))) return res.status(403).json({ success: false, message: 'This batch is outside your course or branch assignment.' });
      if (['completed', 'cancelled', 'inactive'].includes(cleanText(readField(batch, 'status')).toLowerCase())) return res.status(409).json({ success: false, message: 'This batch is not active.' });
    }

    const sessionId = nextId('SES');
    const hours = durationHours(body.startTime, body.endTime, body.actualHours);
    if (!hours) return res.status(400).json({ success: false, message: 'Enter valid session times or completed hours.' });
    const trainingId = mode === 'individual' ? cleanText(body.trainingId) : '';
    const batchId = mode === 'batch' ? cleanText(body.batchId) : '';
    const trainerName = cleanText(req.portalUser?.name || readField(selectedTraining || batch, 'trainerName'));
    const studentIds = mode === 'individual'
      ? [cleanText(readField(selectedTraining, 'studentId'))]
      : [];

    if (mode === 'batch' && studentIds.length === 0) {
      const members = cleanText(readField(batch, 'studentIds')).split(/[,;\n]+/).map(cleanText).filter(Boolean);
      for (const row of trainingRows) {
        if (cleanText(readField(row, 'batchId')) === batchId) members.push(cleanText(readField(row, 'studentId')));
      }
      studentIds.push(...new Set(members.filter(Boolean)));
    }
    if (studentIds.length === 0) return res.status(400).json({ success: false, message: 'Add at least one student to the session.' });
    const allowedStudentIds = new Set(scopedData.students.map(student => cleanText(student.studentId).toLowerCase()));
    if (studentIds.some(id => !allowedStudentIds.has(id.toLowerCase()))) return res.status(403).json({ success: false, message: 'A session attendee is outside your course or branch assignment.' });
    const allowedAttendance = ['Present', 'Absent', 'Late', 'Leave'];
    const explicitAttendance = Array.isArray(body.attendance) ? body.attendance : [];
    if (explicitAttendance.some(item => !allowedAttendance.includes(cleanText(item.status)))) return res.status(400).json({ success: false, message: 'Attendance status must be Present, Absent, Late, or Leave.' });

    const sessionRows = makeRow(sessionSheet, {
      sessionId, trainingId, batchId, studentId: mode === 'individual' ? studentIds[0] : '',
      date: sessionDate, startTime: cleanText(body.startTime), endTime: cleanText(body.endTime),
      trainerId: cleanText(req.portalUser?.empId), trainerName, topicId: cleanText(body.topicId), topic,
      actualHours: hours, sessionStatus: cleanText(body.sessionStatus) || 'Completed', remarks: cleanText(body.remarks)
    });
    await sessionSheet.addRow(sessionRows);

    const attendanceSheet = findSheet('attendance');
    const statusByStudent = new Map(explicitAttendance.map(item => [cleanText(item.studentId).toLowerCase(), cleanText(item.status) || 'Present']));
    if (attendanceSheet) {
      await attendanceSheet.addRows(studentIds.map(studentId => makeRow(attendanceSheet, {
        attendanceId: nextId('ATT'), sessionId, trainingId, studentId, date: sessionDate,
        attendanceStatus: statusByStudent.get(studentId.toLowerCase()) || 'Present',
        markingMethod: 'Trainer', verified: 'No', verifiedBy: '', remarks: cleanText(body.remarks)
      })));
    }

    const progressSheet = findSheet('topicProgress');
    const diarySheet = findSheet('diary');
    const progressRows = progressSheet ? await readRows(progressSheet) : [];
    const now = formatIndiaTimestamp();
    for (const studentId of studentIds) {
      const trainingRow = trainingRows.find(row => cleanText(readField(row, 'studentId')).toLowerCase() === studentId.toLowerCase() &&
        (trainingId ? cleanText(readField(row, 'trainingId')) === trainingId : cleanText(readField(row, 'batchId')) === batchId));
      if (trainingRow) {
        const completed = (Number(readField(trainingRow, 'completedHours')) || 0) + hours;
        const planned = Number(readField(trainingRow, 'plannedHours')) || 0;
        const progress = planned > 0 ? `${Math.min(100, Math.round(completed / planned * 100))}%` : readField(trainingRow, 'progress') || '0%';
        trainingRow.assign(makeRow(trainingSheet, { completedHours: completed, progress }));
        await trainingRow.save();
      }
      if (progressSheet && body.topicId) {
        const progressRow = progressRows.find(row => cleanText(readField(row, 'studentId')).toLowerCase() === studentId.toLowerCase() && cleanText(readField(row, 'topicId')) === cleanText(body.topicId));
        if (progressRow) {
          progressRow.assign(makeRow(progressSheet, { completed: 'Yes', comprehension: cleanText(body.comprehension), remarks: cleanText(body.remarks) }));
          await progressRow.save();
        } else {
          await progressSheet.addRow(makeRow(progressSheet, {
            trainingId: trainingId || cleanText(readField(trainingRow, 'trainingId')), studentId,
            topicId: cleanText(body.topicId), topic, completed: 'Yes', comprehension: cleanText(body.comprehension), remarks: cleanText(body.remarks)
          }));
        }
      }
      if (diarySheet) {
        await diarySheet.addRow(makeRow(diarySheet, {
          diaryId: nextId('DIA'), studentId, trainingId: trainingId || cleanText(readField(trainingRow, 'trainingId')),
          date: now, eventType: 'Training Session', title: topic,
          description: `${hours} training hours logged for ${sessionDate}.${body.remarks ? ` ${cleanText(body.remarks)}` : ''}`,
          createdBy: cleanText(body.trainerName || body.userName)
        }));
      }
    }

    invalidateAcademicCache();
    res.status(201).json({ success: true, sessionId, attendanceCount: attendanceSheet ? studentIds.length : 0, message: 'Session, attendance, progress, and diary records saved.' });
  } catch (error) { respondError(res, error); }
};

exports.updateStudentAcademics = async (req, res) => {
  try {
    const body = req.body || {};
    const studentId = cleanText(body.studentId);
    if (!studentId) return res.status(400).json({ success: false, message: 'Student roll number is required.' });
    const scopedData = scopeAcademicData(await readAllAcademicData(), req.portalUser);
    let student = scopedData.students.find(item => cleanText(item.studentId).toLowerCase() === studentId.toLowerCase());
    if (!student && cleanText(body.branch) && cleanText(body.course)) {
      const branch = cleanText(body.branch);
      const course = cleanText(body.course);
      if (!canAccessAcademicRecord(req.portalUser, { branch, mainCourse: course })) return res.status(403).json({ success: false, message: 'That branch or course is outside your trainer assignment.' });
      const workbook = await getAttendanceWorkbook(branch);
      if (workbook) {
        const legacyRoster = await readLegacyCourseRoster(workbook, branch, course);
        student = legacyRoster.find(item => cleanText(item.studentId).toLowerCase() === studentId.toLowerCase()) || null;
      }
    }
    if (!student || !canAccessAcademicRecord(req.portalUser, student)) return res.status(403).json({ success: false, message: 'This learner is outside your course or branch assignment.' });

    let savedTopics = 0;
    if (body.topicId) {
      const topic = scopedData.topics.find(item => cleanText(item.topicId) === cleanText(body.topicId));
      if (!topic || (topic.mainCourse && normalize(topic.mainCourse) !== normalize(student.mainCourse)) || (topic.branch && normalizeAttendanceBranch(topic.branch) !== normalizeAttendanceBranch(student.branch))) {
        return res.status(403).json({ success: false, message: 'This topic is not part of the learner’s assigned course and branch.' });
      }
      const progressSheet = requireSheet('topicProgress', res);
      if (!progressSheet) return;
      const progressRows = await readRows(progressSheet);
      const current = progressRows.find(row => cleanText(readField(row, 'studentId')).toLowerCase() === studentId.toLowerCase() && cleanText(readField(row, 'topicId')) === cleanText(body.topicId));
      const training = scopedData.training.find(item => cleanText(item.studentId).toLowerCase() === studentId.toLowerCase());
      const progressValues = {
        trainingId: cleanText(body.trainingId || training?.trainingId), studentId, topicId: cleanText(topic.topicId), topic: cleanText(topic.topic),
        completed: body.completed ? 'Yes' : 'No', comprehension: cleanText(body.comprehension), remarks: cleanText(body.remarks),
      };
      if (current) {
        current.assign(makeRow(progressSheet, progressValues));
        await current.save();
      } else {
        await progressSheet.addRow(makeRow(progressSheet, progressValues));
      }
      savedTopics = 1;
    }

    let coursePercentage = null;
    if (body.coursePercentage !== undefined) {
      coursePercentage = Number(body.coursePercentage);
      if (!Number.isFinite(coursePercentage) || coursePercentage < 0 || coursePercentage > 100) return res.status(400).json({ success: false, message: 'Course completion must be between 0 and 100 percent.' });
      coursePercentage = Math.round(coursePercentage);
      const training = scopedData.training.find(item => cleanText(item.studentId).toLowerCase() === studentId.toLowerCase() && canAccessAcademicRecord(req.portalUser, item));
      if (training) {
        const trainingSheet = requireSheet('training', res);
        if (!trainingSheet) return;
        const row = await findRowBy(trainingSheet, 'trainingId', training.trainingId);
        if (row) {
          row.assign(makeRow(trainingSheet, { progress: `${coursePercentage}%`, status: coursePercentage === 100 ? 'Completed' : training.status }));
          await row.save();
        }
      }
      const workbook = await getAttendanceWorkbook(student.branch);
      const courseConfig = attendanceCourseConfig(student.mainCourse);
      const courseSheet = workbook && courseConfig ? workbook.sheetsByTitle[courseConfig.name] : null;
      if (courseSheet) {
        await courseSheet.loadHeaderRow(5);
        const rows = await readRows(courseSheet);
        const row = rows.find(item => cleanText(readHeaderValue(item, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll'])).toLowerCase() === studentId.toLowerCase());
        if (row) {
          const headers = courseSheet.headerValues || [];
          const percentageHeader = findHeader(headers, ['syllabuscompleted', 'coursecompletedpercentage', 'completedpercentage']);
          const statusHeader = findHeader(headers, ['status', 'studentstatus', 'coursestatus']);
          const completedDateHeader = findHeader(headers, ['coursecompleteddate', 'completeddate']);
          if (percentageHeader) row.set(percentageHeader, `${coursePercentage}%`);
          if (coursePercentage === 100 && statusHeader) row.set(statusHeader, 'Completed');
          if (coursePercentage === 100 && completedDateHeader) row.set(completedDateHeader, indiaTodayKey());
          await row.save();
        }
      }
    }

    invalidateAcademicCache();
    return res.json({ success: true, studentId, coursePercentage, topicsUpdated: savedTopics, message: 'Learner progress saved.' });
  } catch (error) { respondError(res, error); }
};

exports.addAcademicTopic = async (req, res) => {
  try {
    const body = req.body || {};
    const branch = cleanText(body.branch);
    const mainCourse = cleanText(body.course);
    const subCourse = cleanText(body.subCourse);
    const courseDuration = cleanText(body.courseDuration);
    const topicTitle = cleanText(body.topic);
    const module = cleanText(body.module);
    if (!branch || !mainCourse || !subCourse || !courseDuration || !topicTitle) {
      return res.status(400).json({ success: false, message: 'Branch, course, track, duration, and topic are required.' });
    }
    if (!canAccessAcademicRecord(req.portalUser, { branch, mainCourse })) {
      return res.status(403).json({ success: false, message: 'That branch or course is outside your trainer assignment.' });
    }
    const sheet = requireSheet('topics', res);
    if (!sheet) return;
    const requiredHeaders = [
      ['topicId', 'Topic ID'], ['mainCourse', 'Main Course'], ['subCourse', 'Sub Course'],
      ['branch', 'Branch'], ['courseDuration', 'Course Duration'], ['module', 'Module'],
      ['topic', 'Topic'], ['sequence', 'Sequence'], ['plannedHours', 'Planned Hours'],
    ];
    const headers = [...(sheet.headerValues || [])];
    let changed = false;
    requiredHeaders.forEach(([field, label]) => {
      if (!getFieldHeader(headers, field)) { headers.push(label); changed = true; }
    });
    if (changed) {
      await sheet.setHeaderRow([...headers, ...requiredHeaders.filter(([field]) => !getFieldHeader(headers, field)).map(([, label]) => label)]);
      await sheet.loadHeaderRow();
    }
    const rows = await readRows(sheet);
    const duplicate = rows.some(row => normalize(readField(row, 'mainCourse')) === normalize(mainCourse)
      && normalize(readField(row, 'subCourse')) === normalize(subCourse)
      && normalize(readField(row, 'branch')) === normalize(branch)
      && normalize(readField(row, 'courseDuration')) === normalize(courseDuration)
      && normalize(readField(row, 'topic')) === normalize(topicTitle));
    if (duplicate) return res.status(409).json({ success: false, message: 'This topic is already listed for that course, track, branch, and duration.' });
    const sequence = Number(body.sequence) || (rows.reduce((max, row) => {
      const samePlan = normalize(readField(row, 'mainCourse')) === normalize(mainCourse)
        && normalize(readField(row, 'subCourse')) === normalize(subCourse)
        && normalize(readField(row, 'branch')) === normalize(branch)
        && normalize(readField(row, 'courseDuration')) === normalize(courseDuration);
      return samePlan ? Math.max(max, Number(readField(row, 'sequence')) || 0) : max;
    }, 0) + 1);
    const plannedHours = cleanText(body.plannedHours);
    const topicId = nextId('TOP');
    await sheet.addRow(makeRow(sheet, {
      topicId, mainCourse, subCourse, branch, courseDuration,
      module, topic: topicTitle, sequence, plannedHours,
    }));
    invalidateAcademicCache();
    return res.status(201).json({ success: true, message: `Topic added to the ${courseDuration} syllabus.`, topicId });
  } catch (error) { respondError(res, error); }
};

exports.updateAttendance = async (req, res) => {
  try {
    const body = req.body || {};
    if (!cleanText(body.attendanceId)) return res.status(400).json({ success: false, message: 'Attendance ID is required.' });
    const sheet = requireSheet('attendance', res);
    if (!sheet) return;
    const row = await findRowBy(sheet, 'attendanceId', body.attendanceId);
    if (!row) return res.status(404).json({ success: false, message: 'Attendance record not found.' });
    const scopedData = scopeAcademicData(await readAllAcademicData(), req.portalUser);
    if (!scopedData.attendance.some(record => cleanText(record.attendanceId) === cleanText(body.attendanceId))) return res.status(403).json({ success: false, message: 'This attendance record is outside your course or branch assignment.' });
    const allowedStatuses = ['Present', 'Absent', 'Late', 'Leave', 'Holiday', 'Sunday', 'No Class'];
    const values = {};
    if (body.status !== undefined) {
      if (!allowedStatuses.includes(body.status)) return res.status(400).json({ success: false, message: 'Choose a valid attendance status.' });
      values.attendanceStatus = body.status;
    }
    if (body.verified !== undefined) {
      values.verified = body.verified ? 'Yes' : 'No';
      values.verifiedBy = cleanText(req.portalUser?.name);
    }
    if (body.remarks !== undefined) values.remarks = cleanText(body.remarks);
    row.assign(makeRow(sheet, values));
    await row.save();
    invalidateAcademicCache();
    res.json({ success: true, message: 'Attendance updated.' });
  } catch (error) { respondError(res, error); }
};

exports.addDiaryEntry = async (req, res) => {
  try {
    const body = req.body || {};
    if (!cleanText(body.studentId) || !cleanText(body.title)) return res.status(400).json({ success: false, message: 'Student roll number and title are required.' });
    const sheet = requireSheet('diary', res);
    if (!sheet) return;
    const scopedData = scopeAcademicData(await readAllAcademicData(), req.portalUser);
    const student = scopedData.students.find(record => cleanText(record.studentId).toLowerCase() === cleanText(body.studentId).toLowerCase());
    if (!student) return res.status(403).json({ success: false, message: 'This student is outside your course or branch assignment.' });
    if (body.trainingId && !scopedData.training.some(record => cleanText(record.trainingId) === cleanText(body.trainingId) && cleanText(record.studentId).toLowerCase() === cleanText(body.studentId).toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Choose a training assignment that belongs to this student.' });
    }
    const diaryId = nextId('DIA');
    await sheet.addRow(makeRow(sheet, {
      diaryId, studentId: cleanText(body.studentId), trainingId: cleanText(body.trainingId),
      date: cleanText(body.date) || formatIndiaTimestamp(),
      eventType: cleanText(body.eventType) || 'Trainer Note', title: cleanText(body.title),
      description: cleanText(body.description), createdBy: cleanText(req.portalUser?.name)
    }));
    invalidateAcademicCache();
    res.status(201).json({ success: true, diaryId, message: 'Student diary entry saved.' });
  } catch (error) { respondError(res, error); }
};
