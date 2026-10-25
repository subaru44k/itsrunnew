<template>
  <section id="pace-comparison" class="comparison" data-pace-comparison aria-labelledby="comparison-title">
    <h2 id="comparison-title">{{ copy.compare }}</h2><p>{{ copy.compareHint }}</p>
    <nav :aria-label="copy.compare" class="comparison-nav">
      <a v-for="hour in hours" :key="hour" :href="`#goals-${hour}`">{{ hour }}{{ copy.band }}</a><a href="#pace-detail">{{ copy.detail }}</a>
    </nav>
    <p id="comparison-scroll" class="scroll-hint">{{ copy.scrollHint }}</p>
    <div class="comparison-scroll" tabindex="0" role="region" :aria-label="copy.compare" aria-describedby="comparison-scroll">
      <table>
        <caption class="sr-only">{{ copy.compareHint }}</caption>
        <thead><tr><th scope="col">{{ copy.comparisonGoal }}</th><th scope="col">1km</th><th scope="col">5km</th><th scope="col">10km</th><th scope="col">20km</th><th scope="col">30km</th></tr></thead>
        <tbody v-for="hour in hours" :key="hour">
          <tr class="band-heading"><th :id="`goals-${hour}`" colspan="6" scope="colgroup" tabindex="-1">{{ hour }}{{ copy.band }}</th></tr>
          <tr v-for="row in rows.filter(row => Math.floor(row.goal / 3600) === hour)" :key="row.goal" :data-comparison-goal="row.goal" :class="{ selected: selected === row.goal }" @click="emit('select', row.goal)">
            <th scope="row"><button type="button" :aria-pressed="selected === row.goal" @click.stop="emit('select', row.goal)">{{ formatDuration(row.goal).slice(0, -3) }}</button></th>
            <td>{{ row.pace }}</td><td v-for="(time, index) in row.times" :key="index">{{ time }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="rounding-note">{{ copy.rounding }}</p>
  </section>
</template>
<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { paceCopy } from './pace-copy';
import { formatDuration, formatPace, marathonSplits, paceSeconds } from '@/model/marathon';
defineProps<{ selected: number | null }>();
const emit = defineEmits<{ select: [seconds: number] }>();
const { locale } = useI18n();
const copy = computed(() => paceCopy[locale.value === 'en' ? 'en' : 'ja']);
const hours = [2, 3, 4, 5, 6];
const rows = Array.from({ length: 19 }, (_, index) => {
  const goal = 7200 + index * 900;
  const settings = { mode: 'goal' as const, seconds: goal };
  return { goal, pace: formatPace(paceSeconds(settings)), times: marathonSplits(settings).filter(row => [5000, 10000, 20000, 30000].includes(row.metres)).map(row => formatDuration(row.seconds)) };
});
</script>
<style scoped>
.comparison { min-width: 0; scroll-margin-top: 88px; }
h2 { font-size: 21px; margin-bottom: 12px; }
.comparison-nav { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
.comparison-nav a { display: inline-flex; align-items: center; min-height: 44px; padding: 8px 12px; border: 1px solid #c6cedf; border-radius: 8px; color: #304397; background: white; }
.scroll-hint, .rounding-note { font-size: 13px; color: #56627b; }
.comparison-scroll { overflow-x: auto; border: 1px solid #dce1ed; border-radius: 12px; }
table { width: 100%; border-collapse: separate; border-spacing: 0; font-variant-numeric: tabular-nums; white-space: nowrap; background: white; }
th, td { padding: 10px 14px; text-align: right; border-bottom: 1px solid #e3e7f0; }
thead th { font-size: 13px; background: #edf0fc; }
tr > th:first-child { text-align: left; position: sticky; left: 0; background: white; z-index: 1; }
thead > tr > th:first-child { background: #edf0fc; }
.band-heading > th:first-child { background: #e6ebf7; scroll-margin-top: 88px; font-weight: 700; }
tbody tr:not(.band-heading) { cursor: pointer; }
tbody tr:not(.band-heading):hover td, tbody tr:not(.band-heading):hover th, .selected td, .selected > th:first-child { background: #eef1fb; }
button { border: 0; background: transparent; width: 100%; text-align: left; min-height: 44px; padding: 6px 0; color: #304397; font: inherit; font-weight: 700; text-decoration: underline; cursor: pointer; }
a:focus-visible, button:focus-visible, .comparison-scroll:focus-visible { outline: 3px solid #5576d8; outline-offset: -3px; }
.rounding-note { margin-top: 12px; }
.sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
@media (max-width: 650px) { th, td { padding: 8px 10px; font-size: 13px; } }
</style>
