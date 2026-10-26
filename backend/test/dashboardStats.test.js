const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateDashboardPlacementCounts, countPlacementRecords } = require('../src/dashboardStats');

const getValue = (row, aliases) => {
  for (const alias of aliases) {
    const key = Object.keys(row).find(candidate => candidate.toLowerCase().replace(/[^a-z0-9]/g, '') === alias.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (key && row[key] !== undefined && row[key] !== null) return String(row[key]).trim();
  }
  return '';
};

test('dashboard helper counts unique students while counting only exact Placed statuses', () => {
  const students = [
    { Roll_Number: 'R-001', Student_Name: 'Alex K', Branch: 'Kochi', Course: 'Digital Marketing' },
    { Roll_Number: 'R-001', Student_Name: 'Alex K', Branch: 'Kochi', Course: 'Digital Marketing' },
    { Roll_Number: 'R-002', Student_Name: 'Alex K', Branch: 'Kochi', Course: 'Digital Marketing' },
    { Roll_Number: 'R-003', Student_Name: 'Sam', Branch: 'Calicut', Course: 'Digital Marketing' },
  ];
  const placements = [
    { Roll_Number: 'R-001', Student_Name: 'Alex K', Company: 'Company A', Status: 'Placed', Branch: 'Kochi', Course: 'Digital Marketing' },
    { Roll_Number: 'R-001', Student_Name: 'Alex K', Company: 'Company B', Status: 'Got Offer', Branch: 'Kochi', Course: 'Digital Marketing' },
    { Roll_Number: 'R-002', Student_Name: 'Alex K', Company: 'Company C', Status: 'Applied', Branch: 'Kochi', Course: 'Digital Marketing' },
    { Roll_Number: 'R-999', Student_Name: 'Unknown', Company: 'Company D', Status: 'Placed', Branch: 'Kochi', Course: 'Digital Marketing' },
  ];
  const canAccess = row => row.Branch === 'Kochi';

  assert.deepEqual(calculateDashboardPlacementCounts(students, placements, getValue, canAccess), {
    totalStudents: 2,
    placed: 2,
  });
});

test('dashboard excludes placements outside the user’s branch and resolves an unambiguous name when roll is missing', () => {
  const students = [
    { Student_Name: 'Jordan Smith', Branch: 'Kochi', Course: 'Digital Marketing' },
    { Roll_Number: 'R-002', Student_Name: 'Alex K', Branch: 'Kochi', Course: 'Digital Marketing' },
  ];
  const placements = [
    { Student_Name: 'Jordan Smith', Company: 'Company A', Status: 'Joined', Branch: 'Kochi', Course: 'Digital Marketing' },
    { Student_Name: 'Another Student', Company: 'Company B', Status: 'Placed', Branch: 'Calicut', Course: 'Digital Marketing' },
  ];

  assert.deepEqual(calculateDashboardPlacementCounts(students, placements, getValue, row => row.Branch === 'Kochi'), {
    totalStudents: 2,
    placed: 0,
  });
});

test('dashboard headline counts placement rows and excludes offers and joining outcomes', () => {
  const placements = [
    { Status: 'Placed' },
    { Status: 'Placed' },
    { Status: 'Offer' },
    { Status: 'Joined' },
    { Status: 'Not Joined' },
  ];
  assert.equal(countPlacementRecords(placements, getValue), 2);
});

test('dashboard includes students marked placed in the student register even without a matching TPO log', () => {
  const students = [
    { Roll_Number: 'R-001', Student_Name: 'Alex K', Branch: 'Kochi', Placement_Status: 'Placed' },
    { Roll_Number: 'R-002', Student_Name: 'Sam', Branch: 'Kochi', Placement_Status: 'Not Placed' },
  ];
  const placements = [
    { Roll_Number: 'R-001', Student_Name: 'Alex K', Company: 'Company A', Status: 'Placed', Branch: 'Kochi' },
  ];

  assert.deepEqual(calculateDashboardPlacementCounts(students, placements, getValue), {
    totalStudents: 2,
    placed: 1,
  });
});
