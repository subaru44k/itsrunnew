import { describe, expect, it, vi } from 'vitest'
import { addDays } from '@itsrun/core'
import type { IsoDate, ScheduleMonth, StadiumSlug } from '@itsrun/core'
import { useSchedule } from './useSchedule'
import type { ScheduleDataRepository } from './useSchedule'
import type { WeekSchedule } from '../repositories/httpScheduleRepository'
import { ScheduleRepositoryError } from '../repositories/httpScheduleRepository'

const week = (start: IsoDate, months: ScheduleMonth[] = [{ yearMonth: start.slice(0, 7), updatedAt: `${start}T00:00:00.000Z`, days: {} } as ScheduleMonth]): WeekSchedule => ({
  dates: Array.from({ length: 7 }, (_, index) => addDays(start, index)),
  months,
})

describe('useSchedule state contract', () => {
  it('exposes loading, unpublished, and retained-last-success states', async () => {
    let fail = false
    const repository: ScheduleDataRepository = { getWeek: vi.fn(async (_stadium: StadiumSlug, start: IsoDate) => {
      if (fail) throw new ScheduleRepositoryError('network details', undefined, 'network')
      return week(start)
    }) }
    const schedule = useSchedule('oda', repository)
    const loading = schedule.load('2026-07-31')
    expect(schedule.state.value).toBe('loading')
    await loading
    expect(schedule.state.value).toBe('loaded')
    const successfulDates = [...schedule.dates.value]
    fail = true
    await schedule.load('2026-08-07')
    expect(schedule.state.value).toBe('error')
    expect(schedule.errorKind.value).toBe('network')
    expect(schedule.dates.value).toEqual(successfulDates)
    expect(schedule.months.value).toHaveLength(1)

    const unpublished = useSchedule('oda', { getWeek: vi.fn(async (_stadium: StadiumSlug, start: IsoDate) => week(start, [])) })
    await unpublished.load('2026-07-31')
    expect(unpublished.state.value).toBe('loaded')
    expect(unpublished.months.value).toEqual([])
  })

  it('classifies invalid and unavailable data and supports retry', async () => {
    const repository: ScheduleDataRepository = { getWeek: vi.fn()
      .mockRejectedValueOnce(new ScheduleRepositoryError('invalid details', undefined, 'invalid'))
      .mockRejectedValueOnce(new ScheduleRepositoryError('unavailable details', undefined, 'unavailable'))
      .mockResolvedValueOnce(week('2026-07-31')) }
    const schedule = useSchedule('oda', repository)
    await schedule.load('2026-07-31')
    expect(schedule.errorKind.value).toBe('invalid')
    await schedule.load('2026-07-31')
    expect(schedule.errorKind.value).toBe('unavailable')
    await schedule.load('2026-07-31')
    expect(schedule.state.value).toBe('loaded')
    expect(repository.getWeek).toHaveBeenCalledTimes(3)
  })

  it('does not let an older response overwrite a newer request', async () => {
    let resolveFirst!: (value: WeekSchedule) => void
    let resolveSecond!: (value: WeekSchedule) => void
    const first = new Promise<WeekSchedule>((resolve) => { resolveFirst = resolve })
    const second = new Promise<WeekSchedule>((resolve) => { resolveSecond = resolve })
    const repository: ScheduleDataRepository = { getWeek: vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second) }
    const schedule = useSchedule('oda', repository)
    const firstLoad = schedule.load('2026-07-31')
    const secondLoad = schedule.load('2026-08-07')
    resolveSecond(week('2026-08-07'))
    await secondLoad
    resolveFirst(week('2026-07-31'))
    await firstLoad
    expect(schedule.dates.value[0]).toBe('2026-08-07')
    expect(schedule.months.value[0]?.yearMonth).toBe('2026-08')
  })
})
