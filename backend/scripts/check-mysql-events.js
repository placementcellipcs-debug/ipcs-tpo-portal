const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const mysqlPool = require('../src/mysqlPool');
const events = require('../src/mysqlEventsService');

async function main() {
  const host = String(process.env.MYSQL_HOST || '').trim().toLowerCase();
  const database = String(process.env.MYSQL_DATABASE || '').trim().toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) || !['ipcs_portal_dev', 'ipcs_portal'].includes(database)) {
    throw new Error('This rollback-only check is restricted to the configured local IPCS MySQL database.');
  }
  const connection = await mysqlPool.getPool().getConnection();
  const suffix = crypto.randomUUID();
  const eventId = `CODEX-EVENT-${suffix}`;
  const branchId = crypto.randomUUID();
  const tpoUserId = crypto.randomUUID();
  const managerUserId = crypto.randomUUID();
  const tpoEmail = `event-check-tpo-${suffix}@example.invalid`;
  const managerEmail = `event-check-manager-${suffix}@example.invalid`;
  let driveId = '';
  try {
    await connection.beginTransaction();
    await connection.execute('INSERT INTO branches (id, name, normalized_name) VALUES (?, ?, ?)',
      [branchId, `Event Check ${suffix}`, `event check ${suffix}`.toLowerCase()]);
    await connection.execute(
      `INSERT INTO users (id, email, normalized_email, role, full_name, status, sitting_branch_id)
       VALUES (?, ?, ?, 'tpo', 'Synthetic Event TPO', 'active', ?), (?, ?, ?, 'branch manager', 'Synthetic Event Manager', 'active', ?)`,
      [tpoUserId, tpoEmail, tpoEmail, branchId, managerUserId, managerEmail, managerEmail, branchId],
    );
    await connection.execute('INSERT INTO user_branch_assignments (user_id, branch_id) VALUES (?, ?), (?, ?)',
      [tpoUserId, branchId, managerUserId, branchId]);
    const recipients = await events.eventRecipients({ branch: `Event Check ${suffix}`, tpoName: 'Synthetic Event TPO', connection });
    assert.ok(recipients.tpos.includes(tpoEmail));
    assert.ok(recipients.assignedTpo.includes(tpoEmail));
    assert.equal(recipients.branchManager, managerEmail);
    assert.ok(recipients.branchManagers.includes(managerEmail));

    const created = await events.createEvent({
      fields: {
        'Date of the Event': '15/12/2026', TPO: 'Synthetic Event TPO', Branch: `Event Check ${suffix}`,
        Course: 'Digital Marketing', Event: 'Placement Drive', Title: `Synthetic event ${suffix.slice(0, 8)}`,
        Descripation: 'Rollback-only MySQL event check.', 'Time of the Event': '10:00 AM',
        'Event Happening in': 'Local test venue', Event_ID: eventId, Created_By: 'test@example.invalid', Status: 'Scheduled',
      },
      actorEmail: tpoEmail, requestId: `check-${suffix}`, connection,
    });
    driveId = created.id;
    assert.equal(created.eventId, eventId);
    assert.equal(created.status, 'Scheduled');
    const [[createdTime]] = await connection.execute("SELECT DATE_FORMAT(starts_at, '%Y-%m-%d %H:%i:%s') AS starts_at FROM drives WHERE id = ?", [driveId]);
    assert.equal(createdTime.starts_at, '2026-12-15 04:30:00');

    const listed = await events.listEvents(connection);
    assert.equal(listed.filter(item => item.eventId === eventId).length, 1);

    const rescheduled = await events.updateEventStatus({
      eventKey: eventId, status: 'Rescheduled', reason: 'Synthetic schedule update.',
      date: '2026-12-16', time: '11:30', actor: { name: 'Synthetic Event TPO', email: tpoEmail },
      requestId: `check-${suffix}`, connection,
    });
    assert.equal(rescheduled.event.status, 'Rescheduled');
    assert.equal(rescheduled.event.date, '16/12/2026');
    assert.equal(rescheduled.event.time, '11:30');
    const [[rescheduledTime]] = await connection.execute("SELECT DATE_FORMAT(starts_at, '%Y-%m-%d %H:%i:%s') AS starts_at FROM drives WHERE id = ?", [driveId]);
    assert.equal(rescheduledTime.starts_at, '2026-12-16 06:00:00');

    const cancelled = await events.updateEventStatus({
      eventKey: eventId, status: 'Cancelled', reason: 'Rollback check completed.',
      actor: { name: 'Synthetic Event TPO', email: tpoEmail }, requestId: `check-${suffix}`, connection,
    });
    assert.equal(cancelled.event.status, 'Cancelled');
    await events.setMailStatus({ eventKey: eventId, status: 'CANCELLED NOTICE SENT', connection });

    const [[drive]] = await connection.execute('SELECT status, metadata FROM drives WHERE id = ?', [driveId]);
    assert.equal(drive.status, 'closed');
    const metadata = typeof drive.metadata === 'string' ? JSON.parse(drive.metadata) : drive.metadata;
    assert.equal(metadata.fields.Mail_Status, 'CANCELLED NOTICE SENT');
    const [[audit]] = await connection.execute("SELECT COUNT(*) AS count FROM audit_events WHERE entity_type = 'drive' AND entity_id = ?", [driveId]);
    assert.equal(Number(audit.count), 3);

    await connection.rollback();
    const [[persisted]] = await connection.execute('SELECT COUNT(*) AS count FROM drives WHERE id = ?', [driveId]);
    const [[persistedAudit]] = await connection.execute("SELECT COUNT(*) AS count FROM audit_events WHERE entity_type = 'drive' AND entity_id = ?", [driveId]);
    const [[persistedSetup]] = await connection.execute(
      `SELECT (SELECT COUNT(*) FROM branches WHERE id = ?) AS branches,
              (SELECT COUNT(*) FROM users WHERE id IN (?, ?)) AS users,
              (SELECT COUNT(*) FROM user_branch_assignments WHERE user_id IN (?, ?)) AS assignments`,
      [branchId, tpoUserId, managerUserId, tpoUserId, managerUserId],
    );
    assert.equal(Number(persisted.count), 0);
    assert.equal(Number(persistedAudit.count), 0);
    for (const count of Object.values(persistedSetup)) assert.equal(Number(count), 0);
    console.log('TPO event MySQL check passed: active TPO/BM recipients, create, list, reschedule, cancel, mail status, audit, and rollback verified; no test rows remain.');
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
    await mysqlPool.close();
  }
}

main().catch(error => {
  console.error(`TPO event MySQL check failed: ${error.message}`);
  process.exitCode = 1;
});
