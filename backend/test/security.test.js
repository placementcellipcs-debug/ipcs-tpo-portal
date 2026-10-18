const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword, isPasswordHash, validatePassword } = require('../src/passwords');
const { getAccountVersion, createPortalSessionToken, readPortalSessionToken } = require('../src/sessionTokens');
const { getPolicyDenial, isPortalAdmin } = require('../src/rolePolicy');

const secret = 'synthetic-only-session-secret';

test('passwords are salted hashes and verify without trimming', async () => {
  const password = 'Synthetic-Staff-Password-2026!';
  const firstHash = await hashPassword(password);
  const secondHash = await hashPassword(password);
  assert.notEqual(firstHash, secondHash);
  assert.ok(isPasswordHash(firstHash));
  assert.notEqual(firstHash, password);
  assert.equal(await verifyPassword(password, firstHash), true);
  assert.equal(await verifyPassword(`${password} `, firstHash), false);
  assert.equal(await verifyPassword('legacy synthetic password', 'legacy synthetic password'), true);
  assert.equal(await verifyPassword(password, 'scrypt$invalid$payload'), false);
  assert.match(validatePassword('short'), /at least 12 characters/i);
  assert.equal(validatePassword(password), null);
});

test('a password or account-state change invalidates a staff session', () => {
  const user = { email: 'synthetic.tpo@example.test', role: 'TPO', accessType: 'edit' };
  const beforeReset = getAccountVersion({ password: 'synthetic-hash-before', role: user.role }, secret);
  const token = createPortalSessionToken(user, beforeReset, { secret, now: 1000 });
  assert.deepEqual(readPortalSessionToken(user.email, token, beforeReset, { secret, now: 2000 }), user);
  const afterReset = getAccountVersion({ password: 'synthetic-hash-after', role: user.role }, secret);
  assert.equal(readPortalSessionToken(user.email, token, afterReset, { secret, now: 2000 }), null);
  assert.equal(readPortalSessionToken('other@example.test', token, beforeReset, { secret, now: 2000 }), null);
  assert.equal(readPortalSessionToken(user.email, token, beforeReset, { secret, now: 1_000 + 7 * 24 * 60 * 60 * 1000 }), null);
});

test('synthetic accounts for the main staff roles receive the intended policy access', () => {
  const accounts = [
    { name: 'Admin', email: 'admin@example.test', role: 'SYSTEM ADMIN', accessType: 'edit' },
    { name: 'TPO', email: 'tpo@example.test', role: 'TPO', accessType: 'edit' },
    { name: 'Branch Manager', email: 'bm@example.test', role: 'Branch Manager', accessType: 'edit' },
    { name: 'Placement Officer', email: 'placement@example.test', role: 'Placement Officer', accessType: 'edit' },
    { name: 'Asset Manager', email: 'asset@example.test', role: 'Branch Asset Manager', accessType: 'edit' },
    { name: 'Regional Manager', email: 'regional@example.test', role: 'Regional Manager', accessType: 'edit' },
    { name: 'Territory Manager', email: 'territory@example.test', role: 'Territory Manager', accessType: 'edit' },
    { name: 'Regional Technical Head', email: 'rth@example.test', role: 'Regional Technical Head', accessType: 'edit' },
    { name: 'Territory Technical Head', email: 'tth@example.test', role: 'Territory Technical Head', accessType: 'edit' },
    { name: 'Technical Lead', email: 'tl@example.test', role: 'Technical Lead', accessType: 'edit' },
    { name: 'Academic Trainer', email: 'trainer@example.test', role: 'TRAINER', department: 'Academic', accessType: 'edit' },
    { name: 'Corporate Trainer', email: 'corporate-trainer@example.test', role: 'TRAINER', department: 'Corporate', accessType: 'edit' },
    { name: 'Designer', email: 'designer@example.test', role: 'Designer', accessType: 'edit' },
    { name: 'Technical Head', email: 'technical-head@example.test', role: 'Technical Head', accessType: 'edit' },
    { name: 'Zonal Placement Head', email: 'zonal-head@example.test', role: 'Zonal Placement Head', accessType: 'edit' },
    { name: 'General Manager', email: 'gm@example.test', role: 'General Manager', accessType: 'edit' },
  ];
  const account = name => accounts.find(candidate => candidate.name === name);
  const allows = (user, policy, context = {}) => getPolicyDenial(user, { policy, ...context }) === null;

  assert.equal(accounts.length, 16);
  assert.ok(isPortalAdmin(account('Admin')));
  assert.ok(allows(account('Admin'), 'portal-admin'));
  assert.ok(allows(account('TPO'), 'placement-drive'));
  assert.ok(allows(account('TPO'), 'events-write'));
  assert.ok(allows(account('TPO'), 'vacancies-write'));
  assert.ok(!allows(account('TPO'), 'portal-admin'));
  assert.ok(allows(account('Branch Manager'), 'placement-drive'));
  assert.ok(!allows(account('Branch Manager'), 'vacancies-write'));
  assert.ok(allows(account('Placement Officer'), 'vacancies-write'));
  assert.ok(allows(account('Asset Manager'), 'assets'));
  assert.ok(allows(account('Asset Manager'), 'asset-admin'));
  assert.ok(allows(account('Regional Technical Head'), 'learning'));
  assert.ok(allows(account('Regional Technical Head'), 'exam-manager'));
  assert.ok(!allows(account('Regional Technical Head'), 'clients'));
  assert.ok(allows(account('Territory Technical Head'), 'learning'));
  assert.ok(!allows(account('Territory Technical Head'), 'exam-manager'));
  assert.ok(allows(account('Technical Lead'), 'exams', { method: 'GET', path: '/results', baseUrl: '/api/exams' }));
  assert.ok(!allows(account('Technical Lead'), 'exams', { method: 'POST', path: '/questions/add', baseUrl: '/api/exams' }));
  assert.ok(allows(account('Academic Trainer'), 'learning'));
  assert.ok(!allows(account('Corporate Trainer'), 'learning'));
  assert.ok(!allows(account('Designer'), 'portal-admin'));
  assert.ok(allows(account('Designer'), 'design'));
  for (const name of ['Technical Head', 'Zonal Placement Head', 'General Manager']) {
    assert.ok(isPortalAdmin(account(name)), `${name} should have administrator access`);
  }
  for (const name of ['Regional Manager', 'Territory Manager']) {
    assert.ok(!isPortalAdmin(account(name)), `${name} should not automatically become a system administrator`);
  }
});
