const crypto = require('crypto');
const mysqlPool = require('../src/mysqlPool');
const auth = require('../src/mysqlTpoAuthService');
const { hashPassword } = require('../src/passwords');
const { getAccountVersion, createPortalSessionToken, readPortalSessionToken } = require('../src/sessionTokens');

async function main() {
  const host = String(process.env.MYSQL_HOST || '').trim().toLowerCase();
  const database = String(process.env.MYSQL_DATABASE || '').trim();
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) || !/^ipcs_portal(?:_dev)?$/.test(database)) {
    throw new Error('This rollback-only verifier is restricted to the local ipcs_portal or ipcs_portal_dev database.');
  }

  const pool = mysqlPool.getPool();
  const connection = await pool.getConnection();
  const id = crypto.randomUUID();
  const email = `codex-mysql-tpo-auth-${id}@example.invalid`;
  const loginName = `Codex TPO Auth Check ${id.slice(0, 8)}`;
  const password = `Local-check-${crypto.randomBytes(18).toString('base64url')}`;
  let result;
  try {
    await connection.beginTransaction();
    const passwordHash = await hashPassword(password, { allowShortLegacy: true });
    const metadata = JSON.stringify({
      source: 'shared_operations:User',
      fields: {
        Email: email,
        Name: loginName,
        Username: loginName,
        Login_ID: `codex-${id.slice(0, 8)}`,
        Role: 'TPO',
        Status: 'Active',
        Sitting_Branch: 'Local Test Branch',
        Assigned_Branches: 'Local Test Branch, Second Test Branch',
        Assigned_Courses: 'Digital Marketing',
        Access: 'View Only',
        Contact_Number: '0000000000',
        Employee_ID: `CODEX-${id.slice(0, 8)}`,
        Profile_Photo_URL: 'https://example.invalid/test-photo.png',
        Target: '7',
        Position: 'Placement Officer',
        Description: 'Temporary rollback-only test account',
      },
      rawSittingBranch: 'Local Test Branch',
      rawAssignedBranches: ['Local Test Branch', 'Second Test Branch'],
      rawAssignedCourses: ['Digital Marketing'],
    });
    await connection.execute(
      `INSERT INTO users (id, email, normalized_email, password_hash, role, full_name, phone,
                          status, metadata)
       VALUES (?, ?, ?, ?, 'tpo', ?, '0000000000', 'active', CAST(? AS JSON))`,
      [id, email, email, passwordHash, loginName, metadata],
    );

    const wrongPassword = await auth.authenticate(loginName, 'incorrect-password', { connection });
    const account = await auth.authenticate(loginName, password, { connection });
    if (wrongPassword || !account || account.id !== id) throw new Error('MySQL TPO username/password authentication check failed.');
    const user = { ...account.sessionUser, loginId: loginName.toLowerCase() };
    const accountVersion = getAccountVersion(account.authState);
    const sessionToken = createPortalSessionToken(user, accountVersion);
    await auth.recordSuccessfulLogin(account, { requestId: `check-${id}`, connection });
    const byEmail = await auth.findAccountByEmail(email, { connection });
    const verifiedUser = readPortalSessionToken(email, sessionToken, getAccountVersion(byEmail.authState));
    const [lastLoginRows] = await connection.execute('SELECT last_login_at FROM users WHERE id = ?', [id]);
    if (!verifiedUser || verifiedUser.role !== 'TPO' || verifiedUser.assignedBranchesArray.length !== 2) {
      throw new Error(`MySQL TPO session/profile reconstruction check failed (${JSON.stringify({
        tokenValid: Boolean(verifiedUser),
        roleIsTpo: verifiedUser?.role === 'TPO',
        assignedBranchCount: verifiedUser?.assignedBranchesArray?.length ?? null,
      })}).`);
    }
    if (verifiedUser.accessType !== 'view' || verifiedUser.target !== '7' || !lastLoginRows[0]?.last_login_at) {
      throw new Error('MySQL TPO access, target, or successful login audit check failed.');
    }

    const updatedHash = await hashPassword(`${password}-rotated`, { allowShortLegacy: true });
    await connection.execute('UPDATE users SET password_hash = ? WHERE id = ?', [updatedHash, id]);
    const afterPasswordChange = await auth.findAccountByEmail(email, { connection });
    const oldTokenAfterPasswordChange = readPortalSessionToken(email, sessionToken, getAccountVersion(afterPasswordChange.authState));
    if (oldTokenAfterPasswordChange) throw new Error('Changing the staff password did not invalidate the previous session.');

    await connection.execute("UPDATE users SET status = 'inactive' WHERE id = ?", [id]);
    const inactiveAccount = await auth.findAccountByEmail(email, { connection });
    if (auth.isAccountEnabled(inactiveAccount.row)) throw new Error('An inactive staff account was treated as enabled.');

    result = {
      status: 'verified_then_rolled_back',
      usernameAndEmailLookupWork: true,
      incorrectPasswordRejected: true,
      scryptLoginWorks: true,
      sessionReconstructionWorks: true,
      profileAndAccessFieldsPreserved: true,
      successfulLoginTimestampAndAuditWork: true,
      passwordChangeInvalidatesSession: true,
      inactiveAccountRejected: true,
      testRowsPersisted: false,
    };
    await connection.rollback();
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }

  const [persistedRows] = await pool.execute('SELECT COUNT(*) AS count FROM users WHERE id = ?', [id]);
  if (Number(persistedRows[0].count) !== 0) throw new Error('The temporary TPO auth check account remained after rollback.');
  await mysqlPool.close();
  console.log(JSON.stringify(result, null, 2));
}

main().catch(async error => {
  console.error(`MySQL TPO auth verification failed: ${error.message}`);
  await mysqlPool.close().catch(() => {});
  process.exitCode = 1;
});
