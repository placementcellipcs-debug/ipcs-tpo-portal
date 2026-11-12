const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mysqlPool = require('../src/mysqlPool');
const leaveService = require('../src/mysqlAcademicLeaveService');

async function main() {
  const host = String(process.env.MYSQL_HOST || '').trim().toLowerCase();
  const database = String(process.env.MYSQL_DATABASE || '').trim().toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) || !['ipcs_portal_dev', 'ipcs_portal'].includes(database)) {
    throw new Error('This rollback-only check is restricted to the configured local IPCS MySQL database.');
  }
  const connection = await mysqlPool.getPool().getConnection();
  const suffix = crypto.randomUUID();
  const branchId = crypto.randomUUID();
  const courseId = crypto.randomUUID();
  const actorId = crypto.randomUUID();
  const studentUserId = crypto.randomUUID();
  const studentId = crypto.randomUUID();
  const leaveId = crypto.randomUUID();
  const actorEmail = `leave-review-${suffix}@example.invalid`;
  const studentEmail = `leave-student-${suffix}@example.invalid`;
  const requestId = `leave-review-check-${suffix}`;
  try {
    await connection.beginTransaction();
    await connection.execute('INSERT INTO branches (id, name, normalized_name) VALUES (?, ?, ?)',
      [branchId, `Leave Check ${suffix}`, `leave check ${suffix}`.toLowerCase()]);
    await connection.execute('INSERT INTO courses (id, name, normalized_name, category) VALUES (?, ?, ?, ?)',
      [courseId, `Leave Course ${suffix}`, `leave course ${suffix}`.toLowerCase(), 'Digital Marketing']);
    await connection.execute(
      `INSERT INTO users (id, email, normalized_email, role, full_name, status, sitting_branch_id)
       VALUES (?, ?, ?, 'branch_manager', 'Synthetic Leave Reviewer', 'active', ?),
              (?, ?, ?, 'student', 'Synthetic Leave Student', 'active', ?)`,
      [actorId, actorEmail, actorEmail, branchId, studentUserId, studentEmail, studentEmail, branchId],
    );
    await connection.execute(
      `INSERT INTO student_profiles (id, user_id, roll_number, normalized_roll_number, course_id, branch_id,
                                     personal_email, status, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', JSON_OBJECT())`,
      [studentId, studentUserId, `LEAVE-${suffix}`, `leave-${suffix}`.toLowerCase(), courseId, branchId, studentEmail],
    );
    await connection.execute(
      `INSERT INTO student_leave_requests
        (id, student_id, student_email, student_name, roll_number, branch_id, course_id, branch_name, course_name,
         start_date, end_date, start_date_raw, end_date_raw, request_type, reason, status,
         requested_at, requested_at_raw, source, source_record_key, metadata)
       VALUES (?, ?, ?, 'Synthetic Leave Student', ?, ?, ?, ?, ?, '2026-12-01', '2026-12-02',
               '01/12/2026', '02/12/2026', 'Leave Request', 'Synthetic local leave review verification.',
               'Pending', UTC_TIMESTAMP(), '12/11/2026 10:00:00', 'mysql_check', ?, JSON_OBJECT('origin', 'check'))`,
      [leaveId, studentId, studentEmail, `LEAVE-${suffix}`, branchId, courseId, `Leave Check ${suffix}`, `Leave Course ${suffix}`, suffix],
    );

    const listed = await leaveService.listLeaveRequests(connection);
    const found = listed.find(item => item.leaveId === leaveId);
    assert.ok(found);
    assert.equal(found.studentId, `LEAVE-${suffix}`);
    assert.equal(found.mainCourse, 'Digital Marketing');
    assert.equal(found.leaveStatus, 'Pending');
    assert.equal(found.fromDate, '01/12/2026');

    const reviewed = await leaveService.reviewLeaveRequest({
      leaveId, status: 'Approved', notes: 'Synthetic approval note.',
      actor: { name: 'Synthetic Leave Reviewer', email: actorEmail }, requestId, connection,
    });
    assert.equal(reviewed.leaveStatus, 'Approved');
    assert.equal(reviewed.approvedBy, 'Synthetic Leave Reviewer');
    assert.equal(reviewed.approvalNotes, 'Synthetic approval note.');
    await assert.rejects(
      leaveService.reviewLeaveRequest({ leaveId, status: 'Rejected', actor: { email: actorEmail }, requestId, connection }),
      error => error.code === 'LEAVE_ALREADY_REVIEWED',
    );
    const [[audit]] = await connection.execute(
      `SELECT COUNT(*) AS count FROM audit_events WHERE actor_user_id = ? AND request_id = ?
       AND entity_type = 'student_leave_request' AND entity_id = ? AND action = 'student_leave_request_approved'`,
      [actorId, requestId, leaveId],
    );
    assert.equal(Number(audit.count), 1);

    await connection.rollback();
    const [[remaining]] = await connection.execute(
      `SELECT (SELECT COUNT(*) FROM branches WHERE id = ?) AS branches,
              (SELECT COUNT(*) FROM courses WHERE id = ?) AS courses,
              (SELECT COUNT(*) FROM users WHERE id IN (?, ?)) AS users,
              (SELECT COUNT(*) FROM student_profiles WHERE id = ?) AS students,
              (SELECT COUNT(*) FROM student_leave_requests WHERE id = ?) AS requests,
              (SELECT COUNT(*) FROM audit_events WHERE request_id = ?) AS audits`,
      [branchId, courseId, actorId, studentUserId, studentId, leaveId, requestId],
    );
    for (const count of Object.values(remaining)) assert.equal(Number(count), 0);
    console.log('TPO academic leave MySQL check passed: shared listing, approval, audit, repeat-review rejection, and rollback verified; no test rows remain.');
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
    await mysqlPool.close();
  }
}

main().catch(error => {
  console.error(`TPO academic leave MySQL check failed: ${error.message}`);
  process.exitCode = 1;
});
