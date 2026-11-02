const normalizePlacementText = value => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

const placementLogRecordKey = record => {
  const normalizedRoll = normalizePlacementText(record?.roll || record?.rollNumber || record?.ipcsRollNumber);
  const name = normalizePlacementText(record?.name || record?.studentName);
  // Some older manual entries use "IPCS" as a placeholder roll number. It
  // must not make different learners share the same upsert key.
  const placeholderRolls = new Set(['ipcs', 'na', 'none', 'null', 'unknown', 'notavailable', '0']);
  const student = normalizedRoll && !placeholderRolls.has(normalizedRoll) ? normalizedRoll : name || normalizedRoll;
  if (!student) return '';

  const jobId = normalizePlacementText(record?.jobId);
  const manualJobIds = new Set(['manualadd', 'manual', 'manualentry', 'manualplacement']);
  const company = normalizePlacementText(record?.company || record?.companyName);
  const position = normalizePlacementText(record?.position);
  const opening = jobId && !manualJobIds.has(jobId)
    ? `job:${jobId}`
    : company || position ? `manual:${company}|${position}` : 'manual:general';
  return `${student}|${opening}`;
};

const placementIdentity = (record, getValue) => {
  const roll = getValue(record, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']);
  const name = getValue(record, ['studentname', 'name']);
  const company = getValue(record, ['companyname', 'company']);
  const student = normalizePlacementText(roll) || normalizePlacementText(name);
  const normalizedCompany = normalizePlacementText(company);
  return student && normalizedCompany ? `${student}|${normalizedCompany}` : '';
};

const parsePlacementTime = value => {
  const input = String(value || '').trim();
  const localDate = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (localDate) {
    const [, day, month, year] = localDate;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day)).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  const direct = Date.parse(input);
  return Number.isFinite(direct) ? direct : 0;
};

const placementTimestamp = (record, getValue) => parsePlacementTime(
  getValue(record, ['timestamp', 'createdat', 'updatedat']) ||
  getValue(record, ['dateplaced', 'date', 'applicationdate'])
);

const latestPlacementRows = (rows, getValue) => {
  return (Array.isArray(rows) ? rows : []).slice().sort((a, b) =>
    placementTimestamp(b, getValue) - placementTimestamp(a, getValue)
      || Number(b.rowNumber || 0) - Number(a.rowNumber || 0)
  );
};

module.exports = { normalizePlacementText, placementIdentity, placementLogRecordKey, latestPlacementRows };
