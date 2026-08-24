import rawTracks from '../data/tracks.json';

export type LocaleName = { ja: string; en: string };
export type IndividualUseStatus = 'available' | 'temporarily-unavailable' | 'unavailable' | 'unknown';

export interface TrackFacility {
  id: string;
  name: LocaleName;
  location: { latitude: number; longitude: number; address: string };
  track: { lengthMeters: number | null; lanes: number | null; surface: string | null };
  certification: { jaafCertified: boolean | null; jaafClass: number | string | null };
  individualUse: {
    status: IndividualUseStatus;
    feeYen: number | null;
    feeUnit: string | null;
    openingHours: string | null;
    spikesAllowed: boolean | null;
    note: string | null;
  };
  urls: { official: string; individualUse: string | null; schedule: string | null };
  externalIds: { jaaf: string | null; osm: string[] };
  sources: { url: string; type: string; verifiedAt: string }[];
}

export const tracks = rawTracks as TrackFacility[];

export function distanceKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const earthRadiusKm = 6371;
  const latitudeDelta = radians(b.latitude - a.latitude);
  const longitudeDelta = radians(b.longitude - a.longitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(a.latitude)) * Math.cos(radians(b.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function directionsUrl(track: TrackFacility, origin?: { latitude: number; longitude: number } | null) {
  const params = new URLSearchParams({
    api: '1',
    destination: `${track.location.latitude},${track.location.longitude}`,
    travelmode: 'walking',
  });
  if (origin) params.set('origin', `${origin.latitude},${origin.longitude}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
