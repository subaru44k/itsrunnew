import type { AvailabilityStatus, TrackAvailability } from './availability';
import type { TrackFacility } from './tracks';

export interface TrackAlternative {
  track: TrackFacility;
  distance: number;
  availability: TrackAvailability;
}

// Express availability confidence as a distance trade-off. This keeps a very
// close "needs confirmation" facility useful, while promoting a confirmed
// option that is only a reasonable distance farther away.
const statusDistancePenalty: Record<AvailabilityStatus, number> = {
  available: 0,
  partially_available: 6,
  unknown: 30,
  unavailable: 60,
};

const statusOrder: Record<AvailabilityStatus, number> = {
  available: 0,
  partially_available: 1,
  unknown: 2,
  unavailable: 3,
};

export function alternativeScore(item: Pick<TrackAlternative, 'distance' | 'availability'>) {
  return item.distance + statusDistancePenalty[item.availability.status];
}

export function rankTrackAlternatives(candidates: TrackAlternative[], limit = 5) {
  return [...candidates]
    .sort((left, right) => alternativeScore(left) - alternativeScore(right)
      || statusOrder[left.availability.status] - statusOrder[right.availability.status]
      || left.distance - right.distance
      || left.track.id.localeCompare(right.track.id))
    .slice(0, limit);
}
