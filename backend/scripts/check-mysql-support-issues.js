const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mysqlPool = require('../src/mysqlPool');
const issues = require('../src/mysqlSupportIssueService');

async function main() {
  const host = String(process.env.MYSQL_HOST || '').trim().toLowerCase();
  const database = String(process.env.MYSQL_DATABASE || '').trim().toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) || !['ipcs_portal_dev', 'ipcs_portal'].includes(database)) {
    throw new Error('This rollback-only check is restricted to the configured local IPCS MySQL database.');
  }
  const connection = await mysqlPool.getPool().getConnection();
  const suffix = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const issueId = crypto.randomUUID();
  const email = `mysql-issue-review-${suffix}@example.invalid`;
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO users (id, email, normalized_email, role, full_name, status)
       VALUES (?, ?, ?, 'placement officer', 'Synthetic Issue Reviewer', 'active')`,
      [userId, email, email],
    );
    await connection.execute(
      `INSERT INTO support_issues
        (id, student_name, student_email, branch_name, course_name, details, status, source, source_record_key)
       VALUES (?, 'Synthetic Student', 'student@example.invalid', 'Local Test Branch', 'Local Test Course',
               'Synthetic issue for review verification.', 'Pending', 'mysql_check', ?)`,
      [issueId, suffix],
    );
    const listed = await issues.listIssues(connection);
    assert.ok(listed.some(row => row.id === issueId));
    const issue = await issues.findIssue(issueId, connection, true);
    assert.equal(issue.status, 'Pending');
    const updated = await issues.updateIssue({
      id: issueId, status: 'Resolved', remarks: 'Synthetic resolution note.', actorEmail: email,
      requestId: `test-${suffix}`, connection,
    });
    assert.equal(updated.status, 'Resolved');
    const [updatedRows] = await connection.execute('SELECT status, remarks, updated_by_user_id FROM support_issues WHERE id = ?', [issueId]);
    assert.equal(updatedRows[0].status, 'Resolved');
    assert.equal(updatedRows[0].remarks, 'Synthetic resolution note.');
    assert.equal(updatedRows[0].updated_by_user_id, userId);
    const [auditRows] = await connection.execute("SELECT action FROM audit_events WHERE entity_type = 'support_issue' AND entity_id = ?", [issueId]);
    assert.equal(auditRows.length, 1);
    assert.equal(auditRows[0].action, 'support_issue_updated');
    await connection.rollback();

    const [[persistedIssue]] = await connection.execute('SELECT COUNT(*) AS count FROM support_issues WHERE id = ?', [issueId]);
    const [[persistedAudit]] = await connection.execute("SELECT COUNT(*) AS count FROM audit_events WHERE entity_type = 'support_issue' AND entity_id = ?", [issueId]);
    assert.equal(Number(persistedIssue.count), 0);
    assert.equal(Number(persistedAudit.count), 0);
    console.log('TPO support issue MySQL check passed: list, resolved status, remarks, actor audit, and rollback verified; no test rows remain.');
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
    await mysqlPool.close();
  }
}

main().catch(error => {
  console.error(`TPO support issue MySQL check failed: ${error.message}`);
  process.exitCode = 1;
});
