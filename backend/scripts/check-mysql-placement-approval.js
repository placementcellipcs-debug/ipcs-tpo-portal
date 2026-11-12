const crypto = require('crypto');
const mysqlPool = require('../src/mysqlPool');
const vacancyManagement = require('../src/mysqlVacancyManagement');

function recordFields(metadata) {
  const value = typeof metadata === 'string' ? JSON.parse(metadata || '{}') : metadata;
  return value?.fields || {};
}

function field(fields, name) {
  const wanted = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const key = Object.keys(fields || {}).find(candidate => candidate.toLowerCase().replace(/[^a-z0-9]/g, '') === wanted);
  return String((key ? fields[key] : '') || '').trim();
}

async function main() {
  const pool = mysqlPool.getPool();
  const connection = await pool.getConnection();
  let transactionOpen = false;
  try {
    const [reviewers] = await connection.execute(
      `SELECT id, email, full_name, role FROM users
       WHERE normalized_email = 'gifty@ipcsglobal.com' AND status = 'active' LIMIT 1`,
    );
    const reviewer = reviewers[0];
    if (!reviewer) throw new Error('The local active Gifty reviewer account is not available.');

    const [candidates] = await connection.execute(
      `SELECT tr.id, tr.source_row_number, tr.metadata, tr.roll_number, tr.student_name,
              tr.job_code, tr.company_name, tr.position_title, tr.student_id, tr.vacancy_id,
              u.id AS owner_id, u.email AS owner_email, u.full_name AS owner_name, u.role AS owner_role
       FROM placement_tracker_records tr
       JOIN users u ON u.id = tr.owner_tpo_user_id
       WHERE tr.source_key = 'shared_placement' AND tr.source_tab = 'TPO_Log'
         AND LOWER(TRIM(COALESCE(tr.status, ''))) = 'placed'
         AND tr.student_id IS NOT NULL AND tr.vacancy_id IS NOT NULL
         AND u.status = 'active' AND u.role = 'tpo'
         AND (SELECT COUNT(*) FROM placement_tracker_records oa
              WHERE oa.source_key = tr.source_key AND oa.source_tab = 'Opening_Applied'
                AND oa.student_id = tr.student_id AND oa.vacancy_id = tr.vacancy_id
                AND LOWER(COALESCE(oa.status, '')) <> 'deleted') = 1
       ORDER BY tr.source_row_number LIMIT 1`,
    );
    const row = candidates[0];
    if (!row) throw new Error('No eligible active placement with exactly one linked application is available for a rollback check.');

    const fields = recordFields(row.metadata);
    const expected = {
      name: String(row.student_name || field(fields, 'Student Name')),
      roll: String(row.roll_number || field(fields, 'Roll Number')),
      jobId: String(row.job_code || field(fields, 'Job ID')),
      company: String(row.company_name || field(fields, 'Company Name')),
      position: String(row.position_title || field(fields, 'Position')),
    };
    const target = {
      type: 'placed-student',
      recordId: row.id,
      rowNumber: Number(row.source_row_number),
      expected,
      entrySource: 'TPO_Log',
    };
    const requestCode = `LCL-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;

    await connection.beginTransaction();
    transactionOpen = true;
    await connection.execute(
      `INSERT INTO tpo_delete_requests
       (id, request_code, status, record_type, target_id, target_summary, target_snapshot, reason,
        requested_by_user_id, requested_by_name, requested_by_email, requested_by_role)
       VALUES (?, ?, 'pending', 'Placed student', ?, 'Local rollback verification', CAST(? AS JSON),
         'Local rollback verification only', ?, 'Local verification', 'local-check@example.invalid', 'tpo')`,
      [crypto.randomUUID(), requestCode, `LOCAL|${row.source_row_number}`, JSON.stringify(target), row.owner_id],
    );

    const outcome = await vacancyManagement.reviewDeleteRequest({
      actor: { email: reviewer.email },
      requestCode,
      decision: 'approve',
      notes: 'Local rollback verification only',
      enabledRecordTypes: ['Placed student'],
      connection,
      previewOnly: true,
    });
    transactionOpen = false; // previewOnly rolled the entire transaction back.

    const [placementRows] = await connection.execute(
      `SELECT status FROM placement_tracker_records WHERE id = ? LIMIT 1`, [row.id],
    );
    const [openingRows] = await connection.execute(
      `SELECT COUNT(*) AS active_count FROM placement_tracker_records
       WHERE source_key = 'shared_placement' AND source_tab = 'Opening_Applied'
         AND student_id = ? AND vacancy_id = ? AND LOWER(COALESCE(status, '')) <> 'deleted'`,
      [row.student_id, row.vacancy_id],
    );
    const [requestRows] = await connection.execute(
      'SELECT COUNT(*) AS total FROM tpo_delete_requests WHERE request_code = ?', [requestCode],
    );
    const [auditRows] = await connection.execute(
      'SELECT COUNT(*) AS total FROM audit_events WHERE request_id = ?', [requestCode],
    );

    const result = {
      status: 'verified_then_rolled_back',
      reviewerAuthorizationPassed: true,
      approvalRan: outcome.status === 'Approved' && outcome.rolledBack === true,
      placementStillActive: String(placementRows[0]?.status || '').toLowerCase() === 'placed',
      linkedApplicationStillActive: Number(openingRows[0]?.active_count) === 1,
      temporaryRequestPersisted: Number(requestRows[0]?.total) !== 0,
      temporaryAuditPersisted: Number(auditRows[0]?.total) !== 0,
    };
    result.passed = result.approvalRan && result.placementStillActive && result.linkedApplicationStillActive
      && !result.temporaryRequestPersisted && !result.temporaryAuditPersisted;
    console.log(JSON.stringify(result, null, 2));
    if (!result.passed) process.exitCode = 1;
  } catch (error) {
    if (transactionOpen) await connection.rollback().catch(() => {});
    console.error(`Placement-approval rollback check failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    connection.release();
    await mysqlPool.close();
  }
}

main().catch(error => {
  console.error(`Placement-approval rollback check could not start: ${error.message}`);
  process.exitCode = 1;
});
