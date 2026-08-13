import { describe, expect, it } from 'vitest'
import { expandedNozomiRecords } from './nozomiRecords'

describe('Nozomi public parity records', () => {
  it('keeps all sixty separate event rows and both yearly anchors', () => {
    const records = expandedNozomiRecords('ja')
    expect(records).toHaveLength(60)
    expect(records.filter((record) => record.year === 2021)).toHaveLength(41)
    expect(records.filter((record) => record.year === 2020)).toHaveLength(19)
    expect(records.some((record) => record.date === '11/20(土)' && record.event === '3000m')).toBe(true)
    expect(records.some((record) => record.meet.includes('東京オリンピック'))).toBe(true)
    expect(records.filter((record) => record.date === '6/27(日)')).toHaveLength(2)
    expect(records.every((record) => !record.event.includes(' / ') && !record.result.includes(' / '))).toBe(true)
    expect(records[0]).toEqual({ year: 2020, date: '12/27', meet: '川内杯栗橋関所マラソン', event: '10km', result: '32\'07"' })
    expect(records.at(-1)).toEqual({ year: 2020, date: '07/04', meet: 'Hokuren Distance Challenge Shibetsu', event: '1500m', result: '4\'08"68' })
  })
})
