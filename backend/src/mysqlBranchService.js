const crypto = require('crypto');
const mysqlPool = require('./mysqlPool');

const text = value => String(value ?? '').trim();
const normalize = value => text(value).toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
const key = value => normalize(value).replace(/[^a-z0-9]/g, '');
const parseJson = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

function getField(fields, ...aliases) {
  const aliasesSet = new Set(aliases.map(key));
  for (const [name, value] of Object.entries(fields || {})) {
    if (aliasesSet.has(key(name)) && value !== undefined && value !== null) return text(value);
  }
  return '';
}

function branchShape(row, index) {
  const metadata = parseJson(row.metadata);
  const fields = metadata.fields || {};
  return {
    no: getField(fields, 'No', 'Number', 'Index') || index + 1,
    region: text(row.region || getField(fields, 'Region / State', 'Region', 'State')),
    branch: text(row.name || getField(fields, 'Branch', 'Branch Name', 'Branch Location')),
    email: getField(fields, 'Email', 'Branch Email', 'Mail ID', 'Email ID'),
    latitude: getField(fields, 'Latitude', 'Lat'),
    longitude: getField(fields, 'Longitude', 'Long', 'Lng', 'Lon'),
  };
}

async function writeAudit(connection, action, branchId, actor = {}) {
  const actorEmail = normalize(actor.email);
  const [actors] = actorEmail
    ? await connection.execute('SELECT id FROM users WHERE normalized_email = ? LIMIT 1', [actorEmail])
    : [[]];
  await connection.execute(
    `INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, occurred_at, request_id, details)
     VALUES (?, ?, ?, 'branch', ?, UTC_TIMESTAMP(), ?, ?)`,
    [crypto.randomUUID(), actors[0]?.id || null, action, branchId,
      text(actor.requestId) || null, JSON.stringify({ actor: text(actor.name || actor.email) || 'Portal user' })],
  );
}

function validateBranch(input = {}) {
  const branch = text(input.branch);
  const region = text(input.region);
  const email = text(input.email);
  const latitudeText = text(input.latitude);
  const longitudeText = text(input.longitude);
  if (!branch) throw Object.assign(new Error('Enter a branch name.'), { status: 400 });
  if (branch.length > 160 || region.length > 120) throw Object.assign(new Error('Branch names or region names are too long.'), { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Object.assign(new Error('Enter a valid branch email address.'), { status: 400 });
  const latitude = latitudeText ? Number(latitudeText) : null;
  const longitude = longitudeText ? Number(longitudeText) : null;
  if (latitudeText && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) throw Object.assign(new Error('Latitude must be between -90 and 90.'), { status: 400 });
  if (longitudeText && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) throw Object.assign(new Error('Longitude must be between -180 and 180.'), { status: 400 });
  return { branch, region, email, latitude, longitude, no: text(input.no) };
}

async function listBranches() {
  const [rows] = await mysqlPool.query('SELECT name, normalized_name, region, metadata FROM branches ORDER BY region, name');
  return rows.map(branchShape);
}

async function addBranch(input, actor = {}) {
  const values = validateBranch(input);
  const normalizedName = normalize(values.branch);
  const connection = await mysqlPool.getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute('SELECT id FROM branches WHERE normalized_name = ? LIMIT 1 FOR UPDATE', [normalizedName]);
    if (existing.length) throw Object.assign(new Error('This branch already exists.'), { status: 409 });
    const id = crypto.randomUUID();
    const fields = {
      No: values.no, 'Region / State': values.region, Branch: values.branch,
      Latitude: values.latitude === null ? '' : String(values.latitude),
      Longitude: values.longitude === null ? '' : String(values.longitude), Email: values.email,
    };
    await connection.execute(
      `INSERT INTO branches (id, name, normalized_name, region, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [id, values.branch, normalizedName, values.region || null,
        JSON.stringify({ source: 'portal:branch_admin', fields, rawBranch: values.branch })],
    );
    await writeAudit(connection, 'branch_created', id, actor);
    await connection.commit();
    return branchShape({ name: values.branch, region: values.region, metadata: { fields } }, 0);
  } catch (error) {
    await connection.rollback().catch(() => {});
    if (error.code === 'ER_DUP_ENTRY') throw Object.assign(new Error('This branch already exists.'), { status: 409 });
    throw error;
  } finally { connection.release(); }
}

async function updateBranch(oldBranch, input, actor = {}) {
  const values = validateBranch(input);
  const oldKey = normalize(oldBranch);
  const normalizedName = normalize(values.branch);
  if (!oldKey) throw Object.assign(new Error('Choose the branch to update.'), { status: 400 });
  const connection = await mysqlPool.getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT id, metadata FROM branches WHERE normalized_name = ? LIMIT 1 FOR UPDATE', [oldKey]);
    if (!rows.length) throw Object.assign(new Error('Branch not found.'), { status: 404 });
    const current = rows[0];
    const metadata = parseJson(current.metadata);
    const fields = { ...(metadata.fields || {}), No: values.no, 'Region / State': values.region, Branch: values.branch,
      Latitude: values.latitude === null ? '' : String(values.latitude),
      Longitude: values.longitude === null ? '' : String(values.longitude), Email: values.email };
    metadata.fields = fields;
    metadata.source = metadata.source || 'portal:branch_admin';
    metadata.rawBranch = values.branch;
    await connection.execute(
      'UPDATE branches SET name = ?, normalized_name = ?, region = ?, metadata = ? WHERE id = ?',
      [values.branch, normalizedName, values.region || null, JSON.stringify(metadata), current.id],
    );
    await writeAudit(connection, 'branch_updated', current.id, actor);
    await connection.commit();
    return branchShape({ name: values.branch, region: values.region, metadata }, 0);
  } catch (error) {
    await connection.rollback().catch(() => {});
    if (error.code === 'ER_DUP_ENTRY') throw Object.assign(new Error('Another branch already has that name.'), { status: 409 });
    throw error;
  } finally { connection.release(); }
}

async function deleteBranch(branchName, actor = {}) {
  const normalizedName = normalize(branchName);
  if (!normalizedName) throw Object.assign(new Error('Choose a branch to delete.'), { status: 400 });
  const connection = await mysqlPool.getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute('SELECT id FROM branches WHERE normalized_name = ? LIMIT 1 FOR UPDATE', [normalizedName]);
    if (!rows.length) throw Object.assign(new Error('Branch not found.'), { status: 404 });
    const id = rows[0].id;
    const [[references]] = await connection.execute(
      `SELECT
         (SELECT COUNT(*) FROM student_profiles WHERE branch_id = ?) AS students,
         (SELECT COUNT(*) FROM users WHERE sitting_branch_id = ?) AS staff,
         (SELECT COUNT(*) FROM user_branch_assignments WHERE branch_id = ?) AS assignments`, [id, id, id],
    );
    if (Number(references.students) + Number(references.staff) + Number(references.assignments) > 0) {
      throw Object.assign(new Error('This branch is still assigned to students or staff. Reassign them before deleting it.'), { status: 409 });
    }
    await writeAudit(connection, 'branch_deleted', id, actor);
    await connection.execute('DELETE FROM branches WHERE id = ?', [id]);
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally { connection.release(); }
}

module.exports = { addBranch, deleteBranch, listBranches, updateBranch };
