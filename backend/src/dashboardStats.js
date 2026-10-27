const { normalizePlacementText } = require('./placementRecords');
const { isPlacedStatus } = require('./placementMetrics');

const isPlacementOutcome = (row, getValue) => {
  // TPO_Log's Status column is the sole authority for placement counts.
  return isPlacedStatus(getValue(row, ['status']));
};

const countPlacementRecords = (placementRows, getValue, canAccessPlacement = () => true) =>
  (Array.isArray(placementRows) ? placementRows : []).reduce((count, row) =>
    count + (canAccessPlacement(row) && isPlacementOutcome(row, getValue) ? 1 : 0), 0);

const calculateDashboardPlacementCounts = (students, placementRows, getValue, canAccess = () => true, canAccessPlacement = canAccess) => {
  const eligibleStudents = new Set();

  (Array.isArray(students) ? students : []).forEach((row, index) => {
    if (!canAccess(row)) return;
    const roll = normalizePlacementText(getValue(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
    const name = normalizePlacementText(getValue(row, ['studentname', 'name']));
    eligibleStudents.add(roll ? `roll:${roll}` : name ? `name:${name}` : `row:${row?.rowNumber ?? index}`);
  });

  return {
    totalStudents: eligibleStudents.size,
    // Every TPO_Log row marked Placed is one placement, including repeat rows
    // for a student who has more than one placement record.
    placed: countPlacementRecords(placementRows, getValue, canAccessPlacement)
  };
};

module.exports = { calculateDashboardPlacementCounts, countPlacementRecords, isPlacementOutcome };
