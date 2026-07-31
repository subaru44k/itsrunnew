import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseScheduleMonth } from './index'

describe('preview seed contract', () => {
  it('accepts a representative seed shape', () => {
    expect(parseScheduleMonth({ schemaVersion: 1, stadium: 'oda', yearMonth: '2026-07', updatedAt: '2026-01-01T00:00:00.000Z', days: { '2026-07-01': [0, 1, 2] } })).toBeTruthy()
  })

  it('accepts generated seed files when the seed has been generated', () => {
    const root = resolve(process.cwd(), '../../.artifacts/preview-seed')
    let manifest: { objects: { key: string }[] }
    try { manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8')) } catch { return }
    for (const object of manifest.objects) {
      const yearMonth = /([0-9]{4}-[0-9]{2})\.json$/.exec(object.key)?.[1]
      if (!yearMonth) throw new Error(`Invalid fixture key: ${object.key}`)
      parseScheduleMonth(JSON.parse(readFileSync(resolve(root, object.key), 'utf8')), { stadium: 'oda', yearMonth })
    }
  })
})
