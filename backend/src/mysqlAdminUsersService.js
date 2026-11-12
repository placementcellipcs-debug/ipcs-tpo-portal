const crypto = require('crypto');
const mysqlPool = require('./mysqlPool');

const STAFF_SOURCES = new Set(['shared_operations:Contact', 'shared_operations:User']);
const text = value => String(value ?? '').normalize('NFKC').trim();
const normalized = value => text(value).toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
const headerKey = value => normalized(value).replace(/[^a-z0-9]/g, '');
const indiaMonth = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit',
}).format(new Date()).slice(0, 7);

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function fieldValue(fields, ...aliases) {
  const aliasesSet = new Set(aliases.map(headerKey));
  for (const [key, value] of Object.entries(fields || {})) {
    if (aliasesSet.has(headerKey(key)) && value !== undefined && value !== null && text(value) !== '') return value;
  }
  return '';
}

function setField(fields, aliases, preferred, value) {
  const keys = new Set(aliases.map(headerKey));
  const existing = Object.keys(fields).find(key => keys.has(headerKey(key)));
  fields[existing || preferred] = value;
}

function parseList(value) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  const raw = text(value);
  if (!raw) return [];
  if (raw.startsWith('[')) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(text).filter(Boolean);
    } catch { /* Fall back to a delimited list. */ }
  }
  return raw.split(/[\n,;|]+/).map(item => text(item).replace(/^\d+\.\s*/, '')).filter(Boolean);
}

function parseBirthday(value) {
  const raw = text(value);
  if (!raw) return null;
  let match = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  let year; let month; let day;
  if (match) [, year, month, day] = match;
  else {
    match = raw.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{4})$/);
    if (!match) throw Object.assign(new Error('Enter a valid birthday.'), { status: 400 });
    [, day, month, year] = match;
  }
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== Number(month) - 1 || parsed.getUTCDate() !== Number(day)) {
    throw Object.assign(new Error('Enter a valid birthday.'), { status: 400 });
  }
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatBirthday(value) {
  if (!value) return '';
  const raw = value instanceof Date ? value.toISOString().slice(0, 10) : text(value).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : raw;
}

function isTpoRole(role) {
  return /\b(tpo|placement officer)\b/i.test(text(role));
}

function accountSource(row) {
  const source = String(parseJson(row.metadata).source || '');
  return STAFF_SOURCES.has(source) ? source : '';
}

function accountShape(row, target) {
  const metadata = parseJson(row.metadata);
  const fields = metadata.fields || {};
  const isContact = accountSource(row) === 'shared_operations:Contact';
  const branchNames = parseList(metadata.rawAssignedBranches || fieldValue(fields, 'Assigned Branches', 'Assigned_Branches'));
  const courseNames = parseList(metadata.rawAssignedCourses || fieldValue(fields, 'Assigned Courses', 'Assigned_Courses', 'Assigned Course', 'Course'));
  const role = text(fieldValue(fields, 'Role', 'Portal Role') || row.role).replace(/_/g, ' ') || (isContact ? 'TPO' : 'Unassigned');
  const status = text(fieldValue(fields, 'Status', 'TPO Status') || row.status).replace(/^./, char => char.toUpperCase());
  return {
    userId: String(row.id),
    sheet: isContact ? 'Contact' : 'User',
    rowNumber: Number(metadata.sourceRow) || undefined,
    userName: text(row.full_name || fieldValue(fields, 'TPO Name', 'Name', 'Username')),
    contact: text(row.phone || fieldValue(fields, 'Contact Number', 'Contact_Number', 'Phone', 'Phone Number')),
    email: text(row.email || row.normalized_email || fieldValue(fields, 'Mail ID', 'Email', 'Mail')),
    loginId: text(fieldValue(fields, 'Login ID', 'Login_Id', 'User ID', 'Username')),
    sittingBranch: text(metadata.rawSittingBranch || fieldValue(fields, 'Sitting Branch', 'Sitting_Branch', 'Branch')),
    assignedBranches: branchNames.join(', '),
    role,
    course: courseNames.length ? courseNames.join(', ') : 'All Courses',
    access: text(fieldValue(fields, 'Access Type', 'Access_Type', 'Access')) || (isContact ? 'View & Edit' : 'View Only'),
    profilePhoto: text(row.profile_photo_url || fieldValue(fields, 'Profile Photo', 'Profile Photo URL', 'Profile_Photo_URL', 'Photo')),
    empId: text(row.employee_id || fieldValue(fields, 'Emp ID', 'Employee ID', 'Employee_ID')),
    linkedIn: text(row.linkedin_url || fieldValue(fields, 'Linkedin', 'LinkedIn', 'LinkedIn URL', 'Linkedin URL')),
    birthday: formatBirthday(row.birthday || fieldValue(fields, 'BirthDay', 'Birthday', 'DOB', 'Date of Birth')),
    position: text(row.position_title || fieldValue(fields, 'Position', 'Designation')),
    description: text(row.description || fieldValue(fields, 'Description', 'Descripation', 'Bio', 'Profile Description')),
    status,
    target: target === null || target === undefined ? '' : String(target?.count ?? target),
    targetMonth: target?.month || '',
  };
}

function monthParts(month) {
  const cleanMonth = text(month) || indiaMonth();
  const match = cleanMonth.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) throw Object.assign(new Error('Choose a valid target month.'), { status: 400 });
  return { month: cleanMonth, year: Number(match[1]), monthNumber: Number(match[2]) };
}

function normalizeStatus(value, fallback = 'active') {
  const cleanStatus = normalized(value || fallback);
  if (!['active', 'inactive'].includes(cleanStatus)) {
    throw Object.assign(new Error('Choose Active or Inactive for the account status.'), { status: 400 });
  }
  return cleanStatus;
}

function accountMetadata(row) {
  const metadata = parseJson(row?.metadata);
  if (!metadata.fields || typeof metadata.fields !== 'object' || Array.isArray(metadata.fields)) metadata.fields = {};
  if (!Array.isArray(metadata.rawAssignedBranches)) metadata.rawAssignedBranches = [];
  if (!Array.isArray(metadata.rawAssignedCourses)) metadata.rawAssignedCourses = [];
  return metadata;
}

function fieldsForInput(input, { isContact, existingMetadata, status, profilePhoto }) {
  const metadata = existingMetadata || { fields: {}, rawAssignedBranches: [], rawAssignedCourses: [] };
  const fields = { ...(metadata.fields || {}) };
  const branchText = parseList(input.assignedBranches).join(', ');
  const courseText = parseList(input.course).join(', ');
  if (isContact) {
    setField(fields, ['TPO Name', 'Name'], 'TPO Name', text(input.userName));
    setField(fields, ['Contact Number', 'Phone'], 'Contact Number', text(input.contact));
    setField(fields, ['Mail ID', 'Email'], 'Mail ID', text(input.email).toLocaleLowerCase('en-US'));
    setField(fields, ['Sitting Branch'], 'Sitting Branch', text(input.sittingBranch));
    setField(fields, ['Assigned Branches'], 'Assigned Branches', branchText);
    setField(fields, ['Role'], 'Role', text(input.role) || 'TPO');
    setField(fields, ['Emp ID', 'Employee ID'], 'Emp ID', text(input.empId));
    setField(fields, ['Linkedin', 'LinkedIn', 'Linkedin URL', 'LinkedIn URL'], 'Linkedin', text(input.linkedIn));
    setField(fields, ['BirthDay', 'Birthday'], 'BirthDay', text(input.birthday));
    setField(fields, ['Position', 'Designation'], 'Position', text(input.position));
    setField(fields, ['Description', 'Descripation', 'Bio'], 'Descripation', text(input.description));
    setField(fields, ['Status', 'TPO Status'], 'Status', status === 'inactive' ? 'InActive' : 'Active');
    setField(fields, ['Profile Photo', 'Profile Photo URL', 'Profile Image URL', 'Photo'], 'Profile Photo', profilePhoto || '');
  } else {
    setField(fields, ['Name', 'Username'], 'Name', text(input.userName));
    setField(fields, ['Contact Number', 'Contact_Number', 'Phone'], 'Contact_Number', text(input.contact));
    setField(fields, ['Email', 'Mail ID', 'Mail'], 'Email', text(input.email).toLocaleLowerCase('en-US'));
    setField(fields, ['Sitting_Branch', 'Sitting Branch', 'Branch'], 'Sitting_Branch', text(input.sittingBranch));
    setField(fields, ['Assigned_Branches', 'Assigned Branches'], 'Assigned_Branches', branchText);
    setField(fields, ['Role'], 'Role', text(input.role) || 'Unassigned');
    setField(fields, ['Assigned_Courses', 'Assigned Courses', 'Course'], 'Assigned_Courses', courseText);
    setField(fields, ['Access_Type', 'Access Type', 'Access'], 'Access_Type', text(input.access) || 'View Only');
    setField(fields, ['Employee_ID', 'Employee ID', 'Emp ID'], 'Employee_ID', text(input.empId));
    setField(fields, ['Profile_Photo_URL', 'Profile Photo', 'Profile Photo URL', 'Photo'], 'Profile_Photo_URL', profilePhoto || '');
    setField(fields, ['Status'], 'Status', status === 'inactive' ? 'Inactive' : 'Active');
  }
  metadata.fields = fields;
  metadata.rawSittingBranch = text(input.sittingBranch) || null;
  metadata.rawAssignedBranches = parseList(input.assignedBranches);
  metadata.rawAssignedCourses = isContact ? [] : parseList(input.course);
  return metadata;
}

async function resolveOrCreateBranch(connection, name) {
  const cleanName = text(name);
  if (!cleanName) return null;
  if (cleanName.length > 160) throw Object.assign(new Error('Branch names must be 160 characters or fewer.'), { status: 400 });
  const key = normalized(cleanName);
  const [rows] = await connection.execute('SELECT id FROM branches WHERE normalized_name = ? LIMIT 1', [key]);
  if (rows[0]) return rows[0].id;
  const id = crypto.randomUUID();
  await connection.execute(
    `INSERT INTO branches (id, name, normalized_name, metadata)
     VALUES (?, ?, ?, JSON_OBJECT('createdBy', 'tpo_admin_user_management'))`,
    [id, cleanName, key],
  );
  return id;
}

async function resolveCourse(connection, name) {
  const cleanName = text(name);
  const key = normalized(cleanName);
  const [rows] = await connection.execute('SELECT id FROM courses WHERE normalized_name = ? AND active = TRUE LIMIT 1', [key]);
  if (!rows[0]) throw Object.assign(new Error(`The course “${cleanName}” is not in the MySQL course catalog. Import or add it before assigning this account.`), { status: 400 });
  return rows[0].id;
}

async function saveAssignments(connection, userId, input, isContact) {
  const branches = [...new Set(parseList(input.assignedBranches))];
  const courses = isContact ? [] : [...new Set(parseList(input.course))].filter(course => !/^all courses?$/i.test(course));
  const branchIds = [];
  for (const name of branches) {
    if (/^(all|all branches)$/i.test(name)) continue;
    branchIds.push(await resolveOrCreateBranch(connection, name));
  }
  const courseIds = [];
  for (const name of courses) courseIds.push(await resolveCourse(connection, name));

  await connection.execute('DELETE FROM user_branch_assignments WHERE user_id = ?', [userId]);
  for (const branchId of [...new Set(branchIds)]) {
    await connection.execute('INSERT IGNORE INTO user_branch_assignments (user_id, branch_id) VALUES (?, ?)', [userId, branchId]);
  }
  await connection.execute('DELETE FROM user_course_assignments WHERE user_id = ?', [userId]);
  for (const courseId of [...new Set(courseIds)]) {
    await connection.execute('INSERT IGNORE INTO user_course_assignments (user_id, course_id) VALUES (?, ?)', [userId, courseId]);
  }
}

async function actorIdFor(connection, actor) {
  const email = normalized(actor?.email);
  if (!email) return null;
  const [rows] = await connection.execute('SELECT id FROM users WHERE normalized_email = ? LIMIT 1', [email]);
  return rows[0]?.id || null;
}

async function writeAudit(connection, actor, action, entityId, details) {
  await connection.execute(
    `INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, occurred_at, request_id, details)
     VALUES (?, ?, ?, 'user', ?, UTC_TIMESTAMP(), ?, CAST(? AS JSON))`,
    [crypto.randomUUID(), await actorIdFor(connection, actor), action, entityId, actor?.requestId || null, JSON.stringify(details || {})],
  );
}

async function accountById(connection, userId, { forUpdate = false } = {}) {
  const [rows] = await connection.execute(
    `SELECT id, email, normalized_email, password_hash, role, full_name, phone, sitting_branch_id,
            linkedin_url, birthday, position_title, description, employee_id, profile_photo_url, status, metadata
       FROM users WHERE id = ? ${forUpdate ? 'FOR UPDATE' : ''}`,
    [userId],
  );
  const row = rows[0];
  if (!row || !accountSource(row)) return null;
  return row;
}

async function targetValue(connection, userId, month) {
  const { year, monthNumber } = monthParts(month);
  const [rows] = await connection.execute(
    `SELECT target_count FROM placement_targets WHERE tpo_user_id = ? AND target_year = ? AND target_month = ? LIMIT 1`,
    [userId, year, monthNumber],
  );
  return rows[0] ? String(rows[0].target_count) : '';
}

async function listUsers({ month, connection: suppliedConnection } = {}) {
  const targetMonth = monthParts(month).month;
  const ownsConnection = !suppliedConnection;
  const connection = suppliedConnection || await mysqlPool.getPool().getConnection();
  try {
    const { year, monthNumber } = monthParts(targetMonth);
    const [rows] = await connection.execute(
      `SELECT u.id, u.email, u.normalized_email, u.role, u.full_name, u.phone, u.sitting_branch_id,
              u.linkedin_url, u.birthday, u.position_title, u.description, u.employee_id,
              u.profile_photo_url, u.status, u.metadata, target.target_count
         FROM users u
         LEFT JOIN placement_targets target
           ON target.tpo_user_id = u.id AND target.target_year = ? AND target.target_month = ?
        WHERE JSON_UNQUOTE(JSON_EXTRACT(u.metadata, '$.source')) IN (?, ?)
        ORDER BY u.full_name, u.normalized_email`,
      [year, monthNumber, ...STAFF_SOURCES],
    );
    return rows.map(row => {
      const targetRow = accountSource(row) === 'shared_operations:Contact' && isTpoRole(fieldValue(parseJson(row.metadata).fields, 'Role') || row.role)
        ? { month: targetMonth, count: row.target_count }
        : null;
      return accountShape(row, targetRow);
    });
  } finally {
    if (ownsConnection) connection.release();
  }
}

async function listPublicPlacementTeam({ connection: suppliedConnection } = {}) {
  const ownsConnection = !suppliedConnection;
  const connection = suppliedConnection || await mysqlPool.getPool().getConnection();
  try {
    const [rows] = await connection.execute(
      `SELECT id, email, normalized_email, role, full_name, phone, linkedin_url,
              position_title, description, profile_photo_url, status, metadata
         FROM users
        WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.source')) = 'shared_operations:Contact'
        ORDER BY full_name, normalized_email`,
    );
    const seen = new Set();
    return rows.map(row => {
      const metadata = parseJson(row.metadata);
      const fields = metadata.fields || {};
      const name = text(row.full_name || fieldValue(fields, 'TPO Name', 'Name', 'Placement Officer'));
      const status = normalized(fieldValue(fields, 'Status', 'TPO Status') || row.status);
      const role = text(row.position_title || fieldValue(fields, 'Position', 'Role', 'Designation'));
      return {
        name,
        role,
        status,
        branches: text(fieldValue(fields, 'Assigned Branches', 'Assigned_Branches', 'Assigned Branch', 'Sitting Branch', 'Branch')),
        region: text(fieldValue(fields, 'Region')),
        photo: text(row.profile_photo_url || fieldValue(fields, 'Profile Photo URL', 'Profile Photo', 'Profile_Photo_URL', 'Profile Image', 'Photo', 'Image URL')),
        phone: text(row.phone || fieldValue(fields, 'Contact Number', 'Phone Number', 'Phone', 'Contact')),
        email: text(row.email || row.normalized_email || fieldValue(fields, 'Mail ID', 'Email', 'Work Email')),
        linkedin: text(row.linkedin_url || fieldValue(fields, 'Linkedin', 'LinkedIn', 'LinkedIn URL', 'Linkedin URL', 'LinkedIn Profile')),
        bio: text(row.description || fieldValue(fields, 'Description', 'Descripation', 'Bio', 'Profile Description', 'Profile Bio')),
      };
    }).filter(member => {
      const identity = normalized(member.name).replace(/^(mrs|miss|mr|ms|dr)\s+/, '').replace(/[^\p{L}\p{N}]+/gu, '');
      if (member.status !== 'active' || !identity || seen.has(identity)) return false;
      seen.add(identity);
      return true;
    }).map(({ status, ...member }) => member);
  } finally {
    if (ownsConnection) connection.release();
  }
}

async function getUser(userId, { connection: suppliedConnection, month = indiaMonth() } = {}) {
  const ownsConnection = !suppliedConnection;
  const connection = suppliedConnection || await mysqlPool.getPool().getConnection();
  try {
    const row = await accountById(connection, userId);
    if (!row) return null;
    const shaped = accountShape(row, null);
    if (isTpoRole(shaped.role)) {
      const target = await targetValue(connection, row.id, month);
      shaped.target = target;
      shaped.targetMonth = month;
    }
    return shaped;
  } finally {
    if (ownsConnection) connection.release();
  }
}

async function saveMonthlyTarget(connection, userId, target, month, actor) {
  const { year, monthNumber } = monthParts(month);
  const targetText = text(target);
  if (!/^\d+$/.test(targetText) || !Number.isSafeInteger(Number(targetText)) || Number(targetText) < 0 || Number(targetText) > 4294967295) {
    throw Object.assign(new Error('A monthly placement target must be a whole number of zero or more.'), { status: 400 });
  }
  const actorId = await actorIdFor(connection, actor);
  await connection.execute(
    `INSERT INTO placement_targets (id, tpo_user_id, target_year, target_month, target_count, assigned_by_user_id)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE target_count = VALUES(target_count), assigned_by_user_id = VALUES(assigned_by_user_id)`,
    [crypto.randomUUID(), userId, year, monthNumber, Number(targetText), actorId],
  );
}

async function targetEmailProgress(connection, month, actor) {
  if (normalized(actor?.email) !== 'gifty@ipcsglobal.com') return null;
  const { year, monthNumber } = monthParts(month);
  const [rows] = await connection.execute(
    `SELECT u.id, u.full_name, u.email, u.role, u.metadata, t.target_count
       FROM users u
       LEFT JOIN placement_targets t ON t.tpo_user_id = u.id AND t.target_year = ? AND t.target_month = ?
      WHERE JSON_UNQUOTE(JSON_EXTRACT(u.metadata, '$.source')) = 'shared_operations:Contact'
        AND LOWER(COALESCE(u.status, 'active')) <> 'inactive'`,
    [year, monthNumber],
  );
  const activeTpos = rows.filter(row => isTpoRole(fieldValue(parseJson(row.metadata).fields, 'Role') || row.role));
  const activeRoster = activeTpos.filter(row => {
    const status = normalized(fieldValue(parseJson(row.metadata).fields, 'Status', 'TPO Status') || row.status);
    return status !== 'inactive' && status !== 'in active';
  });
  if (!activeRoster.length) return { status: 'waiting', message: 'There are no active TPO accounts in the MySQL directory.' };
  const missing = activeRoster.filter(row => row.target_count === null || row.target_count === undefined);
  if (missing.length) {
    return {
      status: 'waiting',
      message: `Saved. The team target email can be prepared after every active TPO has a target for ${month}: ${missing.map(row => text(row.full_name)).join(', ')}.`,
      remaining: missing.length,
    };
  }
  const incomplete = activeRoster.filter(row => !text(row.email) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text(row.email)));
  if (incomplete.length) {
    return {
      status: 'waiting',
      message: `The monthly target email is waiting for valid email addresses for: ${incomplete.map(row => text(row.full_name) || 'Unnamed TPO').join(', ')}.`,
      remaining: incomplete.length,
    };
  }
  const tpos = activeRoster.map(row => {
    const fields = parseJson(row.metadata).fields || {};
    return {
      userId: row.id,
      name: text(row.full_name),
      email: text(row.email),
      region: text(fieldValue(fields, 'Region')),
      target: Number(row.target_count),
    };
  });
  return {
    status: 'pending_mysql_mail',
    message: `All ${activeRoster.length} active TPOs have targets for ${month}.`,
    tpoCount: activeRoster.length,
    totalTarget: activeRoster.reduce((sum, row) => sum + Number(row.target_count || 0), 0),
    tpos,
  };
}

async function saveUser(input, { userId = null, actor, passwordHash = null, targetChanged = false, connection: suppliedConnection } = {}) {
  const ownsConnection = !suppliedConnection;
  const connection = suppliedConnection || await mysqlPool.getPool().getConnection();
  if (ownsConnection) await connection.beginTransaction();
  try {
    const cleanName = text(input?.userName);
    const cleanEmail = text(input?.email).toLocaleLowerCase('en-US');
    const role = text(input?.role) || 'Unassigned';
    const isContact = isTpoRole(role);
    const source = isContact ? 'shared_operations:Contact' : 'shared_operations:User';
    const phone = text(input?.contact) || null;
    const empId = text(input?.empId) || null;
    const birthday = parseBirthday(input?.birthday);
    const status = normalizeStatus(input?.status, 'active');
    const profilePhoto = text(input?.profilePhoto) || null;
    const normalizedEmail = normalized(cleanEmail);
    const selectedTargetMonth = monthParts(input?.targetMonth).month;
    if (!cleanName || cleanName.length > 200) throw Object.assign(new Error('Enter the staff member’s name (up to 200 characters).'), { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) throw Object.assign(new Error('Enter a valid login email.'), { status: 400 });
    if (!role || role.length > 40) throw Object.assign(new Error('Choose a valid account role.'), { status: 400 });
    if (phone && phone.length > 40) throw Object.assign(new Error('Phone numbers must be 40 characters or fewer.'), { status: 400 });
    if (empId && empId.length > 100) throw Object.assign(new Error('Employee IDs must be 100 characters or fewer.'), { status: 400 });
    if (!passwordHash && !userId) throw Object.assign(new Error('An initial password is required.'), { status: 400 });

    let current = null;
    if (userId) {
      current = await accountById(connection, userId, { forUpdate: true });
      if (!current) throw Object.assign(new Error('The selected staff account could not be found.'), { status: 404 });
      const oldSource = accountSource(current);
      if ((oldSource === 'shared_operations:Contact') !== isContact) {
        throw Object.assign(new Error('An account cannot be moved between the TPO and system-user directories. Keep its current account type.'), { status: 400 });
      }
    }

    const metadata = fieldsForInput(input, {
      isContact,
      existingMetadata: current ? accountMetadata(current) : null,
      status,
      profilePhoto: profilePhoto || current?.profile_photo_url || '',
    });
    metadata.source = current ? accountSource(current) : source;
    if (!current) metadata.sourceRow = null;
    const sittingBranchId = await resolveOrCreateBranch(connection, input?.sittingBranch);
    const newId = userId || crypto.randomUUID();
    if (current) {
      await connection.execute(
        `UPDATE users SET email = ?, normalized_email = ?, password_hash = COALESCE(?, password_hash), role = ?,
             full_name = ?, phone = ?, sitting_branch_id = ?, linkedin_url = ?, birthday = ?, position_title = ?,
             description = ?, employee_id = ?, profile_photo_url = ?, status = ?, metadata = CAST(? AS JSON)
           WHERE id = ?`,
        [cleanEmail, normalizedEmail, passwordHash, role.toLocaleLowerCase('en-US').replace(/\s+/g, '_'), cleanName,
          phone, sittingBranchId, text(input?.linkedIn) || null, birthday, text(input?.position) || null,
          text(input?.description) || null, empId, profilePhoto || current.profile_photo_url || null, status,
          JSON.stringify(metadata), newId],
      );
    } else {
      await connection.execute(
        `INSERT INTO users
          (id, email, normalized_email, password_hash, role, full_name, phone, sitting_branch_id, linkedin_url,
           birthday, position_title, description, employee_id, profile_photo_url, status, metadata)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CAST(? AS JSON))`,
        [newId, cleanEmail, normalizedEmail, passwordHash, role.toLocaleLowerCase('en-US').replace(/\s+/g, '_'), cleanName,
          phone, sittingBranchId, text(input?.linkedIn) || null, birthday, text(input?.position) || null,
          text(input?.description) || null, empId, profilePhoto, status, JSON.stringify(metadata)],
      );
    }

    await saveAssignments(connection, newId, input, isContact);
    let targetMail = null;
    if (isContact && text(input?.target) !== '' && (!current || targetChanged)) {
      await saveMonthlyTarget(connection, newId, input.target, selectedTargetMonth, actor);
      targetMail = await targetEmailProgress(connection, selectedTargetMonth, actor);
    }
    await writeAudit(connection, actor, current ? 'staff.user.updated' : 'staff.user.created', newId, {
      source: metadata.source,
      role,
      status,
      targetMonth: isContact && text(input?.target) !== '' && (!current || targetChanged) ? selectedTargetMonth : null,
    });
    const user = await getUser(newId, { connection, month: selectedTargetMonth });
    if (ownsConnection) await connection.commit();
    return { user, targetMail };
  } catch (error) {
    if (ownsConnection) await connection.rollback().catch(() => {});
    if (error?.code === 'ER_DUP_ENTRY') {
      throw Object.assign(new Error('Another account already uses this email address or employee ID.'), { status: 409 });
    }
    throw error;
  } finally {
    if (ownsConnection) connection.release();
  }
}

async function updateProfilePhoto(userId, photoUrl, { actor, connection: suppliedConnection } = {}) {
  const ownsConnection = !suppliedConnection;
  const connection = suppliedConnection || await mysqlPool.getPool().getConnection();
  if (ownsConnection) await connection.beginTransaction();
  try {
    const row = await accountById(connection, userId, { forUpdate: true });
    if (!row) throw Object.assign(new Error('The selected staff account could not be found.'), { status: 404 });
    const metadata = accountMetadata(row);
    const isContact = accountSource(row) === 'shared_operations:Contact';
    const aliases = isContact
      ? ['Profile Photo', 'Profile Photo URL', 'Profile Image URL', 'Photo']
      : ['Profile_Photo_URL', 'Profile Photo', 'Profile Photo URL', 'Photo'];
    setField(metadata.fields, aliases, isContact ? 'Profile Photo' : 'Profile_Photo_URL', text(photoUrl));
    await connection.execute(
      'UPDATE users SET profile_photo_url = ?, metadata = CAST(? AS JSON) WHERE id = ?',
      [text(photoUrl) || null, JSON.stringify(metadata), userId],
    );
    await writeAudit(connection, actor, text(photoUrl) ? 'staff.user.photo_updated' : 'staff.user.photo_removed', userId, {});
    const user = await getUser(userId, { connection });
    if (ownsConnection) await connection.commit();
    return user;
  } catch (error) {
    if (ownsConnection) await connection.rollback().catch(() => {});
    throw error;
  } finally {
    if (ownsConnection) connection.release();
  }
}

async function deactivateUser(userId, { actor, connection: suppliedConnection } = {}) {
  const ownsConnection = !suppliedConnection;
  const connection = suppliedConnection || await mysqlPool.getPool().getConnection();
  if (ownsConnection) await connection.beginTransaction();
  try {
    const row = await accountById(connection, userId, { forUpdate: true });
    if (!row) throw Object.assign(new Error('The selected staff account could not be found.'), { status: 404 });
    const metadata = accountMetadata(row);
    const isContact = accountSource(row) === 'shared_operations:Contact';
    setField(metadata.fields, ['Status', 'TPO Status'], 'Status', isContact ? 'InActive' : 'Inactive');
    await connection.execute(
      'UPDATE users SET status = \'inactive\', metadata = CAST(? AS JSON) WHERE id = ?',
      [JSON.stringify(metadata), userId],
    );
    await writeAudit(connection, actor, 'staff.user.deactivated', userId, {});
    const user = await getUser(userId, { connection });
    if (ownsConnection) await connection.commit();
    return user;
  } catch (error) {
    if (ownsConnection) await connection.rollback().catch(() => {});
    throw error;
  } finally {
    if (ownsConnection) connection.release();
  }
}

module.exports = {
  accountShape,
  deactivateUser,
  getUser,
  indiaMonth,
  isTpoRole,
  listPublicPlacementTeam,
  listUsers,
  parseBirthday,
  parseList,
  saveUser,
  targetEmailProgress,
  updateProfilePhoto,
};
