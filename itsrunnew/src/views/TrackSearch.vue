<template>
  <v-container class="track-search-page">
    <header class="track-hero">
      <div>
        <p class="track-eyebrow">{{ isEnglish ? 'TRACK FINDER' : 'TRACK FINDER' }}</p>
        <h1>{{ isEnglish ? 'Find a track near you' : '近くで走れるトラックを探す' }}</h1>
        <p>{{ isEnglish ? 'When your usual track is closed, or when you are training somewhere new, search by workout date and a reference point.' : 'いつもの競技場が使えない日も、転居先や合宿先でも。利用日と基準地点から、練習できそうなトラックを探せます。' }}</p>
      </div>
    </header>

    <v-alert v-if="locationMessage" :type="locationError ? 'warning' : 'success'" variant="tonal" class="mb-3" closable>
      {{ locationMessage }}
    </v-alert>

    <section class="date-controls" :aria-label="isEnglish ? 'Use date' : '利用日'">
      <div class="date-control-heading">
        <strong>{{ isEnglish ? 'Use date' : '利用日' }}</strong>
        <span>{{ dateRangeLabel }}</span>
      </div>
      <div class="date-shortcuts">
        <v-btn size="small" :variant="selectedDate === today ? 'flat' : 'outlined'" color="indigo" @click="chooseDate(today, 'today')">{{ isEnglish ? 'Today' : '今日' }}</v-btn>
        <v-btn size="small" :variant="selectedDate === tomorrow ? 'flat' : 'outlined'" color="indigo" @click="chooseDate(tomorrow, 'tomorrow')">{{ isEnglish ? 'Tomorrow' : '明日' }}</v-btn>
        <v-btn size="small" :variant="selectedDate === saturday ? 'flat' : 'outlined'" color="indigo" @click="chooseDate(saturday, 'saturday')">{{ isEnglish ? 'Sat' : '土曜' }}</v-btn>
        <v-btn size="small" :variant="selectedDate === sunday ? 'flat' : 'outlined'" color="indigo" @click="chooseDate(sunday, 'sunday')">{{ isEnglish ? 'Sun' : '日曜' }}</v-btn>
        <label class="native-date-field">
          <span>{{ isEnglish ? 'Choose a date' : '日付を選ぶ' }}</span>
          <input :value="selectedDate" type="date" :min="availabilityManifest.startDate" :max="availabilityManifest.endDate"
            :aria-label="isEnglish ? 'Choose availability date' : '利用日を選ぶ'" @change="onDateInput" />
        </label>
      </div>
      <v-progress-linear v-if="availabilityLoading" indeterminate color="indigo" aria-label="availability loading" />
      <p v-if="dateMessage" class="date-message" role="status">{{ dateMessage }}</p>
    </section>

    <section class="track-controls" :aria-label="isEnglish ? 'Map display and availability legend' : '地図表示と利用状況の凡例'">
      <v-switch v-model="showUnavailable" color="red-darken-2" density="compact" hide-details
        :label="showUnavailableLabel" />
      <strong class="result-count">{{ visibleTracks.length }}{{ isEnglish ? ' facilities' : '施設' }}</strong>
      <span class="marker-legend"><i class="legend-dot today-available" />{{ availabilityStatusName('available') }}</span>
      <span class="marker-legend"><i class="legend-dot today-partial" />{{ availabilityStatusName('partially_available') }}</span>
      <span class="marker-legend"><i class="legend-dot today-unknown" />{{ availabilityStatusName('unknown') }}</span>
      <span class="marker-legend"><i class="legend-dot today-unavailable" />{{ availabilityStatusName('unavailable') }}</span>
    </section>

    <div :class="['track-layout', { 'has-detail': selectedTrack }]">
      <section ref="mapPanelElement" id="track-map-section" tabindex="-1" class="map-panel" :aria-label="isEnglish ? 'Athletic track map' : '陸上トラック地図'">
        <div class="map-tools">
          <strong>{{ isEnglish ? 'Search origin' : '検索の基準地点' }}</strong>
          <v-btn size="small" :variant="referencePointSource === 'current' ? 'flat' : 'outlined'" color="indigo" prepend-icon="mdi-crosshairs-gps" :loading="locating" @click="requestLocation">
            {{ isEnglish ? 'Use current location' : '現在地を使う' }}
          </v-btn>
          <v-btn size="small" :color="selectingPoint ? 'indigo' : undefined" :variant="selectingPoint ? 'flat' : 'outlined'" prepend-icon="mdi-map-marker-plus" @click="togglePointSelection">
            {{ selectingPoint ? (isEnglish ? 'Tap a point on the map' : '地図上の地点をタップ') : (isEnglish ? 'Choose a map point' : '地図から基準地点を選ぶ') }}
          </v-btn>
          <v-btn v-if="distanceOrigin" size="small" variant="text" prepend-icon="mdi-close" @click="clearReferencePoint">
            {{ isEnglish ? 'Clear reference point' : '基準地点を解除' }}
          </v-btn>
          <span v-if="distanceOrigin">{{ referencePointLabel }}</span>
        </div>
        <div ref="mapElement" id="track-map" class="track-map" :data-zoom="mapZoom ?? undefined" />
      </section>

      <aside v-if="selectedTrack" ref="detailElement" class="detail-card" aria-live="polite">
        <div class="detail-heading">
          <div>
            <span :class="['status-badge', statusClass(selectedTrack)]"><v-icon :icon="statusIcon(selectedAvailability.status)" size="14" aria-hidden="true" />{{ statusLabel(selectedTrack) }}</span>
            <h2>{{ localizedName(selectedTrack) }}</h2>
          </div>
          <v-btn icon="mdi-close" variant="text" size="small" :aria-label="isEnglish ? 'Close details' : '詳細を閉じる'" @click="closeSelectedTrack" />
        </div>
        <p class="track-address">{{ selectedTrack.location.address }}</p>
        <section :class="['today-availability', availabilityClass(selectedAvailability)]">
          <span class="availability-date">{{ selectedDateLongLabel }}</span>
          <strong>{{ availabilityLabel(selectedAvailability) }}</strong>
          <p>{{ availabilityDescription(selectedAvailability) }}</p>
          <ul v-if="availablePeriodLabels(selectedAvailability).length" class="availability-periods">
            <li v-for="period in availablePeriodLabels(selectedAvailability)" :key="period">{{ period }}</li>
          </ul>
          <small>{{ freshnessLabel(selectedAvailability) }}</small>
        </section>
        <dl class="track-facts">
          <div v-if="selectedDistance != null"><dt>{{ isEnglish ? 'Distance' : '直線距離' }}</dt><dd>{{ formatDistance(selectedDistance) }}</dd></div>
          <div><dt>JAAF</dt><dd>{{ certificationLabel(selectedTrack) }}</dd></div>
          <div v-if="selectedTrack.track.lengthMeters"><dt>{{ isEnglish ? 'Length' : 'トラック' }}</dt><dd>{{ selectedTrack.track.lengthMeters }}m</dd></div>
          <div v-if="selectedTrack.track.lanes"><dt>{{ isEnglish ? 'Lanes' : 'レーン数' }}</dt><dd>{{ selectedTrack.track.lanes }}</dd></div>
          <div v-if="selectedTrack.track.surface"><dt>{{ isEnglish ? 'Surface' : '路面' }}</dt><dd>{{ surfaceLabel(selectedTrack.track.surface) }}</dd></div>
          <div v-if="selectedTrack.individualUse.feeYen != null"><dt>{{ isEnglish ? 'Fee' : '個人料金' }}</dt><dd>{{ feeLabel(selectedTrack) }}</dd></div>
          <div v-if="selectedTrack.individualUse.openingHours"><dt>{{ isEnglish ? 'Hours' : '利用条件' }}</dt><dd>{{ selectedTrack.individualUse.openingHours }}</dd></div>
          <div><dt>{{ isEnglish ? 'Verified' : '最終確認' }}</dt><dd>{{ latestVerifiedAt(selectedTrack) }}</dd></div>
        </dl>
        <p v-if="selectedTrack.individualUse.note" class="track-note">{{ selectedTrack.individualUse.note }}</p>
        <p class="official-warning">{{ isEnglish ? 'Conditions may change. Check the official website before visiting.' : '利用条件は変わることがあります。お出かけ前に公式サイトをご確認ください。' }}</p>
        <div class="detail-actions">
          <v-btn class="detail-action action-detail" color="blue-grey-darken-3" variant="flat" prepend-icon="mdi-information-outline" :to="detailRoute(selectedTrack)">{{ isEnglish ? 'Facility page' : '施設ページ' }}</v-btn>
          <v-btn v-if="availabilityActionUrl(selectedTrack)" class="detail-action action-schedule" color="amber-lighten-4" variant="flat" prepend-icon="mdi-calendar-check" :href="availabilityActionUrl(selectedTrack)" target="_blank" rel="noopener" @click="trackOutbound('availability_source_click', selectedTrack)">{{ availabilityActionLabel(selectedAvailability) }}</v-btn>
          <v-btn class="detail-action action-official" color="indigo" variant="flat" prepend-icon="mdi-open-in-new" :href="selectedTrack.urls.official" target="_blank" rel="noopener" @click="trackOutbound('official_site_click', selectedTrack)">{{ isEnglish ? 'Official site' : '公式サイト' }}</v-btn>
          <v-btn class="detail-action action-directions" color="teal-darken-2" variant="outlined" prepend-icon="mdi-directions" :href="directionsUrl(selectedTrack, distanceOrigin)" target="_blank" rel="noopener" @click="trackOutbound('directions_click', selectedTrack)">{{ isEnglish ? 'Directions' : '経路を見る' }}</v-btn>
        </div>
      </aside>
    </div>

    <section class="facility-section">
      <div class="facility-heading">
        <div><h2>{{ isEnglish ? 'Facilities' : '施設一覧' }}</h2><p>{{ listModeLabel }}</p></div>
        <strong>{{ visibleTracks.length }}{{ isEnglish ? ' facilities' : '施設' }}</strong>
      </div>
      <p class="dataset-note">{{ datasetNote }}</p>
      <div v-if="sortedTracks.length && distanceOrigin" class="distance-results">
        <article v-for="item in distanceListItems" :key="item.track.id" :class="['facility-row', { 'is-selected': selectedTrack?.id === item.track.id }]">
          <button type="button" :aria-pressed="selectedTrack?.id === item.track.id" :aria-label="facilityCardAriaLabel(item.track, item.availability)" @click="selectTrack(item.track, 'list')">
            <span :class="['availability-badge', availabilityClass(item.availability)]"><v-icon :icon="statusIcon(item.availability.status)" size="14" />{{ availabilityLabel(item.availability) }}</span>
            <span class="facility-main"><strong>{{ localizedName(item.track) }}</strong><small>{{ compactSummary(item.track) }}</small></span>
            <strong class="facility-distance">{{ formatDistance(item.distance!) }}</strong>
            <span class="map-action"><v-icon icon="mdi-map-marker" size="18" />{{ isEnglish ? 'Map' : '地図' }}</span>
          </button>
          <router-link :to="detailRoute(item.track)">{{ isEnglish ? 'Details' : '詳細' }}<v-icon icon="mdi-chevron-right" size="18" /></router-link>
        </article>
        <v-btn v-if="distanceListLimit < sortedTracks.length" class="load-more" variant="outlined" color="indigo" @click="distanceListLimit += 12">
          {{ isEnglish ? 'Show more facilities' : 'さらに施設を表示' }}
        </v-btn>
      </div>
      <div v-else-if="sortedTracks.length" class="prefecture-groups">
        <section v-for="group in prefectureGroups" :key="group.name" class="prefecture-group">
          <button type="button" class="prefecture-toggle" :aria-expanded="expandedPrefectures.includes(group.name)" @click="togglePrefecture(group)">
            <span><strong>{{ localizedPrefecture(group.name) }}</strong><small>{{ group.items.length }}{{ isEnglish ? ' facilities' : '施設' }}</small></span>
            <v-icon :icon="expandedPrefectures.includes(group.name) ? 'mdi-chevron-up' : 'mdi-chevron-down'" />
          </button>
          <div v-if="expandedPrefectures.includes(group.name)" class="prefecture-results">
            <article v-for="item in group.items.slice(0, prefectureLimit(group.name))" :key="item.track.id" :class="['facility-row', { 'is-selected': selectedTrack?.id === item.track.id }]">
              <button type="button" :aria-pressed="selectedTrack?.id === item.track.id" :aria-label="facilityCardAriaLabel(item.track, item.availability)" @click="selectTrack(item.track, 'list')">
                <span :class="['availability-badge', availabilityClass(item.availability)]"><v-icon :icon="statusIcon(item.availability.status)" size="14" />{{ availabilityLabel(item.availability) }}</span>
                <span class="facility-main"><strong>{{ localizedName(item.track) }}</strong><small>{{ compactSummary(item.track) }}</small></span>
                <span class="map-action"><v-icon icon="mdi-map-marker" size="18" />{{ isEnglish ? 'Map' : '地図' }}</span>
              </button>
              <router-link :to="detailRoute(item.track)">{{ isEnglish ? 'Details' : '詳細' }}<v-icon icon="mdi-chevron-right" size="18" /></router-link>
            </article>
            <v-btn v-if="prefectureLimit(group.name) < group.items.length" class="load-more" variant="text" color="indigo" @click="showMorePrefecture(group.name)">
              {{ isEnglish ? 'Show more in this prefecture' : 'この都道府県をさらに表示' }}
            </v-btn>
          </div>
        </section>
      </div>
      <div v-else class="no-results" role="status">
        <strong>{{ isEnglish ? 'No candidates for this date.' : 'この日の候補が見つかりませんでした。' }}</strong>
        <p>{{ isEnglish ? 'Try another date or include unavailable facilities.' : '日付を変えるか、利用不可の施設も表示してみてください。' }}</p>
        <v-btn v-if="!showUnavailable" color="indigo" variant="outlined" @click="showUnavailable = true">
          {{ isEnglish ? 'Show all facilities' : '全施設を表示' }}
        </v-btn>
      </div>
    </section>

    <p class="map-credit">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> (ODbL)</p>
    <p class="guide-link"><router-link :to="isEnglish ? '/en/tracks/guide' : '/tracks/guide'">{{ isEnglish ? 'How to use availability and choose a track' : '利用状況の見方・トラック選びのヒント' }}</router-link></p>
  </v-container>
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css';
import L, { type Map as LeafletMap, type LayerGroup, type Marker } from 'leaflet';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { directionsUrl, distanceKm, trackById, trackDetailPath, tracks, type TrackFacility } from '../model/tracks';
import {
  availabilityDataset,
  availabilityForTrack,
  isAvailabilityCandidate,
  localDateKey,
  type AvailabilityDataset,
  type AvailabilityStatus,
  type TrackAvailability,
  type UnknownReason,
} from '../model/availability';
import {
  addDateOnlyDays,
  availabilityManifest,
  isGeneratedDate,
  loadAvailabilityDate,
  nextWeekdayDate,
  normalizeSelectedDate,
} from '../model/availability-range';
import { trackProductEvent, type ProductEventName, type ProductEventParameters } from '../services/analytics';

const { locale } = useI18n();
const route = useRoute();
const router = useRouter();
const isEnglish = computed(() => locale.value === 'en');
const showUnavailable = ref(false);
const today = localDateKey();
const tomorrow = addDateOnlyDays(today, 1);
const saturday = nextWeekdayDate(today, 6);
const sunday = nextWeekdayDate(today, 0);
const selectedDate = ref(normalizeSelectedDate(route.query.date, today));
const selectedDataset = ref<AvailabilityDataset>(availabilityDataset);
const availabilityLoading = ref(false);
const dateMessage = ref('');
const pageLoadedAt = new Date();
const locating = ref(false);
const locationMessage = ref('');
const locationError = ref(false);
const distanceOrigin = ref<{ latitude: number; longitude: number } | null>(null);
const referencePointSource = ref<'current' | 'map' | null>(null);
const selectingPoint = ref(false);
const selectedTrack = ref<TrackFacility | null>(null);
const distanceListLimit = ref(12);
const expandedPrefectures = ref<string[]>(['東京都']);
const prefectureListLimits = ref<Record<string, number>>({ 東京都: 12 });
const mapElement = ref<HTMLElement | null>(null);
const mapPanelElement = ref<HTMLElement | null>(null);
const detailElement = ref<HTMLElement | null>(null);
const mapZoom = ref<number | null>(null);
let map: LeafletMap | null = null;
let markerLayer: LayerGroup | null = null;
let locationMarker: Marker | null = null;
let loadSequence = 0;

const availabilityByTrack = computed(() => new Map(tracks.map(track => [track.id, availabilityForTrack(track.id, selectedDate.value, pageLoadedAt, selectedDataset.value)])));
const selectedDateAvailability = (track: TrackFacility) => availabilityByTrack.value.get(track.id) ?? availabilityForTrack(track.id, selectedDate.value, pageLoadedAt, selectedDataset.value);
const visibleTracks = computed(() => tracks.filter(track => isAvailabilityCandidate(selectedDateAvailability(track).status, showUnavailable.value)));
const sortedTracks = computed(() => visibleTracks.value
  .map(track => ({ track, availability: selectedDateAvailability(track), distance: distanceOrigin.value ? distanceKm(distanceOrigin.value, track.location) : null }))
  .sort((a, b) => a.distance == null || b.distance == null ? a.track.name.ja.localeCompare(b.track.name.ja, 'ja') : a.distance - b.distance));
const selectedDistance = computed(() => selectedTrack.value && distanceOrigin.value
  ? distanceKm(distanceOrigin.value, selectedTrack.value.location)
  : null);
const distanceListItems = computed(() => {
  const first = sortedTracks.value.slice(0, distanceListLimit.value);
  const selected = sortedTracks.value.find(item => item.track.id === selectedTrack.value?.id);
  return selected && !first.some(item => item.track.id === selected.track.id) ? [...first, selected] : first;
});
const prefectureGroups = computed(() => {
  const grouped = new Map<string, typeof sortedTracks.value>();
  for (const item of sortedTracks.value) {
    const name = prefectureName(item.track.location.address);
    grouped.set(name, [...(grouped.get(name) ?? []), item]);
  }
  const order = ['東京都', '埼玉県', '神奈川県', '千葉県'];
  return [...grouped].map(([name, items]) => ({ name, items })).sort((a, b) => {
    const ai = order.indexOf(a.name); const bi = order.indexOf(b.name);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.name.localeCompare(b.name, 'ja');
  });
});
const selectedAvailability = computed(() => selectedTrack.value ? selectedDateAvailability(selectedTrack.value) : availabilityForTrack('', selectedDate.value, pageLoadedAt, selectedDataset.value));
const selectedDateShortLabel = computed(() => {
  if (selectedDate.value === today) return isEnglish.value ? 'Today' : '本日';
  if (selectedDate.value === tomorrow) return isEnglish.value ? 'Tomorrow' : '明日';
  const [, month, day] = selectedDate.value.split('-').map(Number);
  return isEnglish.value ? `${month}/${day}` : `${month}月${day}日`;
});
const selectedDateLongLabel = computed(() => {
  const date = new Date(`${selectedDate.value}T12:00:00+09:00`);
  return new Intl.DateTimeFormat(isEnglish.value ? 'en-US' : 'ja-JP', {
    timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', weekday: 'short',
  }).format(date);
});
const dateRangeLabel = computed(() => isEnglish.value
  ? `Searchable: ${availabilityManifest.startDate} – ${availabilityManifest.endDate}`
  : `検索可能期間：${availabilityManifest.startDate.replaceAll('-', '/')}〜${availabilityManifest.endDate.replaceAll('-', '/')}`);
const showUnavailableLabel = computed(() => isEnglish.value
  ? `Show facilities unavailable on ${selectedDateShortLabel.value.toLowerCase()}`
  : `${selectedDateShortLabel.value}利用不可の施設も表示`);
const datasetNote = computed(() => isEnglish.value
  ? 'Based on official sources. Schedules can change, so check before visiting. “Needs confirmation” does not mean unavailable.'
  : '公式情報をもとに表示しています。当日変更もあるため、利用前にご確認ください。「要確認」は利用不可ではありません。');
const referencePointLabel = computed(() => referencePointSource.value === 'current'
  ? (isEnglish.value ? 'Sorted from your current location' : '現在地から近い順')
  : (isEnglish.value ? 'Sorted from the selected map point' : '選択地点から近い順'));
const listModeLabel = computed(() => distanceOrigin.value
  ? referencePointLabel.value
  : (isEnglish.value ? 'Grouped by prefecture' : '都道府県別に表示'));

const initialCoordinates = parseCoordinates(route.query.lat, route.query.lng);
if (initialCoordinates) {
  distanceOrigin.value = initialCoordinates;
  referencePointSource.value = 'map';
}

watch(() => route.query.date, async value => {
  const normalized = normalizeSelectedDate(value, today);
  if (value !== normalized) {
    await router.replace({ path: route.path, query: { ...route.query, date: normalized } });
    return;
  }
  await loadDate(normalized);
}, { immediate: true });

onMounted(() => {
  if (!mapElement.value) return;
  map = L.map(mapElement.value, { zoomControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    className: 'muted-map-tiles',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  fitDefaultTrackBounds();
  map.on('click', event => {
    if (!selectingPoint.value) return;
    setReferencePoint({ latitude: event.latlng.lat, longitude: event.latlng.lng }, 'map', true);
  });
  map.on('zoomend', () => {
    mapZoom.value = map?.getZoom() ?? null;
    renderMarkers();
  });
  renderMarkers();
  if (initialCoordinates) {
    setReferencePoint(initialCoordinates, 'map', false);
    map.setView([initialCoordinates.latitude, initialCoordinates.longitude], 13);
  }
  const focused = trackById(route.query.track);
  if (focused) void selectTrack(focused, 'map', false, false);
  nextTick(() => {
    map?.invalidateSize();
    focusMapSection();
  });
});

onBeforeUnmount(() => map?.remove());
watch(() => route.hash, focusMapSection);
watch(visibleTracks, tracksNow => {
  renderMarkers();
  const explicitlyFocused = selectedTrack.value?.id === route.query.track;
  if (selectedTrack.value && !explicitlyFocused && !tracksNow.some(track => track.id === selectedTrack.value?.id)) closeSelectedTrack();
});
watch(() => route.query.track, value => {
  const focused = trackById(value);
  if (focused && focused.id !== selectedTrack.value?.id && map) void selectTrack(focused, 'map', false, false);
  if (!focused && selectedTrack.value) selectedTrack.value = null;
});
watch(showUnavailable, value => trackSearchEvent('show_unavailable_change', { enabled: value }));
let lastNoResultsKey = '';
watch([availabilityLoading, () => visibleTracks.value.length, selectedDate, showUnavailable], ([loading, count, date, includeUnavailable]) => {
  if (loading || count !== 0) return;
  const key = `${date}|${includeUnavailable}`;
  if (key === lastNoResultsKey) return;
  lastNoResultsKey = key;
  trackSearchEvent('no_results', { include_unavailable: includeUnavailable });
});

function renderMarkers() {
  if (!map || !markerLayer) return;
  markerLayer.clearLayers();
  const selected = selectedTrack.value;
  const candidates = visibleTracks.value.filter(track => track.id !== selected?.id);
  const groups = new Map<string, TrackFacility[]>();
  const zoom = map.getZoom();
  for (const track of candidates) {
    const point = map.project([track.location.latitude, track.location.longitude], zoom);
    const key = zoom <= 12 ? `${Math.floor(point.x / 150)}:${Math.floor(point.y / 150)}` : track.id;
    groups.set(key, [...(groups.get(key) ?? []), track]);
  }
  for (const group of groups.values()) {
    if (group.length > 1) addClusterMarker(group);
    else addTrackMarker(group[0]);
  }
  const explicitlyFocused = selected?.id === route.query.track;
  if (selected && (explicitlyFocused || visibleTracks.value.some(track => track.id === selected.id))) addTrackMarker(selected, true);
}

function focusMapSection() {
  if (route.hash !== '#track-map-section') return;
  void nextTick(() => mapPanelElement.value?.focus({ preventScroll: true }));
}

function fitDefaultTrackBounds() {
  if (!map || !tracks.length) return;
  const padding = window.innerWidth < 800 ? 20 : 40;
  map.fitBounds(L.latLngBounds(tracks.map(track => [track.location.latitude, track.location.longitude])), {
    padding: [padding, padding],
    maxZoom: 7,
  });
  mapZoom.value = map.getZoom();
}

function addTrackMarker(track: TrackFacility, selected = false) {
  if (!map || !markerLayer) return;
    const availability = selectedDateAvailability(track);
    const icon = L.divIcon({
      className: 'track-marker-shell',
      html: `<span class="track-marker track-marker--${availability.status}${selected ? ' track-marker--selected' : ''}" aria-hidden="true"></span>`,
      iconSize: selected ? [36, 36] : [30, 30], iconAnchor: selected ? [18, 18] : [15, 15],
    });
    L.marker([track.location.latitude, track.location.longitude], { icon, title: localizedName(track) })
      .on('click', () => selectTrack(track, 'map')).addTo(markerLayer);
}

function addClusterMarker(group: TrackFacility[]) {
  if (!map || !markerLayer) return;
  const latitude = group.reduce((sum, track) => sum + track.location.latitude, 0) / group.length;
  const longitude = group.reduce((sum, track) => sum + track.location.longitude, 0) / group.length;
  const icon = L.divIcon({ className: 'track-cluster-shell', html: `<span class="track-cluster">${group.length}</span>`, iconSize: [38, 38], iconAnchor: [19, 19] });
  L.marker([latitude, longitude], { icon, title: isEnglish.value ? `${group.length} facilities` : `${group.length}施設` })
    .on('click', () => map?.fitBounds(L.latLngBounds(group.map(track => [track.location.latitude, track.location.longitude])), { padding: [30, 30], maxZoom: 14 }))
    .addTo(markerLayer);
}

async function loadDate(date: string) {
  const sequence = ++loadSequence;
  selectedDate.value = date;
  availabilityLoading.value = true;
  dateMessage.value = '';
  try {
    const dataset = await loadAvailabilityDate(date);
    if (sequence !== loadSequence) return;
    selectedDataset.value = dataset;
  } catch {
    if (sequence !== loadSequence) return;
    selectedDataset.value = { schemaVersion: 1, date, timezone: 'Asia/Tokyo', generatedAt: new Date().toISOString(), facilities: [] };
    dateMessage.value = isEnglish.value ? 'This date could not be loaded. Check the official sources.' : 'この日のデータを読み込めませんでした。公式情報をご確認ください。';
  } finally {
    if (sequence === loadSequence) availabilityLoading.value = false;
  }
}

function chooseDate(date: string, source = 'date_input') {
  if (!isGeneratedDate(date)) {
    dateMessage.value = isEnglish.value ? 'Choose a date in the searchable range.' : '検索可能期間内の日付を選んでください。';
    return;
  }
  trackSearchEvent('date_select', { source, selected_date: date });
  router.replace({ path: route.path, query: { ...route.query, date } });
}

function onDateInput(event: Event) {
  chooseDate((event.target as HTMLInputElement).value, 'native_date_input');
}

async function selectTrack(track: TrackFacility, source: 'map' | 'list', updateUrl = true, scroll = true) {
  selectedTrack.value = track;
  if (!distanceOrigin.value) {
    const prefecture = prefectureName(track.location.address);
    if (!expandedPrefectures.value.includes(prefecture)) expandedPrefectures.value = [...expandedPrefectures.value, prefecture];
    const index = prefectureGroups.value.find(group => group.name === prefecture)?.items.findIndex(item => item.track.id === track.id) ?? -1;
    if (index >= prefectureLimit(prefecture)) prefectureListLimits.value = { ...prefectureListLimits.value, [prefecture]: index + 1 };
  }
  trackSearchEvent('facility_select', { track_id: track.id, source, availability_status: selectedDateAvailability(track).status });
  map?.flyTo([track.location.latitude, track.location.longitude], Math.max(map.getZoom(), 14));
  renderMarkers();
  if (updateUrl) await router.replace({ path: route.path, query: { ...route.query, track: track.id } });
  await nextTick();
  if (scroll) detailElement.value?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeSelectedTrack() {
  selectedTrack.value = null;
  renderMarkers();
  const query = { ...route.query }; delete query.track;
  void router.replace({ path: route.path, query });
}

function requestLocation() {
  trackSearchEvent('use_location', { action: 'request' });
  if (!navigator.geolocation) {
    trackSearchEvent('use_location_result', { result: 'unsupported' });
    showLocationError(isEnglish.value ? 'Geolocation is unavailable. You can choose a reference point on the map.' : 'このブラウザでは現在地を取得できません。地図から基準地点を選択できます。');
    return;
  }
  locating.value = true;
  locationMessage.value = '';
  navigator.geolocation.getCurrentPosition(position => {
    locating.value = false;
    locationError.value = false;
    distanceOrigin.value = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    referencePointSource.value = 'current';
    distanceListLimit.value = 12;
    locationMessage.value = isEnglish.value ? 'Location found. Facilities are sorted by straight-line distance.' : '現在地を取得しました。施設一覧を直線距離順に並べました。';
    trackSearchEvent('use_location_result', { result: 'success' });
    trackSearchEvent('search_origin_select', { origin_type: 'current' });
    if (map) {
      renderReferenceMarker();
      map.setView([position.coords.latitude, position.coords.longitude], 13);
    }
    const query = { ...route.query }; delete query.lat; delete query.lng;
    void router.replace({ path: route.path, query });
  }, error => {
    locating.value = false;
    const messages: Record<number, string> = {
      1: isEnglish.value ? 'Location permission was denied. You can choose a reference point on the map.' : '現在地の利用が許可されませんでした。地図から基準地点を選択できます。',
      2: isEnglish.value ? 'Your location is unavailable. You can choose a reference point on the map.' : '現在地を取得できません。地図から基準地点を選択できます。',
      3: isEnglish.value ? 'Location request timed out. You can choose a reference point on the map.' : '現在地の取得がタイムアウトしました。地図から基準地点を選択できます。',
    };
    showLocationError(messages[error.code] ?? messages[2]);
    trackSearchEvent('use_location_result', { result: error.code === 1 ? 'denied' : error.code === 3 ? 'timeout' : 'unavailable' });
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
}

function parseCoordinates(latitude: unknown, longitude: unknown) {
  const lat = typeof latitude === 'string' ? Number(latitude) : NaN;
  const lng = typeof longitude === 'string' ? Number(longitude) : NaN;
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 20 && lat <= 50 && lng >= 120 && lng <= 150
    ? { latitude: lat, longitude: lng } : null;
}

function prefectureName(address: string) {
  return address.match(/^(東京都|北海道|大阪府|京都府|.{2,3}県)/)?.[1] ?? (isEnglish.value ? 'Other' : 'その他');
}

function localizedPrefecture(name: string) {
  if (!isEnglish.value) return name;
  return ({ 東京都: 'Tokyo', 埼玉県: 'Saitama', 神奈川県: 'Kanagawa', 千葉県: 'Chiba', 北海道: 'Hokkaido', 大阪府: 'Osaka', 京都府: 'Kyoto', その他: 'Other' } as Record<string, string>)[name] ?? name.replace(/[都道府県]$/, '');
}

function togglePrefecture(group: { name: string; items: Array<{ track: TrackFacility }> }) {
  const expanded = expandedPrefectures.value.includes(group.name);
  expandedPrefectures.value = expanded ? expandedPrefectures.value.filter(name => name !== group.name) : [...expandedPrefectures.value, group.name];
  trackSearchEvent('prefecture_toggle', { prefecture: group.name, expanded: !expanded });
  if (!expanded && !prefectureListLimits.value[group.name]) prefectureListLimits.value = { ...prefectureListLimits.value, [group.name]: 12 };
  if (!expanded && map && group.items.length) {
    map.fitBounds(L.latLngBounds(group.items.map(item => [item.track.location.latitude, item.track.location.longitude])), { padding: [28, 28], maxZoom: 12 });
  }
}

function prefectureLimit(name: string) { return prefectureListLimits.value[name] ?? 12; }
function showMorePrefecture(name: string) { prefectureListLimits.value = { ...prefectureListLimits.value, [name]: prefectureLimit(name) + 12 }; }

function detailRoute(track: TrackFacility) {
  return {
    path: trackDetailPath(track, locale.value),
    query: { date: selectedDate.value, lat: route.query.lat, lng: route.query.lng },
  };
}

function togglePointSelection() {
  selectingPoint.value = !selectingPoint.value;
  locationMessage.value = selectingPoint.value
    ? (isEnglish.value ? 'Tap the map to choose the point used for distance sorting.' : '距離順の基準にしたい地点を地図上でタップしてください。') : '';
  locationError.value = false;
}

function setReferencePoint(point: { latitude: number; longitude: number }, source: 'current' | 'map', updateUrl: boolean) {
  distanceOrigin.value = point;
  referencePointSource.value = source;
  distanceListLimit.value = 12;
  selectingPoint.value = false;
  locationMessage.value = source === 'map'
    ? (isEnglish.value ? 'Facilities are sorted from the selected point.' : '選択した地点から近い順に並べました。') : locationMessage.value;
  renderReferenceMarker();
  if (updateUrl) trackSearchEvent('search_origin_select', { origin_type: source });
  if (updateUrl) void router.replace({ path: route.path, query: { ...route.query, lat: point.latitude.toFixed(5), lng: point.longitude.toFixed(5) } });
}

function renderReferenceMarker() {
  if (!map || !distanceOrigin.value) return;
  locationMarker?.remove();
  locationMarker = L.marker([distanceOrigin.value.latitude, distanceOrigin.value.longitude], {
    icon: L.divIcon({ className: 'current-location-shell', html: '<span class="search-origin-dot"></span>', iconSize: [24, 24], iconAnchor: [12, 12] }),
    title: referencePointSource.value === 'map' ? (isEnglish.value ? 'Selected point' : '選択地点') : (isEnglish.value ? 'Current location' : '現在地'),
  }).addTo(map);
}

function clearReferencePoint() {
  if (referencePointSource.value) trackSearchEvent('search_origin_clear', { origin_type: referencePointSource.value });
  distanceOrigin.value = null;
  referencePointSource.value = null;
  selectingPoint.value = false;
  locationMarker?.remove();
  locationMarker = null;
  locationMessage.value = '';
  const query = { ...route.query };
  delete query.lat;
  delete query.lng;
  void router.replace({ path: route.path, query });
}

function showLocationError(message: string) {
  locationError.value = true;
  locationMessage.value = message;
}

function localizedName(track: TrackFacility) { return isEnglish.value ? track.name.en : track.name.ja; }
function statusClass(track: TrackFacility) { return track.individualUse.status === 'available' ? 'is-available' : 'is-other'; }
function statusLabel(track: TrackFacility) {
  if (track.individualUse.status === 'available') return isEnglish.value ? 'Individual use' : '個人利用可';
  if (track.individualUse.status === 'temporarily-unavailable') return isEnglish.value ? 'Temporarily closed' : '一時休止中';
  if (track.individualUse.status === 'unavailable') return isEnglish.value ? 'No individual use' : '個人利用不可';
  return isEnglish.value ? 'Check status' : '利用要確認';
}
function certificationLabel(track: TrackFacility) {
  if (track.certification.jaafCertified === true) return `${isEnglish.value ? 'Certified' : '公認'} ${track.certification.jaafClass}${isEnglish.value ? ' class' : '種'}`;
  if (track.certification.jaafCertified === false) return isEnglish.value ? 'Not JAAF-certified' : '非公認';
  return isEnglish.value ? 'Current status unverified' : '現況未確認';
}
function surfaceLabel(surface: string) {
  const labels: Record<string, [string, string]> = { 'all-weather': ['全天候', 'All-weather'], dirt: ['土', 'Dirt'], clay: ['クレー', 'Clay'] };
  return labels[surface]?.[isEnglish.value ? 1 : 0] ?? surface;
}
function feeLabel(track: TrackFacility) {
  const fee = track.individualUse.feeYen;
  if (fee == null) return isEnglish.value ? 'Check official site' : '公式サイトで確認';
  return fee === 0
    ? (isEnglish.value ? `Free (${track.individualUse.feeUnit ?? ''})` : `無料（${track.individualUse.feeUnit ?? ''}）`)
    : `¥${fee.toLocaleString()}${track.individualUse.feeUnit ? ` / ${track.individualUse.feeUnit}` : ''}`;
}
function formatDistance(distance: number) { return distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`; }
function latestVerifiedAt(track: TrackFacility) { return [...track.sources].map(source => source.verifiedAt).sort().at(-1) ?? '—'; }
function summary(track: TrackFacility) {
  return [track.track.lengthMeters ? `${track.track.lengthMeters}m` : null, track.track.surface ? surfaceLabel(track.track.surface) : null, statusLabel(track), track.individualUse.spikesAllowed === true ? (isEnglish.value ? 'Spikes allowed' : 'スパイク可') : null, track.individualUse.feeYen === 0 ? (isEnglish.value ? 'Free' : '無料') : null].filter(Boolean).join('・');
}
function compactSummary(track: TrackFacility) {
  return [
    track.track.lengthMeters ? `${track.track.lengthMeters}m` : null,
    track.track.surface ? surfaceLabel(track.track.surface) : null,
    track.individualUse.spikesAllowed === true ? (isEnglish.value ? 'Spikes allowed' : 'スパイク可') : null,
    track.individualUse.spikesAllowed == null ? (isEnglish.value ? 'Spikes unconfirmed' : 'スパイク未確認') : null,
  ].filter(Boolean).join('・');
}

function statusIcon(status: AvailabilityStatus) {
  return {
    available: 'mdi-check-circle', partially_available: 'mdi-clock-outline',
    unknown: 'mdi-help-circle-outline', unavailable: 'mdi-close-circle',
  }[status];
}

function availabilityClass(availability: TrackAvailability) { return `availability--${availability.status.replace('_', '-')}`; }
function availabilityLabelForStatus(status: AvailabilityStatus) {
  const statusText: Record<AvailabilityStatus, [string, string]> = {
    available: ['利用可能', 'available'], partially_available: ['一部利用可能', 'partly available'],
    unknown: ['要確認', 'needs confirmation'], unavailable: ['利用不可', 'unavailable'],
  };
  return isEnglish.value
    ? `${selectedDateShortLabel.value} ${statusText[status][1]}`
    : status === 'unknown' ? `${selectedDateShortLabel.value}は要確認` : `${selectedDateShortLabel.value}${statusText[status][0]}`;
}
function availabilityLabel(availability: TrackAvailability) { return availabilityLabelForStatus(availability.status); }
function availabilityStatusName(status: AvailabilityStatus) {
  const labels: Record<AvailabilityStatus, [string, string]> = {
    available: ['利用可能', 'Available'], partially_available: ['一部利用可能', 'Partly available'],
    unknown: ['要確認', 'Needs confirmation'], unavailable: ['利用不可', 'Unavailable'],
  };
  return labels[status][isEnglish.value ? 1 : 0];
}
function unknownReasonLabel(reason: UnknownReason | null) {
  const labels: Record<UnknownReason, [string, string]> = {
    web_schedule_unavailable: [`${selectedDateShortLabel.value}の予定はWebでは公開されていません。`, `The schedule for ${selectedDateShortLabel.value.toLowerCase()} is not published online.`],
    source_stale: ['最新の予定データではないため、公式情報をご確認ください。', 'The saved schedule is stale. Check the official source.'],
    fetch_failed: ['最新予定を取得できませんでした。公式情報をご確認ください。', 'The latest schedule could not be fetched.'],
    parse_failed: ['公式ページの予定を読み取れませんでした。', 'The official schedule could not be read.'],
    extraction_failed: ['公式PDFから予定を読み取れませんでした。', 'The official PDF text could not be extracted.'],
    invalid_content_type: ['公式予定表がPDFとして取得できませんでした。', 'The official schedule was not returned as a PDF.'],
    source_changed: ['公式ページの形式が変わった可能性があります。', 'The official page may have changed.'],
    outside_published_period: ['対象日の予定は公開範囲外です。', 'The date is outside the published schedule.'],
    schedule_not_published: ['対象月の公式予定表はまだ公開されていません。', 'The official schedule for this month has not been published.'],
    unsupported_pdf_graphics: ['予定表の記号を安全に自動判定できません。公式予定表をご確認ください。', 'Graphical schedule symbols cannot yet be interpreted safely.'],
    phone_confirmation_required: [`${selectedDateShortLabel.value}の予定はWebでは公開されていません。施設へご確認ください。`, `The status for ${selectedDateShortLabel.value.toLowerCase()} is available only from the facility.`],
    reservation_system_unsupported: ['予約状況と個人利用可否を自動判定できません。', 'Booking availability cannot yet be equated with individual use.'],
    unsupported_source_type: [`${selectedDateShortLabel.value}の予定表は現在自動取得の対象外です。`, 'This schedule format is not collected yet.'],
    insufficient_information: [`個人利用可能な施設ですが、${selectedDateShortLabel.value}の開放状況はWeb情報だけでは確定できません。`, `Individual use is allowed, but the opening for ${selectedDateShortLabel.value.toLowerCase()} cannot be confirmed online.`],
  };
  return reason ? labels[reason][isEnglish.value ? 1 : 0] : '';
}
function availabilityDescription(availability: TrackAvailability) {
  if (availability.status === 'unknown') return unknownReasonLabel(availability.unknownReason);
  if (availability.status === 'partially_available') return isEnglish.value ? 'Only the official periods or areas below are confirmed.' : '下記の時間帯・利用範囲のみ公式情報で確認できています。';
  if (availability.status === 'unavailable') return isEnglish.value ? `An official closure or unavailable notice applies on ${selectedDateShortLabel.value.toLowerCase()}.` : `公式情報で${selectedDateShortLabel.value}の休場・利用休止を確認しています。`;
  return isEnglish.value ? `Official information confirms individual use on ${selectedDateShortLabel.value.toLowerCase()}.` : `公式情報から${selectedDateShortLabel.value}の個人利用枠を確認できています。`;
}
function availabilityCardHint(availability: TrackAvailability) {
  const reason = availability.unknownReason;
  if (reason === 'web_schedule_unavailable' || reason === 'phone_confirmation_required') return isEnglish.value ? 'Schedule not published online' : '予定はWeb未公開';
  if (reason === 'outside_published_period' || reason === 'schedule_not_published') return isEnglish.value ? 'Schedule not published yet' : '予定はまだ未公開';
  if (reason === 'reservation_system_unsupported') return isEnglish.value ? 'Check the booking system' : '予約システムで要確認';
  if (reason === 'unsupported_pdf_graphics' || reason === 'unsupported_source_type') return isEnglish.value ? 'Check the official schedule' : '公式予定表で要確認';
  if (reason === 'source_stale' || reason === 'fetch_failed' || reason === 'parse_failed' || reason === 'extraction_failed' || reason === 'invalid_content_type' || reason === 'source_changed') return isEnglish.value ? 'Latest schedule unavailable' : '最新予定を確認できません';
  return isEnglish.value ? 'Opening needs confirmation' : '開放状況は要確認';
}
function facilityCardAriaLabel(track: TrackFacility, availability: TrackAvailability) {
  return `${localizedName(track)}、${availabilityLabel(availability)}、${isEnglish.value ? 'open details and directions' : '詳細と行き方を表示'}`;
}
function scopeLabel(scope: TrackAvailability['periods'][number]['scope']) {
  const labels = {
    full_track: ['トラック', 'Track'], track_and_jogging_course: ['トラック・外周', 'Track and jogging course'],
    jogging_course_only: ['外周のみ', 'Jogging course only'], lane_subset: ['一部コース', 'Selected courses'], unknown: ['利用範囲要確認', 'Scope unconfirmed'],
  } as const;
  return labels[scope][isEnglish.value ? 1 : 0];
}
function availablePeriodLabels(availability: TrackAvailability) {
  const periods = availability.periods.filter(period => period.status === 'available');
  const merged: typeof periods = [];
  for (const period of periods) {
    const previous = merged.at(-1);
    if (previous && previous.to === period.from && previous.scope === period.scope && previous.eligibility === period.eligibility) previous.to = period.to;
    else merged.push({ ...period, conditions: [...period.conditions] });
  }
  return merged.map(period => {
    const time = period.from && period.to ? `${period.from}〜${period.to}` : (isEnglish.value ? 'During opening hours' : '開場時間内');
    const eligibility = period.eligibility === 'local_resident_worker_student' ? (isEnglish.value ? ' / Eligible local users only' : '・市内在住・在勤・在学者のみ') : '';
    return `${time}（${scopeLabel(period.scope)}）${eligibility}`;
  });
}
function freshnessLabel(availability: TrackAvailability) {
  const checked = new Date(availability.freshness.checkedAt);
  const formatted = new Intl.DateTimeFormat(isEnglish.value ? 'en-US' : 'ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(checked);
  return availability.freshness.fetchedAt
    ? (isEnglish.value ? `Official source checked: ${formatted}` : `公式情報の最終確認：${formatted}`)
    : (isEnglish.value ? `Status prepared: ${formatted}` : `要確認情報の生成：${formatted}`);
}
function availabilityActionUrl(track: TrackFacility) { return selectedDateAvailability(track).source.url || track.urls.schedule || track.urls.individualUse || track.urls.official; }
function availabilityActionLabel(availability: TrackAvailability) {
  if (availability.status === 'unknown') return isEnglish.value ? 'How to confirm' : '確認方法を見る';
  return isEnglish.value ? `${selectedDateShortLabel.value} schedule` : `${selectedDateShortLabel.value}の予定`;
}
function trackOutbound(eventName: 'availability_source_click' | 'official_site_click' | 'directions_click', track: TrackFacility) {
  trackSearchEvent(eventName, { track_id: track.id, availability_status: selectedDateAvailability(track).status });
}

function trackSearchEvent(name: ProductEventName, parameters: ProductEventParameters = {}) {
  trackProductEvent(name, {
    locale: isEnglish.value ? 'en' : 'ja',
    selected_date: selectedDate.value,
    ...parameters,
  });
}
</script>

<style scoped>
.track-search-page { max-width: 1185px; padding-block: 24px 40px; }
.track-hero { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; padding: 24px; margin-bottom: 16px; color: white; background: linear-gradient(135deg, #283593, #00897b); border-radius: 12px; }
.track-hero h1 { margin: 2px 0 8px; font-size: clamp(28px, 4vw, 42px); line-height: 1.2; }
.track-hero p { max-width: 720px; margin: 0; }
.track-eyebrow { font-size: 12px; font-weight: 700; letter-spacing: .14em; opacity: .85; }
.track-controls { display: flex; min-height: 52px; align-items: center; flex-wrap: wrap; gap: 8px 18px; padding: 6px 14px; margin-bottom: 12px; border: 1px solid #d9dce8; border-radius: 10px; background: white; }
.track-controls .v-switch { flex: 0 1 auto; }
.date-controls { padding: 12px 14px; margin-bottom: 12px; border: 1px solid #d9dce8; border-radius: 10px; background: white; }
.date-control-heading { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 9px; }
.date-control-heading span { color: #666; font-size: 13px; }
.date-shortcuts { display: flex; align-items: flex-end; flex-wrap: wrap; gap: 8px; }
.date-shortcuts .v-btn { min-height: 40px; }
.native-date-field { display: flex; min-width: 180px; color: #555; font-size: 12px; flex-direction: column; gap: 2px; }
.native-date-field input { min-height: 36px; padding: 5px 9px; color: #222; border: 1px solid #9da3b4; border-radius: 5px; background: white; font: inherit; font-size: 14px; }
.native-date-field input:focus-visible { border-color: #3f51b5; outline: 3px solid rgba(63, 81, 181, .22); outline-offset: 1px; }
.date-message { margin: 8px 0 0; color: #8a4b00; }
.marker-legend { display: inline-flex; align-items: center; gap: 6px; color: #555; font-size: 13px; }
.legend-dot { width: 12px; height: 12px; border-radius: 50%; }
.legend-dot.today-available { background: #00897b; }.legend-dot.today-partial { background: #f9a825; }.legend-dot.today-unknown { background: #78909c; }.legend-dot.today-unavailable { background: #c62828; }
.track-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
.track-layout.has-detail { grid-template-columns: minmax(0, 1.7fr) minmax(300px, 1fr); }
.map-panel { overflow: hidden; border: 1px solid #d9dce8; border-radius: 12px; background: #eef1f5; }
.map-tools { display: flex; min-height: 52px; align-items: center; flex-wrap: wrap; gap: 6px 10px; padding: 8px 10px; background: white; border-bottom: 1px solid #d9dce8; }
.map-tools strong { margin-right: 4px; font-size: 13px; }.map-tools span { color: #555; font-size: 12px; }
.track-map { width: 100%; height: min(64vh, 610px); min-height: 480px; z-index: 0; }
.detail-card { padding: 20px; scroll-margin-top: 64px; border: 1px solid #d9dce8; border-radius: 12px; background: white; box-shadow: 0 6px 24px rgba(24, 39, 90, .09); }
.detail-heading { display: flex; justify-content: space-between; gap: 12px; }
.detail-card h2 { margin: 8px 0; font-size: 22px; line-height: 1.35; }
.track-address { color: #666; }
.today-availability { padding: 12px; margin: 12px 0 14px; border-left: 5px solid; border-radius: 7px; background: #f5f7fa; }
.today-availability strong { display: block; font-size: 17px; }.today-availability p { margin: 5px 0; }.today-availability small { color: #555; }
.availability-date { display: block; margin-bottom: 3px; color: #555; font-size: 12px; }
.availability-periods { padding-left: 20px; margin: 7px 0; }
.availability-badge { display: inline-flex; width: fit-content; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; }
.availability--available { color: #00695c; border-color: #00897b; background: #e0f2f1; }
.availability--partially-available { color: #7a4d00; border-color: #f9a825; background: #fff8e1; }
.availability--unknown { color: #455a64; border-color: #78909c; background: #eceff1; }
.availability--unavailable { color: #8e1717; border-color: #c62828; background: #ffebee; }
.status-badge { display: inline-flex; width: fit-content; align-items: center; gap: 4px; padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.status-badge.is-available { color: #00695c; background: #e0f2f1; }.status-badge.is-other { color: #9a4b00; background: #fff3e0; }
.track-facts { margin: 0; border-top: 1px solid #eceef3; }
.track-facts div { display: grid; grid-template-columns: 92px 1fr; gap: 8px; padding: 9px 0; border-bottom: 1px solid #eceef3; }
.track-facts dt { color: #666; }.track-facts dd { margin: 0; font-weight: 500; }
.track-note { padding: 10px; margin: 12px 0; color: #8a4b00; background: #fff8e1; border-radius: 6px; }
.official-warning { margin: 14px 0; color: #555; font-size: 13px; }
.detail-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.detail-actions .v-btn { min-height: 44px; flex: 1 1 100%; }
.detail-actions .action-schedule { color: #4e342e !important; border: 1px solid #d99000; }
.detail-actions .action-official { color: #fff !important; }
.detail-actions .action-directions { color: #00695c !important; border-color: #00695c !important; }
.detail-actions .action-detail { color: #fff !important; }
.facility-section { margin-top: 28px; }.facility-section h2 { margin: 0; font-size: 24px; }.dataset-note { color: #666; }
.facility-heading { display: flex; align-items: end; justify-content: space-between; gap: 16px; }.facility-heading p { margin: 3px 0 0; color: #555; font-size: 13px; }
.distance-results,.prefecture-results { display: flex; flex-direction: column; gap: 7px; }
.facility-row { display: grid; grid-template-columns: minmax(0,1fr) auto; overflow: hidden; border: 1px solid #d9dce8; border-radius: 9px; background: white; }
.facility-row > button { display: grid; grid-template-columns: auto minmax(180px,1fr) auto auto; align-items: center; gap: 10px; min-width: 0; min-height: 64px; padding: 9px 12px; color: inherit; text-align: left; border: 0; background: transparent; cursor: pointer; }
.facility-row > a { display: flex; min-width: 82px; min-height: 44px; align-items: center; justify-content: center; gap: 2px; padding: 8px 11px; color: #303f9f; border-left: 1px solid #eceef3; font-size: 13px; font-weight: 700; text-decoration: none; }
.facility-row:hover,.facility-row:focus-within { border-color: #3f51b5; box-shadow: 0 3px 12px rgba(24,39,90,.1); }.facility-row.is-selected { border-color:#3f51b5;background:#f7f8ff;box-shadow:0 0 0 1px #3f51b5; }
.facility-main { display: flex; min-width: 0; flex-direction: column; gap: 2px; }.facility-main strong { overflow: hidden; font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }.facility-main small { overflow: hidden; color: #666; text-overflow: ellipsis; white-space: nowrap; }
.facility-distance { color: #283593; white-space: nowrap; }.map-action { display: inline-flex; align-items: center; gap: 2px; color: #303f9f; font-size: 13px; font-weight: 700; }
.load-more { align-self: center; min-height: 44px; margin-top: 10px; }
.prefecture-groups { display: flex; flex-direction: column; gap: 9px; }.prefecture-group { overflow: hidden; border: 1px solid #d9dce8; border-radius: 10px; background: #f8f9fc; }
.prefecture-toggle { display: flex; width: 100%; min-height: 56px; align-items: center; justify-content: space-between; padding: 10px 14px; color: #222; border: 0; background: transparent; cursor: pointer; }.prefecture-toggle > span { display: flex; align-items: baseline; gap: 10px; }.prefecture-toggle strong { font-size: 17px; }.prefecture-toggle small { color: #666; }
.prefecture-results { padding: 0 8px 8px; }.prefecture-results .facility-row { background: white; }
.no-results { padding: 28px 20px; text-align: center; border: 1px dashed #9da3b4; border-radius: 10px; background: #fafbff; }
.no-results p { margin: 6px 0 14px; color: #555; }
.map-credit { margin: 20px 0 0; color: #666; font-size: 12px; }
:global(.track-marker-shell), :global(.current-location-shell), :global(.track-cluster-shell) { background: transparent; border: 0; }
:global(.muted-map-tiles) { filter: grayscale(.1) saturate(.82) contrast(.96) brightness(1.03); }
:global(.track-marker) { display: block; width: 26px; height: 26px; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 7px rgba(0,0,0,.42); }
:global(.track-marker--available) { background: #00897b; }:global(.track-marker--partially_available) { background: #f9a825; }:global(.track-marker--unknown) { background: #78909c; }:global(.track-marker--unavailable) { background: #c62828; }
:global(.track-marker--selected) { width: 32px; height: 32px; border-width: 5px; box-shadow: 0 0 0 3px #283593,0 3px 10px rgba(0,0,0,.45); }
:global(.search-origin-dot) { display: block; width: 22px; height: 22px; border: 5px solid white; border-radius: 50%; background: #3949ab; box-shadow: 0 0 0 3px #3949ab,0 2px 8px rgba(0,0,0,.4); }
:global(.track-cluster) { display: flex; width: 38px; height: 38px; align-items: center; justify-content: center; color: white; border: 4px solid white; border-radius: 50%; background: #37474f; box-shadow: 0 2px 9px rgba(0,0,0,.4); font-size: 13px; font-weight: 800; }
.guide-link { text-align: right; font-size: 13px; }
@media (max-width: 799px) {
  .track-search-page { padding: 12px 10px 28px; }
  .track-hero { align-items: stretch; padding: 18px; flex-direction: column; }
  .track-hero .v-btn { align-self: flex-start; }
  .track-controls { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: center; gap: 8px 12px; padding-block: 10px; }
  .track-controls .v-switch, .track-controls .result-count { grid-column: 1 / -1; }
  .date-control-heading { align-items: flex-start; flex-direction: column; }
  .date-shortcuts .v-btn { flex: 1 1 calc(25% - 8px); }
  .native-date-field { width: 100%; }
  .track-layout, .track-layout.has-detail { grid-template-columns: 1fr; }
  .track-map { height: 52vh; min-height: 360px; }
  .facility-row > button { grid-template-columns: minmax(0,1fr) auto; gap: 6px 8px; }
  .facility-row .availability-badge { grid-column: 1 / -1; }
  .facility-row .facility-main strong { display: -webkit-box; overflow: hidden; white-space: normal; -webkit-box-orient: vertical; -webkit-line-clamp: 2; }
  .facility-row .facility-distance { grid-column: 1; }
  .facility-row .map-action { grid-column: 2; grid-row: 2 / span 2; }
  .facility-row > a { min-width: 70px; padding-inline: 7px; }
  .detail-card { padding: 16px; }
}
</style>
