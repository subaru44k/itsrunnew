<script setup lang="ts">
import { MARATHON_GOAL_RANGES, marathonGoals, marathonPace } from '@itsrun/core'
const { t: $t } = useI18n()
const selected = ref(0)
const labels = ['2:00–3:30', '3:30–5:00', '5:00–6:30']
const distances = ['goal', '1 km', '5 km', '10 km', '15 km', '20 km', 'half', '25 km', '30 km', '35 km', '40 km', 'finish']
const goals = computed(() => marathonGoals(MARATHON_GOAL_RANGES[selected.value] ?? MARATHON_GOAL_RANGES[0]))
const rows = computed(() => goals.value.map((goal) => ({ goal, times: marathonPace(goal) })))
useSeoMeta({ title: () => $t('nav.pace'), description: () => $t('paceDescription') })
</script>
<template><section class="content parity-card pace-page"><h1>{{ $t('paceTitle') }}</h1><p class="lead">{{ $t('paceDescription') }}</p><div class="range-picker" role="group" :aria-label="$t('paceRange')"><button v-for="(label, index) in labels" :key="label" type="button" :aria-pressed="selected === index" @click="selected = index">{{ label }}</button></div><div class="table-wrap desktop-pace"><table class="parity-table pace-table"><thead><tr><th>{{ $t('pace.goal') }}</th><th v-for="distance in distances.slice(1)" :key="distance">{{ distance === 'half' ? $t('pace.half') : distance }}</th></tr></thead><tbody><tr v-for="row in rows" :key="row.goal"><th scope="row">{{ row.times[0] }}</th><td v-for="(time, index) in row.times.slice(1)" :key="index">{{ time }}</td></tr></tbody></table></div><div class="table-wrap mobile-pace"><table class="parity-table pace-table"><thead><tr><th>{{ $t('pace.distance') }}</th><th v-for="row in rows" :key="row.goal">{{ row.times[0] }}</th></tr></thead><tbody><tr v-for="(distance, index) in distances.slice(1)" :key="distance"><th scope="row">{{ distance === 'half' ? $t('pace.half') : distance }}</th><td v-for="row in rows" :key="row.goal">{{ row.times[index + 1] }}</td></tr></tbody></table></div></section></template>
