import assert from 'node:assert/strict'
import test from 'node:test'
import { createPreviewAdapters, main, PREVIEW_CONSTANTS, runPreviewAdapter } from './t16-preview-adapter.mjs'

const proof = {
  form: { desktop: 'form-submitted', mobile: 'form-submitted' }, callback: { desktop: true, mobile: true },
  admin: { desktop: 200, mobile: 200 }, 'non-admin': { desktop: 403, mobile: 403 },
  read: { contexts: 2, baseline: true }, update: { putCount: 1, newEtag: true, newVersionId: true },
  stale: { putCount: 1, status: 409, versionUnchanged: true }, public: { status: 200, slot: 1 },
}

function fakeDependencies({ fail = null } = {}) {
  const operations = []; const payloads = []
  const dependencies = {
    operations, payloads,
    randomBytesImpl: length => Buffer.alloc(length, 0xab),
    preflight: async () => ({ target: 'd029', baseline: true }),
    cognito: async (operation, payload) => { operations.push(operation); payloads.push({ operation, keys: Object.keys(payload).sort() }); if (fail === operation) throw new Error('canary credential failure') },
    browser: async (role, stage) => proof[stage === 'sentinel' ? role : stage],
    data: async (stage, _constants, context) => { if (stage === 'update' || stage === 'stale') context.markWrite(); return proof[stage] },
    restore: async () => ({ putCount: 1, bytesExact: true, hashExact: true, metadataExact: true }),
    cleanup: async () => ({ users: 0, admins: 0 }),
  }
  return dependencies
}

test('preview adapter accepts only literal execution flag and fixed constants', async () => {
  assert.equal(PREVIEW_CONSTANTS.account, '470447451992')
  await assert.rejects(() => main([]), /invalid execution flag/)
  await assert.rejects(() => main(['--execute-preview-rehearsal', 'canary-password']), /invalid execution flag/)
})

test('secret-free adapter runs proof-bearing fake rehearsal without exposing generated identities', async () => {
  const deps = fakeDependencies()
  const result = await runPreviewAdapter(deps)
  assert.equal(result.status, 'success'); assert.equal(result.lastCheckpoint, 'complete'); assert.equal(result.failure, null)
  assert.deepEqual(result.counts, { operations: 14, writes: 2, restores: 1, cleanups: 1 })
  assert.deepEqual(deps.operations.slice(-3), ['admin-remove-user-from-group', 'admin-delete-user', 'admin-delete-user'])
  assert.equal(JSON.stringify(result).includes('rehearsal.invalid'), false)
  assert.equal(JSON.stringify(result).includes('canary'), false)
  const passwords = deps.payloads.filter(item => item.keys.includes('Password'))
  assert.equal(passwords.length, 2)
})

test('adapter failure performs cleanup and does not call data after auth failure', async () => {
  const deps = fakeDependencies()
  deps.browser = async (_role, stage) => { if (stage === 'callback') throw new Error('canary browser failure'); return proof[stage] }
  const result = await runPreviewAdapter(deps)
  assert.equal(result.status, 'failed'); assert.equal(result.failureCheckpoint, 'admin-callback'); assert.equal(result.counts.writes, 0)
  assert.equal(deps.operations.some(op => op === 'admin-create-user'), true)
  assert.equal(JSON.stringify(result).includes('canary'), false)
})

test('main never accepts credentials from argv and unconfigured execution is sanitized', async () => {
  await assert.rejects(() => main(['--execute-preview-rehearsal']), /adapter-unconfigured/)
  const deps = fakeDependencies()
  const result = await main(['--execute-preview-rehearsal'], deps)
  assert.equal(result.status, 'success')
})
