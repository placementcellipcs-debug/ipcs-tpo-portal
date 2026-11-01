import { normalizePlacementText } from './placementRecords.js';

// TPO_Log.Status is the sole source for Placed counts. Offers and joining
// outcomes are separate measures and must not be folded into the placed total.
export const placementOutcome = (status, joiningStatus = '') => {
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
  isPlacementPendingStatus(status) && coursePercentageValue(percentage) >= 80;
