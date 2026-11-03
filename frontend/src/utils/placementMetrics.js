import { normalizePlacementText } from './placementRecords.js';

// TPO_Log.Status is the source for Placed counts. When a Joining Status value
// exists, it is the source of truth for joining classifications.
export const placementOutcome = (status, joiningStatus = '') => {
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

export const isPlacedStatus = status => placementOutcome(status).placed;

export const coursePercentageValue = value => {
  const match = String(value ?? '').replace(/,/g, '.').match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;
  const parsed = Number(match[0]);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.min(100, parsed > 0 && parsed <= 1 ? parsed * 100 : parsed));
};

export const isPlacementPendingStatus = status => {
  const normalized = normalizePlacementText(status);
  return normalized === 'pending' || normalized === 'placementneeded' || normalized === 'pendingforplacement';
};

export const isPlacementEligiblePending = (status, percentage) =>
  isPlacementPendingStatus(status) && coursePercentageValue(percentage) >= 90;
