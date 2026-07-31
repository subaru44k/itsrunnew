<script setup lang="ts">
import type { IsoDate, ScheduleMonth, AvailabilityStatus } from '@itsrun/core'
import { statusLabel } from '@itsrun/core'

const props = defineProps<{ dates: IsoDate[]; months: ScheduleMonth[]; loading?: boolean; unpublished?: boolean; timeRanges?: readonly string[]; updatedAt?: string }>()
const { locale, t: $t } = useI18n()
function statusFor(date: IsoDate, slot: number): AvailabilityStatus | null {
  return props.months.find((month) => month.days[date])?.days[date]?.[slot] ?? null
}
</script>

<template>
  <div class="schedule-wrap" :aria-busy="loading ? 'true' : 'false'">
    <p v-if="loading" role="status">{{ $t('scheduleLoading') }}</p>
    <p v-if="unpublished" role="status">{{ $t('scheduleComingSoon') }}</p>
    <p v-if="updatedAt" class="schedule-updated">{{ $t('scheduleUpdatedAt', { date: updatedAt }) }}</p>
    <table class="schedule-table">
      <caption class="sr-only">{{ $t('scheduleCaption') }}</caption>
      <thead><tr><th scope="col">{{ $t('scheduleDate') }}</th><th v-for="slot in 3" :key="slot" scope="col">{{ timeRanges?.[slot - 1] || $t('scheduleSlot', { slot }) }}</th></tr></thead>
      <tbody><tr v-for="date in dates" :key="date"><th scope="row">{{ date }}</th><td v-for="slot in 3" :key="slot"><span v-if="statusFor(date, slot - 1) === null" class="status status-unknown">{{ $t('scheduleUnknown') }}</span><span v-else :class="`status status-${statusFor(date, slot - 1)}`">{{ statusLabel(statusFor(date, slot - 1)!, locale === 'ja' ? 'ja' : 'en') }}</span></td></tr></tbody>
    </table>
  </div>
</template>
