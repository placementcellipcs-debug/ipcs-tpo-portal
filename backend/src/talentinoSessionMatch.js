const { normalizePlacementText } = require('./placementRecords');

const createTalentinoSessionResolver = (scheduleRows, getValue, parseDate) => {
  const byId = new Map();
  const byBranchDate = new Map();
  (Array.isArray(scheduleRows) ? scheduleRows : []).forEach(row => {
    const sessionId = normalizePlacementText(getValue(row, ['sessionid', 'eventid', 'event id', 'id']));
    if (sessionId) byId.set(sessionId, [...(byId.get(sessionId) || []), row]);
    const date = parseDate(getValue(row, ['date', 'dateoftheevent', 'sessiondate', 'timestamp']));
    const branch = normalizePlacementText(getValue(row, ['branch', 'sittingbranch']));
    if (!date || !branch) return;
    const key = `${branch}|${date.toDateString()}`;
    byBranchDate.set(key, [...(byBranchDate.get(key) || []), row]);
  });

  return attendance => {
    const attendanceId = normalizePlacementText(getValue(attendance, ['sessionid', 'eventid', 'event id']));
    const idMatches = attendanceId ? byId.get(attendanceId) || [] : [];
    if (idMatches.length === 1) return { session: idMatches[0], matchType: 'session-id' };

    const date = parseDate(getValue(attendance, ['timestamp', 'date', 'time', 'present check-ins date']));
    const branch = normalizePlacementText(getValue(attendance, ['branch', 'sittingbranch']));
    const matches = date && branch ? byBranchDate.get(`${branch}|${date.toDateString()}`) || [] : [];
    if (matches.length === 1) return { session: matches[0], matchType: 'legacy-branch-date' };
    if (matches.length > 1 || idMatches.length > 1) return { session: null, matchType: 'ambiguous' };
    return { session: null, matchType: 'unmatched' };
  };
};

module.exports = { createTalentinoSessionResolver };
