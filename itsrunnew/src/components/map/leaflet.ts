import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { markerButton, type MapCallbacks, type MapPoint, type MapState, type TrackMapEngine } from './types';

export function createMap(element: HTMLElement, callbacks: MapCallbacks): TrackMapEngine {
  const map = L.map(element).setView([35.6896, 139.6917], 13);
  const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19, className: 'muted-map-tiles',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  tiles.on('tileerror', callbacks.error);
  tiles.on('load', callbacks.ready);
  const layer = L.layerGroup().addTo(map);
  let state: MapState;
  const bounds = (points: MapPoint[]) => L.latLngBounds(points.map(p => [p.latitude, p.longitude]));
  function render() {
    if (!state) return;
    layer.clearLayers();
    const groups = new Map<string, MapState['facilities']>();
    for (const item of state.facilities) {
      const p = map.project([item.latitude, item.longitude]);
      const key = map.getZoom() <= 12 && !item.selected ? `${Math.floor(p.x / 150)}:${Math.floor(p.y / 150)}` : item.id;
      groups.set(key, [...(groups.get(key) ?? []), item]);
    }
    for (const group of groups.values()) {
      if (group.length === 1) {
        const item = group[0];
        const button = markerButton(item, state.english, () => { if (!state.selecting) callbacks.select(item.id); });
        button.disabled = state.selecting;
        L.marker([item.latitude, item.longitude], { keyboard: false, icon: L.divIcon({ html: button, className: 'map-marker-wrapper', iconSize: [44, 44], iconAnchor: [22, 22] }) }).addTo(layer);
      } else {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'track-cluster-shell';
        button.disabled = state.selecting;
        button.title = state.english ? `${group.length} facilities, zoom in` : `${group.length}施設、拡大する`;
        button.setAttribute('aria-label', button.title);
        button.innerHTML = `<span class="track-cluster">${group.length}</span>`;
        button.onclick = event => { event.stopPropagation(); map.fitBounds(bounds(group), { padding: [30, 30], maxZoom: 14 }); };
        L.marker([group.reduce((s, p) => s + p.latitude, 0) / group.length, group.reduce((s, p) => s + p.longitude, 0) / group.length], { keyboard: false, icon: L.divIcon({ html: button, className: 'map-marker-wrapper', iconSize: [44, 44], iconAnchor: [22, 22] }) }).addTo(layer);
      }
    }
    if (state.reference) L.marker([state.reference.latitude, state.reference.longitude], { interactive: false, keyboard: false, title: state.referenceLabel, icon: L.divIcon({ className: 'current-location-shell', html: '<span class="search-origin-dot"></span>', iconSize: [24, 24], iconAnchor: [12, 12] }) }).addTo(layer);
    element.style.cursor = state.selecting ? 'crosshair' : '';
    element.classList.toggle('is-selecting', state.selecting);
  }
  map.on('click', event => { if (state?.selecting) callbacks.point({ latitude: event.latlng.lat, longitude: event.latlng.lng }); });
  map.on('zoomend', () => { callbacks.zoom(map.getZoom()); render(); });
  return {
    update(value) { state = value; render(); },
    setView(p, zoom, animate = false) { if (animate) map.flyTo([p.latitude, p.longitude], zoom); else map.setView([p.latitude, p.longitude], zoom); },
    fitBounds(points, padding, maxZoom) { if (points.length) map.fitBounds(bounds(points), { padding: [padding, padding], maxZoom }); },
    getZoom: () => map.getZoom(), resize: () => map.invalidateSize(), remove: () => map.remove(),
  };
}
