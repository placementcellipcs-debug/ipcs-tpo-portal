const { normalizePlacementText } = require('./placementRecords');

const studentKeyParts = (row, getValue) => ({
  roll: normalizePlacementText(getValue(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll'])),
  name: normalizePlacementText(getValue(row, ['studentname', 'name'])),
});

const isPlacementOutcome = (row, getValue) => {
  // TPO_Log's Status column is the sole authority for placement counts.
  return normalizePlacementText(getValue(row, ['status'])) === 'placed';
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
