const { JWT } = require('google-auth-library');
const { GoogleSpreadsheet } = require('google-spreadsheet');
const { getCache, hasAccess } = require('./config');

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n') : '',
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const academicDoc = new GoogleSpreadsheet('1mhTuK_3dXLKk1DcUCTA7KFWHiCKirwmYP6l7wMLYPlo', serviceAccountAuth);
let loadPromise;
let cachedData;
let cachedAt = 0;
let dataPromise;
const CACHE_TTL_MS = 5 * 60 * 1000;

const SHEET_TITLES = {
  training: ['01_Training', 'training'],
  batches: ['02_Batches', 'batches'],
  topics: ['03_Topics', 'topics'],
  sessions: ['04_Sessions', 'sessions'],
  attendance: ['05_Attendance', 'attendance'],
  topicProgress: ['06_Topic_Progress', 'topicprogress'],
  diary: ['07_Diary', 'diary'],
};

const FIELD_HEADERS = {
  trainingId: ['trainingid'], studentId: ['studentid', 'rollnumber', 'ipcsrollnumber'],
  studentName: ['studentname', 'name'], mainCourse: ['maincourse', 'course'],
  subCourse: ['subcourse', 'specialization'], branch: ['branch'],
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
};

const normalize = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

async function loadAcademicDoc() {
  if (!loadPromise) loadPromise = academicDoc.loadInfo();
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
  const read = (keywords) => {
    const header = headers.find(item => keywords.some(keyword => normalize(item).includes(normalize(keyword))));
    return header ? (row.get(header) || '') : '';
  };
  return {
    studentId: read(['ipcsrollnumber', 'rollnumber', 'roll']),
    studentName: read(['studentname', 'name']),
    mainCourse: read(['course', 'maincourse']),
    subCourse: read(['subcourse']),
    branch: read(['branch']),
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
    const keys = ['training', 'batches', 'topics', 'sessions', 'attendance', 'topicProgress', 'diary'];
    const [trainingRows, batchRows, topicRows, sessionRows, attendanceRows, progressRows, diaryRows] = await Promise.all(
      keys.map(key => readRows(findSheet(key)))
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
    const topics = mapRecords(topicRows, ['topicId', 'mainCourse', 'subCourse', 'module', 'topic', 'subtopic', 'sequence', 'plannedHours']);
    const sessions = mapRecords(sessionRows, [
      'sessionId', 'trainingId', 'batchId', 'studentId', 'date', 'startTime', 'endTime', 'trainerId',
      'trainerName', 'topicId', 'topic', 'actualHours', 'sessionStatus', 'remarks'
    ]);
    const attendance = mapRecords(attendanceRows, [
      'attendanceId', 'sessionId', 'trainingId', 'studentId', 'date', 'attendanceStatus', 'markingMethod',
      'verified', 'verifiedBy', 'remarks'
    ]).map(record => ({ ...record, studentName: studentMap.get(String(record.studentId).trim().toLowerCase())?.studentName || '' }));
    const topicProgress = mapRecords(progressRows, ['trainingId', 'studentId', 'topicId', 'topic', 'completed', 'comprehension', 'remarks']);
    const diary = mapRecords(diaryRows, ['diaryId', 'studentId', 'trainingId', 'date', 'eventType', 'title', 'description', 'createdBy'])
      .map(record => ({ ...record, studentName: studentMap.get(String(record.studentId).trim().toLowerCase())?.studentName || '' }));

    cachedData = { training, batches, topics, sessions, attendance, topicProgress, diary, students };
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

function canAccessAcademicRecord(user, record = {}) {
  if (!user) return false;
  if (user.accessType === 'superadmin') return true;
  return hasAccess(record.branch || '', record.mainCourse || record.course || '', user.role, user.assignedBranchesArray, user.assignedCourse);
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
    const branch = user?.assignedBranchesArray?.find(value => String(value).toLowerCase() !== 'all') || user?.sittingBranch || '';
    return user?.accessType === 'superadmin' || hasAccess(branch, topic.mainCourse, user?.role, user?.assignedBranchesArray, user?.assignedCourse);
  });
  const sessions = data.sessions.filter(session =>
    (session.trainingId && trainingIds.has(cleanText(session.trainingId))) ||
    (session.batchId && batchIds.has(cleanText(session.batchId))) ||
    (session.studentId && studentIds.has(cleanText(session.studentId).toLowerCase()))
  );
  const sessionIds = new Set(sessions.map(session => cleanText(session.sessionId)));
  const attendance = data.attendance.filter(record =>
    sessionIds.has(cleanText(record.sessionId)) || trainingIds.has(cleanText(record.trainingId)) || studentIds.has(cleanText(record.studentId).toLowerCase())
  );
  return {
    training,
    batches,
    topics,
    sessions,
    attendance,
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
    const now = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
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
    const allowedStatuses = ['Present', 'Absent', 'Late', 'Leave'];
    const values = {};
    if (body.status !== undefined) {
      if (!allowedStatuses.includes(body.status)) return res.status(400).json({ success: false, message: 'Attendance status must be Present, Absent, Late, or Leave.' });
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
      date: cleanText(body.date) || new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      eventType: cleanText(body.eventType) || 'Trainer Note', title: cleanText(body.title),
      description: cleanText(body.description), createdBy: cleanText(req.portalUser?.name)
    }));
    invalidateAcademicCache();
    res.status(201).json({ success: true, diaryId, message: 'Student diary entry saved.' });
  } catch (error) { respondError(res, error); }
};
