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

module.exports = { placementOutcome, isPlacedStatus };
