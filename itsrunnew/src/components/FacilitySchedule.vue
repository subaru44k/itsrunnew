<template>
  <div class="facility-schedule" :data-schedule-mode="loading ? 'loading' : summary.mode" :aria-busy="loading">
    <h2>{{ !loading && !summary.known.length ? (english ? 'How to confirm individual use' : '個人利用の確認方法') : (english ? 'Individual-use schedule' : '個人利用スケジュール') }}</h2>
    <p v-if="loading" role="status">{{ english ? 'Loading the schedule…' : '予定を読み込み中…' }}</p>
    <template v-if="summary.known.length">
      <p class="next-use" v-if="summary.next && !loading">
        <strong>{{ english ? 'Next confirmed use' : '次に使える日' }}</strong>
        <button type="button" @click="$emit('select', summary.next.date)">{{ dateLabel(summary.next.date) }} · {{ timeSummary(summary.next) }}</button>
      </p>
      <p v-else-if="!loading">{{ english ? 'No upcoming usable period is confirmed within this range.' : 'この範囲では、今後利用できる枠を確認できていません。' }}</p>
      <p class="coverage">{{ dateLabel(visibleRecords[0].date) }} – {{ dateLabel(visibleRecords.at(-1)!.date) }} · {{ english ? 'Select a date for details' : '日付を選ぶと詳細' }}</p>
      <p v-if="summary.gaps.length" class="coverage-gap">{{ english ? 'For other dates, check the official source.' : '掲載のない日程は公式情報をご確認ください。' }}</p>
      <ul class="schedule-list">
        <li v-for="record in visibleRecords" :key="record.date">
          <button type="button" :aria-pressed="detailOpen && selectedDate === record.date" aria-controls="selected-day-details" @click="$emit('select', record.date)">
            <strong>{{ dateLabel(record.date) }}</strong>
            <span :class="`schedule-status schedule-status--${record.status}`">{{ label(record) }}</span>
            <span v-if="record.status !== 'unavailable'" class="schedule-time">{{ timeSummary(record) }}</span>
          </button>
        </li>
      </ul>
    </template>
    <template v-else-if="!loading">
      <h3>{{ english ? 'Confirm before individual use' : '個人利用には事前確認が必要です' }}</h3>
      <p>{{ confirmationText }}</p>
      <p v-if="checked" class="coverage">{{ english ? 'Source fetched / attempted (JST)' : '情報源の最終取得・取得試行（日本時間）' }}: {{ checked }}</p>
      <p v-else-if="facilityVerifiedAt !== '—'" class="coverage">{{ english ? 'Facility information checked' : '施設情報の確認日' }}: {{ facilityVerifiedAt }}</p>
    </template>
    <button v-if="!loading && !expanded && summary.known.length > 14" type="button" class="expand-schedule" @click="expanded = true">{{ english ? 'Show more dates' : 'さらに日程を見る' }}</button>
    <slot name="date-picker" />
    <slot />
    <p v-if="!loading && failures" class="coverage-gap">{{ english ? 'Some dates could not be loaded. Check the official source.' : '一部の日付情報を取得できませんでした。公式情報をご確認ください。' }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue';
import { availabilityForTrack, localDateKey, type TrackAvailability } from '../model/availability';
import { availabilityManifest, availabilityManifestStatus, loadAvailabilityDate } from '../model/availability-range';
import { availabilitySourceTimestamp, compactPeriodSummary, summarizeFacilitySchedule } from '../model/facility-schedule';
const props = defineProps<{ trackId: string; english: boolean; selectedDate: string; detailOpen: boolean; selectedAvailability: TrackAvailability | null; facilityVerifiedAt: string }>();
defineEmits<{ select: [date: string] }>();
const records = ref<TrackAvailability[]>([]);
const loading = ref(true);
const failures = ref(0);
const expanded = ref(false);
const today = localDateKey();
const availableDates = computed(() => availabilityManifest.dates.filter(date => date >= today));
const dates = computed(() => availableDates.value.slice(0, 31));
const summary = computed(() => summarizeFacilitySchedule(records.value, dates.value, today));
const visibleRecords = computed(() => summary.value.known.slice(0, expanded.value ? 31 : 14));
let sequence = 0;
let loadedKey = '';
const readyWaiters = new Set<() => void>();
function finishLoading() {
  loading.value = false;
  for (const resolve of readyWaiters) resolve();
  readyWaiters.clear();
}
function whenReady(): Promise<void> {
  return loading.value ? new Promise(resolve => readyWaiters.add(resolve)) : Promise.resolve();
}
defineExpose({ whenReady });
onScopeDispose(() => { sequence++; finishLoading(); });
watch(() => props.trackId, () => {
  sequence++;
  loadedKey = '';
  records.value = [];
  loading.value = true;
  failures.value = 0;
  expanded.value = false;
});
watch([() => props.trackId, () => availabilityManifest.generatedAt, availabilityManifestStatus], async () => {
  // A background manifest check is not a new schedule. Keep the existing
  // rows and skip another range load when its generation is unchanged.
  if (availabilityManifestStatus.value === 'loading') return;
  const key = `${props.trackId}|${availabilityManifest.generatedAt}|${dates.value.join(',')}`;
  if (key === loadedKey) {
    // Keep freshness checks even when the published generation is unchanged.
    records.value = records.value.map(record => availabilityForTrack(record.trackId, record.date, new Date(), {
      schemaVersion: 1, date: record.date, timezone: 'Asia/Tokyo',
      generatedAt: availabilityManifest.generatedAt, facilities: [record],
    }));
    return;
  }
  const current = ++sequence;
  const hasPrevious = records.value.length > 0;
  const trackChanged = loadedKey && !loadedKey.startsWith(`${props.trackId}|`);
  if (trackChanged) records.value = [];
  loadedKey = key;
  failures.value = 0;
  loading.value = true;
  const id = props.trackId;
  const queue = [...dates.value];
  const loaded: TrackAvailability[] = [];
  let failed = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length && current === sequence) {
      const date = queue.shift()!;
      try {
        loaded.push(availabilityForTrack(id, date, new Date(), await loadAvailabilityDate(date)));
        if (current === sequence && (!hasPrevious || trackChanged)) records.value = [...loaded];
      }
      catch { failed++; }
    }
  }));
  if (current !== sequence) return;
  records.value = loaded;
  failures.value = failed;
  finishLoading();
}, { immediate: true });
function dateLabel(date: string) { return new Intl.DateTimeFormat(props.english ? 'en-US' : 'ja-JP', { timeZone: 'Asia/Tokyo', month: 'short', day: 'numeric', weekday: 'short' }).format(new Date(`${date}T12:00:00+09:00`)); }
function timeSummary(record: TrackAvailability) { return compactPeriodSummary(record, props.english); }
function label(record: TrackAvailability) { return ({ available: ['利用可能', 'Available'], partially_available: ['一部利用可', 'Partial'], unavailable: ['利用不可', 'Unavailable'], unknown: ['要確認', 'Confirm'] })[record.status][props.english ? 1 : 0]; }
const representative = computed(() => records.value.find(record => record.unknownReason === 'phone_confirmation_required') ?? records.value[0] ?? props.selectedAvailability);
const confirmationText = computed(() => {
  const reason = representative.value?.unknownReason;
  if (reason === 'phone_confirmation_required') return props.english ? 'Future individual-use dates cannot be confirmed online. Contact the facility by phone before visiting; use the official site for contact details.' : '今後の個人利用予定はWebでは確認できません。訪問前に施設へ電話で確認してください。問い合わせ先は公式サイトで確認できます。';
  if (reason === 'schedule_not_published' || reason === 'web_schedule_unavailable') return props.english ? 'A usable daily schedule is not available online. Check individual-use dates and conditions directly with the facility.' : 'Webで確認できる日別の個人利用予定がありません。利用日と利用条件を施設へ直接ご確認ください。';
  if (reason === 'source_stale') return props.english ? 'The saved schedule is out of date. Future availability cannot currently be confirmed; check the latest official information.' : '保存されている予定情報の有効期限が切れています。現在、今後の利用可否を確認できません。最新の公式情報をご確認ください。';
  return props.english ? 'Future individual-use availability cannot currently be confirmed. This does not mean the facility is closed. Check the official schedule or contact the facility.' : '現在、今後の個人利用可否を確認できません。利用不可という意味ではありません。公式の予定や問い合わせ先でご確認ください。';
});
const checked = computed(() => {
  const timestamp = availabilitySourceTimestamp(representative.value);
  if (!timestamp) return '';
  return new Intl.DateTimeFormat(props.english ? 'en-US' : 'ja-JP', { timeZone: 'Asia/Tokyo', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(timestamp));
});
</script>
<style scoped>
h2 { margin: 0 0 10px; font-size: 22px; }
h3 { font-size: 19px; margin: 8px 0; }
p { margin: 8px 0 12px; }
.next-use { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; padding: 8px 12px; background: #e0f2f1; border-radius: 8px; }
.next-use strong { font-size: 13px; }
.next-use button { min-height: 44px; padding: 0; border: 0; background: transparent; color: #00695c; text-align: left; font-weight: 700; }
.coverage,.coverage-gap { font-size: 12px; color: #45505d; }
.schedule-list { display: grid; grid-template-columns: repeat(7, minmax(0,1fr)); gap: 6px; list-style: none; padding: 0; margin: 8px 0; }
.schedule-list button { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; width: 100%; min-height: 80px; padding: 8px; text-align: left; background: white; border: 1px solid #ccd6dd; border-radius: 6px; font-size: 13px; }
.schedule-time { font-size: 12px; color: #45505d; }
.schedule-list button[aria-pressed=true] { outline: 2px solid #283593; outline-offset: -2px; background: #e8eaf6; }
@media(max-width:1000px) { .schedule-list { grid-template-columns: repeat(4,minmax(0,1fr)); } }
@media(max-width:600px) {
  .schedule-list { grid-template-columns: repeat(2,minmax(0,1fr)); }
  .schedule-list button { display: grid; grid-template-columns: 1fr auto; column-gap: 4px; min-height: 64px; padding: 7px; font-size: 12px; }
  .schedule-time { grid-column: 1 / -1; }
  .schedule-status { font-size: 11px; }
}
button:focus-visible { outline: 3px solid #283593; }
.schedule-status { font-weight: 700; }
.schedule-status--available { color: #00695c; }
.schedule-status--unavailable { color: #a51f1f; }
.schedule-status--partially_available { color: #795000; }
.expand-schedule { min-height: 44px; padding: 8px 12px; border: 1px solid #283593; border-radius: 6px; color: #283593; background: white; }
</style>
