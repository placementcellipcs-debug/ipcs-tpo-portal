const test = require('node:test');
const assert = require('node:assert/strict');
const { PLACEMENT_AUDIT_HEADERS, createPlacementAuditEvent } = require('../src/placementAudit');

test('placement audit event records actor and before/after status', () => {
  const event = createPlacementAuditEvent({
    actor: { name: 'TPO One', email: 'TPO@example.com', role: 'TPO' },
    action: 'Status changed', previousStatus: 'Applied', newStatus: 'Placed',
    record: { name: 'Student A', roll: '123', jobId: 'JOB-1', company: 'Example Co' },
    changedAt: '2026-10-26T10:00:00.000Z'
  });
  assert.equal(event['Actor Email'], 'tpo@example.com');
  assert.equal(event['Previous Status'], 'Applied');
  assert.equal(event['New Status'], 'Placed');
  assert.ok(event['Event ID']);
  assert.deepEqual(Object.keys(event), PLACEMENT_AUDIT_HEADERS);
});
