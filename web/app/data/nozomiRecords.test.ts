import { describe, expect, it } from 'vitest'
import { expandedNozomiRecords } from './nozomiRecords'

describe('Nozomi public parity records', () => {
  it('keeps all sixty separate event rows and both yearly anchors', () => {
    const records = expandedNozomiRecords('ja')
    expect(records).toHaveLength(60)
    expect(records.filter((record) => record.year === 2021)).toHaveLength(41)
    expect(records.filter((record) => record.year === 2020)).toHaveLength(19)
    expect(records.some((record) => record.date === '11/20' && record.event === '3000m')).toBe(true)
    expect(records.some((record) => record.meet.includes('東京オリンピック'))).toBe(true)
  })
})
