const mysqlPool = require('./mysqlPool');
const { verifyPassword } = require('./passwords');

const STAFF_SOURCES = ['shared_operations:Contact', 'shared_operations:User'];
const clean = value => String(value ?? '').normalize('NFKC').trim();
const normalized = value => clean(value).toLocaleLowerCase('en-US').replace(/\s+/g, ' ');
const headerKey = value => normalized(value).replace(/[^a-z0-9]/g, '');
const currentIndiaTargetPeriod = () => {
  const [year, month] = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit',
  }).format(new Date()).split('-');
  return { year: Number(year), month: Number(month) };
};

function parseJson(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
}

function sourceFieldsFor(row) {
  return parseJson(row.metadata).fields || {};
}

function sourceField(fields, ...aliases) {
  const wanted = new Set(aliases.map(headerKey));
  for (const [key, value] of Object.entries(fields || {})) {
    if (wanted.has(headerKey(key)) && value !== undefined && value !== null && clean(value) !== '') return clean(value);
  }
  return '';
}

function listValues(value) {
  if (Array.isArray(value)) return value.map(clean).filter(Boolean);
  const text = clean(value);
  if (!text) return [];
  if (text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed.map(clean).filter(Boolean);
    } catch { /* Fall through to legacy delimited values. */ }
  }
  return text.split(/[\n,;|]+/).map(value => clean(value).replace(/^\d+\.\s*/, '')).filter(Boolean);
}

function accountStatus(row, fields) {
  return clean(row.status) || sourceField(fields, 'Status') || 'active';
}

function isAccountEnabled(row) {
  const status = normalized(accountStatus(row, sourceFieldsFor(row))).toUpperCase();
  return !['INACTIVE', 'DISABLED', 'LEFT', 'TERMINATED', 'SUSPENDED', 'REVOKED'].includes(status);
}

function accountAuthState(row) {
  const fields = sourceFieldsFor(row);
  const metadata = parseJson(row.metadata);
  const role = sourceField(fields, 'Role', 'Portal Role') || clean(row.role).replace(/_/g, ' ');
  const assignedBranches = sourceField(fields, 'Assigned Branches') || listValues(metadata.rawAssignedBranches).join(', ');
  const assignedCourses = sourceField(fields, 'Assigned Courses', 'Assigned Course', 'Course') || listValues(metadata.rawAssignedCourses).join(', ');
  return {
    email: normalized(sourceField(fields, 'Mail ID', 'Email') || row.email),
    loginId: normalized(sourceField(fields, 'Login ID', 'User ID', 'User_Id', 'Employee ID', 'Emp ID', 'Username')),
    password: String(row.password_hash || ''),
    role: role.toUpperCase(),
    access: (sourceField(fields, 'Access', 'Access Type') || '').toUpperCase(),
    status: accountStatus(row, fields).toUpperCase(),
    sittingBranch: normalized(sourceField(fields, 'Sitting Branch', 'Branch')),
    assignedBranches: normalized(assignedBranches),
    assignedCourses: normalized(assignedCourses),
    department: (sourceField(fields, 'Department') || '').toUpperCase(),
  };
}

function sessionUserFor(row) {
  const fields = sourceFieldsFor(row);
  const metadata = parseJson(row.metadata);
  const role = sourceField(fields, 'Role', 'Portal Role') || clean(row.role).replace(/_/g, ' ');
  const department = sourceField(fields, 'Department');
  const access = sourceField(fields, 'Access', 'Access Type').toUpperCase();
  const assignedCourse = sourceField(fields, 'Assigned Courses', 'Assigned Course', 'Course')
    || listValues(metadata.rawAssignedCourses).join(', ')
    || (/REGIONAL TECHNICAL HEAD|TERRITORY TECHNICAL HEAD|\bRTH\b|\bTTH\b/i.test(role) ? '' : 'All Courses');
  const assignedBranches = sourceField(fields, 'Assigned Branches') || listValues(metadata.rawAssignedBranches).join(', ');
  const sittingBranch = sourceField(fields, 'Sitting Branch', 'Branch') || '';
  let assignedBranchesArray = listValues(assignedBranches);
  if (!assignedBranchesArray.length) assignedBranchesArray = listValues(sittingBranch);

  let accessType = 'edit';
  const upperRole = role.toUpperCase();
  if (upperRole.includes('ADMIN') || upperRole === 'GENERAL MANAGER' || upperRole === 'TECHNICAL HEAD'
    || upperRole === 'ZONAL PLACEMENT HEAD' || access.includes('SUPER_ADMIN')) {
    accessType = 'superadmin';
  } else if (access.includes('VIEW ONLY') && !access.includes('EDIT')) {
    accessType = 'view';
  } else if (access.includes('VIEW & EDIT') || access.includes('EDIT') || access.includes('MANAGER')
    || access.includes('TRAINER') || access.includes('STAFF')) {
    accessType = 'edit';
  }
  if (accessType === 'superadmin') assignedBranchesArray = ['all'];

  return {
    name: clean(row.full_name) || sourceField(fields, 'TPO Name', 'Username', 'Name') || 'User',
    email: normalized(row.normalized_email || row.email),
    loginId: normalized(sourceField(fields, 'Login ID', 'User ID', 'User_Id', 'Employee ID', 'Emp ID', 'Username') || row.email),
    sittingBranch: sittingBranch || 'N/A',
    assignedBranchesArray,
    photo: clean(row.profile_photo_url) || sourceField(fields, 'Profile Photo', 'Profile Photo URL', 'Photo'),
    phone: clean(row.phone) || sourceField(fields, 'Contact Number', 'Contact', 'Phone No.', 'Phone Number') || 'Not Provided',
    role,
    department,
    assignedCourse,
    accessType,
    empId: clean(row.employee_id) || sourceField(fields, 'Emp ID', 'Employee ID'),
    target: row.mysql_monthly_target === null || row.mysql_monthly_target === undefined
      ? sourceField(fields, 'Target', 'Target of the Month') || '0'
      : String(row.mysql_monthly_target),
  };
}

function accountFor(row) {
  if (!row || !STAFF_SOURCES.includes(String(parseJson(row.metadata).source || ''))) return null;
  return {
    id: String(row.id),
    row,
    fields: sourceFieldsFor(row),
    authState: accountAuthState(row),
    sessionUser: sessionUserFor(row),
  };
}

async function selectStaffAccounts(connection) {
  const period = currentIndiaTargetPeriod();
  const [rows] = await connection.execute(
    `SELECT users.id, users.email, users.normalized_email, users.password_hash, users.role,
            users.full_name, users.phone, users.employee_id, users.profile_photo_url,
            users.status, users.metadata, targets.target_count AS mysql_monthly_target
       FROM users
       LEFT JOIN placement_targets AS targets
         ON targets.tpo_user_id = users.id AND targets.target_year = ? AND targets.target_month = ?
      WHERE JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.source')) IN (?, ?)
      ORDER BY users.full_name, users.normalized_email`,
    [period.year, period.month, ...STAFF_SOURCES],
  );
  return rows.map(accountFor).filter(Boolean);
}

async function findAccountByIdentity(identity, { connection: suppliedConnection } = {}) {
  const normalizedIdentity = normalized(identity);
  if (!normalizedIdentity) return null;
  const ownsConnection = !suppliedConnection;
  const connection = suppliedConnection || await mysqlPool.getPool().getConnection();
  try {
    const accounts = await selectStaffAccounts(connection);
    for (const account of accounts) {
      const email = normalized(account.row.normalized_email || account.row.email);
      const fields = account.fields;
      const source = String(parseJson(account.row.metadata).source || '');
      if (email === normalizedIdentity) return account;
      if (source !== 'shared_operations:User') continue;
      const userName = sourceField(fields, 'Username', 'Name', 'TPO Name');
      const loginId = sourceField(fields, 'Login ID', 'User ID', 'User_Id');
      if (normalized(userName) === normalizedIdentity || normalized(loginId) === normalizedIdentity) {
        return account;
      }
    }
    return null;
  } finally {
    if (ownsConnection) connection.release();
  }
}

async function findAccountByEmail(email, { connection: suppliedConnection } = {}) {
  const normalizedEmail = normalized(email);
  if (!normalizedEmail) return null;
  const ownsConnection = !suppliedConnection;
  const connection = suppliedConnection || await mysqlPool.getPool().getConnection();
  try {
    const period = currentIndiaTargetPeriod();
    const [rows] = await connection.execute(
      `SELECT users.id, users.email, users.normalized_email, users.password_hash, users.role,
              users.full_name, users.phone, users.employee_id, users.profile_photo_url,
              users.status, users.metadata, targets.target_count AS mysql_monthly_target
         FROM users
         LEFT JOIN placement_targets AS targets
           ON targets.tpo_user_id = users.id AND targets.target_year = ? AND targets.target_month = ?
        WHERE users.normalized_email = ?
          AND JSON_UNQUOTE(JSON_EXTRACT(users.metadata, '$.source')) IN (?, ?)
        LIMIT 1`,
      [period.year, period.month, normalizedEmail, ...STAFF_SOURCES],
    );
    return accountFor(rows[0]);
  } finally {
    if (ownsConnection) connection.release();
  }
}

async function authenticate(identity, password, { connection: suppliedConnection } = {}) {
  const account = await findAccountByIdentity(identity, { connection: suppliedConnection });
  if (!account || !isAccountEnabled(account.row)) return null;
  if (!await verifyPassword(String(password ?? ''), account.row.password_hash)) return null;
  return account;
}

async function recordSuccessfulLogin(account, { requestId = null, connection: suppliedConnection } = {}) {
  const ownsConnection = !suppliedConnection;
  const connection = suppliedConnection || await mysqlPool.getPool().getConnection();
  try {
    await connection.execute('UPDATE users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?', [account.id]);
    await connection.execute(
      `INSERT INTO audit_events (id, actor_user_id, action, entity_type, entity_id, occurred_at, request_id, details)
       VALUES (UUID(), ?, 'staff.login', 'user', ?, UTC_TIMESTAMP(), ?, JSON_OBJECT('source', 'tpo_portal'))`,
      [account.id, account.id, requestId],
    );
  } finally {
    if (ownsConnection) connection.release();
  }
}

module.exports = {
  STAFF_SOURCES,
  accountAuthState,
  accountFor,
  authenticate,
  findAccountByEmail,
  findAccountByIdentity,
  isAccountEnabled,
  recordSuccessfulLogin,
  sessionUserFor,
};
