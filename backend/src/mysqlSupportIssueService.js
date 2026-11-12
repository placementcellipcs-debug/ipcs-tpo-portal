const mysqlPool = require('./mysqlPool');

const text = value => String(value ?? '').normalize('NFKC').trim();
const normalizedEmail = value => text(value).toLocaleLowerCase('en-US');

async function listIssues(connection = null) {
  const executor = connection || mysqlPool.getPool();
  const [rows] = await executor.execute(
    `SELECT id, source_row_number, student_name, student_email, phone, roll_number,
            branch_name, course_name, location, details, status, remarks, reported_at,
            reported_at_raw, created_at, updated_at
     FROM support_issues
     ORDER BY COALESCE(reported_at, created_at) DESC, source_row_number DESC, created_at DESC`,
  );
  return rows;
}

async function findIssue(id, connection = null, lock = false) {
  const executor = connection || mysqlPool.getPool();
  const [rows] = await executor.execute(
    `SELECT id, student_name, student_email, branch_name, course_name, details, status, remarks
     FROM support_issues WHERE id = ? LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
    [text(id)],
  );
  return rows[0] || null;
}

async function updateIssue({ id, status, remarks, actorEmail, requestId, connection: suppliedConnection = null }) {
  const ownsConnection = !suppliedConnection;
  const connection = suppliedConnection || await mysqlPool.getPool().getConnection();
  try {
    if (ownsConnection) await connection.beginTransaction();
    const issue = await findIssue(id, connection, true);
    if (!issue) {
      const error = new Error('Issue not found.');
      error.status = 404;
      error.code = 'ISSUE_NOT_FOUND';
      throw error;
    }
    const email = normalizedEmail(actorEmail);
    const [actors] = await connection.execute(
      'SELECT id FROM users WHERE normalized_email = ? AND status = \'active\' LIMIT 1',
      [email],
    );
    const actorId = actors[0]?.id || null;
    await connection.execute(
      `UPDATE support_issues SET status = ?, remarks = ?, updated_by_user_id = ? WHERE id = ?`,
      [status, remarks || null, actorId, issue.id],
    );
    await connection.execute(
      `INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, occurred_at, request_id, details)
       VALUES (?, ?, 'support_issue_updated', 'support_issue', ?, UTC_TIMESTAMP(), ?, CAST(? AS JSON))`,
      [require('crypto').randomUUID(), actorId, issue.id, text(requestId) || null,
        JSON.stringify({ previousStatus: text(issue.status), newStatus: status, remarksChanged: text(issue.remarks) !== remarks })],
    );
    if (ownsConnection) await connection.commit();
    return { id: issue.id, status, remarks };
  } catch (error) {
    if (ownsConnection) await connection.rollback().catch(() => {});
    throw error;
  } finally {
    if (ownsConnection) connection.release();
  }
}

module.exports = { findIssue, listIssues, updateIssue };
