const { normalizePlacementText } = require('./placementRecords');

const studentKeyParts = (row, getValue) => ({
  roll: normalizePlacementText(getValue(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll'])),
  name: normalizePlacementText(getValue(row, ['studentname', 'name'])),
});

const isPlacementOutcome = (row, getValue) => {
  const isNegative = value => {
    const status = normalizePlacementText(value);
    return Boolean(status) && ['notplaced', 'unplaced', 'notjoined', 'didnotjoin', 'notselected', 'notaccepted', 'rejected', 'declined', 'withdrawn'].some(term => status.includes(term));
  };
  const isPositive = value => {
    const status = normalizePlacementText(value);
    return Boolean(status) && !isNegative(value) && (status.includes('placed') || status.includes('offer') || status.includes('join'));
  };

  const status = getValue(row, ['status', 'placementstatus', 'placementstat', 'placementstatsu']);
  const joiningStatus = getValue(row, ['joiningstatus']);
  return !isNegative(status) && !isNegative(joiningStatus) && (isPositive(status) || isPositive(joiningStatus));
};

const calculateDashboardPlacementCounts = (students, placementRows, getValue, canAccess = () => true, canAccessPlacement = canAccess) => {
  const eligibleStudents = new Set();
  const placedStudents = new Set();

  (Array.isArray(students) ? students : []).forEach((row, index) => {
    if (!canAccess(row)) return;

    const { roll, name } = studentKeyParts(row, getValue);
    const key = roll ? `roll:${roll}` : name ? `name:${name}` : `row:${row?.rowNumber ?? index}`;
    eligibleStudents.add(key);
  });

  (Array.isArray(placementRows) ? placementRows : []).forEach((row, index) => {
    if (!canAccessPlacement(row) || !isPlacementOutcome(row, getValue)) return;
    const { roll, name } = studentKeyParts(row, getValue);
    const key = roll ? `roll:${roll}` : name ? `name:${name}` : `row:${row?.rowNumber ?? index}`;
    placedStudents.add(key);
  });

  return { totalStudents: eligibleStudents.size, placed: placedStudents.size };
};

module.exports = { calculateDashboardPlacementCounts, isPlacementOutcome };
