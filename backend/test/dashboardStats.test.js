const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateDashboardPlacementCounts } = require('../src/dashboardStats');

const getValue = (row, aliases) => {
  for (const alias of aliases) {
    const key = Object.keys(row).find(candidate => candidate.toLowerCase().replace(/[^a-z0-9]/g, '') === alias.toLowerCase().replace(/[^a-z0-9]/g, ''));
    if (key && row[key] !== undefined && row[key] !== null) return String(row[key]).trim();
  }
  return '';
};

test('dashboard counts unique placed students who exist in the visible student register', () => {
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
    placed: 1,
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
    placed: 1,
  });
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
