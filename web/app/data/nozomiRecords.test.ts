import { describe, expect, it } from 'vitest'
import { expandedNozomiRecords, NOZOMI_JA_TUPLES } from './nozomiRecords'

describe('Nozomi public parity records', () => {
  it('deep-equals the complete ordered Japanese legacy projection', () => {
    const records = expandedNozomiRecords('ja')
    expect(records.map(({ year, dateJa, meetJa, event, result }) => [year, dateJa, meetJa, event, result])).toEqual(NOZOMI_JA_TUPLES)
    expect(records).toHaveLength(60)
    expect(records.filter((record) => record.year === 2021)).toHaveLength(41)
    expect(records.filter((record) => record.year === 2020)).toHaveLength(19)
    expect(records.filter((record) => record.year === 2021 && record.dateJa === '6/27(日)')).toHaveLength(2)
    expect(records.every((record) => !record.event.includes(' / ') && !record.result.includes(' / '))).toBe(true)
  })

  it('keeps locale fields separate and provides the same ordered rows in English', () => {
    const ja = expandedNozomiRecords('ja')
    const en = expandedNozomiRecords('en')
    expect(en.map((record) => record.dateEn)).toHaveLength(60)
    expect(en.map((record) => record.meetEn)).toHaveLength(60)
    expect(en.map((record) => record.event)).toEqual(ja.map((record) => record.event))
    expect(en.map((record) => record.result)).toEqual(ja.map((record) => record.result))
    expect(en[0]?.meetEn).toBe('Edion Distance Challenge in Kyoto 2021')
  })
})
