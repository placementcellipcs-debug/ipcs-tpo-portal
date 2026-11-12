const crypto = require('crypto');
const mysqlPool = require('./mysqlPool');

const text = value => String(value ?? '').normalize('NFKC').trim();
const normalized = value => text(value).toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
const compact = value => normalized(value).replace(/[^a-z0-9]/g, '');

function parseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function valueFrom(fields, ...aliases) {
  const wanted = new Set(aliases.map(compact));
  for (const [key, value] of Object.entries(fields || {})) {
    if (wanted.has(compact(key)) && value !== undefined && value !== null) return value;
  }
  return '';
}

function writeField(fields, aliases, value) {
  const wanted = new Set(aliases.map(compact));
  const existing = Object.keys(fields).find(key => wanted.has(compact(key)));
  fields[existing || aliases[0]] = value;
}

function dateText(value) {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString();
  return text(value);
}

function formatDate(value) {
  const date = dateText(value);
  if (!date) return '';
  const iso = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : date;
}

function historyFromFields(fields, fallbackStatus, fallbackAt, fallbackBy) {
  const raw = valueFrom(fields, 'statusHistory', 'status history');
  const saved = parseJson(raw);
  const history = Array.isArray(saved) ? saved : Array.isArray(saved.history) ? saved.history : [];
  if (history.length) return history;
  const status = text(valueFrom(fields, 'status') || fallbackStatus);
  if (!status) return [];
  return [{
    status,
    remarks: text(valueFrom(fields, 'remarks')),
    interviewDate: text(valueFrom(fields, 'interviewDate')),
    interviewTime: text(valueFrom(fields, 'interviewTime', 'intervewtime')),
    interviewVenue: text(valueFrom(fields, 'interviewVenue')),
    changedBy: text(valueFrom(fields, 'placementOfficer', 'tpoName') || fallbackBy || 'Placement team'),
    changedAt: dateText(valueFrom(fields, 'timestamp', 'date', 'time') || fallbackAt),
    event: 'Existing placement record',
  }];
}

function applicationShape(row, fields, recordId, statusHistory) {
  const applicant = fields.applicant || {};
  const opening = fields.opening || {};
  const openingFields = fields.openingSourceFields || {};
  const sourceFields = fields.studentSourceFields || {};
  const merged = { ...sourceFields, ...openingFields };
  const status = text(row.status || valueFrom(merged, 'status') || 'Applied');
  const tpoName = text(row.owner_name || valueFrom(merged, 'placementOfficer', 'tpoName'));
  return {
    recordId,
    rowNumber: row.source_row_number ? Number(row.source_row_number) : undefined,
    recordType: 'application',
    origin: text(row.source || row.source_tab || valueFrom(merged, 'entrySource', 'recordOrigin', 'origin', 'source')),
    name: text(row.student_name || applicant.name || valueFrom(merged, 'studentName', 'name', 'candidate')),
    roll: text(row.roll_number || applicant.rollNumber || valueFrom(merged, 'rollNumber', 'rollNo', 'roll')),
    branch: text(row.branch_name || valueFrom(merged, 'branch', 'sittingBranch')) || 'Unknown',
    course: text(row.course_name || valueFrom(merged, 'course', 'program')) || 'Unknown',
    qual: text(row.qualification || valueFrom(merged, 'qualification', 'qual')) || 'Not Specified',
    jobId: text(row.job_code || opening.jobCode || valueFrom(merged, 'jobId', 'job id')),
    company: text(row.company_name || opening.companyName || valueFrom(merged, 'companyName', 'company')) || 'Unknown Company',
    position: text(row.position_title || opening.title || valueFrom(merged, 'position', 'role', 'title')) || 'Unknown Position',
    date: dateText(row.applied_at || row.occurred_at || valueFrom(merged, 'timestamp', 'date', 'time')),
    status,
    remarks: text(valueFrom(merged, 'remarks')),
    statusHistory,
    interviewDate: text(valueFrom(merged, 'interviewDate')),
    interviewTime: text(valueFrom(merged, 'interviewTime', 'intervewtime')),
    interviewVenue: text(valueFrom(merged, 'interviewVenue')),
    tpoName,
    phone: text(row.student_phone || applicant.phone || valueFrom(merged, 'contact', 'phone', 'mobileNumber')),
    email: text(row.student_email || applicant.email || valueFrom(merged, 'mailId', 'studentEmail', 'email', 'mail')),
    resume: text(row.resume_url || applicant.resume || valueFrom(merged, 'resume', 'cv')),
    datePlaced: text(valueFrom(merged, 'datePlaced')),
    packageLpa: text(valueFrom(merged, 'package', 'packageLpa')),
    offerLetter: text(valueFrom(merged, 'offerLetter', 'offerLetterStatus')),
    joiningStatus: text(valueFrom(merged, 'joiningStatus')),
    isInternationalPlacement: text(valueFrom(merged, 'internationalPlacement', 'isInternationalPlacement')),
    placementLocation: text(valueFrom(merged, 'workLocation', 'location')),
  };
}

async function getActor(connection, user) {
  const email = text(user?.email).toLocaleLowerCase('en-US');
  if (!email) return null;
  const [rows] = await connection.execute(
    `SELECT id, full_name, normalized_email, role, status, sitting_branch_id
     FROM users WHERE normalized_email = ? LIMIT 1`, [email],
  );
  return rows[0] || null;
}

async function branchAllowed(connection, actor, branchId) {
  if (!branchId || !actor?.id) return false;
  const [rows] = await connection.execute(
    `SELECT 1 AS allowed WHERE ? = ?
     UNION SELECT 1 FROM user_branch_assignments WHERE user_id = ? AND branch_id = ? LIMIT 1`,
    [actor.sitting_branch_id, branchId, actor.id, branchId],
  );
  return rows.length > 0;
}

async function listApplications({ user, isAdmin, isTpo, connection: suppliedConnection = null }) {
  const ownsConnection = !suppliedConnection;
  const connection = suppliedConnection || await mysqlPool.getPool().getConnection();
  try {
    const actor = await getActor(connection, user);
    if ((!actor && !isAdmin) || (actor && normalized(actor.status) === 'inactive')) {
      const error = new Error('Your staff profile is not available in the MySQL directory yet.');
      error.status = 403;
      throw error;
    }

    const [trackerRows] = await connection.execute(
      `SELECT tr.id, tr.source_tab, tr.source_row_number, tr.student_id, tr.vacancy_id,
              tr.owner_tpo_user_id, tr.roll_number, tr.student_name, tr.job_code,
              tr.company_name, tr.position_title, tr.status, tr.occurred_at, tr.metadata,
              sp.personal_email AS student_email, sp.phone AS student_phone, sp.resume_url,
              sp.branch_id, c.name AS course_name, b.name AS branch_name, v.qualification,
              owner.full_name AS owner_name, vacancy_owner.full_name AS vacancy_owner_name,
              v.assigned_tpo_user_id
       FROM placement_tracker_records tr
       LEFT JOIN student_profiles sp ON sp.id = tr.student_id
       LEFT JOIN courses c ON c.id = sp.course_id
       LEFT JOIN branches b ON b.id = sp.branch_id
       LEFT JOIN vacancies v ON v.id = tr.vacancy_id
       LEFT JOIN users owner ON owner.id = tr.owner_tpo_user_id
       LEFT JOIN users vacancy_owner ON vacancy_owner.id = v.assigned_tpo_user_id
       WHERE tr.source_tab = 'Opening_Applied' AND LOWER(COALESCE(tr.status, '')) <> 'deleted'
       ORDER BY tr.occurred_at DESC, tr.source_row_number DESC`,
    );
    const [applicationRows] = await connection.execute(
      `SELECT ja.id, ja.student_id, ja.vacancy_id, ja.owner_tpo_user_id, ja.status,
              ja.applied_at, ja.source, ja.metadata,
              sp.roll_number, sp.personal_email AS student_email, sp.phone AS student_phone,
              sp.resume_url, sp.branch_id, u.full_name AS student_name, c.name AS course_name,
              b.name AS branch_name, v.job_code, v.title AS position_title,
              v.company_name, v.qualification, owner.full_name AS owner_name
       FROM job_applications ja
       JOIN student_profiles sp ON sp.id = ja.student_id
       LEFT JOIN users u ON u.id = sp.user_id
       LEFT JOIN courses c ON c.id = sp.course_id
       LEFT JOIN branches b ON b.id = sp.branch_id
       JOIN vacancies v ON v.id = ja.vacancy_id
       LEFT JOIN users owner ON owner.id = ja.owner_tpo_user_id
       WHERE LOWER(COALESCE(ja.status, '')) <> 'deleted'
       ORDER BY ja.applied_at DESC`,
    );

    const historyIds = applicationRows.map(row => row.id);
    const [historyRows] = historyIds.length ? await connection.query(
      `SELECT h.application_id, h.previous_status, h.new_status, h.note, h.occurred_at,
              actor.full_name AS changed_by
       FROM application_status_history h
       LEFT JOIN users actor ON actor.id = h.actor_user_id
       WHERE h.application_id IN (${historyIds.map(() => '?').join(',')})
       ORDER BY h.occurred_at, h.history_sequence`,
      historyIds,
    ) : [[]];
    const historyByApplication = new Map();
    for (const row of historyRows) {
      const list = historyByApplication.get(row.application_id) || [];
      list.push({
        status: row.new_status,
        remarks: row.note || '',
        changedBy: row.changed_by || 'Placement team',
        changedAt: dateText(row.occurred_at),
        event: row.previous_status ? `${row.previous_status} → ${row.new_status}` : 'Application submitted',
      });
      historyByApplication.set(row.application_id, list);
    }

    const trackerApplications = [];
    for (const row of trackerRows) {
      const fields = parseJson(row.metadata)?.fields || {};
      const ownerLabel = text(valueFrom(fields, 'Placement Officer', 'Assigned TPO', 'TPO Name', 'TPO'));
      const ownerId = row.owner_tpo_user_id || (!ownerLabel ? row.assigned_tpo_user_id : null);
      let allowed = isAdmin;
      if (!allowed && isTpo) allowed = ownerId === actor.id;
      if (!allowed && !isTpo) allowed = await branchAllowed(connection, actor, row.branch_id);
      if (!allowed) continue;
      const resolved = {
        ...row,
        owner_name: row.owner_name || (!ownerLabel ? row.vacancy_owner_name : '') || (actor && ownerId === actor.id ? actor.full_name : ''),
      };
      trackerApplications.push(applicationShape(
        resolved, fields, `tracker:${row.id}`,
        historyFromFields(fields, row.status, row.occurred_at, resolved.owner_name),
      ));
    }

    const currentApplications = [];
    for (const row of applicationRows) {
      let allowed = isAdmin;
      if (!allowed && isTpo) allowed = row.owner_tpo_user_id === actor.id;
      if (!allowed && !isTpo) allowed = await branchAllowed(connection, actor, row.branch_id);
      if (!allowed) continue;
      currentApplications.push(applicationShape(
        row, parseJson(row.metadata), `application:${row.id}`,
        historyByApplication.get(row.id) || [],
      ));
    }
    return [...trackerApplications, ...currentApplications]
      .sort((left, right) => new Date(right.date || 0).getTime() - new Date(left.date || 0).getTime());
  } finally {
    if (ownsConnection) connection.release();
  }
}

const placementFields = row => parseJson(row.metadata)?.fields || {};
const truthyField = value => /^(yes|true|1|marked)$/i.test(text(value));
const expectedMismatch = (expected, actual) => ['name', 'roll', 'jobId', 'company', 'position'].some(key => {
  const supplied = text(expected?.[key]);
  return supplied && normalized(supplied) !== normalized(actual[key]);
});

function samePlacedStudent(candidateFields, target) {
  const candidateRoll = text(valueFrom(candidateFields, 'Roll Number', 'Roll No', 'IPCS Roll Number', 'Roll'));
  if (target.roll && candidateRoll) return normalized(candidateRoll) === normalized(target.roll);
  const candidateName = text(valueFrom(candidateFields, 'Student Name', 'Name', 'Candidate'));
  return Boolean(target.name && candidateName && normalized(candidateName) === normalized(target.name));
}

function samePlacedOpening(candidateFields, target) {
  const candidateJobId = text(valueFrom(candidateFields, 'Job ID', 'JOBID'));
  if (target.jobId && candidateJobId && normalized(candidateJobId) !== normalized(target.jobId)) return false;
  const candidateCompany = text(valueFrom(candidateFields, 'Company Name', 'Company'));
  if (!target.company || !candidateCompany || normalized(candidateCompany) !== normalized(target.company)) return false;
  const candidatePosition = text(valueFrom(candidateFields, 'Position', 'Role'));
  return !target.position || !candidatePosition || normalized(candidatePosition) === normalized(target.position);
}

async function getPlacedTrackerRow(connection, rowNumber, forUpdate = false) {
  const [rows] = await connection.execute(
    `SELECT tr.*, sp.branch_id, sp.personal_email AS student_email, sp.phone AS student_phone, sp.resume_url,
            c.name AS course_name, b.name AS branch_name, v.qualification, v.assigned_tpo_user_id AS vacancy_owner_id,
            owner.full_name AS owner_name, owner.email AS owner_email
     FROM placement_tracker_records tr
     LEFT JOIN student_profiles sp ON sp.id = tr.student_id
     LEFT JOIN courses c ON c.id = sp.course_id
     LEFT JOIN branches b ON b.id = sp.branch_id
     LEFT JOIN vacancies v ON v.id = tr.vacancy_id
     LEFT JOIN users owner ON owner.id = tr.owner_tpo_user_id
     WHERE tr.source_key = 'shared_placement' AND tr.source_tab = 'TPO_Log' AND tr.source_row_number = ?
     LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [rowNumber],
  );
  return rows[0] || null;
}

async function listPlacedStudents({ user, isAdmin = false, isTpo = false }) {
  const connection = await mysqlPool.getPool().getConnection();
  try {
    const actor = await getActor(connection, user);
    if ((!actor && !isAdmin) || (actor && normalized(actor.status) === 'inactive')) {
      const error = new Error('Your staff profile is not available in the MySQL directory yet.');
      error.status = 403;
      throw error;
    }
    const [rows] = await connection.execute(
      `SELECT tr.*, sp.branch_id, sp.personal_email AS student_email, sp.phone AS student_phone, sp.resume_url,
              c.name AS course_name, b.name AS branch_name, v.qualification, v.assigned_tpo_user_id AS vacancy_owner_id,
              owner.full_name AS owner_name
       FROM placement_tracker_records tr
       LEFT JOIN student_profiles sp ON sp.id = tr.student_id
       LEFT JOIN courses c ON c.id = sp.course_id
       LEFT JOIN branches b ON b.id = sp.branch_id
       LEFT JOIN vacancies v ON v.id = tr.vacancy_id
       LEFT JOIN users owner ON owner.id = tr.owner_tpo_user_id
       WHERE tr.source_key = 'shared_placement' AND tr.source_tab = 'TPO_Log'
         AND LOWER(TRIM(COALESCE(tr.status, ''))) = 'placed'
       ORDER BY tr.occurred_at DESC, tr.source_row_number DESC`,
    );
    const records = [];
    for (const row of rows) {
      const fields = placementFields(row);
      if (truthyField(valueFrom(fields, 'TPO Action Log', 'Action Type'))) continue;
      const ownerLabel = text(valueFrom(fields, 'Placement Officer', 'TPO', 'TPO Name', 'Created By'));
      const ownerId = row.owner_tpo_user_id || (!ownerLabel ? row.vacancy_owner_id : null);
      const branch = text(row.branch_name || valueFrom(fields, 'Branch', 'Sitting Branch'));
      let allowed = isAdmin;
      if (!allowed && isTpo) allowed = ownerId === actor?.id
        || (ownerLabel && normalized(ownerLabel) === normalized(actor?.full_name))
        || (!ownerLabel && await branchAllowed(connection, actor, row.branch_id));
      if (!allowed && !isTpo) allowed = await branchAllowed(connection, actor, row.branch_id);
      if (!allowed) continue;

      records.push({
        ...fields,
        rowNumber: Number(row.source_row_number),
        recordId: `tracker:${row.id}`,
        sourceSheet: 'TPO_Log',
        'Student Name': text(row.student_name || valueFrom(fields, 'Student Name', 'Name', 'Candidate')),
        'Roll Number': text(row.roll_number || valueFrom(fields, 'Roll Number', 'Roll No', 'Roll')),
        'Company Name': text(row.company_name || valueFrom(fields, 'Company Name', 'Company')),
        Position: text(row.position_title || valueFrom(fields, 'Position', 'Role')),
        Branch: branch,
        Course: text(row.course_name || valueFrom(fields, 'Course', 'Program')),
        Qualification: text(row.qualification || valueFrom(fields, 'Qualification')),
        Status: text(row.status),
        'Placement Officer': text(row.owner_name || ownerLabel),
        'Job ID': text(row.job_code || valueFrom(fields, 'Job ID', 'JOBID')),
        Contact: text(row.student_phone || valueFrom(fields, 'Contact', 'Phone', 'Mobile Number')),
        'Mail ID': text(row.student_email || valueFrom(fields, 'Mail ID', 'Email')),
        location: text(valueFrom(fields, 'Work Location', 'Placement Location', 'Location')),
        isInternationalPlacement: truthyField(valueFrom(fields, 'International Placement', 'Is International Placement')),
      });
    }
    return records;
  } finally { connection.release(); }
}

async function createPlacedStudentDeleteRequest({ user, rowNumber, expected = {}, reason }) {
  const connection = await mysqlPool.getPool().getConnection();
  try {
    await connection.beginTransaction();
    const actor = await getActor(connection, user);
    if (!actor || normalized(actor.status) === 'inactive') {
      const error = new Error('Your staff profile is not available in the MySQL directory yet.'); error.status = 403; throw error;
    }
    const row = await getPlacedTrackerRow(connection, rowNumber, true);
    if (!row) { const error = new Error('This placement row no longer exists. Refresh the page and try again.'); error.status = 404; throw error; }
    const fields = placementFields(row);
    const record = {
      name: text(row.student_name || valueFrom(fields, 'Student Name', 'Name', 'Candidate')),
      roll: text(row.roll_number || valueFrom(fields, 'Roll Number', 'Roll No', 'IPCS Roll Number', 'Roll')),
      jobId: text(row.job_code || valueFrom(fields, 'Job ID', 'JOBID')),
      company: text(row.company_name || valueFrom(fields, 'Company Name', 'Company')),
      position: text(row.position_title || valueFrom(fields, 'Position', 'Role')),
      branch: text(row.branch_name || valueFrom(fields, 'Branch', 'Sitting Branch')),
      course: text(row.course_name || valueFrom(fields, 'Course', 'Program')),
      owner: text(row.owner_name || valueFrom(fields, 'Placement Officer', 'TPO', 'TPO Name', 'Created By')),
      status: text(row.status),
    };
    if (normalizePlacementStatus(record.status) !== 'placed') {
      const error = new Error('This TPO_Log row is no longer marked Placed. Refresh the page before deleting.'); error.status = 409; throw error;
    }
    if (truthyField(valueFrom(fields, 'TPO Action Log'))) {
      const error = new Error('This is a placement action-history row and cannot be deleted from the Placed Students page.'); error.status = 409; throw error;
    }
    if (expectedMismatch(expected, record)) {
      const error = new Error('The placement details changed after this list loaded. Refresh the page and check the record again.'); error.status = 409; throw error;
    }
    const ownerId = row.owner_tpo_user_id || (!record.owner ? row.vacancy_owner_id : null);
    const branchAccess = await branchAllowed(connection, actor, row.branch_id);
    const isTpo = /tpo|placement[_ ]officer/i.test(text(actor.role));
    if (isTpo && ownerId !== actor.id && normalized(record.owner) !== normalized(actor.full_name) && !( !record.owner && branchAccess)) {
      const error = new Error('You can request deletion only for placements assigned to you.'); error.status = 403; throw error;
    }
    if (!isTpo && !branchAccess && !/admin|manager|head/i.test(text(actor.role))) {
      const error = new Error('This placement is outside your assigned branch.'); error.status = 403; throw error;
    }
    const cleanReason = text(reason);
    if (cleanReason.length < 5) { const error = new Error('Add a short reason for this deletion request (at least 5 characters).'); error.status = 400; throw error; }
    const targetId = `${record.roll || record.name}|${record.jobId || record.company}|${record.position}`.slice(0, 200);
    const requestCode = `DEL-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
    const target = {
      type: 'placed-student', recordId: row.id, rowNumber: Number(row.source_row_number),
      expected: { name: record.name, roll: record.roll, jobId: record.jobId, company: record.company, position: record.position },
      branch: record.branch, course: record.course, owner: record.owner, entrySource: 'TPO_Log',
    };
    const summary = `${record.name || 'Student'} · ${record.roll || 'No roll number'} · ${record.company || 'Company not listed'} · ${record.position || 'Position not listed'}`;
    await connection.execute(
      `INSERT INTO tpo_delete_requests
       (id, request_code, status, record_type, target_id, target_summary, target_snapshot, reason,
        requested_by_user_id, requested_by_name, requested_by_email, requested_by_role)
       VALUES (?, ?, 'pending', 'Placed student', ?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?)`,
      [crypto.randomUUID(), requestCode, targetId, summary, JSON.stringify(target), cleanReason.slice(0, 500),
        actor.id, actor.full_name, actor.normalized_email, actor.role],
    );
    await connection.execute(
      `INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, request_id, details)
       VALUES (?, ?, 'deletion_requested', 'placed_student', ?, ?, CAST(? AS JSON))`,
      [crypto.randomUUID(), actor.id, row.id, requestCode, JSON.stringify({ summary, reason: cleanReason.slice(0, 500) })],
    );
    await connection.commit();
    return { requestId: requestCode, target };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally { connection.release(); }
}

function normalizePlacementStatus(value) { return normalized(value).replace(/[^a-z0-9]/g, ''); }

async function archivePlacedStudent({ connection, actor, rowNumber, expected = {}, requestId = '' }) {
  const row = await getPlacedTrackerRow(connection, rowNumber, true);
  if (!row) { const error = new Error('This placement row no longer exists. Refresh the list and try again.'); error.status = 404; throw error; }
  const fields = placementFields(row);
  const record = {
    name: text(row.student_name || valueFrom(fields, 'Student Name', 'Name', 'Candidate')),
    roll: text(row.roll_number || valueFrom(fields, 'Roll Number', 'Roll No', 'IPCS Roll Number', 'Roll')),
    jobId: text(row.job_code || valueFrom(fields, 'Job ID', 'JOBID')),
    company: text(row.company_name || valueFrom(fields, 'Company Name', 'Company')),
    position: text(row.position_title || valueFrom(fields, 'Position', 'Role')),
  };
  if (normalizePlacementStatus(row.status) !== 'placed' || truthyField(valueFrom(fields, 'TPO Action Log'))) {
    const error = new Error('The placement is no longer an active Placed record. No data was changed.'); error.status = 409; throw error;
  }
  if (expectedMismatch(expected, record)) {
    const error = new Error('The placement details changed after this request was submitted. Ask the TPO to submit a fresh request.'); error.status = 409; throw error;
  }

  const [openingRows] = await connection.execute(
    `SELECT id, roll_number, student_name, job_code, company_name, metadata
     FROM placement_tracker_records WHERE source_key = 'shared_placement' AND source_tab = 'Opening_Applied'
       AND LOWER(COALESCE(status, '')) <> 'deleted' ORDER BY source_row_number`,
  );
  let matching = openingRows.filter(candidate => {
    const candidateFields = placementFields(candidate);
    return samePlacedStudent(candidateFields, record) && samePlacedOpening(candidateFields, record);
  });
  if (matching.length > 1) {
    const error = new Error(`Found ${matching.length} matching Opening_Applied rows. Nothing was deleted; ask an administrator to resolve the duplicate safely.`); error.status = 409; throw error;
  }
  if (matching[0]) {
    const [lockedRows] = await connection.execute(
      `SELECT id, roll_number, student_name, job_code, company_name, metadata, status
       FROM placement_tracker_records WHERE id = ? LIMIT 1 FOR UPDATE`, [matching[0].id],
    );
    const locked = lockedRows[0];
    if (!locked || normalized(locked.status) === 'deleted') matching = [];
    else {
      const lockedFields = placementFields(locked);
      if (!samePlacedStudent(lockedFields, record) || !samePlacedOpening(lockedFields, record)) {
        const error = new Error('The linked application changed during this request. Refresh and retry.'); error.status = 409; throw error;
      }
      matching = [locked];
    }
  }

  const deletedAt = new Date().toISOString();
  const markDeleted = async targetRow => {
    const metadata = parseJson(targetRow.metadata);
    metadata.fields ||= {};
    writeField(metadata.fields, ['Status'], 'Deleted');
    metadata.deleted = { at: deletedAt, requestId: requestId || null, by: text(actor?.email) };
    await connection.execute(
      "UPDATE placement_tracker_records SET status = 'deleted', metadata = CAST(? AS JSON), updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [JSON.stringify(metadata), targetRow.id],
    );
  };
  await markDeleted(row);
  if (matching[0]) await markDeleted(matching[0]);

  let canonicalApplicationReverted = false;
  let studentId = row.student_id;
  let vacancyId = row.vacancy_id;
  if (!studentId && record.roll) {
    const [students] = await connection.execute('SELECT id FROM student_profiles WHERE normalized_roll_number = ? LIMIT 1', [normalized(record.roll).replace(/\s+/g, '')]);
    studentId = students[0]?.id || null;
  }
  if (!vacancyId && record.jobId) {
    const [vacancies] = await connection.execute('SELECT id FROM vacancies WHERE LOWER(TRIM(job_code)) = ? LIMIT 1', [normalized(record.jobId)]);
    vacancyId = vacancies[0]?.id || null;
  }
  if (studentId && vacancyId) {
    const [applications] = await connection.execute(
      'SELECT id, status, metadata FROM job_applications WHERE student_id = ? AND vacancy_id = ? LIMIT 1 FOR UPDATE',
      [studentId, vacancyId],
    );
    const application = applications[0];
    if (application && normalized(application.status) === 'placed') {
      const [historyRows] = await connection.execute(
        `SELECT previous_status FROM application_status_history WHERE application_id = ?
         AND LOWER(new_status) = 'placed' ORDER BY occurred_at DESC, history_sequence DESC LIMIT 1`, [application.id],
      );
      const restoredStatus = text(historyRows[0]?.previous_status) || 'applied';
      const metadata = parseJson(application.metadata);
      metadata.placementCorrection = { at: deletedAt, requestId: requestId || null, note: 'Placement record deleted after review.' };
      await connection.execute('UPDATE job_applications SET status = ?, metadata = CAST(? AS JSON) WHERE id = ?',
        [restoredStatus, JSON.stringify(metadata), application.id]);
      await connection.execute(
        `INSERT INTO application_status_history (id, application_id, previous_status, new_status, note, actor_user_id, metadata)
         VALUES (?, ?, 'placed', ?, ?, ?, CAST(? AS JSON))`,
        [crypto.randomUUID(), application.id, restoredStatus, 'Placement record removed after review.', actor?.id || null,
          JSON.stringify({ requestId: requestId || null, source: 'placed_student_deletion' })],
      );
      canonicalApplicationReverted = true;
    }
  }

  await connection.execute(
    `INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, request_id, details)
     VALUES (?, ?, 'placed_student_archived', 'placed_student', ?, ?, CAST(? AS JSON))`,
    [crypto.randomUUID(), actor?.id || null, row.id, requestId || null,
      JSON.stringify({ record, linkedOpeningRowArchived: Boolean(matching[0]), canonicalApplicationReverted })],
  );
  return { tpoLog: true, openingApplied: Boolean(matching[0]), applicationRestored: canonicalApplicationReverted };
}

async function deletePlacedStudent({ user, isAdmin = false, isTpo = false, rowNumber, expected = {}, reason = '', approvalRequestId = '' }) {
  const connection = await mysqlPool.getPool().getConnection();
  try {
    await connection.beginTransaction();
    const actor = await getActor(connection, user);
    if ((!actor && !isAdmin) || (actor && normalized(actor.status) === 'inactive')) {
      const error = new Error('Your staff profile is not available in the MySQL directory yet.'); error.status = 403; throw error;
    }
    if (isTpo && !approvalRequestId) {
      await connection.rollback();
      return { request: await createPlacedStudentDeleteRequest({ user, rowNumber, expected, reason }) };
    }
    const row = await getPlacedTrackerRow(connection, rowNumber, true);
    if (!row) { const error = new Error('This placement row no longer exists. Refresh the page and try again.'); error.status = 404; throw error; }
    const ownerLabel = text(valueFrom(placementFields(row), 'Placement Officer', 'TPO', 'TPO Name', 'Created By'));
    const ownerId = row.owner_tpo_user_id || (!ownerLabel ? row.vacancy_owner_id : null);
    if (!isAdmin && !approvalRequestId) {
      const assignedToActor = ownerId === actor?.id || (ownerLabel && normalized(ownerLabel) === normalized(actor?.full_name));
      const branchAccess = await branchAllowed(connection, actor, row.branch_id);
      if (isTpo ? (!assignedToActor && !( !ownerLabel && branchAccess)) : !branchAccess) {
        const error = new Error('You can delete only placements within your assigned placement scope.'); error.status = 403; throw error;
      }
    }
    const deleted = await archivePlacedStudent({ connection, actor: actor || user, rowNumber, expected, requestId: approvalRequestId });
    await connection.commit();
    return { deleted };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally { connection.release(); }
}

async function updateApplication({ user, isAdmin, isTpo, body, previewOnly = false }) {
  const recordId = text(body?.recordId);
  const match = recordId.match(/^(tracker|application):([0-9a-f-]{36})$/i);
  if (!match) {
    const error = new Error('Refresh the tracker and select the application again.');
    error.status = 400;
    throw error;
  }
  const [, kind, id] = match;
  const pool = mysqlPool.getPool();
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const actor = await getActor(connection, user);
    if ((!actor && !isAdmin) || (actor && normalized(actor.status) === 'inactive')) {
      const error = new Error('Your staff profile is not available in the MySQL directory yet.');
      error.status = 403;
      throw error;
    }

    let record;
    let metadata;
    let previousStatus;
    let previousRemarks;
    let branchId = null;
    let ownerId = null;
    if (kind.toLowerCase() === 'tracker') {
      const [rows] = await connection.execute(
        `SELECT tr.*, v.assigned_tpo_user_id AS vacancy_owner_id,
                sp.branch_id
         FROM placement_tracker_records tr
         LEFT JOIN vacancies v ON v.id = tr.vacancy_id
         LEFT JOIN student_profiles sp ON sp.id = tr.student_id
         WHERE tr.id = ? AND tr.source_tab = 'Opening_Applied' LIMIT 1 FOR UPDATE`, [id],
      );
      record = rows[0];
      if (!record) {
        const error = new Error('Application record was not found.'); error.status = 404; throw error;
      }
      metadata = parseJson(record.metadata);
      metadata.fields ||= {};
      previousStatus = text(record.status || valueFrom(metadata.fields, 'status'));
      previousRemarks = text(valueFrom(metadata.fields, 'remarks'));
      branchId = record.branch_id;
      const ownerLabel = text(valueFrom(metadata.fields, 'Placement Officer', 'Assigned TPO', 'TPO Name', 'TPO'));
      ownerId = record.owner_tpo_user_id || (!ownerLabel ? record.vacancy_owner_id : null);
    } else {
      const [rows] = await connection.execute(
        `SELECT ja.*, sp.branch_id FROM job_applications ja
         JOIN student_profiles sp ON sp.id = ja.student_id
         WHERE ja.id = ? LIMIT 1 FOR UPDATE`, [id],
      );
      record = rows[0];
      if (!record) {
        const error = new Error('Application record was not found.'); error.status = 404; throw error;
      }
      metadata = parseJson(record.metadata);
      previousStatus = text(record.status);
      previousRemarks = text(valueFrom(metadata.openingSourceFields, 'remarks'));
      branchId = record.branch_id;
      ownerId = record.owner_tpo_user_id;
    }
    const allowed = isAdmin || (isTpo && ownerId === actor.id) || (!isTpo && await branchAllowed(connection, actor, branchId));
    if (!allowed) {
      const error = new Error('This application is outside your placement assignment.'); error.status = 403; throw error;
    }

    const nextStatus = body.status === undefined ? previousStatus : text(body.status);
    if (!nextStatus) {
      const error = new Error('Choose a valid application status.'); error.status = 400; throw error;
    }
    if (normalized(nextStatus) === 'placed' && normalized(previousStatus) !== 'placed'
      && !normalized(body.isInternationalPlacement)) {
      const error = new Error('Choose whether this placement is International or within India before marking the student Placed.');
      error.status = 422;
      throw error;
    }

    const fields = kind.toLowerCase() === 'tracker'
      ? metadata.fields
      : (metadata.openingSourceFields ||= {});
    const nextRemarks = body.remarks === undefined ? previousRemarks : text(body.remarks);
    writeField(fields, ['Status'], nextStatus);
    writeField(fields, ['Remarks'], nextRemarks);
    if (body.interviewDate !== undefined) writeField(fields, ['Interview Date'], text(body.interviewDate));
    if (body.interviewTime !== undefined) writeField(fields, ['Interview Time'], text(body.interviewTime));
    if (body.interviewVenue !== undefined) writeField(fields, ['Interview Venue'], text(body.interviewVenue));
    if (body.datePlaced !== undefined) writeField(fields, ['Date Placed'], text(body.datePlaced));
    if (body.packageLpa !== undefined) writeField(fields, ['Package (LPA)'], text(body.packageLpa));
    if (body.joiningStatus !== undefined) writeField(fields, ['Joining Status'], text(body.joiningStatus));
    if (body.offerLetter !== undefined) writeField(fields, ['Offer Letter'], text(body.offerLetter));
    if (body.isInternationalPlacement !== undefined) writeField(fields, ['International Placement'], text(body.isInternationalPlacement));
    if (body.joiningStatus !== undefined) {
      writeField(fields, ['Dual Placement'], 'No');
      writeField(fields, ['Multiple Placement'], 'No');
    }

    const now = new Date().toISOString();
    const existingHistory = kind.toLowerCase() === 'tracker'
      ? historyFromFields(metadata.fields, previousStatus, record.occurred_at, actor?.full_name)
      : [];
    const historyEntry = {
      status: nextStatus,
      remarks: nextRemarks,
      interviewDate: text(body.interviewDate === undefined ? valueFrom(fields, 'Interview Date') : body.interviewDate),
      interviewTime: text(body.interviewTime === undefined ? valueFrom(fields, 'Interview Time') : body.interviewTime),
      interviewVenue: text(body.interviewVenue === undefined ? valueFrom(fields, 'Interview Venue') : body.interviewVenue),
      changedBy: actor?.full_name || text(user?.name || user?.email) || 'Placement team',
      changedAt: now,
      event: previousStatus && previousStatus !== nextStatus ? `${previousStatus} → ${nextStatus}` : 'Application updated',
    };
    const history = [...existingHistory, historyEntry];
    writeField(fields, ['Status History'], JSON.stringify(history));

    if (kind.toLowerCase() === 'tracker') {
      await connection.execute(
        `UPDATE placement_tracker_records SET status = ?, metadata = CAST(? AS JSON), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [nextStatus, JSON.stringify(metadata), id],
      );
    } else {
      await connection.execute(
        `UPDATE job_applications SET status = ?, metadata = CAST(? AS JSON), updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [nextStatus, JSON.stringify(metadata), id],
      );
      await connection.execute(
        `INSERT INTO application_status_history
          (id, application_id, previous_status, new_status, note, actor_user_id, occurred_at, metadata)
         VALUES (?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), CAST(? AS JSON))`,
        [crypto.randomUUID(), id, previousStatus || null, nextStatus,
          nextRemarks || 'Application details updated.', actor?.id || null,
          JSON.stringify({ source: 'tpo_portal', interviewDate: historyEntry.interviewDate, interviewTime: historyEntry.interviewTime, interviewVenue: historyEntry.interviewVenue })],
      );
    }
    await connection.execute(
      `INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, occurred_at, details)
       VALUES (?, ?, 'placement_application_updated', ?, ?, UTC_TIMESTAMP(), CAST(? AS JSON))`,
      [crypto.randomUUID(), actor?.id || null, kind.toLowerCase() === 'tracker' ? 'placement_tracker_record' : 'job_application', id,
        JSON.stringify({ previousStatus, newStatus: nextStatus, changedFields: Object.keys(body).filter(key => !['recordId', 'fullApp', 'currentUserEmail', 'offerLetterFile'].includes(key)) })],
    );
    if (previewOnly) {
      // Local integration checks can exercise the complete update transaction
      // without persisting a change. The HTTP controller never forwards this.
      await connection.rollback();
      return { status: nextStatus, statusHistory: history, rolledBack: true };
    }
    await connection.commit();
    return { status: nextStatus, statusHistory: history };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  archivePlacedStudent,
  createPlacedStudentDeleteRequest,
  deletePlacedStudent,
  listApplications,
  listPlacedStudents,
  updateApplication,
};
