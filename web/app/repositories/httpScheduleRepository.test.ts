import { describe, expect, it, vi } from 'vitest'
import { HttpScheduleRepository } from './httpScheduleRepository'

const month = (yearMonth: string) => ({ schemaVersion: 1, stadium: 'oda', yearMonth, updatedAt: '2026-07-31T00:00:00.000Z', days: {} })

describe('HttpScheduleRepository', () => {
  it('fetches two months for a crossing week and preserves date order', async () => {
    const request = vi.fn(async (url: string) => new Response(JSON.stringify(month(url.includes('2026-08') ? '2026-08' : '2026-07')), { status: 200 }))
    const repository = new HttpScheduleRepository('/data/v1', request as typeof fetch)
    const result = await repository.getWeek('oda', '2026-07-30')
    expect(request).toHaveBeenCalledTimes(2)
    expect(result.dates).toEqual(['2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05'])
    expect(result.months.map((item) => item.yearMonth)).toEqual(['2026-07', '2026-08'])
  })

  it('invokes a receiver-sensitive fetch dependency without the repository receiver', async () => {
    const request = function (this: unknown, url: string) {
      expect(this).toBeUndefined()
      return Promise.resolve(new Response(JSON.stringify(month(url.includes('2026-08') ? '2026-08' : '2026-07')), { status: 200 }))
    }
    const repository = new HttpScheduleRepository('/data/v1', request as typeof fetch)
    await expect(repository.getMonth('oda', '2026-07')).resolves.toMatchObject({ yearMonth: '2026-07' })
  })

  it('returns missing months as empty data and surfaces invalid data', async () => {
    const missing = new HttpScheduleRepository('/data/v1', vi.fn(async () => new Response('', { status: 404 })) as typeof fetch)
    expect((await missing.getMonth('oda', '2026-07'))).toBeNull()
    const invalid = new HttpScheduleRepository('/data/v1', vi.fn(async () => new Response('{}', { status: 200 })) as typeof fetch)
    await expect(invalid.getMonth('oda', '2026-07')).rejects.toThrow('invalid')
  })
})
