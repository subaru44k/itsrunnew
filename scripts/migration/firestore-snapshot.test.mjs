import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { normalizeFirestoreSnapshot, SnapshotValidationError } from '../../packages/core/src/firestoreSnapshot.ts'

const fixture = JSON.parse(await readFile(new URL('./fixtures/firestore-snapshot.synthetic.json', import.meta.url), 'utf8'))
const clone = (value) => structuredClone(value)
const expectInvalid = (value, category = undefined) => {
  expect(() => normalizeFirestoreSnapshot(value)).toThrow(SnapshotValidationError)
  try { normalizeFirestoreSnapshot(value) } catch (error) { if (category) expect(error.category).toBe(category); expect(error.message).not.toMatch(/secret|token|credential|actor|password|raw-value/i); expect(error.message).toMatch(/^Invalid Firestore snapshot \([a-z-]+\) at (snapshot|collection\[\d+\](\.document\[\d+\])?)$/) }
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

  it('rejects every top-level type and schema boundary', () => {
    for (const schemaVersion of [0, 2, '1', undefined]) {
      const value = clone(fixture); if (schemaVersion === undefined) delete value.schemaVersion; else value.schemaVersion = schemaVersion; expectInvalid(value, 'top-level')
    }
    for (const collections of [null, {}, [], Object.create(null)]) {
      const value = clone(fixture); value.collections = collections; expectInvalid(value, Array.isArray(collections) ? 'collection-count' : 'top-level')
    }
    const array = []; array.push(...fixture.collections); expectInvalid(array, 'top-level')
    const nullProto = Object.assign(Object.create(null), fixture); expectInvalid(nullProto, 'top-level')
  })

  it('rejects every descriptor shape boundary', () => {
    for (const descriptor of [null, [], Object.create(null), { legacyId: fixture.collections[0].legacyId, documents: [] }, { slug: 'oda', documents: [] }, { slug: 'oda', legacyId: fixture.collections[0].legacyId, documents: [], extra: 'secret' }, { slug: 'oda', legacyId: fixture.collections[0].legacyId, documents: null }]) {
      const value = clone(fixture); value.collections[0] = descriptor; expectInvalid(value, 'descriptor')
    }
  })

  it('rejects every document and data shape boundary', () => {
    for (const document of [null, [], Object.create(null), { data: { status: [0, 1, 2] } }, { path: 'x' }, { path: 'x', data: null }, { path: 'x', data: [] }, { path: 'x', data: Object.assign(Object.create(null), { status: [0, 1, 2] }) }, { path: 'x', data: { status: [0, 1, 2], unknown: 'credential' } }]) {
      const value = clone(fixture); value.collections[0].documents[0] = document; expectInvalid(value, 'document-shape')
    }
  })

  it('rejects every meaningful invalid status value', () => {
    const invalid = [0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, true, {}, undefined, '1', null, -1, 3]
    for (const bad of invalid) {
      const value = clone(fixture); value.collections[0].documents[0].data.status = [0, bad, 2]; expectInvalid(value, 'status')
    }
    for (const tuple of [[0, 1], [0, 1, 2, 0], (() => { const sparse = []; sparse.length = 3; sparse[2] = 2; return sparse })()]) {
      const value = clone(fixture); value.collections[0].documents[0].data.status = tuple; expectInvalid(value, 'status')
    }
  })

  it('accepts only exact legacy status strings when the temporary boundary is enabled', () => {
    const value = clone(fixture); value.collections[0].documents[0].data.status = ['0', 1, '2']
    expect(normalizeFirestoreSnapshot(value, { allowLegacyStatusStrings: true }).find((record) => record.slug === 'oda')?.status).toEqual([0, 1, 2])
    for (const bad of [' 0', '+1', '-1', '1.0', '01', '０', 'Available', '', true, null, 3, 1.5]) {
      const invalid = clone(fixture); invalid.collections[0].documents[0].data.status = [0, bad, 2]
      expectInvalid(invalid, 'status')
      expect(() => normalizeFirestoreSnapshot(invalid, { allowLegacyStatusStrings: true })).toThrow(SnapshotValidationError)
    }
  })

  it('rejects duplicate dates even when status differs and rejects cross-identity documents', () => {
    const duplicate = clone(fixture); duplicate.collections[0].documents.push({ path: duplicate.collections[0].documents[0].path, data: { status: [2, 2, 2] } }); expectInvalid(duplicate, 'duplicate-document')
    const cross = clone(fixture); cross.collections[1].documents[0].path = cross.collections[0].documents[0].path; expectInvalid(cross, 'path-identity')
  })

  it('does not mutate input, returns copied tuples, and is stable across calls', () => {
    const before = clone(fixture); const first = normalizeFirestoreSnapshot(fixture); const second = normalizeFirestoreSnapshot(fixture)
    expect(fixture).toEqual(before); expect(first).toEqual(second)
    first[0].status[0] = 2; expect(fixture).toEqual(before); expect(normalizeFirestoreSnapshot(fixture)).toEqual(second)
  })
})
