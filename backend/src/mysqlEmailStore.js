'use strict';

const crypto = require('crypto');
const mysqlPool = require('./mysqlPool');

const makeId = () => crypto.randomUUID();

async function createOrReuseOutbox({
  idempotencyKey,
  senderKey,
  emailCategory,
  encryptedPayload,
  context,
  relatedEntityType = null,
  relatedEntityId = null,
}) {
  const connection = await mysqlPool.getPool().getConnection();
  const proposedId = makeId();
  try {
    await connection.beginTransaction();
    await connection.execute(
      `INSERT INTO email_outbox
        (id, idempotency_key, sender_key, email_category, encrypted_payload, context_json, status,
         attempts, available_at, related_entity_type, related_entity_id)
       VALUES (?, ?, ?, ?, ?, CAST(? AS JSON), 'sending', 0, UTC_TIMESTAMP(), ?, ?)
       ON DUPLICATE KEY UPDATE id = id`,
      [proposedId, idempotencyKey, senderKey, emailCategory, encryptedPayload, JSON.stringify(context || {}), relatedEntityType, relatedEntityId],
    );
    const [rows] = await connection.execute(
      `SELECT id, status, attempts, last_error, sent_at
         FROM email_outbox WHERE idempotency_key = ? LIMIT 1 FOR UPDATE`,
      [idempotencyKey],
    );
    const row = rows[0];
    if (!row) throw new Error('The email record could not be saved to MySQL.');
    const created = row.id === proposedId;
    let retryingFailed = false;
    if (!created && row.status === 'failed') {
      await connection.execute(
        `UPDATE email_outbox
            SET sender_key = ?, email_category = ?, encrypted_payload = ?, context_json = CAST(? AS JSON),
                status = 'sending', attempts = 0, available_at = UTC_TIMESTAMP(), last_error = NULL,
                sent_at = NULL, related_entity_type = ?, related_entity_id = ?
          WHERE id = ? AND status = 'failed'`,
        [senderKey, emailCategory, encryptedPayload, JSON.stringify(context || {}), relatedEntityType, relatedEntityId, row.id],
      );
      retryingFailed = true;
      row.status = 'sending';
      row.attempts = 0;
      row.last_error = null;
    }
    await connection.commit();
    return { ...row, created, retryingFailed };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

async function updateOutbox(id, { status, availableAt, lastError, sentAt, attempts } = {}) {
  const assignments = ['status = ?'];
  const values = [status];
  if (availableAt !== undefined) { assignments.push('available_at = ?'); values.push(availableAt); }
  if (lastError !== undefined) { assignments.push('last_error = ?'); values.push(lastError); }
  if (sentAt !== undefined) { assignments.push('sent_at = ?'); values.push(sentAt); }
  if (attempts !== undefined) { assignments.push('attempts = ?'); values.push(attempts); }
  values.push(id);
  const [result] = await mysqlPool.query(`UPDATE email_outbox SET ${assignments.join(', ')} WHERE id = ?`, values);
  if (!result.affectedRows) throw new Error(`Email record ${id} no longer exists.`);
}

async function replaceEncryptedPayload(id, encryptedPayload) {
  const [result] = await mysqlPool.query(
    `UPDATE email_outbox SET encrypted_payload = ? WHERE id = ? AND status = 'sending'`,
    [encryptedPayload, id],
  );
  if (!result.affectedRows) throw new Error(`Email record ${id} could not be prepared for retry.`);
}

async function recordAttempt({
  outboxId,
  senderKey = null,
  senderEmail = null,
  emailCategory = null,
  provider = null,
  result,
  recipientCount = null,
  remainingQuota = null,
  subject = null,
  providerMessageId = null,
  errorMessage = null,
  metadata = null,
}) {
  await mysqlPool.query(
    `INSERT INTO email_delivery_attempts
      (id, outbox_id, attempted_at, sender_key, sender_email, email_category, provider, result,
       recipient_count, remaining_quota, subject, provider_message_id, error_message, metadata)
     VALUES (?, ?, UTC_TIMESTAMP(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))`,
    [makeId(), outboxId, senderKey, senderEmail, emailCategory, provider, result,
      recipientCount, remainingQuota === '' ? null : remainingQuota, subject, providerMessageId,
      errorMessage ? String(errorMessage).slice(0, 4000) : null, metadata ? JSON.stringify(metadata) : null],
  );
}

async function recordUsage({ senderKey, emailCategory, senderEmail, provider, recipientCount, trackedRemaining, appsScriptRemaining = null }) {
  const id = makeId();
  await mysqlPool.query(
    `INSERT INTO email_quota_usage
      (id, sender_key, email_category, sender_email, provider, recipient_count, tracked_remaining,
       apps_script_remaining, sent_at, metadata)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP(), NULL)`,
    [id, senderKey, emailCategory, senderEmail, provider, recipientCount,
      trackedRemaining, appsScriptRemaining === '' ? null : appsScriptRemaining],
  );
  return id;
}

async function rollingRecipientCount(senderKey) {
  const [rows] = await mysqlPool.query(
    `SELECT COALESCE(SUM(recipient_count), 0) AS used
       FROM email_quota_usage
      WHERE sender_key = ? AND sent_at >= UTC_TIMESTAMP() - INTERVAL 24 HOUR`,
    [senderKey],
  );
  return Number(rows[0]?.used || 0);
}

async function appendMailLog({ name, email, type, status, subject, senderKey = null, provider = null, outboxId = null, metadata = null }) {
  await mysqlPool.query(
    `INSERT INTO mail_logs
      (id, occurred_at, recipient_name, recipient_email, mail_type, subject, status, sender_key, provider, outbox_id, metadata)
     VALUES (?, UTC_TIMESTAMP(), ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))`,
    [makeId(), String(name || 'Unknown').slice(0, 200), String(email || 'Unknown').slice(0, 254),
      String(type || 'System Alert').slice(0, 100), String(subject || 'Notification').slice(0, 500),
      String(status || 'Unknown').slice(0, 120), senderKey, provider, outboxId,
      metadata ? JSON.stringify(metadata) : null],
  );
}

async function claimDueOutbox(limit = 20) {
  const connection = await mysqlPool.getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [stale] = await connection.execute(
      `SELECT id FROM email_outbox
        WHERE status = 'sending' AND updated_at < UTC_TIMESTAMP() - INTERVAL 30 MINUTE
        ORDER BY updated_at LIMIT ? FOR UPDATE SKIP LOCKED`,
      [Math.max(1, Math.min(100, Number(limit) || 20))],
    );
    if (stale.length) {
      const ids = stale.map(row => row.id);
      await connection.query(
        `UPDATE email_outbox
            SET status = 'review', last_error = 'Worker stopped during delivery. Check the recipient before retrying to avoid a duplicate.'
          WHERE id IN (?) AND status = 'sending'`,
        [ids],
      );
    }
    const [rows] = await connection.execute(
      `SELECT id, sender_key, email_category, encrypted_payload, context_json, attempts, last_error, created_at,
              related_entity_type, related_entity_id
         FROM email_outbox
        WHERE status = 'pending' AND available_at <= UTC_TIMESTAMP()
        ORDER BY available_at, created_at LIMIT ? FOR UPDATE SKIP LOCKED`,
      [Math.max(1, Math.min(100, Number(limit) || 20))],
    );
    for (const row of rows) {
      await connection.execute(
        `UPDATE email_outbox SET status = 'sending', attempts = attempts + 1 WHERE id = ? AND status = 'pending'`,
        [row.id],
      );
      row.attempts = Number(row.attempts || 0) + 1;
    }
    await connection.commit();
    return rows;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  appendMailLog,
  claimDueOutbox,
  createOrReuseOutbox,
  recordAttempt,
  recordUsage,
  replaceEncryptedPayload,
  rollingRecipientCount,
  updateOutbox,
};
