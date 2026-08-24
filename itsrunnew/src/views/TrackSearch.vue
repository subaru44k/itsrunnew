<template>
  <v-container class="track-search-page">
    <header class="track-hero">
      <div>
        <p class="track-eyebrow">{{ isEnglish ? 'TRACK FINDER' : 'TRACK FINDER' }}</p>
        <h1>{{ isEnglish ? 'Find a track near you' : '近くで走れるトラックを探す' }}</h1>
        <p>{{ isEnglish ? 'Search verified athletic tracks around Shakujii Park on an OpenStreetMap map.' : '石神井公園周辺の、公式情報で確認した陸上競技場・ランニングトラックを地図から探せます。' }}</p>
      </div>
      <v-btn color="indigo" prepend-icon="mdi-crosshairs-gps" :loading="locating" @click="requestLocation">
        {{ isEnglish ? 'Use my location' : '現在地を表示' }}
      </v-btn>
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
        <v-btn size="small" :variant="selectedDate === today ? 'flat' : 'outlined'" color="indigo" @click="chooseDate(today)">{{ isEnglish ? 'Today' : '今日' }}</v-btn>
        <v-btn size="small" :variant="selectedDate === tomorrow ? 'flat' : 'outlined'" color="indigo" @click="chooseDate(tomorrow)">{{ isEnglish ? 'Tomorrow' : '明日' }}</v-btn>
        <v-btn size="small" :variant="selectedDate === saturday ? 'flat' : 'outlined'" color="indigo" @click="chooseDate(saturday)">{{ isEnglish ? 'Sat' : '土曜' }}</v-btn>
        <v-btn size="small" :variant="selectedDate === sunday ? 'flat' : 'outlined'" color="indigo" @click="chooseDate(sunday)">{{ isEnglish ? 'Sun' : '日曜' }}</v-btn>
        <label class="native-date-field">
          <span>{{ isEnglish ? 'Choose a date' : '日付を選ぶ' }}</span>
          <input :value="selectedDate" type="date" :min="availabilityManifest.startDate" :max="availabilityManifest.endDate"
            :aria-label="isEnglish ? 'Choose availability date' : '利用日を選ぶ'" @change="onDateInput" />
        </label>
      </div>
      <v-progress-linear v-if="availabilityLoading" indeterminate color="indigo" aria-label="availability loading" />
      <p v-if="dateMessage" class="date-message" role="status">{{ dateMessage }}</p>
    </section>

    <section class="track-controls" aria-label="検索条件">
      <v-switch v-model="showUnavailable" color="red-darken-2" density="compact" hide-details
        :label="showUnavailableLabel" />
      <span>{{ visibleTracks.length }}{{ isEnglish ? ' facilities' : '施設' }}</span>
      <span class="marker-legend"><i class="legend-dot today-available" />{{ availabilityLabelForStatus('available') }}</span>
      <span class="marker-legend"><i class="legend-dot today-partial" />{{ availabilityLabelForStatus('partially_available') }}</span>
      <span class="marker-legend"><i class="legend-dot today-unknown" />{{ availabilityLabelForStatus('unknown') }}</span>
      <span class="marker-legend"><i class="legend-dot today-unavailable" />{{ availabilityLabelForStatus('unavailable') }}</span>
    </section>

    <div :class="['track-layout', { 'has-detail': selectedTrack }]">
      <section class="map-panel" aria-label="陸上トラック地図">
        <div ref="mapElement" id="track-map" class="track-map" />
      </section>

      <aside v-if="selectedTrack" ref="detailElement" class="detail-card" aria-live="polite">
        <div class="detail-heading">
          <div>
            <span :class="['status-badge', statusClass(selectedTrack)]">{{ statusLabel(selectedTrack) }}</span>
            <h2>{{ localizedName(selectedTrack) }}</h2>
          </div>
          <v-btn icon="mdi-close" variant="text" size="small" :aria-label="isEnglish ? 'Close details' : '詳細を閉じる'" @click="selectedTrack = null" />
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
          <v-btn v-if="availabilityActionUrl(selectedTrack)" color="amber-darken-3" variant="flat" :href="availabilityActionUrl(selectedTrack)" target="_blank" rel="noopener">{{ availabilityActionLabel(selectedAvailability) }}</v-btn>
          <v-btn color="indigo" variant="flat" :href="selectedTrack.urls.official" target="_blank" rel="noopener">{{ isEnglish ? 'Official site' : '公式サイト' }}</v-btn>
          <v-btn color="teal" variant="outlined" :href="directionsUrl(selectedTrack, currentLocation)" target="_blank" rel="noopener">{{ isEnglish ? 'Directions' : '経路を見る' }}</v-btn>
        </div>
      </aside>
    </div>

    <section class="facility-section">
      <h2>{{ isEnglish ? 'Facilities' : '施設一覧' }}</h2>
      <p class="dataset-note">{{ datasetNote }}</p>
      <div class="facility-grid">
        <button v-for="item in sortedTracks" :key="item.track.id" type="button" class="facility-card" @click="selectTrack(item.track)">
          <span :class="['availability-badge', availabilityClass(item.availability)]">{{ availabilityLabel(item.availability) }}</span>
          <strong>{{ localizedName(item.track) }}</strong>
          <span v-if="item.availability.status === 'unknown'" class="availability-hint">{{ availabilityDescription(item.availability) }}</span>
          <span>{{ summary(item.track) }}</span>
          <span v-if="item.distance != null" class="facility-distance">{{ formatDistance(item.distance) }}</span>
        </button>
      </div>
    </section>

    <p class="map-credit">Map data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a> (ODbL)</p>
  </v-container>
</template>

<script setup lang="ts">
import 'leaflet/dist/leaflet.css';
import L, { type Map as LeafletMap, type LayerGroup, type Marker } from 'leaflet';
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import { directionsUrl, distanceKm, tracks, type TrackFacility } from '../model/tracks';
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

const SHAKUJII_PARK = { latitude: 35.7433, longitude: 139.5969 };
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
const currentLocation = ref<{ latitude: number; longitude: number } | null>(null);
const selectedTrack = ref<TrackFacility | null>(null);
const mapElement = ref<HTMLElement | null>(null);
const detailElement = ref<HTMLElement | null>(null);
let map: LeafletMap | null = null;
let markerLayer: LayerGroup | null = null;
let locationMarker: Marker | null = null;
let loadSequence = 0;

const availabilityByTrack = computed(() => new Map(tracks.map(track => [track.id, availabilityForTrack(track.id, selectedDate.value, pageLoadedAt, selectedDataset.value)])));
const selectedDateAvailability = (track: TrackFacility) => availabilityByTrack.value.get(track.id) ?? availabilityForTrack(track.id, selectedDate.value, pageLoadedAt, selectedDataset.value);
const visibleTracks = computed(() => tracks.filter(track => isAvailabilityCandidate(selectedDateAvailability(track).status, showUnavailable.value)));
const sortedTracks = computed(() => visibleTracks.value
  .map(track => ({ track, availability: selectedDateAvailability(track), distance: currentLocation.value ? distanceKm(currentLocation.value, track.location) : null }))
  .sort((a, b) => a.distance == null || b.distance == null ? a.track.name.ja.localeCompare(b.track.name.ja, 'ja') : a.distance - b.distance));
const selectedDistance = computed(() => selectedTrack.value && currentLocation.value
  ? distanceKm(currentLocation.value, selectedTrack.value.location)
  : null);
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
  ? `${selectedDateShortLabel.value}’s status was generated before the static build. “Needs confirmation” remains a useful candidate.`
  : `${selectedDateShortLabel.value}の状況は静的サイトのbuild前に生成しています。「要確認」も有力候補として残しています。訪問前に公式情報をご確認ください。`);

watch(() => route.query.date, async value => {
  const normalized = normalizeSelectedDate(value, today);
  if (value !== normalized) {
    await router.replace({ query: { ...route.query, date: normalized } });
    return;
  }
  await loadDate(normalized);
}, { immediate: true });

onMounted(() => {
  if (!mapElement.value) return;
  map = L.map(mapElement.value, { zoomControl: true }).setView([SHAKUJII_PARK.latitude, SHAKUJII_PARK.longitude], 12);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);
  markerLayer = L.layerGroup().addTo(map);
  renderMarkers();
  nextTick(() => map?.invalidateSize());
});

onBeforeUnmount(() => map?.remove());
watch(visibleTracks, tracksNow => {
  renderMarkers();
  if (selectedTrack.value && !tracksNow.some(track => track.id === selectedTrack.value?.id)) selectedTrack.value = null;
});

function renderMarkers() {
  if (!map || !markerLayer) return;
  markerLayer.clearLayers();
  for (const track of visibleTracks.value) {
    const availability = selectedDateAvailability(track);
    const icon = L.divIcon({
      className: 'track-marker-shell',
      html: `<span class="track-marker track-marker--${availability.status}" aria-hidden="true"></span>`,
      iconSize: [30, 30], iconAnchor: [15, 15],
    });
    L.marker([track.location.latitude, track.location.longitude], { icon, title: localizedName(track) })
      .on('click', () => selectTrack(track)).addTo(markerLayer);
  }
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

function chooseDate(date: string) {
  if (!isGeneratedDate(date)) {
    dateMessage.value = isEnglish.value ? 'Choose a date in the searchable range.' : '検索可能期間内の日付を選んでください。';
    return;
  }
  router.replace({ query: { ...route.query, date } });
}

function onDateInput(event: Event) {
  chooseDate((event.target as HTMLInputElement).value);
}

function selectTrack(track: TrackFacility) {
  selectedTrack.value = track;
  map?.flyTo([track.location.latitude, track.location.longitude], Math.max(map.getZoom(), 14));
  nextTick(() => detailElement.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
}

function requestLocation() {
  if (!navigator.geolocation) {
    showLocationError(isEnglish.value ? 'Geolocation is unavailable. Showing Shakujii Park instead.' : 'このブラウザでは現在地を取得できません。石神井公園周辺を表示します。');
    return;
  }
  locating.value = true;
  locationMessage.value = '';
  navigator.geolocation.getCurrentPosition(position => {
    locating.value = false;
    locationError.value = false;
    currentLocation.value = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    locationMessage.value = isEnglish.value ? 'Location found. Facilities are sorted by straight-line distance.' : '現在地を取得しました。施設一覧を直線距離順に並べました。';
    if (map) {
      locationMarker?.remove();
      locationMarker = L.marker([position.coords.latitude, position.coords.longitude], {
        icon: L.divIcon({ className: 'current-location-shell', html: '<span class="current-location-dot"></span>', iconSize: [24, 24], iconAnchor: [12, 12] }),
        title: isEnglish.value ? 'Current location' : '現在地',
      }).addTo(map);
      map.setView([position.coords.latitude, position.coords.longitude], 13);
    }
  }, error => {
    locating.value = false;
    const messages: Record<number, string> = {
      1: isEnglish.value ? 'Location permission was denied. The map remains usable around Shakujii Park.' : '現在地の利用が許可されませんでした。石神井公園周辺の地図はそのまま利用できます。',
      2: isEnglish.value ? 'Your location is unavailable. Showing Shakujii Park instead.' : '現在地を取得できません。石神井公園周辺を表示します。',
      3: isEnglish.value ? 'Location request timed out. Showing Shakujii Park instead.' : '現在地の取得がタイムアウトしました。石神井公園周辺を表示します。',
    };
    showLocationError(messages[error.code] ?? messages[2]);
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
}

function showLocationError(message: string) {
  locationError.value = true;
  locationMessage.value = message;
  map?.setView([SHAKUJII_PARK.latitude, SHAKUJII_PARK.longitude], 12);
}

function localizedName(track: TrackFacility) { return isEnglish.value ? track.name.en : track.name.ja; }
function statusClass(track: TrackFacility) { return track.individualUse.status === 'available' ? 'is-available' : 'is-other'; }
function statusLabel(track: TrackFacility) {
  if (track.individualUse.status === 'available') return isEnglish.value ? 'Individual use' : '個人利用可';
  if (track.individualUse.status === 'temporarily-unavailable') return isEnglish.value ? 'Temporarily closed' : '一時休止中';
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
    ? (isEnglish.value ? `Official source checked ${formatted}` : `${formatted} 公式情報確認`)
    : (isEnglish.value ? `Status prepared ${formatted}` : `${formatted} 要確認情報を生成`);
}
function availabilityActionUrl(track: TrackFacility) { return selectedDateAvailability(track).source.url || track.urls.schedule || track.urls.individualUse || track.urls.official; }
function availabilityActionLabel(availability: TrackAvailability) {
  if (availability.status === 'unknown') return isEnglish.value ? 'How to confirm' : '確認方法を見る';
  return isEnglish.value ? `${selectedDateShortLabel.value} schedule` : `${selectedDateShortLabel.value}の予定`;
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
.native-date-field { display: flex; min-width: 180px; color: #555; font-size: 12px; flex-direction: column; gap: 2px; }
.native-date-field input { min-height: 36px; padding: 5px 9px; color: #222; border: 1px solid #9da3b4; border-radius: 5px; background: white; font: inherit; font-size: 14px; }
.date-message { margin: 8px 0 0; color: #8a4b00; }
.marker-legend { display: inline-flex; align-items: center; gap: 6px; color: #555; font-size: 13px; }
.legend-dot { width: 12px; height: 12px; border-radius: 50%; }
.legend-dot.today-available { background: #00897b; }.legend-dot.today-partial { background: #f9a825; }.legend-dot.today-unknown { background: #78909c; }.legend-dot.today-unavailable { background: #c62828; }
.track-layout { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; align-items: start; }
.track-layout.has-detail { grid-template-columns: minmax(0, 1.7fr) minmax(300px, 1fr); }
.map-panel { overflow: hidden; border: 1px solid #d9dce8; border-radius: 12px; background: #eef1f5; }
.track-map { width: 100%; height: min(64vh, 610px); min-height: 480px; z-index: 0; }
.detail-card { padding: 20px; scroll-margin-top: 64px; border: 1px solid #d9dce8; border-radius: 12px; background: white; box-shadow: 0 6px 24px rgba(24, 39, 90, .09); }
.detail-heading { display: flex; justify-content: space-between; gap: 12px; }
.detail-card h2 { margin: 8px 0; font-size: 22px; line-height: 1.35; }
.track-address { color: #666; }
.today-availability { padding: 12px; margin: 12px 0 14px; border-left: 5px solid; border-radius: 7px; background: #f5f7fa; }
.today-availability strong { display: block; font-size: 17px; }.today-availability p { margin: 5px 0; }.today-availability small { color: #555; }
.availability-date { display: block; margin-bottom: 3px; color: #555; font-size: 12px; }
.availability-periods { padding-left: 20px; margin: 7px 0; }
.availability-badge { display: inline-flex; width: fit-content; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; }
.availability--available { color: #00695c; border-color: #00897b; background: #e0f2f1; }
.availability--partially-available { color: #7a4d00; border-color: #f9a825; background: #fff8e1; }
.availability--unknown { color: #455a64; border-color: #78909c; background: #eceff1; }
.availability--unavailable { color: #8e1717; border-color: #c62828; background: #ffebee; }
.status-badge { display: inline-flex; width: fit-content; padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 700; }
.status-badge.is-available { color: #00695c; background: #e0f2f1; }.status-badge.is-other { color: #9a4b00; background: #fff3e0; }
.track-facts { margin: 0; border-top: 1px solid #eceef3; }
.track-facts div { display: grid; grid-template-columns: 92px 1fr; gap: 8px; padding: 9px 0; border-bottom: 1px solid #eceef3; }
.track-facts dt { color: #666; }.track-facts dd { margin: 0; font-weight: 500; }
.track-note { padding: 10px; margin: 12px 0; color: #8a4b00; background: #fff8e1; border-radius: 6px; }
.official-warning { margin: 14px 0; color: #555; font-size: 13px; }
.detail-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.facility-section { margin-top: 28px; }.facility-section h2 { font-size: 24px; }.dataset-note { color: #666; }
.facility-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.facility-card { display: flex; min-width: 0; padding: 14px; text-align: left; color: inherit; border: 1px solid #d9dce8; border-radius: 9px; background: white; cursor: pointer; flex-direction: column; gap: 5px; }
.facility-card:hover, .facility-card:focus-visible { border-color: #3f51b5; box-shadow: 0 3px 12px rgba(24, 39, 90, .1); outline: none; }
.facility-card strong { font-size: 16px; }.facility-card > span:not(.status-badge):not(.availability-badge) { color: #666; }.facility-distance { color: #283593 !important; font-weight: 700; }
.facility-card .availability-badge { color: inherit; }.availability-hint { font-size: 12px; line-height: 1.45; }
.map-credit { margin: 20px 0 0; color: #666; font-size: 12px; }
:global(.track-marker-shell), :global(.current-location-shell) { background: transparent; border: 0; }
:global(.track-marker) { display: block; width: 26px; height: 26px; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 7px rgba(0,0,0,.42); }
:global(.track-marker--available) { background: #00897b; }:global(.track-marker--partially_available) { background: #f9a825; }:global(.track-marker--unknown) { background: #78909c; }:global(.track-marker--unavailable) { background: #c62828; }
:global(.current-location-dot) { display: block; width: 22px; height: 22px; border: 5px solid white; border-radius: 50%; background: #1976d2; box-shadow: 0 0 0 2px #1976d2, 0 2px 7px rgba(0,0,0,.35); }
@media (max-width: 799px) {
  .track-search-page { padding: 12px 10px 28px; }
  .track-hero { align-items: stretch; padding: 18px; flex-direction: column; }
  .track-hero .v-btn { align-self: flex-start; }
  .track-controls { align-items: stretch; flex-direction: column; }
  .date-control-heading { align-items: flex-start; flex-direction: column; }
  .date-shortcuts .v-btn { flex: 1 1 calc(25% - 8px); }
  .native-date-field { width: 100%; }
  .track-layout, .track-layout.has-detail { grid-template-columns: 1fr; }
  .track-map { height: 52vh; min-height: 360px; }
  .facility-grid { grid-template-columns: 1fr; }
  .detail-card { padding: 16px; }
}
</style>
