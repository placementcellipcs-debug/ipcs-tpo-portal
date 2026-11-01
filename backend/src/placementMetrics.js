const { normalizePlacementText } = require('./placementRecords');

// TPO_Log.Status is the sole source for the portal's Placed measure. Keep
// joining and offer outcomes as separate measures so they never inflate it.
const placementOutcome = (status, joiningStatus = '') => {
  const normalizedStatus = normalizePlacementText(status);
  const normalizedJoining = normalizePlacementText(joiningStatus);
  const placed = normalizedStatus === 'placed';
  return {
    placed,
    joined: normalizedStatus === 'joined' || normalizedJoining === 'joined',
    offer: ['offer', 'offered', 'offerreleased', 'offeraccepted'].includes(normalizedStatus),
    notJoined: !placed && (['notjoined', 'notplaced', 'rejected', 'notattended', 'declined'].includes(normalizedStatus)
      || ['notjoined', 'notjoinedyet'].includes(normalizedJoining)),
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
  isPlacementPendingStatus(status) && coursePercentageValue(percentage) >= 80;

module.exports = {
  placementOutcome,
  isPlacedStatus,
  coursePercentageValue,
  isPlacementPendingStatus,
  isPlacementEligiblePending
};
