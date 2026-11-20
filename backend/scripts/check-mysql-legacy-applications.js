const assert = require('node:assert/strict');
const mysqlPool = require('../src/mysqlPool');
const placementTracker = require('../src/mysqlPlacementTracker');
const studentDirectory = require('../src/mysqlStudentDirectoryService');

const text = value => String(value ?? '').trim();

async function main() {
  const connection = await mysqlPool.getPool().getConnection();
  try {
    const [[counts]] = await connection.execute(
      `SELECT
         (SELECT COUNT(*) FROM placement_tracker_records
          WHERE source_key = 'shared_placement' AND source_tab = 'Opening_Applied') AS source_rows,
         (SELECT COUNT(*) FROM source_sheet_records
          WHERE source_key = 'shared_placement' AND tab_name = 'Opening_Applied') AS archived_source_rows,
         (SELECT COUNT(*) FROM source_sheet_records
          WHERE source_key = 'shared_placement' AND tab_name = 'TPO_Log') AS archived_tpo_log_rows,
         (SELECT COUNT(*) FROM placement_tracker_records tr
          WHERE tr.source_key = 'shared_placement' AND tr.source_tab = 'Opening_Applied'
            AND EXISTS (SELECT 1 FROM job_applications ja
                        WHERE ja.source = 'legacy_opening_applied'
                          AND ja.student_id = tr.student_id AND ja.vacancy_id = tr.vacancy_id)) AS linked_rows_normalized,
         (SELECT COUNT(*) FROM placement_tracker_records tr
          WHERE tr.source_key = 'shared_placement' AND tr.source_tab = 'Opening_Applied'
            AND NOT EXISTS (SELECT 1 FROM job_applications ja
                            WHERE ja.source = 'legacy_opening_applied'
                              AND ja.student_id = tr.student_id AND ja.vacancy_id = tr.vacancy_id)) AS archive_only_rows,
         (SELECT COUNT(*) FROM job_applications WHERE source = 'legacy_opening_applied') AS canonical_apps,
         (SELECT COUNT(*) FROM application_status_history
          WHERE source_key = 'shared_placement' AND source_tab = 'Opening_Applied') AS history_events,
         (SELECT COUNT(*) FROM (
            SELECT student_id, vacancy_id FROM job_applications
            WHERE source = 'legacy_opening_applied'
            GROUP BY student_id, vacancy_id HAVING COUNT(*) > 1
          ) duplicate_pairs) AS duplicate_pairs,
         (SELECT COUNT(*) FROM (
            SELECT source_row_number, source_event_index FROM application_status_history
            WHERE source_key = 'shared_placement' AND source_tab = 'Opening_Applied'
            GROUP BY source_row_number, source_event_index HAVING COUNT(*) > 1
          ) duplicate_events) AS duplicate_history_keys,
         (SELECT COUNT(*) FROM job_applications ja
          WHERE ja.source = 'legacy_opening_applied'
            AND NOT EXISTS (SELECT 1 FROM application_status_history ash WHERE ash.application_id = ja.id)) AS apps_without_history`,
    );
    const actual = Object.fromEntries(Object.entries(counts).map(([key, value]) => [key, Number(value || 0)]));
    assert.equal(actual.source_rows, actual.archived_source_rows, 'all Opening_Applied source rows should be represented in the tracker table');
    assert.equal(actual.linked_rows_normalized + actual.archive_only_rows, actual.source_rows,
      'each source row should either resolve to a canonical application or remain archive-only');
    assert.ok(actual.canonical_apps > 0, 'canonical applications should be present');
    assert.ok(actual.history_events >= actual.canonical_apps, 'application status history should contain at least one event per canonical application');
    assert.ok(actual.apps_without_history <= actual.canonical_apps, 'status-history gaps cannot exceed the canonical application set');

    const [historyGapStatuses] = await connection.execute(
      `SELECT COALESCE(NULLIF(tr.status, ''), '(blank)') AS source_status, COUNT(*) AS applications
       FROM job_applications ja
       LEFT JOIN application_status_history ash ON ash.application_id = ja.id
       LEFT JOIN placement_tracker_records tr
         ON tr.source_key = 'shared_placement' AND tr.source_tab = 'Opening_Applied'
        AND tr.source_row_number = CAST(JSON_UNQUOTE(JSON_EXTRACT(ja.metadata, '$.migration.sourceRows[0]')) AS UNSIGNED)
       WHERE ja.source = 'legacy_opening_applied' AND ash.id IS NULL
       GROUP BY source_status ORDER BY source_status`,
    );
    assert.equal(actual.duplicate_pairs, 0, 'canonical application pairs should be unique');
    assert.equal(actual.duplicate_history_keys, 0, 'historical source event keys should be unique');

    const [[ownershipCounts]] = await connection.execute(
      `SELECT COUNT(*) AS total,
              SUM(owner_tpo_user_id IS NOT NULL) AS assigned,
              SUM(owner_tpo_user_id IS NULL) AS unassigned
       FROM job_applications WHERE source = 'legacy_opening_applied'`,
    );
    const expectedAssigned = Number(ownershipCounts.assigned || 0);

    const [admins] = await connection.execute(
      "SELECT email FROM users WHERE status <> 'inactive' ORDER BY id LIMIT 1",
    );
    assert.ok(admins[0]?.email, 'a current user account should exist for the read-only portal service check');
    const listed = await placementTracker.listApplications({
      user: { email: admins[0].email }, isAdmin: true, isTpo: false, connection,
    });
    const canonicalVisible = listed.filter(row => row.origin === 'legacy_opening_applied').length;
    assert.equal(canonicalVisible, actual.canonical_apps, 'TPO tracker service should expose each canonical legacy application once');
    assert.equal(listed.length, actual.canonical_apps + actual.archive_only_rows,
      'TPO tracker service should hide consolidated duplicates while keeping unresolved archive-only rows visible to admins');

    const directory = await studentDirectory.loadDirectoryRows({ connection });
    assert.equal(directory.applications.length, actual.canonical_apps + actual.archive_only_rows,
      'student directory should list consolidated applications and retain unresolved rows without duplicating linked pairs');
    assert.equal(directory.tpoLogs.length, actual.archived_tpo_log_rows, 'student directory should retain all archived TPO log history rows');

    const [tpos] = await connection.execute(
      "SELECT id, email FROM users WHERE role = 'tpo' AND status <> 'inactive' ORDER BY id",
    );
    const tpoVisibility = new Map();
    for (const tpo of tpos) {
      const visible = await placementTracker.listApplications({
        user: { email: tpo.email }, isAdmin: false, isTpo: true, connection,
      });
      for (const row of visible) {
        if (row.origin !== 'legacy_opening_applied') continue;
        tpoVisibility.set(row.recordId, (tpoVisibility.get(row.recordId) || 0) + 1);
      }
    }
    const duplicateTpoVisibility = [...tpoVisibility.values()].filter(count => count > 1).length;
    assert.equal(tpoVisibility.size, expectedAssigned,
      'every assigned legacy application should be visible to exactly one active TPO');
    assert.equal(duplicateTpoVisibility, 0, 'no legacy application should appear under multiple TPO accounts');

    console.log(JSON.stringify({
      status: 'passed',
      ...actual,
      canonicalApplicationsWithoutStatusHistory: actual.apps_without_history,
      missingHistorySourceStatusCounts: historyGapStatuses.map(row => ({ status: row.source_status, count: Number(row.applications || 0) })),
      canonicalApplicationsAssignedToTpo: expectedAssigned,
      canonicalApplicationsWithoutResolvedTpo: Number(ownershipCounts.unassigned || 0),
      canonicalApplicationsVisibleUnderExactlyOneTpo: tpoVisibility.size,
      tpoPortalVisibleCanonicalApplications: canonicalVisible,
      tpoPortalVisibleApplicationAndArchiveRows: listed.length,
      studentDirectoryVisibleApplicationsAndArchiveRows: directory.applications.length,
      studentDirectoryTpoHistoryRows: directory.tpoLogs.length,
      writesPerformed: 0,
      personLevelDetailsPrinted: false,
    }, null, 2));
  } finally {
    connection.release();
    await mysqlPool.close();
  }
}

main().catch(error => {
  console.error(`Legacy application check failed: ${text(error.message)}`);
  process.exitCode = 1;
});
