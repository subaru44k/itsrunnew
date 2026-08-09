import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { normalizeFirestoreSnapshot, SnapshotValidationError } from '../../packages/core/src/firestoreSnapshot.ts'

const fixture = JSON.parse(await readFile(new URL('./fixtures/firestore-snapshot.synthetic.json', import.meta.url), 'utf8'))
const clone = (value) => structuredClone(value)
const expectInvalid = (value, category = undefined) => {
  expect(() => normalizeFirestoreSnapshot(value)).toThrow(SnapshotValidationError)
  try { normalizeFirestoreSnapshot(value) } catch (error) { if (category) expect(error.category).toBe(category); expect(error.message).not.toMatch(/secret|token|credential|actor|password|raw-value/i) }
}

describe('strict Firestore snapshot normalization', () => {
  it('maps all four descriptors and sorts normalized records deterministically', () => {
    const records = normalizeFirestoreSnapshot(fixture)
    expect(records).toHaveLength(4)
    expect(records.map(({ slug, date }) => `${slug}/${date}`)).toEqual(['komazawa/20240101', 'oda/20240229', 'todoroki/20240301', 'yumenoshima/20231231'])
    expect(records.flatMap(({ status }) => status)).toEqual(expect.arrayContaining([0, 1, 2]))
  })

  it('is independent of collection and document order', () => {
    const permuted = clone(fixture); permuted.collections.reverse(); permuted.collections.forEach((collection) => collection.documents.reverse())
    expect(normalizeFirestoreSnapshot(permuted)).toEqual(normalizeFirestoreSnapshot(fixture))
  })

  it('accepts four empty collections and returns an empty result', () => {
    const empty = clone(fixture); empty.collections.forEach((collection) => { collection.documents = [] })
    expect(normalizeFirestoreSnapshot(empty)).toEqual([])
  })

  it('rejects missing, duplicate, unknown, and mismatched descriptors', () => {
    const missing = clone(fixture); missing.collections.pop(); expectInvalid(missing, 'collection-count')
    const duplicate = clone(fixture); duplicate.collections[1].slug = 'oda'; duplicate.collections[1].legacyId = fixture.collections[0].legacyId; expectInvalid(duplicate, 'duplicate-descriptor')
    const unknown = clone(fixture); unknown.collections[0].slug = 'unknown'; expectInvalid(unknown, 'identity')
    const mismatch = clone(fixture); mismatch.collections[0].legacyId = 'wrong'; expectInvalid(mismatch, 'identity')
    const extra = clone(fixture); extra.extra = 'credential=secret'; expectInvalid(extra, 'top-level')
  })

  it('rejects malformed paths, identity mismatch, non-real dates, and duplicate dates', () => {
    for (const path of ['availability/x/date/20240229', 'availability/nVfuSmsj9cULg3712chv/20240229', 'availability/nVfuSmsj9cULg3712chv/date/20240230', 'availability/nVfuSmsj9cULg3712chv/date/20241301', 'availability/nVfuSmsj9cULg3712chv/date/2024022']) {
      const value = clone(fixture); value.collections[0].documents[0].path = path; expectInvalid(value)
    }
    const duplicate = clone(fixture); duplicate.collections[0].documents.push(clone(duplicate.collections[0].documents[0])); expectInvalid(duplicate, 'duplicate-document')
  })

  it('rejects non-plain data and unknown fields', () => {
    const unknown = clone(fixture); unknown.collections[0].documents[0].data.extra = 'secret'; expectInvalid(unknown, 'document-shape')
    const nullProto = clone(fixture); nullProto.collections[0].documents[0].data = Object.assign(Object.create(null), { status: [0, 1, 2] }); expectInvalid(nullProto, 'document-shape')
    const polluted = clone(fixture); polluted.__proto__ = { token: 'secret' }; expectInvalid(polluted, 'top-level')
  })

  it('rejects sparse, short, long, and every invalid status class', () => {
    for (const status of [[0, 1], [0, 1, 2, 0], [0, '1', 2], [0, null, 2], [0, -1, 2], [0, 3, 2], (() => { const sparse = []; sparse.length = 3; sparse[0] = 0; return sparse })()]) {
      const value = clone(fixture); value.collections[0].documents[0].data.status = status; expectInvalid(value, 'status')
    }
  })

  it('does not echo raw malformed values or credentials in sanitized errors', () => {
    const value = clone(fixture); value.collections[0].documents[0].data = { status: ['token-secret', 'actor-email@example.test', 'credential'] }; expectInvalid(value, 'status')
  })
})
