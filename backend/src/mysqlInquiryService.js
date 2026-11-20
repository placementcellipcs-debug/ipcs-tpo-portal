const crypto = require('crypto');
const mysqlPool = require('./mysqlPool');

const TYPES = {
  corporate_training: { sourceTab: 'Corporate Training Inquiries' },
  hiring: { sourceTab: 'Hiring Inquiries' },
};
const text = value => String(value ?? '');
const normalize = value => text(value).trim().toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
const headerKey = value => normalize(value).replace(/[^a-z0-9]/g, '');

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function fieldValue(fields, ...aliases) {
  const keys = new Set(aliases.map(headerKey));
  for (const [key, value] of Object.entries(fields || {})) {
    if (keys.has(headerKey(key)) && value !== undefined && value !== null) return value;
  }
  return '';
}

function toSheetRow(fields, rowNumber = 0) {
  const headers = Object.keys(fields || {});
  return {
    _worksheet: { headerValues: headers },
    _rawData: headers.map(header => text(fields[header])),
    rowNumber,
  };
}

function runtimeFields(row) {
  return parseJson(row.fields_json, {});
}

function toRuntimeRecord(row) {
  const fields = runtimeFields(row);
  return { id: String(row.id), inquiryId: text(row.inquiry_id), type: row.inquiry_type, fields, row: toSheetRow(fields) };
}

async function archivedRows(type, { connection = null } = {}) {
  const sourceTab = TYPES[type]?.sourceTab;
  if (!sourceTab) return [];
  const query = connection ? connection.execute.bind(connection) : mysqlPool.query;
  const [manifestRows] = await query(
    `SELECT headers_json FROM source_sheet_manifest WHERE source_key = 'shared_placement' AND tab_name = ? LIMIT 1`,
    [sourceTab],
  );
  if (!manifestRows.length) return [];
  const headers = parseJson(manifestRows[0].headers_json, []);
  const [sourceRows] = await query(
    `SELECT sheet_row_number, row_data_json FROM source_sheet_records
     WHERE source_key = 'shared_placement' AND tab_name = ? ORDER BY sheet_row_number`, [sourceTab],
  );
  return sourceRows.map(sourceRow => {
    const data = parseJson(sourceRow.row_data_json, {});
    const cells = Array.isArray(data.cells) ? data.cells : [];
    const fields = Object.fromEntries(headers.map((header, index) => [header, text(cells[index] ?? '')]));
    return { inquiryId: text(fieldValue(fields, 'Inquiry ID')), type, fields, row: toSheetRow(fields, Number(sourceRow.sheet_row_number)) };
  }).filter(record => record.inquiryId);
}

async function getInquiry(type, inquiryId, { connection = null } = {}) {
  if (!TYPES[type]) throw new Error('Unknown inquiry type.');
  const query = connection ? connection.execute.bind(connection) : mysqlPool.query;
  const [rows] = await query(
    `SELECT id, inquiry_id, inquiry_type, fields_json FROM portal_inquiries
     WHERE inquiry_type = ? AND inquiry_id = ? LIMIT 1`, [type, String(inquiryId)],
  );
  if (rows[0]) return toRuntimeRecord(rows[0]);
  return (await archivedRows(type, { connection })).find(record => record.inquiryId === String(inquiryId)) || null;
}

async function createInquiry({ type, inquiryId, submittedAt, fields }) {
  if (!TYPES[type]) throw new Error('Unknown inquiry type.');
  const recordId = crypto.randomUUID();
  const normalizedFields = { ...fields };
  await mysqlPool.query(
    `INSERT INTO portal_inquiries
     (id, inquiry_id, inquiry_type, submitted_at_raw, status, assigned_name, assigned_email,
      assigned_branch, assigned_at_raw, assigned_by, notification_status, notification_sent_at_raw,
      internal_email_status, fields_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [recordId, inquiryId, type, submittedAt, text(fieldValue(normalizedFields, 'Status') || 'New'),
      text(fieldValue(normalizedFields, 'Assigned TPO') || '') || null,
      text(fieldValue(normalizedFields, 'Assigned TPO Email') || '') || null,
      text(fieldValue(normalizedFields, 'Assigned Branch') || '') || null,
      text(fieldValue(normalizedFields, 'Assigned At') || '') || null,
      text(fieldValue(normalizedFields, 'Assigned By') || '') || null,
      text(fieldValue(normalizedFields, 'Notification Status') || '') || null,
      text(fieldValue(normalizedFields, 'Notification Sent At') || '') || null,
      text(fieldValue(normalizedFields, 'Internal Email Status') || '') || null,
      JSON.stringify(normalizedFields)],
  );
  return { id: recordId, inquiryId, type, fields: normalizedFields, row: toSheetRow(normalizedFields) };
}

async function updateInquiry(type, inquiryId, updates, { actor = null } = {}) {
  if (!TYPES[type]) throw new Error('Unknown inquiry type.');
  const connection = await mysqlPool.getPool().getConnection();
  try {
    await connection.beginTransaction();
    let [rows] = await connection.execute(
      `SELECT id, inquiry_id, inquiry_type, fields_json FROM portal_inquiries
       WHERE inquiry_type = ? AND inquiry_id = ? LIMIT 1 FOR UPDATE`, [type, String(inquiryId)],
    );
    if (!rows.length) {
      const archived = (await archivedRows(type, { connection })).find(record => record.inquiryId === String(inquiryId));
      if (!archived) throw Object.assign(new Error('This inquiry could not be found.'), { status: 404 });
      const id = crypto.randomUUID();
      const fields = archived.fields;
      await connection.execute(
        `INSERT INTO portal_inquiries
         (id, inquiry_id, inquiry_type, submitted_at_raw, status, assigned_name, assigned_email,
          assigned_branch, assigned_at_raw, assigned_by, notification_status, notification_sent_at_raw,
          internal_email_status, fields_json)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, inquiryId, type, text(fieldValue(fields, 'Submitted At')), text(fieldValue(fields, 'Status') || 'New'),
          text(fieldValue(fields, 'Assigned TPO') || '') || null,
          text(fieldValue(fields, 'Assigned TPO Email') || '') || null,
          text(fieldValue(fields, 'Assigned Branch') || '') || null,
          text(fieldValue(fields, 'Assigned At') || '') || null,
          text(fieldValue(fields, 'Assigned By') || '') || null,
          text(fieldValue(fields, 'Notification Status') || '') || null,
          text(fieldValue(fields, 'Notification Sent At') || '') || null,
          text(fieldValue(fields, 'Internal Email Status') || '') || null, JSON.stringify(fields)],
      );
      [rows] = await connection.execute(
        `SELECT id, inquiry_id, inquiry_type, fields_json FROM portal_inquiries
         WHERE inquiry_type = ? AND inquiry_id = ? LIMIT 1 FOR UPDATE`, [type, String(inquiryId)],
      );
    }

    const current = toRuntimeRecord(rows[0]);
    const next = { ...current.fields, ...updates };
    const submittedAt = text(fieldValue(next, 'Submitted At'));
    await connection.execute(
      `UPDATE portal_inquiries SET submitted_at_raw = ?, status = ?, assigned_name = ?, assigned_email = ?, assigned_branch = ?,
          assigned_at_raw = ?, assigned_by = ?, notification_status = ?, notification_sent_at_raw = ?,
          internal_email_status = ?, fields_json = ? WHERE id = ?`,
      [submittedAt, text(fieldValue(next, 'Status') || 'New'),
        text(fieldValue(next, 'Assigned TPO') || '') || null,
        text(fieldValue(next, 'Assigned TPO Email') || '') || null,
        text(fieldValue(next, 'Assigned Branch') || '') || null,
        text(fieldValue(next, 'Assigned At') || '') || null,
        text(fieldValue(next, 'Assigned By') || '') || null,
        text(fieldValue(next, 'Notification Status') || '') || null,
        text(fieldValue(next, 'Notification Sent At') || '') || null,
        text(fieldValue(next, 'Internal Email Status') || '') || null, JSON.stringify(next), rows[0].id],
    );
    const actorEmail = normalize(actor?.email);
    const [actors] = actorEmail ? await connection.execute('SELECT id FROM users WHERE normalized_email = ? LIMIT 1', [actorEmail]) : [[]];
    await connection.execute(
      `INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, occurred_at, request_id, details)
       VALUES (?, ?, 'portal_inquiry_updated', 'portal_inquiry', ?, UTC_TIMESTAMP(), ?, ?)`,
      [crypto.randomUUID(), actors[0]?.id || null, rows[0].id,
        text(actor?.requestId || '').trim() || null, JSON.stringify({ type, fields: Object.keys(updates) })],
    );
    await connection.commit();
    return { id: String(rows[0].id), inquiryId: String(inquiryId), type, fields: next, row: toSheetRow(next) };
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally { connection.release(); }
}

async function listInquiries(type) {
  if (!TYPES[type]) throw new Error('Unknown inquiry type.');
  const [runtimeRows] = await mysqlPool.query(
    `SELECT id, inquiry_id, inquiry_type, fields_json FROM portal_inquiries
     WHERE inquiry_type = ? ORDER BY created_at DESC, inquiry_id DESC`, [type],
  );
  const runtime = runtimeRows.map(toRuntimeRecord);
  const runtimeIds = new Set(runtime.map(record => record.inquiryId));
  const archived = await archivedRows(type);
  // Runtime rows come first (newest first); archived source rows are older and
  // retain their original sheet order in the database snapshot.
  return [...runtime.map(record => record.row),
    ...archived.filter(record => !runtimeIds.has(record.inquiryId)).reverse().map(record => record.row)];
}

async function resolveBranch(branchName) {
  const key = normalize(branchName);
  if (!key) return null;
  const alternate = key.replace(/ branch(?: campus)?$/i, '').trim();
  const [branches] = await mysqlPool.query(
    'SELECT id, name, metadata FROM branches WHERE normalized_name IN (?, ?) ORDER BY CASE WHEN normalized_name = ? THEN 0 ELSE 1 END LIMIT 1',
    [key, alternate, key],
  );
  const branch = branches[0];
  if (!branch) return null;
  const metadata = parseJson(branch.metadata);
  const fields = metadata.fields || {};
  let email = text(fieldValue(fields, 'Email', 'Branch Email', 'Mail ID', 'Email ID')).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const [users] = await mysqlPool.query(
      `SELECT u.email, u.role FROM users u
       LEFT JOIN user_branch_assignments uba ON uba.user_id = u.id
       WHERE u.status = 'active' AND (u.sitting_branch_id = ? OR uba.branch_id = ?)
       ORDER BY CASE WHEN LOWER(REPLACE(u.role, '_', ' ')) LIKE '%branch%manager%' THEN 0
                     WHEN LOWER(REPLACE(u.role, '_', ' ')) LIKE '%tpo%' THEN 1 ELSE 2 END,
                u.created_at, u.email`,
      [branch.id, branch.id],
    );
    email = text(users[0]?.email).trim();
  }
  return { id: String(branch.id), name: text(branch.name), email };
}

module.exports = { createInquiry, getInquiry, listInquiries, resolveBranch, toSheetRow, updateInquiry };
