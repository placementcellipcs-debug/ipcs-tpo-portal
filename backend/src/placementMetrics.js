const { normalizePlacementText } = require('./placementRecords');

// TPO_Log.Status is the source for the portal's Placed measure. When a Joining
// Status value exists, it is the source of truth for joining classifications.
const placementOutcome = (status, joiningStatus = '') => {
  const normalizedStatus = normalizePlacementText(status);
  const normalizedJoining = normalizePlacementText(joiningStatus);
  const placed = normalizedStatus === 'placed';
  const explicitJoiningStatuses = new Set([
    'joined', 'notjoined', 'notjoining', 'notjoinedyet', 'willnotjoin',
    'pendingjoining', 'dualplacement', 'multipleplacement'
  ]);
  const hasExplicitJoiningStatus = explicitJoiningStatuses.has(normalizedJoining);
  const joined = hasExplicitJoiningStatus
    ? normalizedJoining === 'joined'
    : normalizedStatus === 'joined';
  return {
    placed,
    joined,
    offer: ['offer', 'offered', 'offerreleased', 'offeraccepted'].includes(normalizedStatus),
    // A populated Joining Status is exclusive: each placement row belongs to
    // one joining category, including Pending Joining, Dual, or Multiple.
    notJoined: hasExplicitJoiningStatus
      ? ['notjoined', 'notjoining', 'notjoinedyet', 'willnotjoin'].includes(normalizedJoining)
      : ['notjoined', 'notjoining', 'notplaced', 'rejected', 'notattended', 'declined'].includes(normalizedStatus),
  };
};

const isPlacedStatus = status => placementOutcome(status).placed;

const coursePercentageValue = value => {
  const match = String(value ?? '').replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed > 0 && parsed <= 1 ? parsed * 100 : parsed));
};

const isPlacementPendingStatus = status => {
  const normalized = normalizePlacementText(status);
  return normalized === 'pending' || normalized === 'placementneeded' || normalized === 'pendingforplacement';
};

const isPlacementEligiblePending = (status, percentage) =>
  isPlacementPendingStatus(status) && coursePercentageValue(percentage) >= 90;

module.exports = {
  placementOutcome,
  isPlacedStatus,
  coursePercentageValue,
  isPlacementPendingStatus,
  isPlacementEligiblePending
};
