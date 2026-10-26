const test = require('node:test');
const assert = require('node:assert/strict');
const { buildPlacementReconciliation } = require('../src/placementReconciliation');

const getValue = (row, aliases) => {
  const keys = Object.keys(row || {});
  const key = keys.find(candidate => aliases.some(alias => candidate.toLowerCase().replace(/[^a-z0-9]/g, '') === alias.toLowerCase().replace(/[^a-z0-9]/g, '')));
  return key ? row[key] : '';
};

test('reconciliation detects missing, stale, and duplicate projection keys', () => {
  const result = buildPlacementReconciliation({
    tpoLogs: [
      { rowNumber: 12, Status: 'Placed', 'Student Name': 'Asha' },
      { rowNumber: 13, Status: 'Offer', 'Student Name': 'Bala' },
    ],
    placedStudents: [
      { rowNumber: 2, 'Record Key': 'TPO_Log:12', Status: 'Placed' },
      { rowNumber: 3, 'Record Key': 'TPO_Log:12', Status: 'Placed' },
      { rowNumber: 4, 'Record Key': 'TPO_Log:99', Status: 'Placed' },
    ],
    getValue,
  });

  assert.equal(result.sourceCount, 1);
  assert.equal(result.projectionCount, 3);
  assert.equal(result.missingCount, 0);
  assert.equal(result.staleCount, 1);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.staleRows[0].key, 'TPO_Log:99');
});

test('reconciliation reports source rows absent from the projection', () => {
  const result = buildPlacementReconciliation({
    tpoLogs: [{ rowNumber: 20, Status: 'Placed', 'Student Name': 'Chitra' }],
    placedStudents: [],
    getValue,
  });
  assert.equal(result.missingCount, 1);
  assert.equal(result.missingRows[0].key, 'TPO_Log:20');
});

test('reconciliation identifies manual placements saved in applications but missing from TPO_Log', () => {
  const result = buildPlacementReconciliation({
    tpoLogs: [],
    placedStudents: [],
    applications: [{ rowNumber: 8, 'Entry Source': 'Manual Add', 'Roll Number': 'R-8', Status: 'Placed', Company: 'Example' }],
    getValue,
  });
  assert.equal(result.missingManualLogCount, 1);
  assert.equal(result.missingManualLogRows[0].roll, 'R-8');
});
