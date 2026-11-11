import type { AvailabilityStatus } from '../../model/availability';

export type MapPoint = { latitude: number; longitude: number };
export type FacilityMarker = MapPoint & { id: string; name: string; status: AvailabilityStatus; selected: boolean; kind?: 'course' };
export type MapState = {
  facilities: FacilityMarker[];
  reference: MapPoint | null;
  referenceLabel: string;
  english: boolean;
  selecting: boolean;
};
export type MapCallbacks = {
  select: (id: string) => void;
  point: (point: MapPoint) => void;
  zoom: (zoom: number) => void;
  error: () => void;
  ready: () => void;
};
export interface TrackMapEngine {
  update(state: MapState): void;
  setView(point: MapPoint, zoom: number, animate?: boolean): void;
  fitBounds(points: MapPoint[], padding: number, maxZoom: number): void;
  getZoom(): number;
  resize(): void;
  remove(): void;
}

export function markerButton(marker: FacilityMarker, english: boolean, select: () => void) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'track-marker-shell';
  const statuses = {
    available: ['利用可能', 'Available'], partially_available: ['一部利用可能', 'Partly available'],
    unknown: ['要確認', 'Needs confirmation'], unavailable: ['利用不可', 'Unavailable'],
  };
  button.title = `${marker.name}: ${statuses[marker.status][english ? 1 : 0]}${marker.kind === 'course' ? (english ? ' (running course)' : '（ランニングコース）') : ''}`;
  button.setAttribute('aria-label', button.title);
  button.setAttribute('aria-pressed', String(marker.selected));
  button.dataset.trackId = marker.id;
  const dot = document.createElement('span');
  dot.className = `track-marker track-marker--${marker.status}${marker.kind === 'course' ? ' track-marker--course' : ''}${marker.selected ? ' track-marker--selected' : ''}`;
  dot.setAttribute('aria-hidden', 'true');
  button.append(dot);
  button.addEventListener('click', event => { event.stopPropagation(); select(); });
  return button;
}
