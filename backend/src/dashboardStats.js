const { normalizePlacementText } = require('./placementRecords');
const { isPlacedStatus, isPlacementEligiblePending } = require('./placementMetrics');

const isPlacementOutcome = (row, getValue) => {
  // TPO_Log's Status column is the sole authority for placement counts.
  return isPlacedStatus(getValue(row, ['status']));
};

const countPlacementRecords = (placementRows, getValue, canAccessPlacement = () => true) =>
  (Array.isArray(placementRows) ? placementRows : []).reduce((count, row) =>
    count + (canAccessPlacement(row) && isPlacementOutcome(row, getValue) ? 1 : 0), 0);

const calculateDashboardPlacementCounts = (students, placementRows, getValue, canAccess = () => true, canAccessPlacement = canAccess) => {
  const eligibleStudents = new Set();
  const placedStudentRolls = new Set();
  const placedStudentNameBranches = new Set();
  const pendingStudents = new Set();

  (Array.isArray(placementRows) ? placementRows : []).forEach(row => {
    if (!canAccessPlacement(row) || !isPlacementOutcome(row, getValue)
      || /^(yes|true|1)$/i.test(String(getValue(row, ['tpoactionlog']) || ''))) return;
    const roll = normalizePlacementText(getValue(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
    const name = normalizePlacementText(getValue(row, ['studentname', 'name']));
    const branch = normalizePlacementText(getValue(row, ['branch', 'sittingbranch']));
    if (roll) placedStudentRolls.add(roll);
    else if (name && branch) placedStudentNameBranches.add(`${name}|${branch}`);
  });

  (Array.isArray(students) ? students : []).forEach((row, index) => {
    if (!canAccess(row)) return;
    const roll = normalizePlacementText(getValue(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']));
    const name = normalizePlacementText(getValue(row, ['studentname', 'name']));
    const branch = normalizePlacementText(getValue(row, ['branch', 'sittingbranch']));
    const studentKey = roll ? `roll:${roll}` : name ? `name:${name}|${branch}` : `row:${row?.rowNumber ?? index}`;
    eligibleStudents.add(studentKey);
    const placedFromLog = (roll && placedStudentRolls.has(roll))
      || (name && branch && placedStudentNameBranches.has(`${name}|${branch}`));
    const placementStatus = placedFromLog ? 'Placed' : getValue(row, ['placementstatus', 'placementstat']);
    if (isPlacementEligiblePending(placementStatus, getValue(row, ['coursepercentage']))) pendingStudents.add(studentKey);
  });

  return {
    totalStudents: eligibleStudents.size,
    placementPending: pendingStudents.size,
    // Every TPO_Log row marked Placed is one placement, including repeat rows
    // for a student who has more than one placement record.
    placed: countPlacementRecords(placementRows, getValue, canAccessPlacement)
  };
};

module.exports = { calculateDashboardPlacementCounts, countPlacementRecords, isPlacementOutcome };
