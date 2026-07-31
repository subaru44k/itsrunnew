import { addDays, japanToday } from '@itsrun/core'
import type { IsoDate, ScheduleMonth, StadiumSlug } from '@itsrun/core'
import { HttpScheduleRepository, ScheduleRepositoryError } from '~/repositories/httpScheduleRepository'

export function useSchedule(stadium: StadiumSlug) {
  const repository = new HttpScheduleRepository()
  const start = ref<IsoDate>(japanToday())
  const dates = computed(() => Array.from({ length: 7 }, (_, index) => addDays(start.value, index)))
  const months = ref<ScheduleMonth[]>([])
  const state = ref<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const error = ref<string | null>(null)
  const errorKind = ref<'network' | 'unavailable' | 'invalid' | null>(null)
  let requestId = 0

  async function load() {
    const current = ++requestId
    state.value = 'loading'; error.value = null; errorKind.value = null
    try {
      const result = await repository.getWeek(stadium, start.value)
      if (current !== requestId) return
      months.value = result.months; state.value = 'loaded'
    } catch (reason) {
      if (current !== requestId) return
      state.value = 'error'
      errorKind.value = reason instanceof ScheduleRepositoryError ? reason.kind : 'network'
    }
  }
  function previousWeek() { start.value = addDays(start.value, -7); void load() }
  function nextWeek() { start.value = addDays(start.value, 7); void load() }
  if (import.meta.client) onMounted(() => { void load() })
  return { dates, months, state, error, errorKind, load, previousWeek, nextWeek }
}
