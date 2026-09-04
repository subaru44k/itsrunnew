import { describe, expect, it } from 'vitest';
import { availabilityDataset, type TrackAvailability } from './availability';
import { availabilityActionUrl } from './availability-link';
import { tracks, type TrackFacility } from './tracks';

const baseTrack = tracks[0];
const baseAvailability = availabilityDataset.facilities[0];

function trackWithUrls(overrides: Partial<TrackFacility['urls']>): TrackFacility {
  return { ...baseTrack, urls: { ...baseTrack.urls, ...overrides } };
}

function availabilityWithSource(overrides: Partial<TrackAvailability['source']>): TrackAvailability {
  return { ...baseAvailability, source: { ...baseAvailability.source, ...overrides } };
}

describe('availability action URL selection', () => {
  it('prefers the curated schedule URL over a rotating direct PDF', () => {
    const scheduleUrl = 'https://example.test/curated-schedule';
    const rotatingPdfUrl = 'https://example.test/rotating-schedule.pdf';

    expect(availabilityActionUrl(
      trackWithUrls({ schedule: scheduleUrl }),
      availabilityWithSource({ landingPageUrl: null, url: rotatingPdfUrl }),
    )).toBe(scheduleUrl);
  });

  it('uses the availability landing page when no schedule URL is configured', () => {
    const landingPageUrl = 'https://example.test/availability';

    expect(availabilityActionUrl(
      trackWithUrls({ schedule: null }),
      availabilityWithSource({ landingPageUrl, url: 'https://example.test/today.pdf' }),
    )).toBe(landingPageUrl);
  });

  it('uses the direct source URL when no stable availability link exists', () => {
    const sourceUrl = 'https://example.test/today.pdf';

    expect(availabilityActionUrl(
      trackWithUrls({ schedule: null }),
      availabilityWithSource({ landingPageUrl: null, url: sourceUrl }),
    )).toBe(sourceUrl);
  });

  it('falls back to individual-use and then official URLs', () => {
    const individualUseUrl = 'https://example.test/individual-use';
    const officialUrl = 'https://example.test/official';

    expect(availabilityActionUrl(
      trackWithUrls({ schedule: null, individualUse: individualUseUrl, official: officialUrl }),
      null,
    )).toBe(individualUseUrl);

    expect(availabilityActionUrl(
      trackWithUrls({ schedule: null, individualUse: null, official: officialUrl }),
      undefined,
    )).toBe(officialUrl);
  });
});
