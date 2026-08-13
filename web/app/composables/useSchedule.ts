import { computed, onMounted, ref } from 'vue'
import { addDays, japanToday } from '@itsrun/core'
import type { IsoDate, ScheduleMonth, StadiumSlug } from '@itsrun/core'
import { HttpScheduleRepository, ScheduleRepositoryError } from '../repositories/httpScheduleRepository'

export type ScheduleDataRepository = Pick<HttpScheduleRepository, 'getWeek'>

export function useSchedule(stadium: StadiumSlug, repository: ScheduleDataRepository = new HttpScheduleRepository()) {
  const start = ref<IsoDate>(japanToday())
  const dates = computed(() => Array.from({ length: 7 }, (_, index) => addDays(start.value, index)))
  const months = ref<ScheduleMonth[]>([])
  const state = ref<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const errorKind = ref<'network' | 'unavailable' | 'invalid' | null>(null)
  let requestId = 0

  async function load(targetStart: IsoDate = start.value) {
    const current = ++requestId
    state.value = 'loading'; errorKind.value = null
    try {
      const result = await repository.getWeek(stadium, targetStart)
      if (current !== requestId) return
      start.value = targetStart; months.value = result.months; state.value = 'loaded'
    } catch (reason) {
      if (current !== requestId) return
      state.value = 'error'
      errorKind.value = reason instanceof ScheduleRepositoryError ? reason.kind : 'network'
    }
  }
  function previousWeek() { void load(addDays(start.value, -7)) }
  function nextWeek() { void load(addDays(start.value, 7)) }
  if (import.meta.client) onMounted(() => { void load() })
  return { dates, months, state, errorKind, load, previousWeek, nextWeek }
}
