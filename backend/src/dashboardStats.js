const { normalizePlacementText, isTpoActionLog } = require('./placementRecords');
const { isPlacedStatus, isPlacementEligiblePending } = require('./placementMetrics');

const isPlacementOutcome = (row, getValue) => {
  // Keep every real Placed event, including repeat placements. Audit snapshots
  // marked as TPO action logs are not separate placement events.
  return !isTpoActionLog(row, getValue) && isPlacedStatus(getValue(row, ['status']));
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
    if (!canAccessPlacement(row) || !isPlacementOutcome(row, getValue)) return;
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
    // Count each actual placement event. Repeat placements remain separate;
    // TPO action-history snapshots are excluded by isPlacementOutcome.
    placed: countPlacementRecords(placementRows, getValue, canAccessPlacement)
  };
};

module.exports = { calculateDashboardPlacementCounts, countPlacementRecords, isPlacementOutcome };
