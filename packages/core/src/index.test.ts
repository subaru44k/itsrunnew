import { describe, expect, it } from 'vitest'
import { addDays, japanToday, marathonGoals, marathonPace, MARATHON_GOAL_RANGES, parseScheduleMonth, parseTime, scheduleMonthPath, schedulePaths, STADIUMS } from './index'

describe('core schedule contract', () => {
  it('validates a month and rejects unknown fields', () => {
    const value = { schemaVersion: 1, stadium: 'oda', yearMonth: '2024-02', updatedAt: '2024-02-01T00:00:00.000Z', days: { '2024-02-29': [0, 1, 2] } }
    expect(parseScheduleMonth(value).days['2024-02-29']).toEqual([0, 1, 2])
    expect(() => parseScheduleMonth({ ...value, extra: true })).toThrow()
    expect(() => parseScheduleMonth({ ...value, days: { '2024-02-30': [0, 1, 2] } })).toThrow()
    expect(() => parseScheduleMonth({ ...value, days: { '2024-02-29': [0, , 2] } })).toThrow()
    expect(() => parseScheduleMonth({ ...value, updatedAt: '2024-02-01' })).toThrow()
    expect(() => parseScheduleMonth({ ...value, days: { '2024-02-29': [0, 1, 3] } })).toThrow()
  })

  it('handles Japan date and month boundaries', () => {
    expect(japanToday(new Date('2024-01-31T15:00:00.000Z'))).toBe('2024-02-01')
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01')
    expect(schedulePaths('oda', ['2024-01-31', '2024-02-01'])).toEqual(['data/v1/stadiums/oda/availability/2024-01.json', 'data/v1/stadiums/oda/availability/2024-02.json'])
  })

  it('constructs typed monthly keys only from validated values', () => {
    for (const slug of Object.keys(STADIUMS) as Array<keyof typeof STADIUMS>) {
      expect(scheduleMonthPath(slug, '2026-12')).toBe(`data/v1/stadiums/${slug}/availability/2026-12.json`)
    }
  })

  it('preserves legacy marathon lap rounding', () => {
    expect(marathonPace(3 * 3600)).toEqual(["3'00'00\"", "4'15\"", "21'19\"", "42'39\"", "1'03'59\"", "1'25'19\"", "1'30'00\"", "1'46'38\"", "2'07'58\"", "2'29'18\"", "2'50'38\"", "3'00'00\""])
  })

  it('parses legacy goal-time formats without changing units', () => {
    expect(parseTime(`3'00'00"`)).toBe(10800)
    expect(parseTime(`4'15"`)).toBe(255)
    expect(parseTime(`45"`)).toBe(45)
    expect(() => parseTime(`4:15`)).toThrow()
  })

  it('exposes the three legacy pace ranges with nineteen goals each', () => {
    expect(MARATHON_GOAL_RANGES).toHaveLength(3)
    expect(MARATHON_GOAL_RANGES.map((range) => marathonGoals(range))).toEqual([
      expect.arrayContaining([7200, 12600]), expect.arrayContaining([12600, 18000]), expect.arrayContaining([18000, 23400]),
    ])
    for (const range of MARATHON_GOAL_RANGES) expect(marathonGoals(range)).toHaveLength(19)
  })
})
