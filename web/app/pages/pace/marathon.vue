<script setup lang="ts">
import { marathonPace } from '@itsrun/core'
const { t: $t } = useI18n()
useSeoMeta({ title: () => $t('nav.pace') })
const goalSeconds = ref(3 * 60 * 60)
const goalOptions = [{ label: '3:00:00', seconds: 3 * 60 * 60 }, { label: '3:30:00', seconds: 3.5 * 60 * 60 }, { label: '5:00:00', seconds: 5 * 60 * 60 }, { label: '6:30:00', seconds: 6.5 * 60 * 60 }]
const distances = ['goal', '1 km', '5 km', '10 km', '15 km', '20 km', 'half', '25 km', '30 km', '35 km', '40 km', 'finish']
const rows = computed(() => marathonPace(goalSeconds.value).map((time, index) => ({ distance: distances[index], time })))
</script>
<template><section class="content"><h1>{{ $t('nav.pace') }}</h1><label for="goal-time">{{ $t('pace.goal') }}</label><select id="goal-time" v-model="goalSeconds"><option v-for="option in goalOptions" :key="option.seconds" :value="option.seconds">{{ option.label }}</option></select><table><thead><tr><th>{{ $t('pace.distance') }}</th><th>{{ $t('pace.time') }}</th></tr></thead><tbody><tr v-for="row in rows" :key="row.distance"><th scope="row">{{ row.distance === 'goal' || row.distance === 'finish' ? $t('pace.goal') : row.distance === 'half' ? $t('pace.half') : row.distance }}</th><td>{{ row.time }}</td></tr></tbody></table></section></template>
