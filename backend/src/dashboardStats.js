const { normalizePlacementText } = require('./placementRecords');

const studentKeyParts = (row, getValue) => ({
  roll: normalizePlacementText(getValue(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll'])),
  name: normalizePlacementText(getValue(row, ['studentname', 'name'])),
});

const isPlacementOutcome = (row, getValue) => {
  const isPositive = value => {
    const status = normalizePlacementText(value);
    if (!status || ['notplaced', 'unplaced', 'notjoined', 'didnotjoin', 'notselected', 'notaccepted', 'rejected', 'declined', 'withdrawn'].some(term => status.includes(term))) return false;
    return status.includes('placed') || status.includes('offer') || status.includes('join');
  };

  return [
    getValue(row, ['status']),
    getValue(row, ['joiningstatus']),
    getValue(row, ['placementstatus', 'placementstat', 'placementstatsu']),
  ].some(isPositive);
};

const calculateDashboardPlacementCounts = (students, placementRows, getValue, canAccess = () => true) => {
  const eligibleStudents = new Set();
  const rollToStudent = new Map();
  const studentsByName = new Map();
  const placedStudents = new Set();

  (Array.isArray(students) ? students : []).forEach((row, index) => {
    if (!canAccess(row)) return;

    const { roll, name } = studentKeyParts(row, getValue);
    const key = roll ? `roll:${roll}` : name ? `name:${name}` : `row:${row?.rowNumber ?? index}`;
    eligibleStudents.add(key);
    // The student register is also a placement source: staff can update its
    // Placement Status without a matching TPO_Log row being present.
    if ((roll || name) && isPlacementOutcome(row, getValue)) placedStudents.add(key);

    if (roll) rollToStudent.set(roll, key);
    if (name) {
      if (!studentsByName.has(name)) studentsByName.set(name, new Set());
      studentsByName.get(name).add(key);
    }
  });

  const resolveRegisteredStudent = row => {
    const { roll, name } = studentKeyParts(row, getValue);
    if (roll && rollToStudent.has(roll)) return rollToStudent.get(roll);
    const nameMatches = name ? studentsByName.get(name) : null;
    return nameMatches?.size === 1 ? nameMatches.values().next().value : null;
  };

  (Array.isArray(placementRows) ? placementRows : []).forEach(row => {
    if (!canAccess(row) || !isPlacementOutcome(row, getValue)) return;
    const studentKey = resolveRegisteredStudent(row);
    if (studentKey && eligibleStudents.has(studentKey)) placedStudents.add(studentKey);
  });

  return { totalStudents: eligibleStudents.size, placed: placedStudents.size };
};

module.exports = { calculateDashboardPlacementCounts, isPlacementOutcome };
