<template>
  <v-container class="pace-page">
    <header class="pace-heading"><p class="eyebrow">PACE PLANNER</p><h1>{{ copy.title }}</h1><p>{{ copy.intro }}</p></header>
    <section class="pace-panel" :aria-label="copy.input">
      <div class="mode-switch" role="group" :aria-label="copy.input">
        <button v-for="value in (['goal', 'pace'] as const)" :key="value" type="button" :aria-pressed="mode === value" @click="changeMode(value)">{{ value === 'goal' ? copy.byGoal : copy.byPace }}</button>
      </div>
      <fieldset class="time-inputs" @input="edited = true">
        <legend>{{ mode === 'goal' ? copy.goal : copy.pace }}</legend>
        <label v-if="mode === 'goal'">{{ copy.hours }}<input v-model="hours" data-pace-hours type="number" inputmode="numeric" min="0" max="12" step="1" :aria-invalid="!settings" aria-describedby="pace-input-help" /></label>
        <label>{{ copy.minutes }}<input v-model="minutes" data-pace-minutes type="number" inputmode="numeric" min="0" :max="mode === 'goal' ? 59 : 20" step="1" :aria-invalid="!settings" aria-describedby="pace-input-help" /></label>
        <label>{{ copy.seconds }}<input v-model="seconds" data-pace-seconds type="number" inputmode="numeric" min="0" max="59" step="1" :aria-invalid="!settings" aria-describedby="pace-input-help" /></label>
      </fieldset>
      <p id="pace-input-help" :class="{ 'input-error': !settings }">{{ mode === 'goal' ? copy.goalRange : copy.paceRange }}</p>
      <div v-if="mode === 'goal'" class="presets" role="group" :aria-label="copy.presets">
        <button v-for="value in [10800, 12600, 14400, 16200, 18000]" :key="value" type="button" :aria-pressed="settings?.seconds === value" @click="chooseGoal(value)">{{ formatDuration(value).slice(0, -3) }}</button>
      </div>
      <p class="storage-note">{{ storageFailed ? copy.storageFailed : copy.remember }} <button type="button" class="text-button" @click="reset">{{ copy.reset }}</button></p>
      <p v-if="invalidLink" class="input-error" role="status">{{ copy.invalidLink }}</p>
    </section>
    <section v-if="settings" class="pace-results" :aria-label="copy.results" data-pace-results>
      <div class="summary-grid" aria-live="polite" aria-atomic="true">
        <div><span>{{ copy.pace }}</span><strong data-pace-summary>{{ formatPace(paceSeconds(settings)) }}<small> / km</small></strong><span>{{ copy.approx }}</span></div>
        <div><span>{{ copy.finish }}</span><strong data-goal-summary>{{ formatDuration(goalSeconds(settings)) }}</strong><span>42.195 km</span></div>
        <div><span>{{ copy.half }}</span><strong>{{ formatDuration(goalSeconds(settings) / 2) }}</strong><span>21.0975 km</span></div>
      </div>
      <div class="results-layout">
        <section class="pace-panel split-panel">
          <h2>{{ copy.splits }}</h2>
          <table class="split-table" data-personal-splits>
            <caption class="sr-only">{{ copy.splits }}</caption>
            <thead><tr><th scope="col">{{ copy.distance }}</th><th scope="col">{{ copy.elapsed }}</th></tr></thead>
            <tbody><tr v-for="row in splits" :key="row.metres"><th scope="row">{{ distanceLabel(row.metres) }}</th><td>{{ formatDuration(row.seconds) }}</td></tr></tbody>
          </table>
          <p class="calculation-note">{{ copy.rounding }}</p><p class="calculation-note">{{ copy.subNote }}</p>
          <div class="save-actions"><button type="button" @click="copyLink">{{ copy.share }}</button><button type="button" :disabled="savingImage" @click="saveImage">{{ savingImage ? copy.saving : copy.image }}</button></div>
          <p role="status" class="action-status">{{ actionStatus }}</p>
          <label v-if="manualLink" class="manual-link">{{ copy.manualCopy }}<input readonly :value="shareUrl" @focus="($event.target as HTMLInputElement).select()" /></label>
        </section>
        <section class="pace-panel training-panel">
          <p class="eyebrow">TRAINING</p><h2>{{ copy.training }}</h2><p>{{ copy.trainingIntro }}</p>
          <dl class="training-times"><div v-for="row in training" :key="row.metres"><dt>{{ distanceLabel(row.metres) }}</dt><dd>{{ formatDuration(row.seconds) }}</dd></div></dl>
          <router-link class="track-link" :to="locale === 'en' ? '/en/' : '/'">{{ copy.findTrack }} <span aria-hidden="true">→</span></router-link>
        </section>
      </div>
    </section>
    <p v-else class="pace-panel input-error" role="alert">{{ copy.invalidInput }}</p>
    <details class="pace-panel comparison" data-pace-comparison>
      <summary>{{ copy.compare }}<span>{{ copy.compareHint }}</span></summary>
      <div class="comparison-body"><v-select :items="items" :label="$t('pacetable.personal_goal')" v-model="targetTime" /><div class="d-sm-none"><PhonePaceTable /></div><div class="d-none d-sm-block"><PcPaceTable /></div></div>
    </details>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';
import { useRoute, useRouter } from 'vue-router';
import PhonePaceTable from '@/components/laptime/PhonePaceTable.vue';
import PcPaceTable from '@/components/laptime/PcPaceTable.vue';
import { useAppStore } from '@/store';
import { DEFAULT_PACE_SETTINGS, formatDuration, formatPace, goalSeconds, isPaceSettings, marathonSplits, paceSeconds, parsePaceQuery, readPaceSettings, trainingSplits, type PaceSettings } from '@/model/marathon';
import { paceCopy } from '@/components/laptime/pace-copy';
import { downloadPaceImage } from '@/components/laptime/pace-image';
const { t, locale } = useI18n();
const copy = computed(() => paceCopy[locale.value === 'en' ? 'en' : 'ja']);
const store = useAppStore();
const route = useRoute();
const router = useRouter();
const storageKey = 'itsrun.marathon.v1';
const storageFailed = ref(false);
function readSaved() {
  try { return readPaceSettings(localStorage.getItem(storageKey)); }
  catch { storageFailed.value = true; return null; }
}
const invalidLink = ref(false);
function fromLocation() {
  const linked = parsePaceQuery(route.query);
  invalidLink.value = !linked && ('goal' in route.query || 'pace' in route.query);
  return linked ?? readSaved() ?? DEFAULT_PACE_SETTINGS;
}
const initial = fromLocation();
const modeValues = { goal: 14400, pace: 330 };
modeValues[initial.mode] = initial.seconds;
const mode = ref<PaceSettings['mode']>(initial.mode);
const hours = ref<string | number>(0);
const minutes = ref<string | number>(0);
const seconds = ref<string | number>(0);
const edited = ref(false);
function fill(value: PaceSettings) {
  mode.value = value.mode;
  hours.value = value.mode === 'goal' ? Math.floor(value.seconds / 3600) : 0;
  minutes.value = value.mode === 'goal' ? Math.floor(value.seconds / 60) % 60 : Math.floor(value.seconds / 60);
  seconds.value = value.seconds % 60;
}
fill(initial);
const settings = computed<PaceSettings | null>(() => {
  const parts = mode.value === 'goal' ? [hours.value, minutes.value, seconds.value] : [minutes.value, seconds.value];
  if (parts.some(value => !/^\d+$/.test(String(value)))) return null;
  if (Number(seconds.value) > 59 || (mode.value === 'goal' && Number(minutes.value) > 59)) return null;
  const value = { mode: mode.value, seconds: Number(minutes.value) * 60 + Number(seconds.value) + (mode.value === 'goal' ? Number(hours.value) * 3600 : 0) };
  return isPaceSettings(value) ? value : null;
});
const splits = computed(() => settings.value ? marathonSplits(settings.value) : []);
const training = computed(() => settings.value ? trainingSplits(settings.value) : []);
const actionStatus = ref('');
const manualLink = ref(false);
const savingImage = ref(false);
const shareUrl = computed(() => {
  const url = new URL(route.path, window.location.origin);
  if (settings.value) url.searchParams.set(settings.value.mode, String(settings.value.seconds));
  return url.href;
});
function persist(value: PaceSettings) {
  try { localStorage.setItem(storageKey, JSON.stringify(value)); storageFailed.value = false; }
  catch { storageFailed.value = true; }
}
if (parsePaceQuery(route.query)) persist(initial);
function commit(value: PaceSettings) {
  invalidLink.value = false;
  modeValues[value.mode] = value.seconds;
  persist(value);
  const current = parsePaceQuery(route.query);
  if (current?.mode === value.mode && current.seconds === value.seconds) return;
  const query = { ...route.query }; delete query.goal; delete query.pace;
  query[value.mode] = String(value.seconds);
  void router.replace({ query, hash: route.hash });
}
watch(settings, value => {
  actionStatus.value = ''; manualLink.value = false;
  if (value && edited.value) commit(value);
});
watch(() => [route.query.goal, route.query.pace], () => {
  const value = fromLocation();
  if (parsePaceQuery(route.query)) { persist(value); modeValues[value.mode] = value.seconds; }
  if (settings.value?.mode === value.mode && settings.value.seconds === value.seconds) return;
  edited.value = false; fill(value);
});
function chooseGoal(seconds: number) {
  const value: PaceSettings = { mode: 'goal', seconds };
  edited.value = true; fill(value);
  commit(value);
}
function changeMode(value: PaceSettings['mode']) {
  if (value === mode.value) return;
  if (settings.value) modeValues[settings.value.mode] = settings.value.seconds;
  edited.value = true;
  fill({ mode: value, seconds: modeValues[value] });
}
async function reset() {
  edited.value = false;
  try { localStorage.removeItem(storageKey); storageFailed.value = false; } catch { storageFailed.value = true; }
  modeValues.goal = 14400; modeValues.pace = 330;
  fill(DEFAULT_PACE_SETTINGS); invalidLink.value = false;
  const query = { ...route.query }; delete query.goal; delete query.pace;
  await router.replace({ query, hash: route.hash });
}
function distanceLabel(metres: number) {
  if (metres === 21097.5) return copy.value.half;
  if (metres === 42195) return copy.value.finish;
  return metres < 1000 ? `${metres} m` : `${metres / 1000} km`;
}
async function copyLink() {
  try { await navigator.clipboard.writeText(shareUrl.value); actionStatus.value = copy.value.copied; }
  catch { manualLink.value = true; actionStatus.value = copy.value.manualCopy; }
}
async function saveImage() {
  if (!settings.value || savingImage.value) return;
  savingImage.value = true;
  try {
    await downloadPaceImage({ title: copy.value.title, goalLabel: copy.value.finish, goal: formatDuration(goalSeconds(settings.value)), paceLabel: copy.value.pace, pace: `${formatPace(paceSeconds(settings.value))} / km`, distance: copy.value.distance, elapsed: copy.value.elapsed, rows: splits.value.map(row => [distanceLabel(row.metres), formatDuration(row.seconds)]), note: copy.value.imageNote, filename: `itsrun-${settings.value.mode}-${settings.value.seconds}.png` });
    actionStatus.value = copy.value.imageSaved;
  } catch { actionStatus.value = copy.value.imageFailed; }
  finally { savingImage.value = false; }
}
const items = computed(() => [t('pacetable.from_2hours'), t('pacetable.from_3hourshalf'), t('pacetable.from_5hours')]);
const targetTime = computed({ get: () => items.value[store.targetTimeIndex], set: (value: string) => store.changeTargetTime(items.value.indexOf(value)) });
</script>

<style scoped>
.pace-page { max-width: 1080px; padding: 32px 24px 56px; color: #202c43; }
.pace-heading { margin-bottom: 24px; }
.eyebrow { font-size: 12px; font-weight: 800; letter-spacing: .14em; color: #3f51b5; margin-bottom: 6px; }
h1 { font-size: clamp(28px, 4vw, 40px); line-height: 1.3; margin-bottom: 10px; }
h2 { font-size: 21px; margin-bottom: 16px; }
.pace-panel { border: 1px solid #dce1ed; border-radius: 16px; background: white; padding: 24px; }
button { min-height: 44px; padding: 10px 16px; border: 1px solid #c6cedf; border-radius: 8px; font: inherit; font-weight: 600; color: #304397; background: white; cursor: pointer; }
button:hover { background: #eef1fb; }
button:focus-visible, input:focus-visible, summary:focus-visible, a:focus-visible { outline: 3px solid #5576d8; outline-offset: 3px; }
button[aria-pressed="true"] { background: #3f51b5; color: white; border-color: #3f51b5; }
button:disabled { opacity: .6; cursor: wait; }
.mode-switch { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 24px; }
.time-inputs { display: flex; gap: 12px; border: 0; padding: 0; margin: 0 0 12px; }
.time-inputs legend { font-weight: 700; margin-bottom: 10px; }
.time-inputs label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #526079; }
.time-inputs input { width: 110px; max-width: 100%; font-size: 28px; font-weight: 650; padding: 10px 12px; border: 1px solid #aeb9cf; border-radius: 8px; background: #fcfdff; color: #202c43; font-variant-numeric: tabular-nums; }
#pace-input-help, .storage-note, .calculation-note { font-size: 13px; color: #56627b; line-height: 1.7; }
.presets { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
.text-button { padding: 4px 8px; border: 0; text-decoration: underline; font-size: 13px; }
.storage-note { margin-bottom: 0; }
.input-error { color: #a12726 !important; }
.summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin: 24px 0; padding: 24px; border-radius: 16px; background: #edf0fc; }
.summary-grid div { display: flex; flex-direction: column; gap: 6px; }
.summary-grid span { font-size: 13px; color: #526079; }
.summary-grid strong { font-size: clamp(25px, 3vw, 36px); font-variant-numeric: tabular-nums; letter-spacing: -.025em; }
.summary-grid small { font-size: 14px; font-weight: 500; }
.results-layout { display: grid; grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr); gap: 24px; align-items: start; }
.split-table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums; margin-bottom: 16px; }
.split-table th, .split-table td { padding: 12px 8px; border-bottom: 1px solid #e3e7f0; text-align: left; }
.split-table thead th { font-size: 12px; color: #56627b; }
.split-table td, .split-table thead th:last-child { text-align: right; }
.split-table tbody th { font-weight: 500; }
.split-table tr:last-child { background: #f1f4fc; font-weight: 750; }
.split-table tbody tr:last-child th { font-weight: 750; }
.save-actions { display: flex; flex-wrap: wrap; gap: 8px; }
.action-status { min-height: 20px; margin: 8px 0 0; color: #304397; font-size: 13px; }
.manual-link { display: block; font-size: 13px; }
.manual-link input { display: block; width: 100%; padding: 10px; border: 1px solid #aeb9cf; border-radius: 4px; }
.training-panel > p { font-size: 14px; }
.training-times { margin: 24px 0; font-variant-numeric: tabular-nums; }
.training-times div { display: flex; justify-content: space-between; gap: 12px; padding: 14px 0; border-bottom: 1px solid #e3e7f0; }
.training-times dd { font-weight: 700; }
.track-link { display: flex; justify-content: space-between; align-items: center; min-height: 44px; gap: 12px; color: #304397; font-weight: 650; }
.comparison { margin-top: 24px; min-width: 0; }
.comparison summary { cursor: pointer; font-size: 18px; font-weight: 700; min-height: 44px; }
.comparison summary span { display: block; color: #56627b; font-size: 13px; font-weight: 400; padding-top: 8px; }
.comparison-body { margin-top: 24px; min-width: 0; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
@media (max-width: 650px) {
  .pace-page { padding: 24px 16px 40px; }
  .pace-panel { padding: 20px 16px; }
  .time-inputs label { flex: 1; min-width: 0; }
  .time-inputs input { width: 100%; }
  .summary-grid { grid-template-columns: 1fr 1fr; padding: 20px 16px; gap: 16px; }
  .summary-grid div:first-child { grid-column: 1 / -1; }
  .summary-grid div:first-child strong { font-size: 38px; }
  .summary-grid strong { font-size: 26px; }
  .results-layout { grid-template-columns: minmax(0, 1fr); }
}
</style>
