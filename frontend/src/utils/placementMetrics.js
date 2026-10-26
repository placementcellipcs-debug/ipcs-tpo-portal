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
