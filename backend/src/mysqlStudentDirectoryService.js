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

function sourceFields(row) {
  const data = parseJson(row.row_data_json);
  const fields = data.fields && typeof data.fields === 'object' ? data.fields : {};
  return Object.fromEntries(Object.entries(fields).filter(([key]) => !/password|secret|token/i.test(key)));
}

function putField(fields, aliases, value) {
  const wanted = new Set(aliases.map(compact));
  const existing = Object.keys(fields).find(key => wanted.has(compact(key)));
  fields[existing || aliases[0]] = value ?? '';
}

function putFieldIfMissing(fields, aliases, value) {
  const wanted = new Set(aliases.map(compact));
  if (!Object.keys(fields).some(key => wanted.has(compact(key)))) putField(fields, aliases, value);
}

function rowFromFields(fields, rowNumber, studentId = '') {
  const headerValues = Object.keys(fields);
  const row = {
    rowNumber: Number(rowNumber) || 2,
    studentId,
    _worksheet: { headerValues },
    _rawData: headerValues.map(header => fields[header] == null ? '' : String(fields[header])),
    toObject: () => ({ ...fields }),
  };
  return row;
}

function profileFields(row) {
  const metadata = parseJson(row.metadata);
  const fields = { ...(metadata.fields || {}) };
  // The source-cell values in metadata remain the directory display values.
  // Normalized columns are fallbacks only; writing their trimmed/normalized
  // forms over source text would silently lose spaces and original casing.
  putFieldIfMissing(fields, ['Name', 'Student Name'], row.full_name);
  putFieldIfMissing(fields, ['Mail ID', 'Email'], row.personal_email || row.email);
  putFieldIfMissing(fields, ['Phone No.', 'Contact Number', 'Phone'], row.profile_phone || row.user_phone);
  putFieldIfMissing(fields, ['IPCS Roll Number', 'Roll Number', 'Roll No'], row.roll_number);
  putFieldIfMissing(fields, ['Course', 'Program'], row.course_name);
  putFieldIfMissing(fields, ['Branch', 'Sitting Branch'], row.branch_name);
  putFieldIfMissing(fields, ['Profile Photo', 'Photo'], row.profile_photo_url || '');
  putFieldIfMissing(fields, ['Resume', 'Resume Link'], row.resume_url || '');
  putFieldIfMissing(fields, ['Status'], row.student_status || 'active');
  return { fields, metadata };
}

function trackerFields(row) {
  const fields = { ...(parseJson(row.metadata).fields || {}) };
  putField(fields, ['Timestamp', 'Date'], row.occurred_at || '');
  putField(fields, ['Student Name', 'Name'], row.student_name || '');
  putField(fields, ['Roll Number', 'IPCS Roll Number', 'Roll No'], row.roll_number || '');
  putField(fields, ['Job ID', 'Job Code'], row.job_code || '');
  putField(fields, ['Company Name', 'Company'], row.company_name || '');
  putField(fields, ['Position', 'Role'], row.position_title || '');
  putField(fields, ['Status'], row.status || '');
  return fields;
}

function applicationFields(row, history) {
  const metadata = parseJson(row.metadata);
  const fields = { ...(metadata.studentSourceFields || {}), ...(metadata.openingSourceFields || {}) };
  putField(fields, ['Timestamp', 'Date'], row.applied_at || '');
  putField(fields, ['Student Name', 'Name'], row.student_name || '');
  putField(fields, ['Contact', 'Phone'], row.student_phone || '');
  putField(fields, ['Mail ID', 'Email'], row.student_email || '');
  putField(fields, ['Roll Number', 'IPCS Roll Number', 'Roll No'], row.roll_number || '');
  putField(fields, ['Course', 'Program'], row.course_name || '');
  putField(fields, ['Branch', 'Sitting Branch'], row.branch_name || '');
  putField(fields, ['Job ID', 'Job Code'], row.job_code || '');
  putField(fields, ['Company Name', 'Company'], row.company_name || '');
  putField(fields, ['Position', 'Role'], row.position_title || '');
  putField(fields, ['Status'], row.status || 'Applied');
  putField(fields, ['Remarks'], history.at(-1)?.note || '');
  putField(fields, ['Status History'], JSON.stringify(history.map(item => ({
    status: item.new_status,
    changedAt: item.occurred_at,
    changedBy: item.changed_by || 'Placement team',
    remarks: item.note || '',
  }))));
  return fields;
}

async function loadDirectoryRows({ connection: suppliedConnection = null } = {}) {
  const ownsConnection = !suppliedConnection;
  const connection = suppliedConnection || await mysqlPool.getPool().getConnection();
  try {
    const [profileRows] = await connection.execute(
      `SELECT sp.id AS student_id, sp.user_id, sp.roll_number, sp.personal_email,
              sp.phone AS profile_phone, sp.resume_url, sp.profile_photo_url,
              sp.status AS student_status, sp.metadata, u.email, u.full_name, u.created_at AS account_created_at,
              u.phone AS user_phone, c.name AS course_name, b.name AS branch_name
       FROM student_profiles sp
       LEFT JOIN users u ON u.id = sp.user_id
       LEFT JOIN courses c ON c.id = sp.course_id
       LEFT JOIN branches b ON b.id = sp.branch_id
       ORDER BY COALESCE(b.name, ''), COALESCE(c.name, ''), u.full_name, sp.roll_number`,
    );
    const students = profileRows.map((record, index) => {
      const { fields, metadata } = profileFields(record);
      const student = rowFromFields(fields, Number(metadata.sourceRow) || index + 2, record.student_id);
      student.accountCreatedAt = record.account_created_at || '';
      return student;
    });

    const profileSourceRows = new Set(profileRows.map(record => Number(parseJson(record.metadata).sourceRow)).filter(Number.isInteger));
    const [sourceRows] = await connection.execute(
      `SELECT sheet_row_number, row_data_json
       FROM source_sheet_records
       WHERE source_key = 'shared_student_data' AND tab_name = 'Data'
       ORDER BY sheet_row_number`,
    );
    const [sourceOverrides] = await connection.execute(
      `SELECT source_row_number, fields_json
       FROM student_directory_source_overrides
       WHERE source_key = 'shared_student_data' AND source_tab = 'Data'`,
    );
    const overridesByRow = new Map(sourceOverrides.map(row => [Number(row.source_row_number), parseJson(row.fields_json)]));
    sourceRows.forEach(sourceRow => {
      const rowNumber = Number(sourceRow.sheet_row_number);
      if (profileSourceRows.has(rowNumber)) return;
      const fields = { ...sourceFields(sourceRow), ...(overridesByRow.get(rowNumber) || {}) };
      const row = rowFromFields(fields, rowNumber, `SOURCE-ROW-${rowNumber}`);
      row.sourceRecordOnly = true;
      students.push(row);
    });

    const [trackerRows] = await connection.execute(
      `SELECT id, source_tab, source_row_number, student_id, roll_number, student_name,
              job_code, company_name, position_title, status, occurred_at, metadata
       FROM placement_tracker_records
       WHERE source_key = 'shared_placement'
         AND source_tab IN ('Opening_Applied', 'TPO_Log')
         AND LOWER(COALESCE(status, '')) <> 'deleted'
         AND (source_tab <> 'Opening_Applied' OR NOT EXISTS (
           SELECT 1 FROM job_applications legacy
           WHERE legacy.source = 'legacy_opening_applied'
             AND legacy.student_id = placement_tracker_records.student_id
             AND legacy.vacancy_id = placement_tracker_records.vacancy_id
         ))
       ORDER BY occurred_at, source_row_number`,
    );
    const applications = trackerRows
      .filter(row => row.source_tab === 'Opening_Applied')
      .map(row => rowFromFields(trackerFields(row), row.source_row_number));
    const tpoLogs = trackerRows
      .filter(row => row.source_tab === 'TPO_Log')
      .map(row => rowFromFields(trackerFields(row), row.source_row_number));

    const [applicationRows] = await connection.execute(
      `SELECT ja.id, ja.status, ja.applied_at, ja.metadata, sp.roll_number,
              sp.personal_email AS student_email, sp.phone AS student_phone,
              u.full_name AS student_name, c.name AS course_name, b.name AS branch_name,
              v.job_code, v.company_name, v.title AS position_title
       FROM job_applications ja
       JOIN student_profiles sp ON sp.id = ja.student_id
       LEFT JOIN users u ON u.id = sp.user_id
       LEFT JOIN courses c ON c.id = sp.course_id
       LEFT JOIN branches b ON b.id = sp.branch_id
       JOIN vacancies v ON v.id = ja.vacancy_id
       WHERE LOWER(COALESCE(ja.status, '')) <> 'deleted'
       ORDER BY ja.applied_at, ja.id`,
    );
    const applicationIds = applicationRows.map(row => row.id);
    const [historyRows] = applicationIds.length ? await connection.query(
      `SELECT h.application_id, h.new_status, h.note, h.occurred_at,
              COALESCE(actor.full_name, JSON_UNQUOTE(JSON_EXTRACT(h.metadata, '$.changedBy'))) AS changed_by
       FROM application_status_history h
       LEFT JOIN users actor ON actor.id = h.actor_user_id
       WHERE h.application_id IN (${applicationIds.map(() => '?').join(',')})
       ORDER BY h.application_id, h.occurred_at, h.history_sequence`,
      applicationIds,
    ) : [[]];
    const historyByApplication = new Map();
    for (const history of historyRows) {
      const events = historyByApplication.get(history.application_id) || [];
      events.push(history);
      historyByApplication.set(history.application_id, events);
    }
    for (const row of applicationRows) {
      applications.push(rowFromFields(
        applicationFields(row, historyByApplication.get(row.id) || []),
        1000000 + applications.length,
      ));
    }
    return { students, applications, tpoLogs };
  } finally {
    if (ownsConnection) connection.release();
  }
}

async function lookupStudent({ email = '', phone = '', connection: suppliedConnection = null } = {}) {
  const emailKey = normalized(email);
  const phoneDigits = String(phone || '').replace(/\D/g, '');
  const ownsConnection = !suppliedConnection;
  const connection = suppliedConnection || await mysqlPool.getPool().getConnection();
  try {
    const params = emailKey ? [emailKey] : [phoneDigits.slice(-10)];
    const where = emailKey
      ? 'LOWER(TRIM(COALESCE(sp.personal_email, u.email, \'\'))) = ?'
      : 'RIGHT(REGEXP_REPLACE(COALESCE(sp.phone, u.phone, \'\'), \'[^0-9]\', \'\'), 10) = ?';
    const [rows] = await connection.execute(
      `SELECT sp.id AS student_id, sp.roll_number, sp.personal_email,
              sp.phone AS profile_phone, sp.metadata, u.email, u.full_name,
              u.phone AS user_phone, c.name AS course_name, b.name AS branch_name
       FROM student_profiles sp
       LEFT JOIN users u ON u.id = sp.user_id
       LEFT JOIN courses c ON c.id = sp.course_id
       LEFT JOIN branches b ON b.id = sp.branch_id
       WHERE ${where} ORDER BY u.full_name, sp.roll_number LIMIT 25`,
      params,
    );
    return rows.map(row => {
      const fields = profileFields(row).fields;
      return {
        studentId: row.student_id,
        name: text(row.full_name),
        email: text(row.personal_email || row.email),
        phone: text(row.profile_phone || row.user_phone),
        roll: text(row.roll_number),
        course: text(row.course_name),
        branch: text(row.branch_name),
        fields,
      };
    });
  } finally {
    if (ownsConnection) connection.release();
  }
}

async function findStudent({ studentId = '', rowNumber = 0, connection: suppliedConnection = null, forUpdate = false } = {}) {
  const ownsConnection = !suppliedConnection;
  const connection = suppliedConnection || await mysqlPool.getPool().getConnection();
  try {
    const [rows] = studentId
      ? await connection.execute(
        `SELECT sp.id AS student_id, sp.user_id, sp.roll_number, sp.normalized_roll_number,
                sp.personal_email, sp.phone AS profile_phone, sp.resume_url, sp.profile_photo_url,
                sp.course_id, sp.branch_id, sp.status AS student_status, sp.metadata,
                u.email, u.full_name, u.phone AS user_phone,
                c.name AS course_name, b.name AS branch_name
         FROM student_profiles sp
         LEFT JOIN users u ON u.id = sp.user_id
         LEFT JOIN courses c ON c.id = sp.course_id
         LEFT JOIN branches b ON b.id = sp.branch_id
         WHERE sp.id = ? LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`, [studentId],
      )
      : await connection.execute(
        `SELECT sp.id AS student_id, sp.user_id, sp.roll_number, sp.normalized_roll_number,
                sp.personal_email, sp.phone AS profile_phone, sp.resume_url, sp.profile_photo_url,
                sp.course_id, sp.branch_id, sp.status AS student_status, sp.metadata,
                u.email, u.full_name, u.phone AS user_phone,
                c.name AS course_name, b.name AS branch_name
         FROM student_profiles sp
         LEFT JOIN users u ON u.id = sp.user_id
         LEFT JOIN courses c ON c.id = sp.course_id
         LEFT JOIN branches b ON b.id = sp.branch_id
         WHERE CAST(JSON_UNQUOTE(JSON_EXTRACT(sp.metadata, '$.sourceRow')) AS UNSIGNED) = ?
         LIMIT 2${forUpdate ? ' FOR UPDATE' : ''}`, [Number(rowNumber)],
      );
    if (rows.length > 1) {
      const error = new Error('More than one student profile matches this legacy record number. Refresh and select the student again.');
      error.status = 409;
      throw error;
    }
    if (!rows.length) return null;
    const row = rows[0];
    const { fields, metadata } = profileFields(row);
    return { ...row, fields, profileMetadata: metadata };
  } finally {
    if (ownsConnection) connection.release();
  }
}

async function updateStudentAccess({ studentId = '', rowNumber = 0, actor = {}, updates = {}, requestId = '' }) {
  const connection = await mysqlPool.getPool().getConnection();
  try {
    await connection.beginTransaction();
    const row = await findStudent({ studentId, rowNumber, connection });
    if (!row) {
      const error = new Error('The student could not be found in the shared database. Refresh the directory and try again.');
      error.status = 404;
      throw error;
    }
    if (String(row.student_status || '').toLowerCase() === 'inactive') {
      const error = new Error('This student profile is inactive and cannot be updated here.');
      error.status = 409;
      throw error;
    }

    const nextFields = { ...row.fields };
    for (const [aliases, value] of updates) putField(nextFields, aliases, value);
    await connection.execute(
      'UPDATE student_profiles SET metadata = ?, updated_at = UTC_TIMESTAMP() WHERE id = ?',
      [JSON.stringify({ ...row.profileMetadata, fields: nextFields }), row.student_id],
    );
    await connection.execute(
      `INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, occurred_at, request_id, details)
       VALUES (?, (SELECT id FROM users WHERE normalized_email = ? LIMIT 1), 'student_access.updated',
               'student_profile', ?, UTC_TIMESTAMP(), ?, ?)`,
      [
        crypto.randomUUID(), normalized(actor.email), row.student_id, text(requestId) || null,
        JSON.stringify({ fields: updates.map(([aliases]) => aliases[0]), source: 'tpo_student_directory' }),
      ],
    );
    await connection.commit();
    return {
      studentId: row.student_id,
      vacancyAccess: text(nextFields[Object.keys(nextFields).find(key => compact(key) === 'vacancyopen') || 'Vacancy Open']),
    };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

async function updateStudentProfileFields({ rowNumber = 0, studentId = '', actor = {}, changes = {}, requestId = '', connection: suppliedConnection = null, forUpdate = false }) {
  const ownsConnection = !suppliedConnection;
  const connection = suppliedConnection || await mysqlPool.getPool().getConnection();
  try {
    if (ownsConnection) await connection.beginTransaction();
    const row = await findStudent({ studentId, rowNumber, connection, forUpdate });
    if (!row) {
      const error = new Error('The student could not be found in the shared MySQL directory. Refresh the student directory and try again.');
      error.status = 404;
      throw error;
    }

    const nextFields = { ...row.fields };
    const changedEntries = Object.entries(changes || {});
    const valueFor = aliases => {
      const wanted = new Set(aliases.map(compact));
      const entry = changedEntries.find(([header]) => wanted.has(compact(header)));
      return entry ? text(entry[1]) : undefined;
    };
    for (const [header, value] of changedEntries) {
      const fieldKey = compact(header);
      const aliases = fieldKey === 'name' || fieldKey === 'studentname' || fieldKey === 'nameofstudent' ? ['Name', 'Student Name']
        : ['mailid', 'email', 'emailid', 'studentemail'].includes(fieldKey) ? ['Mail ID', 'Email', 'Email ID', 'Student Email']
          : ['contactnumber', 'phoneno', 'phone', 'phonenumber', 'mobilenumber', 'studentphone'].includes(fieldKey) ? ['Contact Number', 'Phone No.', 'Phone', 'Phone Number', 'Mobile Number', 'Student Phone']
            : ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll'].includes(fieldKey) ? ['IPCS Roll Number', 'Roll Number', 'Roll No']
              : fieldKey === 'course' || fieldKey === 'program' ? ['Course', 'Program']
                : fieldKey === 'branch' || fieldKey === 'sittingbranch' ? ['Branch', 'Sitting Branch']
                  : fieldKey === 'resume' || fieldKey === 'resumelink' ? ['Resume', 'Resume Link']
                    : fieldKey === 'profilephoto' || fieldKey === 'photo' ? ['Profile Photo', 'Photo']
                      : [header];
      putField(nextFields, aliases, value);
    }

    let courseId = row.course_id || null;
    const courseName = valueFor(['Course', 'Program']);
    if (courseName !== undefined) {
      if (!courseName) {
        const error = new Error('A student must remain assigned to a course in the MySQL directory. Choose an existing course.');
        error.status = 409;
        throw error;
      }
      const [courses] = await connection.execute('SELECT id FROM courses WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1', [courseName]);
      if (!courses.length) {
        const error = new Error(`The course “${courseName}” does not exist in MySQL. Choose an existing course.`);
        error.status = 409;
        throw error;
      }
      courseId = courses[0].id;
    }

    let branchId = row.branch_id || null;
    const branchName = valueFor(['Branch', 'Sitting Branch']);
    if (branchName !== undefined) {
      if (!branchName) {
        const error = new Error('A student must remain assigned to a branch in the MySQL directory. Choose an existing branch.');
        error.status = 409;
        throw error;
      }
      const [branches] = await connection.execute('SELECT id FROM branches WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1', [branchName]);
      if (!branches.length) {
        const error = new Error(`The branch “${branchName}” does not exist in MySQL. Choose an existing branch.`);
        error.status = 409;
        throw error;
      }
      branchId = branches[0].id;
    }

    const nextName = valueFor(['Name', 'Student Name', 'Name of Student']);
    const nextEmail = valueFor(['Mail ID', 'Email', 'Email ID', 'Student Email']);
    const nextPhone = valueFor(['Contact Number', 'Phone No.', 'Phone', 'Phone Number', 'Mobile Number', 'Student Phone']);
    const nextRoll = valueFor(['IPCS Roll Number', 'Roll Number', 'Roll No', 'Roll']);
    const nextResume = valueFor(['Resume', 'Resume Link']);
    const nextPhoto = valueFor(['Profile Photo', 'Photo']);
    const rollNumber = nextRoll === undefined ? row.roll_number : nextRoll;
    const personalEmail = nextEmail === undefined ? row.personal_email : nextEmail;
    const phone = nextPhone === undefined ? row.profile_phone : nextPhone;
    const resumeUrl = nextResume === undefined ? row.resume_url : nextResume;
    const profilePhotoUrl = nextPhoto === undefined ? row.profile_photo_url : nextPhoto;

    await connection.execute(
      `UPDATE student_profiles
       SET roll_number = ?, normalized_roll_number = ?, personal_email = ?, phone = ?,
           resume_url = ?, profile_photo_url = ?, course_id = ?, branch_id = ?,
           metadata = ?, updated_at = UTC_TIMESTAMP()
       WHERE id = ?`,
      [rollNumber, compact(rollNumber), personalEmail || null, phone || null, resumeUrl || null,
        profilePhotoUrl || null, courseId, branchId, JSON.stringify({ ...row.profileMetadata, fields: nextFields }), row.student_id],
    );
    if (nextName !== undefined && row.user_id) {
      await connection.execute('UPDATE users SET full_name = ? WHERE id = ?', [nextName, row.user_id]);
    }
    await connection.execute(
      `INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, occurred_at, request_id, details)
       VALUES (?, (SELECT id FROM users WHERE normalized_email = ? LIMIT 1), 'student_profile.details.approved',
               'student_profile', ?, UTC_TIMESTAMP(), ?, ?)`,
      [crypto.randomUUID(), normalized(actor.email), row.student_id, text(requestId) || null,
        JSON.stringify({ changedFields: changedEntries.map(([header]) => header), source: 'tpo_student_directory_approval' })],
    );
    if (ownsConnection) await connection.commit();
    return { studentId: row.student_id, fields: nextFields };
  } catch (error) {
    if (ownsConnection) await connection.rollback().catch(() => {});
    throw error;
  } finally {
    if (ownsConnection) connection.release();
  }
}

function requestShape(row) {
  const json = value => {
    if (value && typeof value === 'object') return value;
    try { return JSON.parse(value || '{}'); } catch { return {}; }
  };
  return {
    requestId: row.request_id,
    status: row.status,
    requestedAt: row.requested_at,
    requestedByName: row.requested_by_name,
    requestedByEmail: row.requested_by_email,
    requestedByRole: row.requested_by_role || '',
    studentRowNumber: Number(row.source_row_number),
    studentRollNumber: row.student_roll_number || '',
    studentName: row.student_name,
    studentBranch: row.student_branch || '',
    changeSummary: row.change_summary,
    originalData: json(row.original_data_json),
    proposedData: json(row.proposed_data_json),
    reviewedByName: row.reviewed_by_name || '',
    reviewedByEmail: row.reviewed_by_email || '',
    reviewedAt: row.reviewed_at || '',
    decisionNotes: row.decision_notes || '',
    executionMessage: row.execution_message || '',
    rowNumber: Number(row.source_row_number),
  };
}

async function createStudentEditRequest({ sourceRowNumber, requester, studentRollNumber = '', studentName, studentBranch = '', changeSummary, originalData, proposedData }) {
  const connection = await mysqlPool.getPool().getConnection();
  const requestId = `STU-EDIT-${crypto.randomBytes(10).toString('hex').toUpperCase()}`;
  try {
    await connection.beginTransaction();
    const student = await findStudent({ rowNumber: sourceRowNumber, connection, forUpdate: true });
    const [sourceRows] = student ? [[]] : await connection.execute(
      `SELECT sheet_row_number FROM source_sheet_records
       WHERE source_key = 'shared_student_data' AND tab_name = 'Data' AND sheet_row_number = ? LIMIT 1 FOR UPDATE`,
      [Number(sourceRowNumber)],
    );
    if (!student && !sourceRows.length) {
      const error = new Error('The selected student no longer exists in the shared database. Reload the directory and try again.');
      error.status = 404;
      throw error;
    }
    const requesterEmail = normalized(requester?.email);
    const [users] = await connection.execute('SELECT id FROM users WHERE normalized_email = ? LIMIT 1', [requesterEmail]);
    if (!users.length) {
      const error = new Error('Your staff account is not linked to the shared database yet. Contact the portal administrator.');
      error.status = 409;
      throw error;
    }
    const [pending] = await connection.execute(
      `SELECT request_id FROM student_profile_change_requests
       WHERE LOWER(status) IN ('pending', 'processing')
         AND ((student_profile_id = ? AND ? IS NOT NULL)
           OR (student_profile_id IS NULL AND source_row_number = ?))
       LIMIT 1`,
      [student?.student_id || null, student?.student_id || null, Number(sourceRowNumber)],
    );
    if (pending.length) {
      const error = new Error('This student already has a pending detail change request. Gifty must review it before another one is submitted.');
      error.status = 409;
      throw error;
    }
    await connection.execute(
      `INSERT INTO student_profile_change_requests
        (request_id, student_profile_id, source_row_number, student_roll_number, student_name, student_branch,
         requested_by_user_id, requested_by_name, requested_by_email, requested_by_role, change_summary,
         original_data_json, proposed_data_json, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Pending')`,
      [requestId, student?.student_id || null, Number(sourceRowNumber), text(studentRollNumber).slice(0, 160) || null,
        text(studentName).slice(0, 200), text(studentBranch).slice(0, 160) || null, users[0].id,
        text(requester?.name).slice(0, 160), text(requester?.email).slice(0, 254), text(requester?.role).slice(0, 100),
        text(changeSummary).slice(0, 500), JSON.stringify(originalData || {}), JSON.stringify(proposedData || {})],
    );
    await connection.execute(
      `INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, occurred_at, request_id, details)
       VALUES (?, ?, 'student_profile.details.requested', 'student_profile', ?, UTC_TIMESTAMP(), ?, ?)`,
      [crypto.randomUUID(), users[0].id, student?.student_id || `source-row:${Number(sourceRowNumber)}`, requestId,
        JSON.stringify({ changedFields: Object.keys(proposedData || {}), studentRowNumber: Number(sourceRowNumber) })],
    );
    await connection.commit();
    return { requestId, status: 'Pending' };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

async function listStudentEditRequests(status = '') {
  const filter = text(status);
  const params = [];
  let where = '';
  if (filter && filter.toLowerCase() !== 'all') {
    where = 'WHERE LOWER(r.status) = LOWER(?)';
    params.push(filter);
  }
  const [rows] = await mysqlPool.query(
    `SELECT r.* FROM student_profile_change_requests r ${where}
     ORDER BY r.requested_at DESC, r.request_id DESC LIMIT 1000`, params,
  );
  return rows.map(requestShape);
}

async function reviewStudentEditRequest({ requestId, decision, reviewer, decisionNotes = '' }) {
  const connection = await mysqlPool.getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [requests] = await connection.execute(
      'SELECT * FROM student_profile_change_requests WHERE request_id = ? FOR UPDATE', [text(requestId)],
    );
    if (!requests.length) {
      const error = new Error('The student detail request was not found.');
      error.status = 404;
      throw error;
    }
    const request = requestShape(requests[0]);
    if (request.status.toLowerCase() !== 'pending') {
      const error = new Error(`This request is already ${request.status.toLowerCase() || 'processed'}.`);
      error.status = 409;
      throw error;
    }
    const reviewerEmail = normalized(reviewer?.email);
    const [reviewers] = await connection.execute('SELECT id FROM users WHERE normalized_email = ? LIMIT 1', [reviewerEmail]);
    if (!reviewers.length) {
      const error = new Error('The reviewer account is not linked to the shared database.');
      error.status = 409;
      throw error;
    }
    const reviewerId = reviewers[0].id;
    let notificationTitle;
    let notificationMessage;
    let executionMessage;
    if (decision === 'approve') {
      let currentFields;
      if (requests[0].student_profile_id) {
        const student = await findStudent({ studentId: requests[0].student_profile_id, connection, forUpdate: true });
        if (!student) {
          const error = new Error('The student record is missing from the shared database.');
          error.status = 409;
          throw error;
        }
        currentFields = student.fields;
      } else {
        const [sourceRows] = await connection.execute(
          `SELECT sheet_row_number, row_data_json
           FROM source_sheet_records
           WHERE source_key = 'shared_student_data' AND tab_name = 'Data' AND sheet_row_number = ?
           LIMIT 1 FOR UPDATE`,
          [request.studentRowNumber],
        );
        if (!sourceRows.length) {
          const error = new Error('The original student source record is missing from MySQL.');
          error.status = 409;
          throw error;
        }
        const [overrides] = await connection.execute(
          `SELECT fields_json FROM student_directory_source_overrides
           WHERE source_key = 'shared_student_data' AND source_tab = 'Data' AND source_row_number = ? FOR UPDATE`,
          [request.studentRowNumber],
        );
        currentFields = { ...sourceFields(sourceRows[0]), ...(overrides.length ? parseJson(overrides[0].fields_json) : {}) };
      }
      const currentByName = new Map(Object.entries(currentFields).map(([key, value]) => [compact(key), String(value ?? '')]));
      const conflictFields = Object.entries(request.proposedData).filter(([header, value]) => {
        const key = compact(header);
        const current = currentByName.get(key) ?? '';
        const original = String(request.originalData[header] ?? '');
        return current !== original && current !== String(value ?? '');
      }).map(([header]) => header);
      if (conflictFields.length) {
        const error = new Error(`The student record changed after this request was submitted (${conflictFields.join(', ')}). Reload and submit a fresh request.`);
        error.status = 409;
        throw error;
      }
      if (requests[0].student_profile_id) {
        await updateStudentProfileFields({
          studentId: requests[0].student_profile_id, actor: reviewer, changes: request.proposedData,
          requestId, connection,
        });
      } else {
        const nextFields = { ...currentFields, ...request.proposedData };
        await connection.execute(
          `INSERT INTO student_directory_source_overrides
            (source_key, source_tab, source_row_number, fields_json, updated_by_user_id)
           VALUES ('shared_student_data', 'Data', ?, ?, ?)
           ON DUPLICATE KEY UPDATE fields_json = VALUES(fields_json), updated_by_user_id = VALUES(updated_by_user_id), updated_at = UTC_TIMESTAMP()`,
          [request.studentRowNumber, JSON.stringify(nextFields), reviewerId],
        );
      }
      notificationTitle = 'Student detail edit approved';
      notificationMessage = `${request.changeSummary}. Gifty approved the changes.`;
      executionMessage = 'Student details updated successfully in MySQL.';
    } else {
      notificationTitle = 'Student detail edit rejected';
      notificationMessage = `${request.changeSummary}. Gifty rejected the changes${decisionNotes ? `: ${decisionNotes}` : '.'}`;
      executionMessage = 'No student details were changed.';
    }
    await connection.execute(
      `UPDATE student_profile_change_requests
       SET status = ?, reviewed_by_user_id = ?, reviewed_by_name = ?, reviewed_by_email = ?,
           reviewed_at = UTC_TIMESTAMP(), decision_notes = ?, execution_message = ?
       WHERE request_id = ?`,
      [decision === 'approve' ? 'Approved' : 'Rejected', reviewerId, text(reviewer?.name).slice(0, 160),
        reviewerEmail, text(decisionNotes).slice(0, 1000) || null, executionMessage, requestId],
    );
    if (requests[0].requested_by_user_id) {
      await connection.execute(
        `INSERT INTO portal_notifications (id, user_id, notification_type, title, message, data_json)
         VALUES (?, ?, 'student_profile_change_decision', ?, ?, ?)`,
        [crypto.randomUUID(), requests[0].requested_by_user_id, notificationTitle, notificationMessage,
          JSON.stringify({ requestId, decision: decision === 'approve' ? 'Approved' : 'Rejected', studentRowNumber: request.studentRowNumber })],
      );
    }
    await connection.execute(
      `INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, occurred_at, request_id, details)
       VALUES (?, ?, ?, 'student_profile_change_request', ?, UTC_TIMESTAMP(), ?, ?)`,
      [crypto.randomUUID(), reviewerId, `student_profile.details.${decision === 'approve' ? 'approved' : 'rejected'}`,
        requestId, requestId, JSON.stringify({ studentProfileId: requests[0].student_profile_id, notes: text(decisionNotes).slice(0, 1000) })],
    );
    await connection.commit();
    return { requestId, status: decision === 'approve' ? 'Approved' : 'Rejected', executionMessage };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

async function listPortalNotifications(email, limit = 20) {
  const normalizedEmail = normalized(email);
  const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
  const [rows] = await mysqlPool.query(
    `SELECT n.id, n.notification_type, n.title, n.message, n.data_json, n.created_at
     FROM portal_notifications n
     JOIN users u ON u.id = n.user_id
     WHERE u.normalized_email = ?
     ORDER BY n.created_at DESC LIMIT ${safeLimit}`,
    [normalizedEmail],
  );
  return rows.map(row => {
    const data = parseJson(row.data_json);
    const decision = String(data.decision || '').trim();
    return {
      id: `student-edit:${data.requestId || row.id}:${decision.toLowerCase()}`,
      type: 'approval',
      decision,
      title: row.title,
      desc: row.message,
      time: row.created_at,
    };
  });
}

module.exports = {
  createStudentEditRequest, findStudent, listPortalNotifications, listStudentEditRequests,
  loadDirectoryRows, lookupStudent, reviewStudentEditRequest, rowFromFields,
  updateStudentAccess, updateStudentProfileFields,
};
