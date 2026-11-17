const mysqlPool = require('../src/mysqlPool');
const placementTracker = require('../src/mysqlPlacementTracker');
const crypto = require('crypto');

function recordFields(metadata) {
  const value = typeof metadata === 'string' ? JSON.parse(metadata || '{}') : metadata;
  return value?.fields || {};
}

function field(fields, name) {
  const key = Object.keys(fields || {}).find(candidate => candidate.toLowerCase().replace(/[^a-z0-9]/g, '') === name.toLowerCase().replace(/[^a-z0-9]/g, ''));
  return String((key ? fields[key] : '') || '').trim();
}

async function main() {
  const pool = mysqlPool.getPool();
  const connection = await pool.getConnection();
  let rolledBack = false;
  let applicationId = '';
  let createdApplication = false;
  let originalApplicationStatus = '';
  try {
    await connection.beginTransaction();
    const [candidates] = await connection.execute(
      `SELECT tr.source_row_number, tr.student_id, tr.vacancy_id, tr.metadata, tr.roll_number, tr.student_name, tr.job_code,
              tr.company_name, tr.position_title, u.id AS actor_id, u.email AS actor_email,
              u.full_name AS actor_name, u.role AS actor_role
       FROM placement_tracker_records tr
       JOIN users u ON u.id = tr.owner_tpo_user_id
       WHERE tr.source_key = 'shared_placement' AND tr.source_tab = 'TPO_Log'
         AND LOWER(TRIM(COALESCE(tr.status, ''))) = 'placed'
         AND tr.student_id IS NOT NULL AND tr.vacancy_id IS NOT NULL
         AND (SELECT COUNT(*) FROM placement_tracker_records oa
              WHERE oa.source_key = tr.source_key AND oa.source_tab = 'Opening_Applied'
                AND oa.student_id = tr.student_id AND oa.vacancy_id = tr.vacancy_id
                AND LOWER(COALESCE(oa.status, '')) <> 'deleted') = 1
         AND u.status = 'active' AND u.role = 'tpo'
       ORDER BY tr.source_row_number LIMIT 1`,
    );
    const row = candidates[0];
    if (!row) throw new Error('No active TPO-owned placement row is available for the rollback check.');
    const fields = recordFields(row.metadata);
    const expected = {
      name: String(row.student_name || field(fields, 'Student Name')),
      roll: String(row.roll_number || field(fields, 'Roll Number')),
      jobId: String(row.job_code || field(fields, 'Job ID')),
      company: String(row.company_name || field(fields, 'Company Name')),
      position: String(row.position_title || field(fields, 'Position')),
    };

    const [applications] = await connection.execute(
      'SELECT id, status FROM job_applications WHERE student_id = ? AND vacancy_id = ? LIMIT 1 FOR UPDATE',
      [row.student_id, row.vacancy_id],
    );
    if (applications[0]) {
      applicationId = applications[0].id;
      originalApplicationStatus = String(applications[0].status || 'Applied');
      await connection.execute("UPDATE job_applications SET status = 'placed' WHERE id = ?", [applicationId]);
    } else {
      applicationId = crypto.randomUUID();
      createdApplication = true;
      await connection.execute(
        `INSERT INTO job_applications
           (id, student_id, vacancy_id, owner_tpo_user_id, status, source, source_record_key, metadata)
         VALUES (?, ?, ?, ?, 'placed', 'rollback_check', ?, CAST(? AS JSON))`,
        [applicationId, row.student_id, row.vacancy_id, row.actor_id,
          `placement-delete:${applicationId}`, JSON.stringify({ source: 'rollback_check' })],
      );
      originalApplicationStatus = 'applied';
    }
    await connection.execute(
      `INSERT INTO application_status_history
         (id, application_id, previous_status, new_status, note, actor_user_id, occurred_at, metadata)
       VALUES (?, ?, 'applied', 'placed', 'Placement delete rollback check setup.', ?, UTC_TIMESTAMP(), CAST(? AS JSON))`,
      [crypto.randomUUID(), applicationId, row.actor_id, JSON.stringify({ source: 'rollback_check' })],
    );

    const result = await placementTracker.archivePlacedStudent({
      connection,
      actor: { id: row.actor_id, email: row.actor_email, full_name: row.actor_name, role: row.actor_role },
      rowNumber: Number(row.source_row_number),
      expected,
      requestId: 'LOCAL-ROLLBACK-CHECK',
    });
    if (!result.openingApplied) throw new Error('The matching Opening_Applied record was not archived.');
    if (!result.applicationRestored) throw new Error('The canonical application was not restored from Placed.');
    const [restoredRows] = await connection.execute(
      'SELECT status FROM job_applications WHERE id = ? LIMIT 1', [applicationId],
    );
    if (String(restoredRows[0]?.status || '').toLowerCase() !== originalApplicationStatus.toLowerCase()) {
      throw new Error('The canonical application status was not restored to its previous value.');
    }
    const [historyRows] = await connection.execute(
      `SELECT COUNT(*) AS count FROM application_status_history
       WHERE application_id = ? AND note = 'Placement record removed after review.'`, [applicationId],
    );
    if (Number(historyRows[0]?.count) < 1) throw new Error('The application correction was not written to status history.');

    await connection.rollback();
    rolledBack = true;
    const [persistedRows] = await connection.execute(
      'SELECT COUNT(*) AS count FROM job_applications WHERE id = ?', [applicationId],
    );
    if (createdApplication && Number(persistedRows[0]?.count) !== 0) {
      throw new Error('The rollback-only canonical application remained in the database.');
    }
    if (!createdApplication) {
      const [originalRows] = await connection.execute(
        'SELECT status FROM job_applications WHERE id = ? LIMIT 1', [applicationId],
      );
      if (String(originalRows[0]?.status || '').toLowerCase() !== originalApplicationStatus.toLowerCase()) {
        throw new Error('The pre-existing canonical application was changed after rollback.');
      }
    }
    console.log(JSON.stringify({
      status: 'verified_then_rolled_back',
      validTpoLogRow: Number(row.source_row_number) >= 2,
      matchingOpeningArchived: result.openingApplied,
      canonicalApplicationRestored: result.applicationRestored,
      applicationHistoryRecorded: Number(historyRows[0].count) >= 1,
      existingApplicationRestoredAfterRollback: !createdApplication,
      persistedChanges: false,
      passed: true,
    }, null, 2));
  } catch (error) {
    if (!rolledBack) await connection.rollback().catch(() => {});
    console.error(`Placement-delete rollback check failed: ${error.message}`);
    process.exitCode = 1;
  } finally {
    connection.release();
    await mysqlPool.close();
  }
}

main().catch(error => { console.error(`Placement-delete rollback check could not start: ${error.message}`); process.exitCode = 1; });
