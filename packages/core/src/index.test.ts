import { describe, expect, it } from 'vitest'
import { addDays, japanToday, marathonPace, parseScheduleMonth, schedulePaths } from './index'

describe('core schedule contract', () => {
  it('validates a month and rejects unknown fields', () => {
    const value = { schemaVersion: 1, stadium: 'oda', yearMonth: '2024-02', updatedAt: '2024-02-01T00:00:00.000Z', days: { '2024-02-29': [0, 1, 2] } }
    expect(parseScheduleMonth(value).days['2024-02-29']).toEqual([0, 1, 2])
    expect(() => parseScheduleMonth({ ...value, extra: true })).toThrow()
    expect(() => parseScheduleMonth({ ...value, days: { '2024-02-30': [0, 1, 2] } })).toThrow()
  })

  it('handles Japan date and month boundaries', () => {
    expect(japanToday(new Date('2024-01-31T15:00:00.000Z'))).toBe('2024-02-01')
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01')
    expect(schedulePaths('oda', ['2024-01-31', '2024-02-01'])).toEqual(['data/v1/stadiums/oda/availability/2024-01.json', 'data/v1/stadiums/oda/availability/2024-02.json'])
  })

  it('preserves legacy marathon lap rounding', () => {
    expect(marathonPace(3 * 3600)).toEqual(["3'00'00\"", "4'15\"", "21'19\"", "42'39\"", "1'03'59\"", "1'25'19\"", "1'30'00\"", "1'46'38\"", "2'07'58\"", "2'29'18\"", "2'50'38\"", "3'00'00\""])
  })
})
