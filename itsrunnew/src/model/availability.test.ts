import { describe, expect, it } from 'vitest';
import { isTodayCandidate } from './availability';

describe('availability filtering', () => {
  it('keeps unknown facilities in today candidates', () => {
    expect(isTodayCandidate('available')).toBe(true);
    expect(isTodayCandidate('partially_available')).toBe(true);
    expect(isTodayCandidate('unknown')).toBe(true);
    expect(isTodayCandidate('unavailable')).toBe(false);
  });

  it('shows every status only when unavailable facilities are explicitly requested', () => {
    expect(isTodayCandidate('unavailable', true)).toBe(true);
    expect(isTodayCandidate('unknown', true)).toBe(true);
  });
});
