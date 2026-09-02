import { describe, expect, it } from 'vitest';
import type { TrackAvailability } from './availability';
import { alternativeScore, rankTrackAlternatives, type TrackAlternative } from './track-alternatives';
import { tracks } from './tracks';

function candidate(index: number, status: TrackAvailability['status'], distance: number): TrackAlternative {
  return {
    track: tracks[index],
    distance,
    availability: { status } as TrackAvailability,
  };
}

describe('alternative track ranking', () => {
  it('balances confirmed availability with practical distance', () => {
    const nearbyUnknown = candidate(0, 'unknown', 1);
    const reasonableAvailable = candidate(1, 'available', 8);
    const distantAvailable = candidate(2, 'available', 40);

    expect(rankTrackAlternatives([nearbyUnknown, distantAvailable, reasonableAvailable]))
      .toEqual([reasonableAvailable, nearbyUnknown, distantAvailable]);
  });

  it('keeps needs-confirmation distinct from unavailable and limits the result', () => {
    const candidates = [
      candidate(0, 'unavailable', 0.5),
      candidate(1, 'unknown', 2),
      candidate(2, 'partially_available', 3),
      candidate(3, 'available', 4),
      candidate(4, 'available', 8),
      candidate(5, 'unknown', 1),
    ];

    const result = rankTrackAlternatives(candidates, 5);
    expect(result).toHaveLength(5);
    expect(result.map(item => item.availability.status)).toEqual([
      'available', 'available', 'partially_available', 'unknown', 'unknown',
    ]);
    expect(result).not.toContain(candidates[0]);
  });

  it('uses stable tie-breakers', () => {
    const available = candidate(1, 'available', 10);
    const partial = candidate(0, 'partially_available', 4);
    expect(alternativeScore(available)).toBe(alternativeScore(partial));
    expect(rankTrackAlternatives([partial, available])).toEqual([available, partial]);
  });
});
