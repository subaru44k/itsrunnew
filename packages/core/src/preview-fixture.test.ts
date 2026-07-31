import { describe, expect, it } from 'vitest'
import { parseScheduleMonth } from './index'

describe('preview seed contract', () => {
  it('accepts the non-production seed shape', () => {
    expect(parseScheduleMonth({ schemaVersion: 1, stadium: 'oda', yearMonth: '2026-07', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-07-01': [0, 1, 2] } })).toBeTruthy()
  })
})
