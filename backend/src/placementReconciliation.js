const { isPlacedStatus } = require('./placementMetrics');
const { placementLogRecordKey } = require('./placementRecords');

const placementKey = (row, getValue) => {
  return placementLogRecordKey({
    roll: getValue(row, ['ipcsrollnumber', 'rollnumber', 'rollno', 'roll']),
    name: getValue(row, ['studentname', 'name']),
    jobId: getValue(row, ['jobid', 'job id']),
    company: getValue(row, ['companyname', 'company']),
    position: getValue(row, ['position', 'role'])
  });
};

const isActionHistoryRow = (row, getValue) => /^(yes|true|1)$/i.test(String(getValue(row, ['tpoactionlog']) || '').trim());
const placementHistoryTime = (row, getValue) => {
  const raw = String(getValue(row, ['timestamp', 'date', 'time']) || '').trim();
  if (!raw) return 0;
  if (/^\d+(?:\.\d+)?$/.test(raw)) return (Number(raw) - 25569) * 86400000;
  const local = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?)?/i);
  if (local) {
    let [, day, month, year, hour = '0', minute = '0', second = '0', meridiem = ''] = local;
    hour = Number(hour);
    if (meridiem.toUpperCase() === 'PM' && hour < 12) hour += 12;
    if (meridiem.toUpperCase() === 'AM' && hour === 12) hour = 0;
    return new Date(Number(year), Number(month) - 1, Number(day), hour, Number(minute), Number(second)).getTime();
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
};
const isPlacedTransition = (row, getValue) => {
  const details = String(getValue(row, ['actiondetails']) || '');
  return /status\s*:\s*.*?(?:→|->)\s*placed\b/i.test(details)
    || /status\s+changed\s+to\s+placed\b/i.test(details);
};

const recoverablePlacementHistory = (tpoLogs, getValue) => {
  const rows = Array.isArray(tpoLogs) ? tpoLogs : [];
  const canonicalKeys = new Set(rows
    .filter(row => !isActionHistoryRow(row, getValue))
    .map(row => placementKey(row, getValue)).filter(Boolean));
  const histories = new Map();
  rows.forEach((row, index) => {
    if (!isActionHistoryRow(row, getValue)) return;
    const key = placementKey(row, getValue);
    if (!key) return;
    const current = histories.get(key) || { latest: null, hasPlacedTransition: false };
    current.hasPlacedTransition ||= isPlacedTransition(row, getValue);
    const currentTime = placementHistoryTime(row, getValue);
    const latestTime = current.latest ? placementHistoryTime(current.latest, getValue) : -1;
    if (!current.latest || currentTime > latestTime
      || (currentTime === latestTime && Number(row?.rowNumber || index + 2) >= Number(current.latest?.rowNumber || 0))) current.latest = row;
    histories.set(key, current);
  });
  return [...histories.entries()].flatMap(([key, history]) => {
    const row = history.latest;
    if (canonicalKeys.has(key) || !history.hasPlacedTransition || !row
      || String(getValue(row, ['status']) || '').trim().toLowerCase() !== 'placed') return [];
    return [{
      key,
      rowNumber: Number(row.rowNumber) || 0,
      name: getValue(row, ['studentname', 'name']),
      roll: getValue(row, ['rollnumber', 'rollno', 'ipcsrollnumber', 'roll']),
      company: getValue(row, ['companyname', 'company']),
      position: getValue(row, ['position', 'role']),
      status: getValue(row, ['status']),
      entrySource: getValue(row, ['entrysource']),
      actionType: getValue(row, ['actiontype']),
      actionDetails: getValue(row, ['actiondetails']),
      _sourceRow: row
    }];
  }).sort((a, b) => a.rowNumber - b.rowNumber);
};

const buildPlacementReconciliation = ({ tpoLogs = [], placedStudents = [], applications = [], getValue }) => {
  const sourceRows = (Array.isArray(tpoLogs) ? tpoLogs : []).filter(row =>
    isPlacedStatus(getValue(row, ['status']))
      && !isActionHistoryRow(row, getValue)
  );
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
    .filter(row => !isActionHistoryRow(row, getValue))
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
    recoverableHistoryCount: recoverablePlacementHistory(tpoLogs, getValue).length,
    recoverableHistoryRows: recoverablePlacementHistory(tpoLogs, getValue).slice(0, 100).map(({ _sourceRow, ...row }) => row),
    missingRows: missingRows.slice(0, 100),
    staleRows: staleRows.slice(0, 100),
    duplicateProjectionKeys: duplicateProjectionKeys.slice(0, 100),
    missingManualLogRows: missingManualLogRows.slice(0, 100),
  };
};

module.exports = { buildPlacementReconciliation, recoverablePlacementHistory };
