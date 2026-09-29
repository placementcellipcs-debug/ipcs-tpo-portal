const cleanHeader = value => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export const normalizePlacementText = value => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

export const getPlacementValue = (record, aliases) => {
  if (!record || typeof record !== 'object') return '';
  const keys = Object.keys(record);
  const targets = (Array.isArray(aliases) ? aliases : [aliases]).map(cleanHeader);
  for (const target of targets) {
    const key = keys.find(candidate => cleanHeader(candidate) === target);
    if (key && record[key] !== undefined && record[key] !== null && String(record[key]).trim() !== '') return String(record[key]).trim();
  }
  for (const target of targets) {
    const key = keys.find(candidate => target.length >= 5 && cleanHeader(candidate).includes(target));
    if (key && record[key] !== undefined && record[key] !== null && String(record[key]).trim() !== '') return String(record[key]).trim();
  }
  return '';
};

const parsePlacementTime = value => {
  const input = String(value || '').trim();
  if (!input) return 0;
  const match = input.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (match) {
    const [, first, second, year] = match;
    const firstNumber = Number(first);
    const secondNumber = Number(second);
    const day = secondNumber > 12 ? secondNumber : firstNumber;
    const month = secondNumber > 12 ? firstNumber : secondNumber;
    const parsed = new Date(Number(year), month - 1, day).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  const direct = Date.parse(input);
  return Number.isFinite(direct) ? direct : 0;
};

export const getPlacementIdentity = record => {
  const roll = getPlacementValue(record, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']);
  const name = getPlacementValue(record, ['studentname', 'name']);
  const company = getPlacementValue(record, ['companyname', 'company']);
  const student = normalizePlacementText(roll) || normalizePlacementText(name);
  const normalizedCompany = normalizePlacementText(company);
  return student && normalizedCompany ? `${student}|${normalizedCompany}` : '';
};

export const latestPlacementRecords = records => {
  const latest = new Map();
  (Array.isArray(records) ? records : []).forEach((record, index) => {
    const identity = getPlacementIdentity(record);
    if (!identity) {
      latest.set(`unkeyed:${record?.rowNumber || record?.rowIdx || index}`, record);
      return;
    }
    const timestamp = parsePlacementTime(
      getPlacementValue(record, ['timestamp', 'createdat', 'updatedat']) ||
      getPlacementValue(record, ['dateplaced', 'date', 'applicationdate'])
    );
    const rowNumber = Number(record?.rowNumber || record?.rowIdx || 0);
    const previous = latest.get(identity);
    const previousTimestamp = previous ? parsePlacementTime(
      getPlacementValue(previous, ['timestamp', 'createdat', 'updatedat']) ||
      getPlacementValue(previous, ['dateplaced', 'date', 'applicationdate'])
    ) : -1;
    const previousRowNumber = Number(previous?.rowNumber || previous?.rowIdx || 0);
    if (!previous || timestamp > previousTimestamp || (timestamp === previousTimestamp && rowNumber >= previousRowNumber)) latest.set(identity, record);
  });
  return [...latest.values()].sort((a, b) => {
    const aTime = parsePlacementTime(getPlacementValue(a, ['timestamp', 'createdat', 'updatedat']) || getPlacementValue(a, ['dateplaced', 'date', 'applicationdate']));
    const bTime = parsePlacementTime(getPlacementValue(b, ['timestamp', 'createdat', 'updatedat']) || getPlacementValue(b, ['dateplaced', 'date', 'applicationdate']));
    return bTime - aTime || Number(b?.rowNumber || b?.rowIdx || 0) - Number(a?.rowNumber || a?.rowIdx || 0);
  });
};
