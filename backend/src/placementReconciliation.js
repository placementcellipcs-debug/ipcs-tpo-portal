const { isPlacedStatus } = require('./placementMetrics');
const { normalizePlacementText } = require('./placementRecords');

const placementKey = (row, getValue) => {
  const student = normalizePlacementText(getValue(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']))
    || normalizePlacementText(getValue(row, ['studentname', 'name']));
  if (!student) return '';
  const jobId = normalizePlacementText(getValue(row, ['jobid', 'job id']));
  const company = normalizePlacementText(getValue(row, ['companyname', 'company']));
  const position = normalizePlacementText(getValue(row, ['position', 'role']));
  return `${student}|${jobId || (company || position ? `${company}|${position}` : 'general')}`;
};

const buildPlacementReconciliation = ({ tpoLogs = [], placedStudents = [], applications = [], getValue }) => {
  const sourceRows = (Array.isArray(tpoLogs) ? tpoLogs : []).filter(row => isPlacedStatus(getValue(row, ['status'])));
  const sourceByKey = new Map(sourceRows.map((row, index) => {
    const rowNumber = Number(row?.rowNumber) || index + 2;
    return [`TPO_Log:${rowNumber}`, row];
  }));
  const keyForProjection = (row, index) => {
    const explicit = String(getValue(row, ['recordkey']) || '').trim();
    if (explicit) return explicit;
    const sourceSheet = String(getValue(row, ['sourcesheet']) || '').trim();
    const sourceRow = Number(getValue(row, ['sourcerow']));
    if (sourceSheet === 'TPO_Log' && Number.isInteger(sourceRow) && sourceRow >= 2) return `TPO_Log:${sourceRow}`;
    return `unlinked:${Number(row?.rowNumber) || index + 2}`;
  };
  const projectionByKey = new Map();
  const duplicateProjectionKeys = [];
  (Array.isArray(placedStudents) ? placedStudents : []).forEach((row, index) => {
    const key = keyForProjection(row, index);
    if (projectionByKey.has(key)) duplicateProjectionKeys.push(key);
    else projectionByKey.set(key, row);
  });

  const missingRows = [...sourceByKey.entries()]
    .filter(([key]) => !projectionByKey.has(key))
    .map(([key, row]) => ({ key, rowNumber: row.rowNumber, name: getValue(row, ['studentname', 'name']), roll: getValue(row, ['rollnumber', 'rollno', 'roll']), company: getValue(row, ['companyname', 'company']), status: getValue(row, ['status']) }));
  const staleRows = [...projectionByKey.entries()]
    .filter(([key]) => !sourceByKey.has(key))
    .map(([key, row]) => ({ key, rowNumber: row.rowNumber, name: getValue(row, ['studentname', 'name']), roll: getValue(row, ['rollnumber', 'rollno', 'roll']), company: getValue(row, ['companyname', 'company']), status: getValue(row, ['status']) }));

  const canonicalLogKeys = new Set((Array.isArray(tpoLogs) ? tpoLogs : [])
    .filter(row => !/^(yes|true|1)$/i.test(String(getValue(row, ['tpoactionlog']) || '').trim()))
    .map(row => placementKey(row, getValue)).filter(Boolean));
  const missingManualLogRows = (Array.isArray(applications) ? applications : [])
    .filter(row => {
      const source = normalizePlacementText(getValue(row, ['entrysource', 'recordorigin', 'origin', 'source']));
      const jobId = normalizePlacementText(getValue(row, ['jobid', 'job id']));
      const isManual = source === 'manualadd' || jobId === 'manualadd';
      const key = placementKey(row, getValue);
      return isManual && key && !canonicalLogKeys.has(key);
    })
    .map(row => ({ rowNumber: row.rowNumber, name: getValue(row, ['studentname', 'name']), roll: getValue(row, ['rollnumber', 'rollno', 'roll']), company: getValue(row, ['companyname', 'company']), position: getValue(row, ['position', 'role']), status: getValue(row, ['status']) }));

  return {
    sourceCount: sourceRows.length,
    projectionCount: (Array.isArray(placedStudents) ? placedStudents : []).length,
    missingCount: missingRows.length,
    staleCount: staleRows.length,
    duplicateCount: duplicateProjectionKeys.length,
    missingManualLogCount: missingManualLogRows.length,
    missingRows: missingRows.slice(0, 100),
    staleRows: staleRows.slice(0, 100),
    duplicateProjectionKeys: duplicateProjectionKeys.slice(0, 100),
    missingManualLogRows: missingManualLogRows.slice(0, 100),
  };
};

module.exports = { buildPlacementReconciliation };
