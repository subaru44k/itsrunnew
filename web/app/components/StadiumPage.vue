<script setup lang="ts">
import type { StadiumSlug } from '@itsrun/core'
import { STADIUMS } from '@itsrun/core'
const props = defineProps<{ slug: StadiumSlug }>()
const { t: $t } = useI18n()
const stadium = computed(() => STADIUMS[props.slug])
useSeoMeta({ title: () => $t(stadium.value.nameKey) })
const schedule = useSchedule(props.slug)
</script>
<template><article class="content" v-if="stadium"><p class="eyebrow">{{ $t('siteName') }}</p><h1>{{ $t(stadium.nameKey) }}</h1><p>{{ $t('homeDescription') }}</p><h2>{{ $t('scheduleTitle') }}</h2><p v-if="schedule.state.value === 'error'" role="alert">{{ schedule.error.value }} <button type="button" @click="schedule.load">Retry</button></p><div class="week-controls"><button type="button" @click="schedule.previousWeek">Previous week</button><button type="button" @click="schedule.nextWeek">Next week</button></div><ScheduleTable :dates="schedule.dates.value" :months="schedule.months.value" :loading="schedule.state.value === 'loading'" /></article></template>
