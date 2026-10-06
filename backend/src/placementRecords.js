const normalizePlacementText = value => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');

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
  const latest = new Map();
  (Array.isArray(rows) ? rows : []).filter(row => !/^\s*(?:yes|true|1)\s*$/i.test(String(getValue(row, ['tpoactionlog']) || ''))).forEach((row, index) => {
    const identity = placementIdentity(row, getValue);
    if (!identity) {
      latest.set(`unkeyed:${row?.rowNumber || index}`, row);
      return;
    }
    const existing = latest.get(identity);
    const currentTime = placementTimestamp(row, getValue);
    const existingTime = existing ? placementTimestamp(existing, getValue) : -1;
    if (!existing || currentTime > existingTime || (currentTime === existingTime && Number(row.rowNumber || 0) >= Number(existing.rowNumber || 0))) {
      latest.set(identity, row);
    }
  });
  return [...latest.values()].sort((a, b) => placementTimestamp(b, getValue) - placementTimestamp(a, getValue) || Number(b.rowNumber || 0) - Number(a.rowNumber || 0));
};

module.exports = { normalizePlacementText, placementIdentity, latestPlacementRows };
