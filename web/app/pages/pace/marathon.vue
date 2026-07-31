<script setup lang="ts">
import { marathonPace } from '@itsrun/core'
const { t: $t } = useI18n()
useSeoMeta({ title: () => $t('nav.pace') })
const goal = 3 * 60 * 60
const distances = ['Goal', '1 km', '5 km', '10 km', '15 km', '20 km', 'Half', '25 km', '30 km', '35 km', '40 km', 'Finish']
const rows = computed(() => marathonPace(goal).map((time, index) => ({ distance: distances[index], time })))
</script>
<template><section class="content"><h1>{{ $t('nav.pace') }}</h1><table><thead><tr><th>Distance</th><th>Time</th></tr></thead><tbody><tr v-for="row in rows" :key="row.distance"><th scope="row">{{ row.distance }}</th><td>{{ row.time }}</td></tr></tbody></table></section></template>
