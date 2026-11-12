const crypto = require('crypto');
const mysqlPool = require('./mysqlPool');
const mysqlPlacementTracker = require('./mysqlPlacementTracker');

const text = value => String(value ?? '').normalize('NFKC').trim();
const normalize = value => text(value).toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
const normalizeHeader = value => text(value).toLocaleLowerCase('en-US').replace(/[^a-z0-9]/g, '');
const normalizeOfficer = value => normalize(value).replace(/^(mrs|miss|ms|mr|dr|prof)+/, '');
const makeId = () => crypto.randomUUID();
const APPROVER_EMAIL = 'gifty@ipcsglobal.com';

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function findField(fields, ...aliases) {
  const keys = new Map(Object.keys(fields || {}).map(key => [normalizeHeader(key), key]));
  for (const alias of aliases) {
    const key = keys.get(normalizeHeader(alias));
    if (key && fields[key] != null) return fields[key];
  }
  return '';
}

function formatDate(value) {
  if (!value) return '';
  const dateText = value instanceof Date ? value.toISOString().slice(0, 10) : text(value).slice(0, 10);
  const match = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : text(value);
}

function parseDate(value) {
  const raw = text(value);
  if (!raw) return null;
  let year; let month; let day;
  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) [, year, month, day] = match;
  else {
    match = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/);
    if (!match) return null;
    [, day, month, year] = match;
    if (year.length === 2) year = Number(year) >= 70 ? `19${year}` : `20${year}`;
  }
  const y = Number(year); const m = Number(month); const d = Number(day);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (check.getUTCFullYear() !== y || check.getUTCMonth() !== m - 1 || check.getUTCDate() !== d) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function fieldsFromVacancy(row) {
  const metadata = parseJson(row.metadata);
  return metadata.fields || {};
}

function shapeVacancy(row, actorEmail = '') {
  const fields = fieldsFromVacancy(row);
  const ownerName = text(row.owner_name || findField(fields, 'Placement Officer', 'TPO', 'TPO Name')) || 'Unknown';
  const ownerEmail = normalize(row.owner_email);
  const canEdit = Boolean(actorEmail && ownerEmail === normalize(actorEmail));
  const company = text(row.company_name || findField(fields, 'Company Name', 'Company'));
  const result = {
    id: text(row.job_code),
    hasJobId: true,
    rowNumber: Number(findField(fields, '_source_row') || 0) || undefined,
    company,
    companyLogo: text(findField(fields, 'Company Logo', 'Logo')),
    position: text(row.title || findField(fields, 'Position', 'Role', 'Title')),
    location: text(row.location || findField(fields, 'Opening At (Location)', 'Opening At ( Location )', 'Location')),
    state: text(findField(fields, 'State')),
    mode: text(row.employment_type || findField(fields, 'Work Mode', 'Mode')),
    lastDate: formatDate(row.apply_by) || text(findField(fields, 'Last Date')),
    course: text(findField(fields, 'Course', 'Program')),
    qualification: text(row.qualification || findField(fields, 'Qualification')),
    description: text(row.description || findField(fields, 'Job Description', 'Description')),
    experience: text(findField(fields, 'Experience')),
    salary: text(row.salary_text || findField(fields, 'Salary', 'Package')),
    gender: text(findField(fields, 'Gender Preference', 'Gender')),
    status: text(row.status).replace(/^./, char => char.toUpperCase()) || 'Open',
    tpoName: ownerName,
    timestamp: text(findField(fields, 'Timestamp')),
    datePosted: text(findField(fields, 'Date', 'Posted Date')),
    canEditThisVacancy: canEdit,
  };
  if (canEdit) Object.assign(result, {
    companyContact: text(findField(fields, 'Company Contact', 'Contact Number', 'Phone', 'Contact')),
    companyMailId: text(findField(fields, 'Company Mail ID', 'Company Email', 'Mail ID', 'Email')),
    companyContactPerson: text(findField(fields, 'Company Contact Person', 'Contact Person', 'Person')),
    companyWebsite: text(row.company_website || findField(fields, 'Company Website', 'Website', 'URL')),
    openings: text(findField(fields, 'No. of Openings', 'Number of Openings', 'Openings')),
    interviewDate: text(findField(fields, 'Interview Date')),
  });
  return result;
}

async function resolveUser(connection, actor, { approver = false } = {}) {
  const email = normalize(actor?.email);
  if (!email) throw Object.assign(new Error('Your sign-in email is missing. Sign in again.'), { status: 401 });
  const [rows] = await connection.execute(
    'SELECT id, email, full_name, role, status FROM users WHERE normalized_email = ? LIMIT 1', [email],
  );
  const user = rows[0];
  if (!user) throw Object.assign(new Error('Your account is not present in the local MySQL staff directory. Complete the staff import before enabling vacancy management.'), { status: 403 });
  if (normalize(user.status) === 'inactive') throw Object.assign(new Error('This staff account is inactive.'), { status: 403 });
  if (approver && email !== APPROVER_EMAIL) throw Object.assign(new Error('Only gifty@ipcsglobal.com can review opening deletion requests.'), { status: 403 });
  return user;
}

async function loadVacancy(connection, jobCode, { forUpdate = false } = {}) {
  const [rows] = await connection.execute(
    `SELECT v.*, u.full_name AS owner_name, u.email AS owner_email
     FROM vacancies v LEFT JOIN users u ON u.id = v.assigned_tpo_user_id
     WHERE v.job_code = ?${forUpdate ? ' FOR UPDATE' : ''} LIMIT 1`, [jobCode],
  );
  return rows[0] || null;
}

function vacancyFields(input, logoUrl, existingFields = {}) {
  const read = (key, fallback = '') => text(input[key] || fallback);
  const interviewDate = read('interviewPlan') === 'Interview Scheduled'
    ? formatDate(read('interviewDate')) : 'Will inform once scheduled';
  return {
    ...existingFields,
    'Timestamp': text(existingFields.Timestamp) || new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'medium' }).format(new Date()),
    'Date': text(existingFields.Date) || new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date()),
    'Company Logo': logoUrl,
    'Company Name': read('companyName'),
    'Company Contact': read('companyContact'),
    'Company Mail ID': read('companyMailId'),
    'Company Contact Person': read('companyContactPerson'),
    'Company Website': read('companyWebsite'),
    'Course': read('course'),
    'Position': read('position'),
    'State': read('state'),
    'Opening At (Location)': read('location'),
    'Work Mode': read('workMode'),
    'No. of Openings': read('openings'),
    'Qualification': read('qualification'),
    'Job Description': read('jobDescription'),
    'Experience': read('experience') === 'Other' ? read('experienceOther') : read('experience'),
    'Salary': read('salary'),
    'Gender Preference': read('genderPreference'),
    'Interview Date': interviewDate,
    'Last Date': formatDate(read('lastDate')),
    'Placement Officer': text(existingFields['Placement Officer'] || existingFields.TPO || ''),
  };
}

function makeSummary(jobCode, fields) {
  return `${jobCode} · ${text(fields['Company Name']) || 'Company not listed'} · ${text(fields.Position) || 'Position not listed'}`;
}

async function syncCompany(connection, userId, fields) {
  const name = text(fields['Company Name']);
  const normalizedName = normalize(name);
  const id = crypto.createHash('sha256').update(`company:${normalizedName}`).digest().subarray(0, 16);
  id[6] = (id[6] & 0x0f) | 0x50; id[8] = (id[8] & 0x3f) | 0x80;
  const hex = id.toString('hex');
  const companyId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  await connection.execute(
    `INSERT INTO companies (id, company_name, normalized_name, website, contact_number, email, contact_person, logo_url, location, created_by_user_id, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, JSON_OBJECT('source', 'vacancy_management'))
     ON DUPLICATE KEY UPDATE company_name = VALUES(company_name), website = COALESCE(NULLIF(VALUES(website), ''), website),
       contact_number = COALESCE(NULLIF(VALUES(contact_number), ''), contact_number), email = COALESCE(NULLIF(VALUES(email), ''), email),
       contact_person = COALESCE(NULLIF(VALUES(contact_person), ''), contact_person), logo_url = COALESCE(NULLIF(VALUES(logo_url), ''), logo_url),
       location = COALESCE(NULLIF(VALUES(location), ''), location)`,
    [companyId, name.slice(0, 240), normalizedName.slice(0, 240), text(fields['Company Website']) || null,
      text(fields['Company Contact']) || null, text(fields['Company Mail ID']) || null, text(fields['Company Contact Person']) || null,
      text(fields['Company Logo']) || null, text(fields['Opening At (Location)']) || null, userId],
  );
}

async function listVacancies(actor) {
  const connection = await mysqlPool.getPool().getConnection();
  try {
    const user = await resolveUser(connection, actor);
    const [rows] = await connection.execute(
      `SELECT v.*, u.full_name AS owner_name, u.email AS owner_email
       FROM vacancies v LEFT JOIN users u ON u.id = v.assigned_tpo_user_id
       WHERE LOWER(v.status) <> 'deleted' ORDER BY v.created_at DESC`,
    );
    return rows.map(row => shapeVacancy(row, actor.email));
  } finally { connection.release(); }
}

async function listPlacementOfficers() {
  const [rows] = await mysqlPool.query(
    `SELECT full_name FROM users WHERE status = 'active'
     AND (role LIKE '%tpo%' OR role LIKE '%placement%officer%') ORDER BY full_name`,
  );
  return [...new Set(rows.map(row => text(row.full_name)).filter(Boolean))];
}

async function createVacancy({ actor, input, logoUrl }) {
  const connection = await mysqlPool.getPool().getConnection();
  try {
    await connection.beginTransaction();
    const user = await resolveUser(connection, actor);
    const role = normalize(user.role);
    if (!role.includes('tpo') && !role.includes('placement officer')) throw Object.assign(new Error('Only placement officers can add vacancies.'), { status: 403 });
    const [sequenceRows] = await connection.execute("SELECT next_number FROM vacancy_sequences WHERE sequence_name = 'job_code' FOR UPDATE");
    if (!sequenceRows.length) throw new Error('The vacancy job-number sequence has not been initialized. Apply database migration 004.');
    const [maximumRows] = await connection.execute("SELECT MAX(CAST(REGEXP_SUBSTR(job_code, '[0-9]+') AS UNSIGNED)) AS max_number FROM vacancies WHERE job_code REGEXP '^JOB[[:space:]]*-[[:space:]]*[0-9]+$'");
    const nextNumber = Math.max(Number(sequenceRows[0].next_number) || 10296, Number(maximumRows[0]?.max_number) || 10296) + 1;
    await connection.execute("UPDATE vacancy_sequences SET next_number = ? WHERE sequence_name = 'job_code'", [nextNumber]);
    const jobCode = `JOB - ${nextNumber}`;
    const fields = vacancyFields(input, logoUrl);
    fields['Placement Officer'] = text(user.full_name);
    const metadata = JSON.stringify({ source: 'mysql', fields, sourceRow: null });
    const id = makeId();
    await connection.execute(
      `INSERT INTO vacancies (id, job_code, title, company_name, company_website, location, description, qualification,
         employment_type, salary_text, apply_by, status, assigned_tpo_user_id, source, source_record_key, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, 'mysql', ?, CAST(? AS JSON))`,
      [id, jobCode, text(input.position).slice(0, 240), text(input.companyName).slice(0, 240), text(input.companyWebsite) || null,
        text(input.location) || null, text(input.jobDescription) || null, text(input.qualification) || null, text(input.workMode) || null,
        text(input.salary) || null, parseDate(input.lastDate), user.id, jobCode, metadata],
    );
    await syncCompany(connection, user.id, fields);
    await connection.execute(
      'INSERT INTO vacancy_edit_history (id, vacancy_id, actor_user_id, action, changes) VALUES (?, ?, ?, ?, CAST(? AS JSON))',
      [makeId(), id, user.id, 'created', JSON.stringify({ fields })],
    );
    await connection.commit();
    const row = await loadVacancy(connection, jobCode);
    return shapeVacancy(row, actor.email);
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally { connection.release(); }
}

async function updateVacancy({ actor, jobCode, input, logoUrl }) {
  const connection = await mysqlPool.getPool().getConnection();
  try {
    await connection.beginTransaction();
    const user = await resolveUser(connection, actor);
    const row = await loadVacancy(connection, jobCode, { forUpdate: true });
    if (!row || normalize(row.status) === 'deleted') throw Object.assign(new Error('This vacancy no longer exists.'), { status: 404 });
    if (row.assigned_tpo_user_id !== user.id) throw Object.assign(new Error('You can edit only vacancies created by your placement account.'), { status: 403 });
    const previousFields = fieldsFromVacancy(row);
    const fields = vacancyFields(input, logoUrl || text(findField(previousFields, 'Company Logo', 'Logo')), previousFields);
    fields['Placement Officer'] = text(row.owner_name || user.full_name);
    const changes = {};
    for (const [key, value] of Object.entries(fields)) {
      if (String(previousFields[key] ?? '').trim() !== String(value ?? '').trim()) changes[key] = { before: previousFields[key] ?? '', after: value };
    }
    const metadata = JSON.stringify({ ...parseJson(row.metadata), source: 'mysql', fields });
    await connection.execute(
      `UPDATE vacancies SET title = ?, company_name = ?, company_website = ?, location = ?, description = ?, qualification = ?,
        employment_type = ?, salary_text = ?, apply_by = ?, metadata = CAST(? AS JSON) WHERE id = ?`,
      [text(input.position).slice(0, 240), text(input.companyName).slice(0, 240), text(input.companyWebsite) || null,
        text(input.location) || null, text(input.jobDescription) || null, text(input.qualification) || null, text(input.workMode) || null,
        text(input.salary) || null, parseDate(input.lastDate), metadata, row.id],
    );
    await syncCompany(connection, user.id, fields);
    if (Object.keys(changes).length) {
      await connection.execute(
        'INSERT INTO vacancy_edit_history (id, vacancy_id, actor_user_id, action, changes) VALUES (?, ?, ?, ?, CAST(? AS JSON))',
        [makeId(), row.id, user.id, 'updated', JSON.stringify(changes)],
      );
    }
    await connection.commit();
    return { vacancy: shapeVacancy(await loadVacancy(connection, jobCode), actor.email), changedCells: Object.keys(changes).length };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally { connection.release(); }
}

async function requestVacancyDelete({ actor, jobCode, reason }) {
  const connection = await mysqlPool.getPool().getConnection();
  try {
    await connection.beginTransaction();
    const user = await resolveUser(connection, actor);
    const row = await loadVacancy(connection, jobCode, { forUpdate: true });
    if (!row || normalize(row.status) === 'deleted') throw Object.assign(new Error('This vacancy no longer exists.'), { status: 404 });
    if (row.assigned_tpo_user_id !== user.id) throw Object.assign(new Error('You can delete only vacancies created by your placement account.'), { status: 403 });
    const fields = fieldsFromVacancy(row);
    const [pending] = await connection.execute("SELECT request_code FROM tpo_delete_requests WHERE record_type = 'Vacancy' AND target_id = ? AND status IN ('pending','processing') LIMIT 1", [jobCode]);
    if (pending.length) throw Object.assign(new Error(`A deletion request is already pending (${pending[0].request_code}).`), { status: 409 });
    const [applicationCounts] = await connection.execute(
      `SELECT (SELECT COUNT(*) FROM job_applications WHERE vacancy_id = ?) +
              (SELECT COUNT(*) FROM placement_tracker_records WHERE job_code = ? AND source_tab = 'Opening_Applied') AS total`,
      [row.id, jobCode],
    );
    const requestId = `DEL-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
    const snapshot = {
      type: 'vacancy', jobId: jobCode, vacancyId: row.id,
      company: row.company_name, position: row.title,
      branch: text(findField(fields, 'Branch', 'Sitting Branch', 'Location')),
      course: text(findField(fields, 'Course', 'Program')),
      linkedApplicationCount: Number(applicationCounts[0]?.total || 0),
      owner: row.owner_name,
    };
    const summary = makeSummary(jobCode, { 'Company Name': row.company_name, Position: row.title });
    await connection.execute(
      `INSERT INTO tpo_delete_requests
       (id, request_code, status, record_type, target_id, target_summary, target_snapshot, reason,
        requested_by_user_id, requested_by_name, requested_by_email, requested_by_role)
       VALUES (?, ?, 'pending', 'Vacancy', ?, ?, CAST(? AS JSON), ?, ?, ?, ?, ?)`,
      [makeId(), requestId, jobCode, summary, JSON.stringify(snapshot), text(reason).slice(0, 500), user.id, user.full_name, user.email, user.role],
    );
    await connection.execute(
      'INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, request_id, details) VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON))',
      [makeId(), user.id, 'deletion_requested', 'vacancy', row.id, requestId, JSON.stringify({ reason: text(reason).slice(0, 500), summary })],
    );
    await connection.commit();
    return { requestId, target: snapshot };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally { connection.release(); }
}

function shapeDeleteRequest(row) {
  return {
    requestId: text(row.request_code), status: text(row.status).replace(/^./, char => char.toUpperCase()),
    recordType: text(row.record_type), requestedAt: row.requested_at ? new Date(row.requested_at).toISOString() : '',
    requestedByName: text(row.requested_by_name), requestedByEmail: text(row.requested_by_email), requestedByRole: text(row.requested_by_role),
    targetId: text(row.target_id), targetRowNumber: '', summary: text(row.target_summary),
    target: parseJson(row.target_snapshot), reason: text(row.reason), reviewedByName: text(row.reviewed_by_name),
    reviewedByEmail: text(row.reviewed_by_email), reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : '',
    decisionNotes: text(row.decision_notes), executionMessage: text(row.execution_message), rowNumber: undefined,
  };
}

async function listDeleteRequests(actor, { includeVacancies = true, includePlacements = true } = {}) {
  const connection = await mysqlPool.getPool().getConnection();
  try {
    const user = await resolveUser(connection, actor);
    const canReview = normalize(user.email) === APPROVER_EMAIL;
    const recordTypes = [
      ...(includeVacancies ? ['Vacancy'] : []),
      ...(includePlacements ? ['Placed student'] : []),
    ];
    if (!recordTypes.length) return { canReview, requests: [] };
    const placeholders = recordTypes.map(() => '?').join(', ');
    const [rows] = await connection.execute(
      `SELECT * FROM tpo_delete_requests WHERE record_type IN (${placeholders}) ${canReview ? '' : 'AND requested_by_user_id = ?'} ORDER BY requested_at DESC`,
      canReview ? recordTypes : [...recordTypes, user.id],
    );
    return { canReview, requests: rows.map(shapeDeleteRequest) };
  } finally { connection.release(); }
}

async function reviewDeleteRequest({ actor, requestCode, decision, notes, enabledRecordTypes = ['Vacancy', 'Placed student'], connection: suppliedConnection = null, previewOnly = false }) {
  const ownsConnection = !suppliedConnection;
  const connection = suppliedConnection || await mysqlPool.getPool().getConnection();
  try {
    if (ownsConnection) await connection.beginTransaction();
    const reviewer = await resolveUser(connection, actor, { approver: true });
    const [requests] = await connection.execute('SELECT * FROM tpo_delete_requests WHERE request_code = ? LIMIT 1 FOR UPDATE', [requestCode]);
    const request = requests[0];
    if (!request) throw Object.assign(new Error('The opening deletion request was not found.'), { status: 404 });
    if (!enabledRecordTypes.some(type => normalize(type) === normalize(request.record_type))) {
      throw Object.assign(new Error('This deletion workflow has not been enabled in MySQL yet.'), { status: 409 });
    }
    if (normalize(request.status) !== 'pending') throw Object.assign(new Error(`This request is already ${normalize(request.status) || 'processed'}.`), { status: 409 });
    const reviewedAt = new Date();
    const reviewedByName = text(reviewer.full_name);
    const decisionNotes = text(notes).slice(0, 1000);
    if (decision === 'reject') {
      await connection.execute(
        `UPDATE tpo_delete_requests SET status = 'rejected', reviewed_by_user_id = ?, reviewed_by_name = ?, reviewed_by_email = ?,
          reviewed_at = ?, decision_notes = ?, execution_message = 'No data was deleted.' WHERE id = ?`,
        [reviewer.id, reviewedByName, reviewer.email, reviewedAt, decisionNotes, request.id],
      );
      const entityType = normalize(request.record_type) === 'placed student' ? 'placed_student' : 'vacancy';
      await connection.execute(
        'INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, request_id, details) VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON))',
        [makeId(), reviewer.id, 'deletion_rejected', entityType, request.target_id, request.request_code, JSON.stringify({ summary: request.target_summary, notes: decisionNotes })],
      );
      if (previewOnly) {
        await connection.rollback();
        return { status: 'Rejected', message: 'Request rejection transaction was verified and rolled back.', rolledBack: true };
      }
      if (ownsConnection) await connection.commit();
      return { status: 'Rejected', message: 'Request rejected. No data was deleted.' };
    }
    const target = parseJson(request.target_snapshot);
    if (normalize(request.record_type) === 'placed student') {
      const deleted = await mysqlPlacementTracker.archivePlacedStudent({
        connection,
        actor: reviewer,
        rowNumber: Number(target.rowNumber || request.target_row_number),
        expected: target.expected || {},
        requestId: request.request_code,
      });
      const reviewedAt = new Date();
      const decisionNotes = text(notes).slice(0, 1000);
      const executionMessage = `Approved placement archived. TPO tracker row archived; matching Opening_Applied row ${deleted.openingApplied ? 'archived' : 'not found'}; linked application ${deleted.applicationRestored ? 'restored to its prior status' : 'preserved'}.`;
      await connection.execute(
        `UPDATE tpo_delete_requests SET status = 'approved', reviewed_by_user_id = ?, reviewed_by_name = ?, reviewed_by_email = ?,
          reviewed_at = ?, decision_notes = ?, execution_message = ? WHERE id = ?`,
        [reviewer.id, text(reviewer.full_name), reviewer.email, reviewedAt, decisionNotes, executionMessage, request.id],
      );
      if (previewOnly) {
        await connection.rollback();
        return { status: 'Approved', message: 'Placement approval transaction was verified and rolled back.', rolledBack: true, deleted };
      }
      if (ownsConnection) await connection.commit();
      return { status: 'Approved', message: executionMessage };
    }
    const vacancy = await loadVacancy(connection, request.target_id, { forUpdate: true });
    if (!vacancy || normalize(vacancy.status) === 'deleted') throw Object.assign(new Error('The opening was already removed or is no longer available.'), { status: 409 });
    if ((normalize(target.company) && normalize(target.company) !== normalize(vacancy.company_name)) ||
        (normalize(target.position) && normalize(target.position) !== normalize(vacancy.title))) {
      throw Object.assign(new Error('The opening changed after this request was submitted. Ask the TPO to submit a fresh request.'), { status: 409 });
    }
    const metadata = parseJson(vacancy.metadata);
    metadata.deleted = { at: reviewedAt.toISOString(), requestId: request.request_code, by: reviewer.email };
    await connection.execute("UPDATE vacancies SET status = 'deleted', metadata = CAST(? AS JSON) WHERE id = ?", [JSON.stringify(metadata), vacancy.id]);
    await connection.execute(
      `UPDATE tpo_delete_requests SET status = 'approved', reviewed_by_user_id = ?, reviewed_by_name = ?, reviewed_by_email = ?,
        reviewed_at = ?, decision_notes = ?, execution_message = 'Approved opening was archived. Application history is preserved.' WHERE id = ?`,
      [reviewer.id, reviewedByName, reviewer.email, reviewedAt, decisionNotes, request.id],
    );
    await connection.execute(
      'INSERT INTO vacancy_edit_history (id, vacancy_id, actor_user_id, action, changes) VALUES (?, ?, ?, ?, CAST(? AS JSON))',
      [makeId(), vacancy.id, reviewer.id, 'archived', JSON.stringify({ requestId: request.request_code, decisionNotes })],
    );
    await connection.execute(
      'INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, request_id, details) VALUES (?, ?, ?, ?, ?, ?, CAST(? AS JSON))',
      [makeId(), reviewer.id, 'deletion_approved_and_archived', 'vacancy', vacancy.id, request.request_code, JSON.stringify({ summary: request.target_summary, linkedApplicationCount: target.linkedApplicationCount || 0 })],
    );
    if (previewOnly) {
      await connection.rollback();
      return { status: 'Approved', message: 'Opening approval transaction was verified and rolled back.', rolledBack: true };
    }
    if (ownsConnection) await connection.commit();
    return { status: 'Approved', message: 'Approved opening archived. Application history is preserved.' };
  } catch (error) {
    if (ownsConnection) await connection.rollback().catch(() => {});
    throw error;
  } finally { if (ownsConnection) connection.release(); }
}

module.exports = { createVacancy, listDeleteRequests, listPlacementOfficers, listVacancies, requestVacancyDelete, reviewDeleteRequest, updateVacancy };
