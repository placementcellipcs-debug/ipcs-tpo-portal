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

function putField(fields, aliases, value) {
  const wanted = new Set(aliases.map(compact));
  const existing = Object.keys(fields).find(key => wanted.has(compact(key)));
  fields[existing || aliases[0]] = value ?? '';
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
  putField(fields, ['Name', 'Student Name'], row.full_name);
  putField(fields, ['Mail ID', 'Email'], row.personal_email || row.email);
  putField(fields, ['Phone No.', 'Contact Number', 'Phone'], row.profile_phone || row.user_phone);
  putField(fields, ['IPCS Roll Number', 'Roll Number', 'Roll No'], row.roll_number);
  putField(fields, ['Course', 'Program'], row.course_name);
  putField(fields, ['Branch', 'Sitting Branch'], row.branch_name);
  putField(fields, ['Profile Photo', 'Photo'], row.profile_photo_url || '');
  putField(fields, ['Resume', 'Resume Link'], row.resume_url || '');
  putField(fields, ['Status'], row.student_status || 'active');
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

    const [trackerRows] = await connection.execute(
      `SELECT id, source_tab, source_row_number, student_id, roll_number, student_name,
              job_code, company_name, position_title, status, occurred_at, metadata
       FROM placement_tracker_records
       WHERE source_key = 'shared_placement'
         AND source_tab IN ('Opening_Applied', 'TPO_Log')
         AND LOWER(COALESCE(status, '')) <> 'deleted'
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
    for (const row of applicationRows) {
      const [history] = await connection.execute(
        `SELECT h.new_status, h.note, h.occurred_at, actor.full_name AS changed_by
         FROM application_status_history h
         LEFT JOIN users actor ON actor.id = h.actor_user_id
         WHERE h.application_id = ? ORDER BY h.occurred_at, h.history_sequence`,
        [row.id],
      );
      applications.push(rowFromFields(applicationFields(row, history), 1000000 + applications.length));
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

async function findStudent({ studentId = '', rowNumber = 0, connection: suppliedConnection = null } = {}) {
  const ownsConnection = !suppliedConnection;
  const connection = suppliedConnection || await mysqlPool.getPool().getConnection();
  try {
    const [rows] = studentId
      ? await connection.execute(
        `SELECT sp.id AS student_id, sp.roll_number, sp.personal_email,
                sp.phone AS profile_phone, sp.status AS student_status, sp.metadata,
                u.email, u.full_name, u.phone AS user_phone,
                c.name AS course_name, b.name AS branch_name
         FROM student_profiles sp
         LEFT JOIN users u ON u.id = sp.user_id
         LEFT JOIN courses c ON c.id = sp.course_id
         LEFT JOIN branches b ON b.id = sp.branch_id
         WHERE sp.id = ? LIMIT 1`, [studentId],
      )
      : await connection.execute(
        `SELECT sp.id AS student_id, sp.roll_number, sp.personal_email,
                sp.phone AS profile_phone, sp.status AS student_status, sp.metadata,
                u.email, u.full_name, u.phone AS user_phone,
                c.name AS course_name, b.name AS branch_name
         FROM student_profiles sp
         LEFT JOIN users u ON u.id = sp.user_id
         LEFT JOIN courses c ON c.id = sp.course_id
         LEFT JOIN branches b ON b.id = sp.branch_id
         WHERE CAST(JSON_UNQUOTE(JSON_EXTRACT(sp.metadata, '$.sourceRow')) AS UNSIGNED) = ?
         LIMIT 2`, [Number(rowNumber)],
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
      'UPDATE student_profiles SET metadata = CAST(? AS JSON), updated_at = UTC_TIMESTAMP() WHERE id = ?',
      [JSON.stringify({ ...row.profileMetadata, fields: nextFields }), row.student_id],
    );
    await connection.execute(
      `INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, occurred_at, request_id, details)
       VALUES (?, (SELECT id FROM users WHERE normalized_email = ? LIMIT 1), 'student_access.updated',
               'student_profile', ?, UTC_TIMESTAMP(), ?, CAST(? AS JSON))`,
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

module.exports = { findStudent, loadDirectoryRows, lookupStudent, rowFromFields, updateStudentAccess };
