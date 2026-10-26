const test = require('node:test');
const assert = require('node:assert/strict');
const { placementOutcome, isPlacedStatus } = require('../src/placementMetrics');

test('only an exact normalized TPO_Log Status of Placed counts as placed', () => {
  for (const status of ['Placed', ' placed ', 'PLACED']) assert.equal(isPlacedStatus(status), true);
  for (const status of ['Joined', 'Offer', 'Not Placed', 'Not Joined', 'Rejected', 'Interview Scheduled', '']) {
    assert.equal(isPlacedStatus(status), false, `${status} must not count as placed`);
  }
});

test('joining and offer outcomes remain separate from placed', () => {
  assert.deepEqual(placementOutcome('Offer'), { placed: false, joined: false, offer: true, notJoined: false });
  assert.deepEqual(placementOutcome('In Process', 'Joined'), { placed: false, joined: true, offer: false, notJoined: false });
  assert.deepEqual(placementOutcome('Placed', 'Not Joined'), { placed: true, joined: false, offer: false, notJoined: false });
  assert.equal(placementOutcome('Rejected').notJoined, true);
});
