const test = require('node:test');
const assert = require('node:assert/strict');
const backendMetrics = require('../src/placementMetrics');

test('frontend and backend placement status rules stay identical', async () => {
  const frontendMetrics = await import('../../frontend/src/utils/placementMetrics.js');
  for (const status of ['Placed', 'placed ', 'Joined', 'Offer', 'Rejected', 'Not Joined', 'Applied', '']) {
    for (const joiningStatus of ['', 'Joined', 'Not Joined']) {
      assert.deepEqual(
        frontendMetrics.placementOutcome(status, joiningStatus),
        backendMetrics.placementOutcome(status, joiningStatus),
        `status=${status}; joiningStatus=${joiningStatus}`
      );
    }
  }
});
