<template>
  <div class="track-map-container">
    <div ref="element" id="track-map" class="track-map" data-engine="leaflet" :data-zoom="zoom" :data-facility-count="state.facilities.length" :aria-label="state.english ? 'Track map' : 'トラック地図'" />
    <div v-if="loading || failed" class="map-message" role="status">
      <span>{{ loading ? (state.english ? 'Loading map…' : '地図を読み込んでいます…') : (state.english ? 'The map could not be fully loaded. You can still use the facility list and date search.' : '地図を正常に読み込めませんでした。施設一覧・日付検索は引き続き利用できます。') }}</span>
      <button v-if="failed" type="button" @click="initialize">{{ state.english ? 'Retry map' : '地図を再読み込み' }}</button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { type MapPoint, type MapState, type TrackMapEngine } from './map/types';
const props = defineProps<{ state: MapState }>();
const emit = defineEmits<{ select: [id: string]; point: [point: MapPoint] }>();
const element = ref<HTMLElement>();
const zoom = ref(13);
const loading = ref(true);
const failed = ref(false);
let engine: TrackMapEngine | undefined;
let controller: AbortController | undefined;
let observer: ResizeObserver | undefined;
let timeout: number | undefined;
let pendingView: (engine: TrackMapEngine) => void = map => map.setView({ latitude: 35.6896, longitude: 139.6917 }, 13);
async function initialize() {
  if (!element.value) return;
  controller?.abort(); clearTimeout(timeout); engine?.remove(); engine = undefined;
  const current = new AbortController(); controller = current;
  loading.value = true; failed.value = false;
  timeout = window.setTimeout(() => { current.abort(); loading.value = false; failed.value = true; }, 15000);
  try {
    const callbacks = { select: (id: string) => emit('select', id), point: (point: MapPoint) => emit('point', point), zoom: (value: number) => { zoom.value = value; }, error: () => { if (controller === current) { failed.value = true; loading.value = false; clearTimeout(timeout); } }, ready: () => { if (controller === current) { loading.value = false; clearTimeout(timeout); } } };
    const { createMap } = await import('./map/leaflet');
    if (current.signal.aborted) return;
    const created = createMap(element.value, callbacks);
    if (current.signal.aborted) { created.remove(); return; }
    engine = created; engine.update(props.state); pendingView(engine); zoom.value = engine.getZoom();
  } catch { if (controller === current) { failed.value = true; loading.value = false; clearTimeout(timeout); } }
}
watch(() => props.state, state => engine?.update(state), { deep: true });
onMounted(() => { void initialize(); observer = new ResizeObserver(() => engine?.resize()); if (element.value) observer.observe(element.value); });
onBeforeUnmount(() => { controller?.abort(); controller = undefined; clearTimeout(timeout); observer?.disconnect(); engine?.remove(); });
defineExpose({
  setView(point: MapPoint, level: number, animate = false) { pendingView = map => map.setView(point, level, animate); if (engine) pendingView(engine); },
  fitBounds(points: MapPoint[], padding: number, maxZoom: number) { pendingView = map => map.fitBounds(points, padding, maxZoom); if (engine) pendingView(engine); },
  getZoom: () => engine?.getZoom() ?? zoom.value,
});
</script>
<style>
.track-map-container { position: relative; }
.track-map { width: 100%; height: min(64vh, 610px); min-height: 480px; z-index: 0; }
.map-message { position: absolute; top: 12px; left: 52px; right: 12px; z-index: 3; display: flex; flex-wrap: wrap; gap: 8px; padding: 10px 12px; color: #37474f; background: #fffffff2; border: 1px solid #c5ced3; border-radius: 6px; font-size: 13px; }
.map-message button { color: #283593; text-decoration: underline; font-weight: 700; }
.map-marker-wrapper { background: transparent; border: 0; }
.track-marker-shell, .track-cluster-shell { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; padding: 0; background: transparent; border: 0; cursor: pointer; }
.track-marker-shell:focus-visible, .track-cluster-shell:focus-visible { outline: 3px solid #283593; outline-offset: 2px; border-radius: 50%; }
.track-marker-shell[aria-pressed="true"] { z-index: 2; }
.track-map .current-location-shell { z-index: 3; pointer-events: none; }
.is-selecting .map-marker-wrapper, .is-selecting .track-marker-shell, .is-selecting .track-cluster-shell, .is-selecting .current-location-shell { pointer-events: none; }
@media (max-width: 799px) { .track-map { height: 52vh; min-height: 360px; } }
</style>
