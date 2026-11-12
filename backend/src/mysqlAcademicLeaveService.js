const crypto = require('crypto');
const mysqlPool = require('./mysqlPool');

const text = value => String(value ?? '').normalize('NFKC').trim();
const normalize = value => text(value).toLocaleLowerCase('en-US').replace(/\s+/g, ' ');

function parseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function serialize(row) {
  const metadata = parseJson(row.metadata);
  return {
    leaveId: text(row.id),
    studentId: text(row.roll_number || row.student_email),
    studentName: text(row.student_name) || 'Student',
    mainCourse: text(row.main_course || row.course_name),
    branch: text(row.branch_name),
    fromDate: text(row.start_date_raw),
    toDate: text(row.end_date_raw),
    reason: text(row.reason),
    leaveStatus: text(row.status) || 'Pending',
    requestedAt: text(row.requested_at_raw),
    approvedBy: text(metadata.approvedBy),
    decisionDate: text(metadata.decisionDate),
    approvalNotes: text(metadata.approvalNotes),
    requestType: text(row.request_type),
  };
}

async function withConnection(suppliedConnection, callback) {
  if (suppliedConnection) return callback(suppliedConnection);
  const connection = await mysqlPool.getPool().getConnection();
  try { return await callback(connection); } finally { connection.release(); }
}

async function listLeaveRequests(connection = null) {
  return withConnection(connection, async conn => {
    const [rows] = await conn.execute(
      `SELECT r.id, r.student_email, r.student_name, r.roll_number,
              COALESCE(NULLIF(c.category, ''), NULLIF(r.course_name, '')) AS main_course,
              COALESCE(NULLIF(b.name, ''), NULLIF(r.branch_name, '')) AS branch_name,
              r.course_name, r.start_date_raw, r.end_date_raw, r.reason, r.status,
              r.request_type, r.requested_at_raw, r.metadata
       FROM student_leave_requests r
       LEFT JOIN student_profiles sp ON sp.id = r.student_id
       LEFT JOIN courses c ON c.id = COALESCE(sp.course_id, r.course_id)
       LEFT JOIN branches b ON b.id = COALESCE(sp.branch_id, r.branch_id)
       ORDER BY COALESCE(r.requested_at, r.created_at) DESC, r.source_row_number DESC, r.created_at DESC`,
    );
    return rows.map(serialize);
  });
}

async function reviewLeaveRequest({ leaveId, status, notes = '', actor = {}, requestId = '', connection = null }) {
  const requestKey = text(leaveId);
  const decision = text(status);
  if (!requestKey || !['Approved', 'Rejected'].includes(decision)) {
    throw Object.assign(new Error('Choose a leave request and approve or reject it.'), { status: 400, code: 'INVALID_LEAVE_REVIEW' });
  }
  return withConnection(connection, async conn => {
    const ownsTransaction = !connection;
    if (ownsTransaction) await conn.beginTransaction();
    try {
      const [rows] = await conn.execute(
        `SELECT id, status, metadata FROM student_leave_requests WHERE id = ? LIMIT 2${ownsTransaction || connection ? ' FOR UPDATE' : ''}`,
        [requestKey],
      );
      if (!rows.length) throw Object.assign(new Error('Leave request not found.'), { status: 404, code: 'LEAVE_REQUEST_NOT_FOUND' });
      if (rows.length > 1) throw Object.assign(new Error('This leave request ID is ambiguous and needs staff review.'), { status: 409, code: 'LEAVE_REQUEST_AMBIGUOUS' });
      const currentStatus = normalize(rows[0].status);
      if (['approved', 'rejected'].includes(currentStatus)) {
        throw Object.assign(new Error(`This leave request has already been ${currentStatus}.`), { status: 409, code: 'LEAVE_ALREADY_REVIEWED' });
      }
      const metadata = parseJson(rows[0].metadata);
      const reviewedAt = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'medium',
      }).format(new Date());
      const reviewer = text(actor.name || actor.email || 'Placement Team');
      const reviewNotes = text(notes).slice(0, 2000);
      Object.assign(metadata, { approvedBy: reviewer, decisionDate: reviewedAt, approvalNotes: reviewNotes });
      const [actors] = await conn.execute('SELECT id FROM users WHERE normalized_email = ? LIMIT 1', [normalize(actor.email)]);
      const actorUserId = actors[0]?.id || null;
      await conn.execute(
        'UPDATE student_leave_requests SET status = ?, metadata = CAST(? AS JSON) WHERE id = ?',
        [decision, JSON.stringify(metadata), requestKey],
      );
      await conn.execute(
        `INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, occurred_at, request_id, details)
         VALUES (?, ?, ?, 'student_leave_request', ?, UTC_TIMESTAMP(), ?, CAST(? AS JSON))`,
        [crypto.randomUUID(), actorUserId, decision === 'Approved' ? 'student_leave_request_approved' : 'student_leave_request_rejected',
          requestKey, text(requestId) || null, JSON.stringify({ status: decision, reviewer, notes: reviewNotes })],
      );
      const [updatedRows] = await conn.execute(
        `SELECT r.id, r.student_email, r.student_name, r.roll_number,
                COALESCE(NULLIF(c.category, ''), NULLIF(r.course_name, '')) AS main_course,
                COALESCE(NULLIF(b.name, ''), NULLIF(r.branch_name, '')) AS branch_name,
                r.course_name, r.start_date_raw, r.end_date_raw, r.reason, r.status,
                r.request_type, r.requested_at_raw, r.metadata
         FROM student_leave_requests r
         LEFT JOIN student_profiles sp ON sp.id = r.student_id
         LEFT JOIN courses c ON c.id = COALESCE(sp.course_id, r.course_id)
         LEFT JOIN branches b ON b.id = COALESCE(sp.branch_id, r.branch_id)
         WHERE r.id = ? LIMIT 1`,
        [requestKey],
      );
      if (ownsTransaction) await conn.commit();
      return serialize(updatedRows[0]);
    } catch (error) {
      if (ownsTransaction) await conn.rollback().catch(() => {});
      throw error;
    }
  });
}

module.exports = { listLeaveRequests, reviewLeaveRequest, serialize };
