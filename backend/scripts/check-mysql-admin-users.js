const crypto = require('crypto');
const mysqlPool = require('../src/mysqlPool');
const mysqlAdminUsers = require('../src/mysqlAdminUsersService');
const mysqlTpoAuth = require('../src/mysqlTpoAuthService');
const { hashPassword } = require('../src/passwords');

async function main() {
  const host = String(process.env.MYSQL_HOST || '').trim().toLowerCase();
  const database = String(process.env.MYSQL_DATABASE || '').trim();
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) || !/^ipcs_portal(?:_dev)?$/.test(database)) {
    throw new Error('This rollback-only verifier is restricted to the local ipcs_portal or ipcs_portal_dev database.');
  }

  const pool = mysqlPool.getPool();
  const connection = await pool.getConnection();
  const id = crypto.randomUUID();
  const email = `codex-mysql-admin-${id}@example.invalid`;
  const name = `Codex Admin User Check ${id.slice(0, 8)}`;
  const password = `Local-check-${crypto.randomBytes(18).toString('base64url')}`;
  const targetMonth = '2026-11';
  let result;
  try {
    await connection.beginTransaction();
    const created = await mysqlAdminUsers.saveUser({
      userName: name,
      email,
      contact: '0000000000',
      role: 'TPO',
      sittingBranch: `Codex Test Branch ${id.slice(0, 8)}`,
      assignedBranches: `Codex Test Branch ${id.slice(0, 8)}, Codex Test Branch Two ${id.slice(0, 8)}`,
      course: 'All Courses',
      access: 'View & Edit',
      empId: `CODEX-ADMIN-${id.slice(0, 8)}`,
      linkedIn: 'https://example.invalid/codex-profile',
      birthday: '2000-02-29',
      position: 'Placement Officer',
      description: 'Temporary rollback-only admin user test.',
      status: 'Active',
      target: '4',
      targetMonth,
    }, {
      actor: { email: 'gifty@ipcsglobal.com', requestId: `check-${id}` },
      passwordHash: await hashPassword(password),
      connection,
    });
    if (['sent', 'queued'].includes(created.targetMail?.status)) {
      throw new Error('The MySQL-only staff workflow unexpectedly invoked the legacy target email path.');
    }
    const userId = created.user.userId;
    const listed = await mysqlAdminUsers.listUsers({ month: targetMonth, connection });
    const listRecord = listed.find(user => user.userId === userId);
    const [branchAssignments] = await connection.execute('SELECT COUNT(*) AS count FROM user_branch_assignments WHERE user_id = ?', [userId]);
    const [targetRows] = await connection.execute('SELECT target_count FROM placement_targets WHERE tpo_user_id = ? AND target_year = 2026 AND target_month = 11', [userId]);
    if (!listRecord || listRecord.target !== '4' || listRecord.targetMonth !== targetMonth || Number(branchAssignments[0].count) !== 2 || Number(targetRows[0]?.target_count) !== 4) {
      throw new Error('The MySQL staff list, branch scope, or monthly target did not round-trip.');
    }

    let account = await mysqlTpoAuth.authenticate(email, password, { connection });
    if (!account || account.id !== userId || account.sessionUser.name !== name) throw new Error('The new staff profile did not authenticate through the existing MySQL sign-in flow.');

    const updated = await mysqlAdminUsers.saveUser({
      userName: name,
      email,
      contact: '0000000001',
      role: 'TPO',
      sittingBranch: `Codex Test Branch ${id.slice(0, 8)}`,
      assignedBranches: `Codex Test Branch ${id.slice(0, 8)}`,
      course: 'All Courses',
      access: 'View & Edit',
      empId: `CODEX-ADMIN-${id.slice(0, 8)}`,
      linkedIn: 'https://example.invalid/codex-profile-updated',
      birthday: '29/02/2000',
      position: 'Senior Placement Officer',
      description: 'Updated rollback-only test profile.',
      status: 'Active',
      target: '4',
      targetMonth,
    }, { userId, actor: { email: 'gifty@ipcsglobal.com', requestId: `check-${id}` }, connection });
    if (updated.user.contact !== '0000000001' || updated.user.position !== 'Senior Placement Officer' || updated.user.target !== '4') {
      throw new Error('The MySQL staff update changed or lost profile/target fields unexpectedly.');
    }

    const photoUrl = `https://example.invalid/${id}.png`;
    const photoUser = await mysqlAdminUsers.updateProfilePhoto(userId, photoUrl, { actor: { email: 'gifty@ipcsglobal.com', requestId: `check-${id}` }, connection });
    if (photoUser.profilePhoto !== photoUrl) throw new Error('The profile photo URL did not persist in the MySQL account.');

    await mysqlAdminUsers.saveUser({
      userName: name,
      email,
      contact: '0000000001',
      role: 'TPO',
      sittingBranch: `Codex Test Branch ${id.slice(0, 8)}`,
      assignedBranches: `Codex Test Branch ${id.slice(0, 8)}`,
      course: 'All Courses',
      access: 'View & Edit',
      empId: `CODEX-ADMIN-${id.slice(0, 8)}`,
      linkedIn: 'https://example.invalid/codex-profile-updated',
      birthday: '29/02/2000',
      position: 'Senior Placement Officer',
      description: 'Updated rollback-only test profile.',
      status: 'Active',
      target: '9',
      targetMonth,
    }, { userId, actor: { email: 'gifty@ipcsglobal.com', requestId: `check-${id}` }, targetChanged: true, connection });
    account = await mysqlTpoAuth.findAccountByEmail(email, { connection });
    if (account.sessionUser.target !== '9' || account.sessionUser.photo !== photoUrl) throw new Error('Target/photo changes did not flow into the staff profile used at sign-in.');

    await mysqlAdminUsers.deactivateUser(userId, { actor: { email: 'gifty@ipcsglobal.com', requestId: `check-${id}` }, connection });
    account = await mysqlTpoAuth.findAccountByEmail(email, { connection });
    if (!account || mysqlTpoAuth.isAccountEnabled(account.row)) throw new Error('The deactivated account remained able to sign in.');

    const staffEmail = `codex-mysql-directory-${id}@example.invalid`;
    const staffName = `Codex Directory User ${id.slice(0, 8)}`;
    const staffDirectoryId = `CODEX-U-${id.slice(0, 8)}`;
    const staffInput = {
      userName: staffName,
      email: staffEmail,
      contact: '0000000002',
      role: 'Regional Technical Head',
      sittingBranch: `Codex Staff Branch ${id.slice(0, 8)}`,
      assignedBranches: `Codex Staff Branch ${id.slice(0, 8)}`,
      course: 'Industrial Automation, Digital Marketing',
      access: 'View & Edit',
      empId: `CODEX-STAFF-${id.slice(0, 8)}`,
      directoryId: staffDirectoryId,
      department: 'Technical',
      level: '3',
      reportsToUserId: 'U002',
      zone: 'South',
      region: 'Tamil Nadu',
      territory: 'Coimbatore',
      mailEligible: 'NO',
      linkedIn: 'https://example.invalid/codex-staff-profile',
      birthday: '2001-03-04',
      position: 'Regional Technical Head',
      description: 'Temporary staff directory fields check.',
      status: 'Active',
    };
    const createdStaff = await mysqlAdminUsers.saveUser(staffInput, {
      actor: { email: 'gifty@ipcsglobal.com', requestId: `check-${id}` },
      passwordHash: await hashPassword(password),
      connection,
    });
    const staffUserId = createdStaff.user.userId;
    let staffList = await mysqlAdminUsers.listUsers({ month: targetMonth, connection });
    let staffRecord = staffList.find(user => user.userId === staffUserId);
    const [initialStaffCourses] = await connection.execute(
      `SELECT DISTINCT c.category FROM user_course_assignments assignment
         JOIN courses c ON c.id = assignment.course_id
        WHERE assignment.user_id = ? ORDER BY c.category`,
      [staffUserId],
    );
    const initialCategories = new Set(initialStaffCourses.map(row => row.category));
    const assignableCourses = await mysqlAdminUsers.listAssignableCourses({ connection });
    if (!staffRecord || staffRecord.directoryId !== staffDirectoryId || staffRecord.department !== 'Technical'
      || staffRecord.level !== '3' || staffRecord.reportsToUserId !== 'U002' || staffRecord.zone !== 'South'
      || staffRecord.region !== 'Tamil Nadu' || staffRecord.territory !== 'Coimbatore' || staffRecord.mailEligible !== 'NO'
      || staffRecord.linkedIn !== staffInput.linkedIn || staffRecord.birthday !== '04/03/2001'
      || staffRecord.position !== staffInput.position || staffRecord.description !== staffInput.description
      || !assignableCourses.includes('Industrial Automation') || !assignableCourses.includes('Digital Marketing')
      || !initialCategories.has('Industrial Automation') || !initialCategories.has('Digital Marketing')) {
      throw new Error('Non-TPO profile fields or multiple course-family assignments did not round-trip on create.');
    }

    const staffUpdate = await mysqlAdminUsers.saveUser({
      ...staffInput,
      userName: `${staffName} Updated`,
      department: 'Operations',
      region: 'Karnataka',
      linkedIn: 'https://example.invalid/codex-staff-updated',
      birthday: '05/04/2001',
      position: 'Technical Operations Lead',
      description: 'Updated temporary staff directory fields check.',
      course: 'Information Technology (IT), Embedded and IoT',
    }, { userId: staffUserId, actor: { email: 'gifty@ipcsglobal.com', requestId: `check-${id}` }, connection });
    staffList = await mysqlAdminUsers.listUsers({ month: targetMonth, connection });
    staffRecord = staffList.find(user => user.userId === staffUserId);
    const [updatedStaffCourses] = await connection.execute(
      `SELECT DISTINCT c.category FROM user_course_assignments assignment
         JOIN courses c ON c.id = assignment.course_id
        WHERE assignment.user_id = ? ORDER BY c.category`,
      [staffUserId],
    );
    const updatedCategories = new Set(updatedStaffCourses.map(row => row.category));
    if (!staffRecord || staffUpdate.user.userName !== `${staffName} Updated` || staffRecord.userName !== `${staffName} Updated`
      || staffRecord.department !== 'Operations' || staffRecord.region !== 'Karnataka'
      || staffRecord.linkedIn !== 'https://example.invalid/codex-staff-updated'
      || staffRecord.birthday !== '05/04/2001' || staffRecord.position !== 'Technical Operations Lead'
      || staffRecord.description !== 'Updated temporary staff directory fields check.'
      || !updatedCategories.has('Information Technology (IT)') || !updatedCategories.has('Embedded and IoT')
      || updatedCategories.has('Industrial Automation') || updatedCategories.has('Digital Marketing')) {
      throw new Error('Non-TPO profile fields or multiple course-family assignments did not update consistently.');
    }

    result = {
      status: 'verified_then_rolled_back',
      createAndStaffListWork: true,
      branchAssignmentsPersist: true,
      monthlyTargetPersistsAndUpdates: true,
      existingMySqlSignInUsesCreatedAccount: true,
      profileAndBirthdayFieldsUpdate: true,
      profilePhotoUrlPersists: true,
      deactivationBlocksSignIn: true,
      noLegacyTargetEmailSent: true,
      nonTpoProfileDetailsAndMultiCourseAssignmentsPersistAndUpdate: true,
      noPermanentTestRows: true,
    };
    await connection.rollback();
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally {
    connection.release();
  }

  const [persistedRows] = await pool.execute('SELECT COUNT(*) AS count FROM users WHERE normalized_email = ?', [email]);
  if (Number(persistedRows[0].count) !== 0) throw new Error('The temporary admin user remained after rollback.');
  await mysqlPool.close();
  console.log(JSON.stringify(result, null, 2));
}

main().catch(async error => {
  console.error(`MySQL admin-user verification failed: ${error.message}`);
  await mysqlPool.close().catch(() => {});
  process.exitCode = 1;
});
