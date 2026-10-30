export const splitAssignments = value => (Array.isArray(value) ? value : String(value || '').split(/[\n,;]+/))
  .map(item => String(item || '').trim()).filter(Boolean);

export const normalizeAcademicBranch = value => String(value || '').trim().toLowerCase().replace(/\bbranch\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

export const standardizeAcademicCourse = value => {
  const course = String(value || '').toLowerCase();
  if (course.includes('bms') || course.includes('cctv')) return 'bms and cctv';
  if (course.includes('automation') || course.includes('plc') || course.includes('scada')) return 'industrial automation';
  if (course.includes('embed') || course.includes('iot')) return 'embedded and iot';
  if (course.includes('digital') || course.includes('marketing') || /(^|[^a-z])dm([^a-z]|$)/.test(course)) return 'digital marketing';
  if (course.includes('information technology') || course.includes('python') || course.includes('software') || course.includes('data') || /(^|[^a-z])it([^a-z]|$)/.test(course)) return 'information technology';
  return normalizeAcademicBranch(course);
};

export const getTrainerAssignments = user => {
  const branches = [...new Set([
    ...splitAssignments(user?.assignedBranchesArray),
    ...splitAssignments(user?.assignedBranches),
    ...splitAssignments(user?.sittingBranch),
  ].filter(value => !/^n\/?a$/i.test(value)))];
  const courses = [...new Set(splitAssignments(user?.assignedCourse))];
  return { branches, courses };
};

export const isWithinTrainerScope = (record, assignments) => {
  const branchKey = normalizeAcademicBranch(record?.branch);
  const branchMatch = branchKey && assignments.branches.some(value => {
    const assigned = normalizeAcademicBranch(value);
    return assigned === 'all' || assigned === 'all branches' || branchKey === assigned || branchKey.includes(assigned) || assigned.includes(branchKey);
  });
  const courseKey = standardizeAcademicCourse(record?.mainCourse || record?.course);
  const courseMatch = courseKey && assignments.courses.some(value => {
    const assigned = standardizeAcademicCourse(value);
    return !['all', 'all courses'].includes(assigned) && assigned === courseKey;
  });
  return Boolean(branchMatch && courseMatch);
};

export const trainerScopeLabels = user => {
  const { branches, courses } = getTrainerAssignments(user);
  return {
    branches: branches.length ? branches.join(' · ') : 'Branch assignment pending',
    courses: courses.length ? courses.join(' · ') : 'Course assignment pending',
  };
};
