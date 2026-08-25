import { describe, expect, it } from 'vitest';
import { directionsUrl, distanceKm, tracks } from './tracks';

describe('track dataset utilities', () => {
  it('has unique IDs and required provenance', () => {
    expect(tracks.length).toBeGreaterThanOrEqual(30);
    expect(tracks.length).toBeLessThanOrEqual(150);
    expect(new Set(tracks.map(track => track.id)).size).toBe(tracks.length);
    for (const track of tracks) {
      expect(track.urls.official).toMatch(/^https:\/\//);
      expect(track.sources.length).toBeGreaterThan(0);
      expect(track.sources.every(source => /^\d{4}-\d{2}-\d{2}$/.test(source.verifiedAt))).toBe(true);
    }
  });

  it('preserves every facility from the original 12-track MVP', () => {
    const ids = new Set(tracks.map(track => track.id));
    for (const id of [
      'nerima-general-sports-park', 'hikarigaoka-park-track', 'oizumi-chuo-park-track',
      'johoku-chuo-park-track', 'akatsuka-park-track', 'musashino-athletic-track',
      'inokashira-park-track', 'toda-sports-center-track', 'asaka-chuo-park-track',
      'niiza-general-sports-park-track', 'yoyogi-park-athletic-track',
      'tokyo-metropolitan-gymnasium-track',
    ]) expect(ids.has(id)).toBe(true);
  });

  it('calculates distance and keyless walking directions', () => {
    const distance = distanceKm({ latitude: 35.743, longitude: 139.606 }, tracks[0].location);
    expect(distance).toBeGreaterThan(3);
    expect(distance).toBeLessThan(6);
    const url = directionsUrl(tracks[0], { latitude: 35.743, longitude: 139.606 });
    expect(url).toContain('api=1');
    expect(url).toContain('travelmode=walking');
    expect(url).toContain('origin=');
  });
});
