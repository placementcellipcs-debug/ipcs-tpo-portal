const crypto = require('crypto');
const mysqlPool = require('./mysqlPool');

const text = value => String(value ?? '').normalize('NFKC').trim();
const normalize = value => text(value).toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
const normalizeKey = value => normalize(value).replace(/[^a-z0-9]/g, '');

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function field(fields, ...aliases) {
  const wanted = new Set(aliases.map(normalizeKey));
  for (const [key, value] of Object.entries(fields || {})) {
    if (wanted.has(normalizeKey(key)) && value !== undefined && value !== null) return text(value);
  }
  return '';
}

function asDateParts(value) {
  const raw = text(value);
  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (match) return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  match = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
  if (!match) return null;
  return { year: Number(match[3]), month: Number(match[2]), day: Number(match[1]) };
}

function toUtcDateTime(dateValue, timeValue) {
  const parts = asDateParts(dateValue);
  if (!parts) return null;
  const checked = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  if (checked.getUTCFullYear() !== parts.year || checked.getUTCMonth() !== parts.month - 1 || checked.getUTCDate() !== parts.day) return null;
  const time = text(timeValue).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\s*([AaPp][Mm]))?$/);
  let hours = time ? Number(time[1]) : 0;
  const minutes = time ? Number(time[2]) : 0;
  const seconds = time ? Number(time[3] || 0) : 0;
  if (time?.[4]) {
    const isPm = time[4].toLowerCase() === 'pm';
    hours = (hours % 12) + (isPm ? 12 : 0);
  }
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  // Event dates and times in the portal are Asia/Kolkata local time.
  const instant = new Date(Date.UTC(parts.year, parts.month - 1, parts.day, hours, minutes, seconds) - 330 * 60 * 1000);
  return instant.toISOString().slice(0, 19).replace('T', ' ');
}

function eventFromRow(row) {
  const metadata = parseJson(row.metadata);
  const fields = metadata.fields || {};
  return {
    id: text(row.id),
    eventKey: field(fields, 'Event_ID', 'Event ID', 'Drive ID') || text(metadata.externalEventId) || text(row.id),
    eventId: field(fields, 'Event_ID', 'Event ID', 'Drive ID') || text(metadata.externalEventId) || text(row.id),
    rowNumber: Number(metadata.sourceRow) || null,
    date: field(fields, 'Date of the Event', 'Date', 'Event Date') || 'TBA',
    tpo: field(fields, 'TPO', 'Placement Officer'),
    branch: field(fields, 'Branch') || 'All Branches',
    course: field(fields, 'Course', 'Eligible Course'),
    type: field(fields, 'Event', 'Event Type', 'Type') || 'GENERAL',
    title: text(row.title) || field(fields, 'Title', 'Event Title') || 'Event',
    description: field(fields, 'Descripation', 'Description'),
    time: field(fields, 'Time of the Event', 'Time', 'Event Time'),
    location: text(row.location) || field(fields, 'Event Happening in', 'Location', 'Venue'),
    poster: field(fields, 'Poster Link', 'Poster'),
    status: field(fields, 'Status') || 'Scheduled',
    mailStatus: field(fields, 'Mail_Status', 'Mail Status') || 'PENDING',
    mailError: field(fields, 'Mail_Error', 'Mail Error'),
    statusUpdatedAt: field(fields, 'Status_Updated_At'),
    statusUpdatedBy: field(fields, 'Status_Updated_By'),
    statusReason: field(fields, 'Status_Reason'),
    createdBy: field(fields, 'Created_By'),
    fields,
  };
}

async function withConnection(suppliedConnection, callback) {
  if (suppliedConnection) return callback(suppliedConnection);
  const connection = await mysqlPool.getPool().getConnection();
  try { return await callback(connection); } finally { connection.release(); }
}

async function getActorId(connection, email) {
  const normalizedEmail = normalize(email);
  if (!normalizedEmail) return null;
  const [rows] = await connection.execute('SELECT id FROM users WHERE normalized_email = ? LIMIT 1', [normalizedEmail]);
  return rows[0]?.id || null;
}

async function listEvents(connection = null) {
  return withConnection(connection, async conn => {
    const [rows] = await conn.execute(
      `SELECT id, title, company_name, starts_at, location, status, source, source_record_key, metadata, created_at, updated_at
       FROM drives
       WHERE source IN ('google_sheets_snapshot', 'tpo_portal_mysql') AND source_record_key LIKE 'Event:%'
       ORDER BY starts_at IS NULL, starts_at, created_at DESC`,
    );
    return rows.map(eventFromRow);
  });
}

async function createEvent({ fields, actorEmail, requestId, connection = null }) {
  const eventId = field(fields, 'Event_ID', 'Event ID', 'Drive ID');
  const title = field(fields, 'Title', 'Event Title') || field(fields, 'Event', 'Event Type') || 'Event';
  if (!eventId) throw Object.assign(new Error('A unique event reference is required.'), { status: 400 });
  if (!field(fields, 'Date of the Event', 'Date', 'Event Date')) throw Object.assign(new Error('A valid event date is required.'), { status: 400 });
  return withConnection(connection, async conn => {
    const ownsTransaction = !connection;
    if (ownsTransaction) await conn.beginTransaction();
    try {
      const id = crypto.randomUUID();
      const actorId = await getActorId(conn, actorEmail);
      const metadata = JSON.stringify({ source: 'tpo_portal_mysql', externalEventId: eventId, fields });
      await conn.execute(
        `INSERT INTO drives (id, title, company_name, starts_at, location, status, created_by_user_id, source, source_record_key, metadata)
         VALUES (?, ?, NULL, ?, ?, 'open', ?, 'tpo_portal_mysql', ?, CAST(? AS JSON))`,
        [id, title.slice(0, 240), toUtcDateTime(field(fields, 'Date of the Event', 'Date', 'Event Date'), field(fields, 'Time of the Event', 'Time', 'Event Time')),
          field(fields, 'Event Happening in', 'Location', 'Venue').slice(0, 240) || null, actorId, `Event:${eventId}`,
          metadata],
      );
      await conn.execute(
        `INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, occurred_at, request_id, details)
         VALUES (?, ?, 'event_created', 'drive', ?, UTC_TIMESTAMP(), ?, CAST(? AS JSON))`,
        [crypto.randomUUID(), actorId, id, text(requestId) || null, JSON.stringify({ eventId, title })],
      );
      const [[row]] = await conn.execute('SELECT id, title, company_name, starts_at, location, status, source, source_record_key, metadata, created_at, updated_at FROM drives WHERE id = ?', [id]);
      if (ownsTransaction) await conn.commit();
      return eventFromRow(row);
    } catch (error) {
      if (ownsTransaction) await conn.rollback().catch(() => {});
      if (error?.code === 'ER_DUP_ENTRY') throw Object.assign(new Error('An event with this reference already exists.'), { status: 409, code: 'EVENT_ALREADY_EXISTS' });
      throw error;
    }
  });
}

async function findEvent(connection, eventKey, { forUpdate = false } = {}) {
  const requested = text(eventKey);
  const rowKey = requested.match(/^row-(\d+)$/i);
  const [rows] = await connection.execute(
    `SELECT id, title, company_name, starts_at, location, status, source, source_record_key, metadata, created_at, updated_at
     FROM drives WHERE source IN ('google_sheets_snapshot', 'tpo_portal_mysql') AND source_record_key LIKE 'Event:%'
     AND (JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.externalEventId')) = ?
       OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.fields.Event_ID')) = ?
       OR id = ?${rowKey ? " OR CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.sourceRow')) AS UNSIGNED) = ?" : ''})
     ${forUpdate ? 'FOR UPDATE' : ''}`,
    rowKey ? [requested, requested, requested, Number(rowKey[1])] : [requested, requested, requested],
  );
  if (rows.length > 1) throw Object.assign(new Error('This event reference matches more than one event and needs staff review.'), { status: 409, code: 'EVENT_REFERENCE_AMBIGUOUS' });
  return rows[0] || null;
}

async function updateEventStatus({ eventKey, status, reason, date, time, actor, requestId, connection = null }) {
  const allowed = ['Cancelled', 'Rescheduled'];
  if (!allowed.includes(status)) throw Object.assign(new Error('Choose a valid event status.'), { status: 400 });
  return withConnection(connection, async conn => {
    const ownsTransaction = !connection;
    if (ownsTransaction) await conn.beginTransaction();
    try {
      const row = await findEvent(conn, eventKey, { forUpdate: true });
      if (!row) throw Object.assign(new Error('This event could not be found. Refresh the calendar and try again.'), { status: 404, code: 'EVENT_NOT_FOUND' });
      const metadata = parseJson(row.metadata);
      const fields = { ...(metadata.fields || {}) };
      const current = field(fields, 'Status') || 'Scheduled';
      if (normalize(current) === 'cancelled') throw Object.assign(new Error('This event is already cancelled and cannot be changed.'), { status: 409, code: 'EVENT_ALREADY_CANCELLED' });
      const event = eventFromRow(row);
      const previousDate = event.date;
      const previousTime = event.time;
      fields.Status = status;
      fields.Status_Updated_At = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'medium' }).format(new Date());
      fields.Status_Updated_By = text(actor?.name || actor?.email || 'Placement Team');
      fields.Status_Reason = text(reason).slice(0, 1000);
      fields.Mail_Status = `${status.toUpperCase()} NOTICE PENDING`;
      fields.Mail_Error = '';
      if (status === 'Rescheduled') {
        if (!asDateParts(date) || !toUtcDateTime(date, time)) throw Object.assign(new Error('Choose a valid new event date and time.'), { status: 400, code: 'INVALID_EVENT_SCHEDULE' });
        const parsed = asDateParts(date);
        fields['Date of the Event'] = `${String(parsed.day).padStart(2, '0')}/${String(parsed.month).padStart(2, '0')}/${parsed.year}`;
        fields['Time of the Event'] = text(time);
      }
      metadata.fields = fields;
      const actorId = await getActorId(conn, actor?.email);
      const dbStatus = status === 'Cancelled' ? 'closed' : 'open';
      const updatedDate = status === 'Rescheduled' ? fields['Date of the Event'] : previousDate;
      const updatedTime = status === 'Rescheduled' ? fields['Time of the Event'] : previousTime;
      await conn.execute(
        `UPDATE drives SET status = ?, starts_at = ?, metadata = CAST(? AS JSON) WHERE id = ?`,
        [dbStatus, status === 'Rescheduled' ? toUtcDateTime(fields['Date of the Event'], fields['Time of the Event']) : row.starts_at,
          JSON.stringify(metadata), row.id],
      );
      await conn.execute(
        `INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, occurred_at, request_id, details)
         VALUES (?, ?, ?, 'drive', ?, UTC_TIMESTAMP(), ?, CAST(? AS JSON))`,
        [crypto.randomUUID(), actorId, status === 'Cancelled' ? 'event_cancelled' : 'event_rescheduled', row.id, text(requestId) || null,
          JSON.stringify({ eventId: event.eventId, status, reason: fields.Status_Reason, previousDate, previousTime, date: updatedDate, time: updatedTime })],
      );
      const [[updatedRow]] = await conn.execute('SELECT id, title, company_name, starts_at, location, status, source, source_record_key, metadata, created_at, updated_at FROM drives WHERE id = ?', [row.id]);
      if (ownsTransaction) await conn.commit();
      return { event: eventFromRow(updatedRow), previousDate, previousTime };
    } catch (error) {
      if (ownsTransaction) await conn.rollback().catch(() => {});
      throw error;
    }
  });
}

async function setMailStatus({ eventKey, status, error = '', sentAt = '', connection = null }) {
  return withConnection(connection, async conn => {
    const row = await findEvent(conn, eventKey, { forUpdate: true });
    if (!row) return false;
    const metadata = parseJson(row.metadata);
    const fields = { ...(metadata.fields || {}) };
    fields.Mail_Status = text(status);
    fields.Mail_Error = text(error);
    if (sentAt) fields.Mail_Sent_At = text(sentAt);
    metadata.fields = fields;
    await conn.execute('UPDATE drives SET metadata = CAST(? AS JSON) WHERE id = ?', [JSON.stringify(metadata), row.id]);
    return true;
  });
}

async function eventRecipients({ branch = '', tpoName = '', includeAll = false, connection = null } = {}) {
  return withConnection(connection, async conn => {
    const [rows] = await conn.execute(
      `SELECT DISTINCT u.email, u.normalized_email, u.full_name, REPLACE(LOWER(u.role), '_', ' ') AS role, b.normalized_name AS sitting_branch
       FROM users u LEFT JOIN branches b ON b.id = u.sitting_branch_id
       WHERE u.status = 'active' AND u.email IS NOT NULL
         AND (REPLACE(LOWER(u.role), '_', ' ') LIKE '%tpo%'
           OR REPLACE(LOWER(u.role), '_', ' ') LIKE '%placement officer%'
           OR REPLACE(LOWER(u.role), '_', ' ') LIKE '%branch manager%')
       ORDER BY u.full_name`,
    );
    const emailOf = row => text(row.email || row.normalized_email);
    const valid = values => [...new Set(values.map(emailOf).filter(value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)))];
    const tpos = rows.filter(row => /tpo|placement officer/.test(row.role));
    const managers = rows.filter(row => /branch manager/.test(row.role));
    const assigned = async candidateRows => {
      const branchKey = normalize(branch);
      if (!branchKey) return [];
      const [assignedRows] = await conn.execute(
        `SELECT DISTINCT u.normalized_email FROM users u
         JOIN user_branch_assignments uba ON uba.user_id = u.id
         JOIN branches b ON b.id = uba.branch_id
         WHERE u.status = 'active' AND b.normalized_name = ?`, [branchKey],
      );
      const assignedEmails = new Set(assignedRows.map(row => normalize(row.normalized_email)));
      return candidateRows.filter(row => assignedEmails.has(normalize(row.normalized_email))
        || normalize(row.sitting_branch) === branchKey);
    };
    const namedTpo = tpos.find(row => normalize(row.full_name).replace(/\s/g, '') === normalize(tpoName).replace(/\s/g, ''));
    return {
      tpos: valid(tpos),
      branchManagers: valid(await assigned(managers)),
      assignedTpo: valid(await assigned(tpos)),
      namedTpoEmail: namedTpo ? emailOf(namedTpo) : '',
      branchManager: valid(await assigned(managers))[0] || '',
    };
  });
}

module.exports = { createEvent, eventFromRow, eventRecipients, listEvents, setMailStatus, updateEventStatus };
