'use strict';

const crypto = require('crypto');
const mysqlPool = require('../src/mysqlPool');
const emailStore = require('../src/mysqlEmailStore');

async function main() {
  const host = String(process.env.MYSQL_HOST || '').trim().toLowerCase();
  const database = String(process.env.MYSQL_DATABASE || '').trim().toLowerCase();
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) || !['ipcs_portal', 'ipcs_portal_dev'].includes(database)) {
    throw new Error('This rollback check is limited to the local IPCS MySQL database. No records were changed.');
  }

  const pool = mysqlPool.getPool();
  const connection = await pool.getConnection();
  const id = crypto.randomUUID();
  const idempotencyKey = `codex-email-store-check:${id}`;
  let outboxId = '';
  let usageRecordId = '';
  try {
    const [activeRows] = await connection.execute(
      `SELECT COUNT(*) AS count FROM email_outbox WHERE status IN ('pending', 'sending')`,
    );
    if (Number(activeRows[0].count) !== 0) {
      throw new Error('The local database already has pending or sending email jobs. The queue-claim check was skipped without changing anything.');
    }

    const created = await emailStore.createOrReuseOutbox({
      idempotencyKey,
      senderKey: 'placement',
      emailCategory: 'placementNotification',
      encryptedPayload: JSON.stringify({ format: 'rollback-check', data: id }),
      context: { check: true },
      relatedEntityType: 'verification',
      relatedEntityId: id,
    });
    if (!created.created || !created.id) throw new Error('MySQL email outbox did not create a new row as expected.');
    outboxId = created.id;

    const duplicate = await emailStore.createOrReuseOutbox({
      idempotencyKey,
      senderKey: 'placement',
      emailCategory: 'placementNotification',
      encryptedPayload: JSON.stringify({ format: 'rollback-check', data: id }),
      context: { check: true },
    });
    if (duplicate.created || duplicate.id !== outboxId || duplicate.status !== 'sending') {
      throw new Error('The MySQL email idempotency guard did not return the existing delivery.');
    }

    await emailStore.recordAttempt({
      outboxId,
      senderKey: 'placement',
      senderEmail: 'placementcell.ipcs@gmail.com',
      emailCategory: 'placementNotification',
      provider: 'rollback-check',
      result: 'CHECKED',
      recipientCount: 1,
      subject: 'MySQL email storage verification',
      metadata: { noEmailSent: true },
    });
    usageRecordId = await emailStore.recordUsage({
      senderKey: 'placement',
      emailCategory: 'placementNotification',
      senderEmail: 'placementcell.ipcs@gmail.com',
      provider: 'rollback-check',
      recipientCount: 1,
      trackedRemaining: 99,
    });
    if (!usageRecordId) throw new Error('The MySQL email quota usage row was not stored.');
    await connection.execute('UPDATE email_outbox SET status = \'pending\', available_at = UTC_TIMESTAMP() - INTERVAL 1 SECOND WHERE id = ?', [outboxId]);
    const claimed = await emailStore.claimDueOutbox(1);
    if (claimed.length !== 1 || claimed[0].id !== outboxId || Number(claimed[0].attempts) !== 1) {
      throw new Error('The MySQL email worker did not claim the due synthetic row exactly once.');
    }
    await emailStore.appendMailLog({
      name: 'Synthetic verification',
      email: 'codex-email-store@example.invalid',
      type: 'MySQL persistence check',
      status: 'Checked',
      subject: 'MySQL email storage verification',
      senderKey: 'placement',
      provider: 'rollback-check',
      outboxId,
    });
    await emailStore.updateOutbox(outboxId, { status: 'sent', sentAt: new Date(), lastError: null });

    const [counts] = await connection.execute(
      `SELECT
         (SELECT COUNT(*) FROM email_outbox WHERE id = ? AND status = 'sent') AS outbox_rows,
         (SELECT COUNT(*) FROM email_delivery_attempts WHERE outbox_id = ?) AS attempt_rows,
         (SELECT COUNT(*) FROM mail_logs WHERE outbox_id = ?) AS mail_log_rows,
         (SELECT COUNT(*) FROM email_quota_usage WHERE id = ?) AS usage_rows`,
      [outboxId, outboxId, outboxId, usageRecordId],
    );
    const result = counts[0];
    if (Number(result.outbox_rows) !== 1 || Number(result.attempt_rows) !== 1
      || Number(result.mail_log_rows) !== 1 || Number(result.usage_rows) !== 1) {
      throw new Error('One or more MySQL email storage records did not reconcile.');
    }
    console.log(JSON.stringify({
      status: 'passed',
      outboxAndIdempotency: 'passed',
      dueQueueClaim: 'passed',
      providerAttempt: 'passed',
      quotaUsage: 'passed',
      mailHistory: 'passed',
      emailSent: false,
      syntheticRowsWillBeRemoved: true,
    }, null, 2));
  } finally {
    await connection.execute('DELETE FROM mail_logs WHERE outbox_id = ?', [outboxId]).catch(() => {});
    await connection.execute('DELETE FROM email_quota_usage WHERE id = ?', [usageRecordId]).catch(() => {});
    if (outboxId) await connection.execute('DELETE FROM email_outbox WHERE id = ?', [outboxId]).catch(() => {});
    if (outboxId) {
      const [remaining] = await connection.execute(
        `SELECT
           (SELECT COUNT(*) FROM email_outbox WHERE id = ?) AS outbox_rows,
           (SELECT COUNT(*) FROM email_delivery_attempts WHERE outbox_id = ?) AS attempt_rows,
           (SELECT COUNT(*) FROM mail_logs WHERE outbox_id = ?) AS mail_log_rows,
           (SELECT COUNT(*) FROM email_quota_usage WHERE id = ?) AS usage_rows`,
        [outboxId, outboxId, outboxId, usageRecordId],
      ).catch(() => [[{ outbox_rows: 1, attempt_rows: 1, mail_log_rows: 1, usage_rows: 1 }]]);
      if (Number(remaining[0]?.outbox_rows) || Number(remaining[0]?.attempt_rows)
        || Number(remaining[0]?.mail_log_rows) || Number(remaining[0]?.usage_rows)) {
        console.error('[MYSQL EMAIL CHECK] A synthetic verification row could not be removed.');
        process.exitCode = 1;
      }
    }
    connection.release();
    await mysqlPool.close();
  }
}

main().catch(error => {
  console.error(`MySQL email storage check failed: ${error.message}`);
  process.exitCode = 1;
});
