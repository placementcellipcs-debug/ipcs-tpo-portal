const assert = require('node:assert/strict');
const crypto = require('crypto');
const mysqlPool = require('../src/mysqlPool');
const placementTracker = require('../src/mysqlPlacementTracker');

const id = () => crypto.randomUUID();
const text = value => String(value ?? '').trim();

async function main() {
  const host = text(process.env.MYSQL_HOST).toLowerCase();
  const database = text(process.env.MYSQL_DATABASE).toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) || !['ipcs_portal_dev', 'ipcs_portal'].includes(database)) {
    throw new Error('This rollback-only check is restricted to the configured local IPCS MySQL database.');
  }

  const connection = await mysqlPool.getPool().getConnection();
  const suffix = crypto.randomUUID();
  const courseId = id();
  const studentUserId = id();
  const studentId = id();
  const ownerTpoId = id();
  const otherTpoId = id();
  const vacancyId = id();
  const applicationId = id();
  const studentEmail = `mysql-tpo-application-check-${suffix}@example.invalid`;
  const ownerEmail = `mysql-tpo-owner-check-${suffix}@example.invalid`;
  const otherEmail = `mysql-tpo-other-check-${suffix}@example.invalid`;
  const jobCode = `TPO-CHECK-${suffix}`;
  const courseName = `Synthetic TPO Application Course ${suffix}`;

  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO courses (id, name, normalized_name, active, metadata)
       VALUES (?, ?, ?, 1, JSON_OBJECT('source', 'rollback_check'))`,
      [courseId, courseName, courseName.toLowerCase()],
    );
    await connection.execute(
      `INSERT INTO users (id, email, normalized_email, role, full_name, status)
       VALUES (?, ?, ?, 'student', 'Synthetic TPO Application Student', 'active'),
              (?, ?, ?, 'tpo', 'Synthetic Assigned TPO', 'active'),
              (?, ?, ?, 'tpo', 'Synthetic Unassigned TPO', 'active')`,
      [studentUserId, studentEmail, studentEmail, ownerTpoId, ownerEmail, ownerEmail, otherTpoId, otherEmail, otherEmail],
    );
    await connection.execute(
      `INSERT INTO student_profiles (id, user_id, roll_number, normalized_roll_number, course_id, personal_email, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
      [studentId, studentUserId, `TPO-CHECK-${suffix}`, `tpo-check-${suffix}`, courseId, studentEmail],
    );
    const applicationMetadata = JSON.stringify({
      applicant: { name: 'Synthetic TPO Application Student', email: studentEmail, rollNumber: `TPO-CHECK-${suffix}`, course: courseName },
      opening: { jobCode, companyName: 'Synthetic Shared Company', title: 'Synthetic Shared Role' },
      studentSourceFields: {},
      openingSourceFields: {},
    });
    await connection.execute(
      `INSERT INTO vacancies (id, job_code, title, company_name, status, assigned_tpo_user_id, source, source_record_key, metadata)
       VALUES (?, ?, 'Synthetic Shared Role', 'Synthetic Shared Company', 'open', ?, 'rollback_check', ?, JSON_OBJECT('source', 'rollback_check'))`,
      [vacancyId, jobCode, ownerTpoId, jobCode],
    );
    await connection.execute(
      `INSERT INTO job_applications (id, student_id, vacancy_id, owner_tpo_user_id, status, applied_at, source, source_record_key, metadata)
       VALUES (?, ?, ?, ?, 'Applied', UTC_TIMESTAMP(), 'mysql_student_portal', ?, CAST(? AS JSON))`,
      [applicationId, studentId, vacancyId, ownerTpoId, `student:${studentId}:vacancy:${vacancyId}`, applicationMetadata],
    );
    await connection.execute(
      `INSERT INTO application_status_history (id, application_id, previous_status, new_status, note, actor_user_id, occurred_at, metadata)
       VALUES (?, ?, NULL, 'Applied', 'Synthetic rollback check.', ?, UTC_TIMESTAMP(), JSON_OBJECT('source', 'rollback_check'))`,
      [id(), applicationId, studentUserId],
    );

    const assignedTpoRows = await placementTracker.listApplications({ user: { email: ownerEmail }, isTpo: true, connection });
    const visibleApplication = assignedTpoRows.find(row => row.recordId === `application:${applicationId}`);
    assert.ok(visibleApplication, 'the opening owner should see the student application');
    assert.equal(visibleApplication.jobId, jobCode);
    assert.equal(visibleApplication.company, 'Synthetic Shared Company');
    assert.equal(visibleApplication.name, 'Synthetic TPO Application Student');
    assert.equal(visibleApplication.tpoName, 'Synthetic Assigned TPO');
    assert.equal(visibleApplication.status, 'Applied');
    assert.equal(visibleApplication.statusHistory.length, 1);

    const otherTpoRows = await placementTracker.listApplications({ user: { email: otherEmail }, isTpo: true, connection });
    assert.ok(!otherTpoRows.some(row => row.recordId === `application:${applicationId}`), 'another TPO must not see an application they do not own');

    await connection.rollback();
    const [[persisted]] = await connection.execute(
      `SELECT
          (SELECT COUNT(*) FROM users WHERE id IN (?, ?, ?)) AS users_count,
          (SELECT COUNT(*) FROM student_profiles WHERE id = ?) AS students_count,
          (SELECT COUNT(*) FROM courses WHERE id = ?) AS courses_count,
          (SELECT COUNT(*) FROM vacancies WHERE id = ?) AS vacancies_count,
          (SELECT COUNT(*) FROM job_applications WHERE id = ?) AS applications_count,
          (SELECT COUNT(*) FROM application_status_history WHERE application_id = ?) AS history_count`,
      [studentUserId, ownerTpoId, otherTpoId, studentId, courseId, vacancyId, applicationId, applicationId],
    );
    for (const [key, value] of Object.entries(persisted)) assert.equal(Number(value), 0, `${key} should be rolled back`);
    console.log('TPO application MySQL check passed: shared application details/history are visible to the assigned TPO only, and all fixtures were rolled back.');
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
    await mysqlPool.close();
  }
}

main().catch(error => {
  console.error(`TPO application MySQL check failed: ${error.message}`);
  process.exitCode = 1;
});
