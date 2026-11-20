'use strict';

const assert = require('node:assert/strict');
const mysqlPool = require('../src/mysqlPool');
const mysqlEmailStore = require('../src/mysqlEmailStore');

async function main() {
  const pool = mysqlPool.getPool();
  try {
    const [[counts]] = await pool.execute(
      `SELECT (SELECT COUNT(*) FROM mail_logs WHERE source_key = 'shared_operations') AS mail_logs,
              (SELECT COUNT(*) FROM email_delivery_attempts WHERE source_key = 'shared_operations') AS delivery_attempts,
              (SELECT COUNT(*) FROM email_quota_usage WHERE source_key = 'shared_operations') AS quota_rows,
              (SELECT COUNT(*) FROM email_queue_history WHERE source_key = 'shared_operations') AS historical_queue_rows,
              (SELECT COUNT(*) FROM email_delivery_attempts WHERE source_key = 'shared_operations' AND outbox_id IS NULL) AS attempts_without_live_outbox`,
    );
    assert.equal(Number(counts.mail_logs), 2637);
    assert.equal(Number(counts.delivery_attempts), 1203);
    assert.equal(Number(counts.quota_rows), 1751);
    assert.equal(Number(counts.historical_queue_rows), 101);
    assert.equal(Number(counts.attempts_without_live_outbox), 1203);

    const [senders] = await pool.execute(
      `SELECT DISTINCT sender_key FROM email_quota_usage
        WHERE source_key = 'shared_operations' AND sender_key IS NOT NULL`,
    );
    const rollingUsageCounts = [];
    for (const row of senders) {
      const used = await mysqlEmailStore.rollingRecipientCount(row.sender_key);
      assert.ok(Number.isFinite(used));
      rollingUsageCounts.push(used);
    }

    const [queueStatuses] = await pool.execute(
      `SELECT status, COUNT(*) AS row_count FROM email_queue_history
        WHERE source_key = 'shared_operations' GROUP BY status`,
    );
    const statusCounts = Object.fromEntries(queueStatuses.map(row => [row.status, Number(row.row_count)]));
    assert.equal(Object.values(statusCounts).reduce((sum, value) => sum + value, 0), 101);

    console.log(JSON.stringify({
      status: 'passed',
      importedRows: {
        mailLogs: Number(counts.mail_logs),
        deliveryAttempts: Number(counts.delivery_attempts),
        quotaEvents: Number(counts.quota_rows),
        historicalQueueRows: Number(counts.historical_queue_rows),
      },
      distinctSenderKeys: senders.length,
      rollingRecipientTotalsRead: rollingUsageCounts.length,
      historicalQueueStatuses: statusCounts,
      activeSenderQueueWrites: 0,
    }, null, 2));
    console.log('Read-only mail-store check; no addresses, messages, credentials, or deliveries were exposed or changed.');
  } finally {
    await mysqlPool.close();
  }
}

main().catch(async error => {
  console.error(`Mail-history check failed: ${error.message}`);
  await mysqlPool.close().catch(() => {});
  process.exitCode = 1;
});
