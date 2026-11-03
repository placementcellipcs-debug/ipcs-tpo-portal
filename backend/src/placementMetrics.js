const { normalizePlacementText } = require('./placementRecords');

// TPO_Log.Status is the sole source for the portal's Placed measure. Keep
// joining and offer outcomes as separate measures so they never inflate it.
const placementOutcome = (status, joiningStatus = '') => {
  const normalizedStatus = normalizePlacementText(status);
  const normalizedJoining = normalizePlacementText(joiningStatus);
  const placed = normalizedStatus === 'placed';
  const joined = normalizedStatus === 'joined' || normalizedJoining === 'joined';
  return {
    placed,
    joined,
    offer: ['offer', 'offered', 'offerreleased', 'offeraccepted'].includes(normalizedStatus),
    // Joining is a separate outcome from placement. A student can be Placed
    // and still have a Not Joined outcome, so do not suppress it when placed.
    notJoined: !joined && (['notjoined', 'notjoining', 'notplaced', 'rejected', 'notattended', 'declined'].includes(normalizedStatus)
      || ['notjoined', 'notjoining', 'notjoinedyet', 'willnotjoin'].includes(normalizedJoining)),
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
