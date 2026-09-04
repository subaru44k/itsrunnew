import type { TrackAvailability } from './availability';
import type { TrackFacility } from './tracks';

export function availabilityActionUrl(
  track: TrackFacility,
  availability: TrackAvailability | null | undefined,
) {
  return track.urls.schedule
    || availability?.source.landingPageUrl
    || availability?.source.url
    || track.urls.individualUse
    || track.urls.official;
}
