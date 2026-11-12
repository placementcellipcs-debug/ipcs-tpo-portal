const mysqlPool = require('../src/mysqlPool');
const placementTracker = require('../src/mysqlPlacementTracker');

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
  try {
    await connection.beginTransaction();
    const [candidates] = await connection.execute(
      `SELECT tr.source_row_number, tr.metadata, tr.roll_number, tr.student_name, tr.job_code,
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
    const result = await placementTracker.archivePlacedStudent({
      connection,
      actor: { id: row.actor_id, email: row.actor_email, full_name: row.actor_name, role: row.actor_role },
      rowNumber: Number(row.source_row_number),
      expected,
      requestId: 'LOCAL-ROLLBACK-CHECK',
    });
    await connection.rollback();
    rolledBack = true;
    console.log(JSON.stringify({
      status: 'verified_then_rolled_back',
      validTpoLogRow: Number(row.source_row_number) >= 2,
      matchingOpeningArchived: result.openingApplied,
      canonicalApplicationRestored: result.applicationRestored,
      persistedChanges: false,
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
