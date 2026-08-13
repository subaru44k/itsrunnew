<script setup lang="ts">
import type { StadiumSlug } from '@itsrun/core'
import { STADIUMS } from '@itsrun/core'
const props = defineProps<{ slug: StadiumSlug }>()
const { t: $t } = useI18n()
const stadium = computed(() => STADIUMS[props.slug])
const schedule = useSchedule(props.slug)
const { tm } = useI18n()
const content = computed(() => tm(`stadiumContent.${props.slug}`) as { official: string; access: string[]; contact: string; paragraphs: string[] })
const updatedAt = computed(() => schedule.months.value.map((month) => month.updatedAt).sort().at(-1))
useSeoMeta({ title: () => $t(stadium.value.nameKey) })
</script>
<template><article v-if="stadium" class="content"><p class="eyebrow">{{ $t('siteName') }}</p><h1>{{ $t(stadium.nameKey) }}</h1><p>{{ content.official }}</p><section aria-labelledby="schedule-heading"><h2 id="schedule-heading">{{ $t('scheduleTitle') }}</h2><p v-if="schedule.state.value === 'error'" role="alert">{{ $t(`scheduleError.${schedule.errorKind.value || 'network'}`) }}<span v-if="schedule.months.value.length"> {{ $t('scheduleRetained') }}</span> <button type="button" @click="schedule.load()">{{ $t('scheduleRetry') }}</button></p><div class="week-controls"><button type="button" @click="schedule.previousWeek">{{ $t('schedulePrevious') }}</button><button type="button" @click="schedule.nextWeek">{{ $t('scheduleNext') }}</button></div><ScheduleTable :dates="schedule.dates.value" :months="schedule.months.value" :time-ranges="stadium.timeRanges" :updated-at="updatedAt" :loading="schedule.state.value === 'loading'" :unpublished="schedule.state.value === 'loaded' && schedule.months.value.length === 0" /></section><section aria-labelledby="access-heading"><h2 id="access-heading">{{ $t('stadiumSections.access') }}</h2><ul><li v-for="line in content.access" :key="line">{{ line }}</li></ul><h2>{{ $t('stadiumSections.contact') }}</h2><p>{{ content.contact }}</p></section><section aria-labelledby="intro-heading"><h2 id="intro-heading">{{ $t('stadiumSections.introduction') }}</h2><p v-for="paragraph in content.paragraphs" :key="paragraph">{{ paragraph }}</p></section><section aria-labelledby="map-heading"><h2 id="map-heading">{{ $t('stadiumSections.map') }}</h2><iframe class="map" loading="lazy" :src="stadium.mapEmbedUrl" :title="`${content.official} ${$t('stadiumSections.map')}`" referrerpolicy="no-referrer-when-downgrade" /></section></article></template>
