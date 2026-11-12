const test = require('node:test');
const assert = require('node:assert/strict');
const { accountFor, isAccountEnabled } = require('../src/mysqlTpoAuthService');

const makeRow = overrides => ({
  id: 'test-user-id',
  email: 'tpo@example.com',
  normalized_email: 'tpo@example.com',
  password_hash: 'scrypt$test',
  role: 'tpo',
  full_name: 'Test TPO',
  phone: '9876543210',
  employee_id: 'IPCS-TEST-1',
  profile_photo_url: 'https://example.invalid/photo.png',
  position_title: 'Placement Officer',
  description: 'Test profile description',
  status: 'active',
  metadata: {
    source: 'shared_operations:User',
    rawAssignedBranches: ['Kochi', 'Kollam'],
    rawAssignedCourses: ['Digital Marketing'],
    fields: {
      Email: 'tpo@example.com',
      Name: 'Test TPO',
      Username: 'tpo-login',
      Login_ID: 'TP-100',
      Role: 'TPO',
      Status: 'Active',
      Sitting_Branch: 'Kochi',
      Assigned_Branches: 'Kochi, Kollam',
      Assigned_Courses: 'Digital Marketing',
      Access: 'View Only',
      Contact_Number: '9876543210',
      Employee_ID: 'IPCS-TEST-1',
      Target: '12',
    },
  },
  ...overrides,
});

test('builds the existing TPO session shape and account-version fields from normalized MySQL rows', () => {
  const account = accountFor(makeRow());
  assert.equal(account.sessionUser.name, 'Test TPO');
  assert.equal(account.sessionUser.email, 'tpo@example.com');
  assert.deepEqual(account.sessionUser.assignedBranchesArray, ['Kochi', 'Kollam']);
  assert.equal(account.sessionUser.assignedCourse, 'Digital Marketing');
  assert.equal(account.sessionUser.accessType, 'view');
  assert.equal(account.sessionUser.empId, 'IPCS-TEST-1');
  assert.equal(account.sessionUser.target, '12');
  assert.equal(account.authState.password, 'scrypt$test');
  assert.equal(account.authState.assignedBranches, 'kochi, kollam');
});

test('uses the live account status and rejects inactive or disabled accounts', () => {
  assert.equal(isAccountEnabled(makeRow()), true);
  assert.equal(isAccountEnabled(makeRow({ status: 'inactive' })), false);
  assert.equal(isAccountEnabled(makeRow({
    status: 'suspended',
    metadata: { ...makeRow().metadata, fields: { ...makeRow().metadata.fields, Status: 'Suspended' } },
  })), false);
});

test('does not treat student or unrelated-source records as TPO staff accounts', () => {
  assert.equal(accountFor(makeRow({ metadata: { source: 'student_portal:registration', fields: {} } })), null);
});
