const test = require('node:test');
const assert = require('node:assert/strict');
const { createTalentinoSessionResolver } = require('../src/talentinoSessionMatch');

const getValue = (row, aliases) => {
  const key = Object.keys(row || {}).find(candidate => aliases.some(alias => candidate.toLowerCase().replace(/[^a-z0-9]/g, '') === alias.toLowerCase().replace(/[^a-z0-9]/g, '')));
  return key ? row[key] : '';
};
const parseDate = value => value ? new Date(value) : null;

test('attendance matches its exact session ID when a branch has two sessions on one day', () => {
  const schedule = [
    { SessionId: 'session-a', Branch: 'Kochi', Date: '2026-10-26' },
    { SessionId: 'session-b', Branch: 'Kochi', Date: '2026-10-26' },
  ];
  const resolve = createTalentinoSessionResolver(schedule, getValue, parseDate);
  const match = resolve({ SessionId: 'session-b', Branch: 'Kochi', Date: '2026-10-26' });
  assert.equal(match.session.SessionId, 'session-b');
  assert.equal(match.matchType, 'session-id');
});

test('legacy attendance does not get assigned arbitrarily when date and branch collide', () => {
  const schedule = [
    { SessionId: 'session-a', Branch: 'Kochi', Date: '2026-10-26' },
    { SessionId: 'session-b', Branch: 'Kochi', Date: '2026-10-26' },
  ];
  const match = createTalentinoSessionResolver(schedule, getValue, parseDate)({ Branch: 'Kochi', Date: '2026-10-26' });
  assert.equal(match.session, null);
  assert.equal(match.matchType, 'ambiguous');
});
