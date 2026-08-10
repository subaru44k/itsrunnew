import { randomBytes } from 'node:crypto'
import { createProtectedCliInput, runT16Coordinator } from './t16-auth-harness.mjs'

export const PREVIEW_CONSTANTS = Object.freeze({
  profile: 'codex-prod', account: '470447451992', region: 'ap-northeast-1',
  poolId: 'ap-northeast-1_nmj9cP9st', clientId: '1olddro3tldfinupl52u9dl1j4',
  hostedUiDomain: 'itsrun-preview-470447451992.auth.ap-northeast-1.amazoncognito.com',
  cloudFrontDomain: 'd2via50thoheqm.cloudfront.net', group: 'admins',
  bucket: 'itsrun-preview-data-470447451992-ap-northeast-1',
  key: 'data/v1/stadiums/oda/availability/2026-08.json',
  baselineBytes: 501, baselineSha256: 'ec0a284d8d237f74bcae683edbd367a9041c0b59f8974e8f5da7e6c6e8c86aeb',
  baselineEtag: '"b2591d35e23ac1b9f2a133f71198b953"', baselineVersionId: 'wQ1b5EEu1Qzrw93GyN9_bPNtxwaZ5VAE',
  targetDate: '2026-08-09', targetSlot: 0, before: 0, after: 1,
})

const EXECUTION_FLAG = '--execute-preview-rehearsal'
const COGNITO_OPERATIONS = new Set(['admin-create-user', 'admin-set-user-password', 'admin-add-user-to-group', 'admin-get-user', 'admin-remove-user-from-group', 'admin-delete-user'])

export function parsePreviewAdapterArgs(argv) {
  if (!Array.isArray(argv) || argv.length !== 1 || argv[0] !== EXECUTION_FLAG) throw new Error('invalid execution flag')
  return { execute: true }
}

function createIdentities(nextRandomBytes) {
  const suffix = nextRandomBytes(12).toString('hex')
  return Object.freeze({
    admin: `preview-t16-admin-${suffix}@rehearsal.invalid`,
    nonAdmin: `preview-t16-nonadmin-${suffix}@rehearsal.invalid`,
    adminPassword: `Aa1!${nextRandomBytes(24).toString('hex')}`,
    nonAdminPassword: `Bb2!${nextRandomBytes(24).toString('hex')}`,
  })
}

function requireFunction(value, name) { if (typeof value !== 'function') throw new Error(`missing ${name} adapter`); return value }

/**
 * Bind the coordinator to reviewed operations. Sensitive values stay in this
 * closure and are only handed to injected protected/browser adapters.
 */
export function createPreviewAdapters({ cognito, browser, data, restore, cleanup, preflight, randomBytesImpl = randomBytes, protectedInput = createProtectedCliInput } = {}) {
  requireFunction(cognito, 'cognito'); requireFunction(browser, 'browser'); requireFunction(data, 'data'); requireFunction(restore, 'restore'); requireFunction(cleanup, 'cleanup'); requireFunction(preflight, 'preflight')
  requireFunction(randomBytesImpl, 'randomBytes')
  const identities = createIdentities(randomBytesImpl)
  const cognitoCall = async (operation, payload) => {
    if (!COGNITO_OPERATIONS.has(operation)) throw new Error('forbidden cognito operation')
    // The injected adapter owns the mode-0600 JSON-file boundary. This call
    // never serializes or returns payloads through the coordinator result.
    return cognito(operation, payload, { protectedInput, constants: PREVIEW_CONSTANTS })
  }
  return {
    preflight: async context => preflight({ ...context, constants: PREVIEW_CONSTANTS }),
    setup: async context => {
      await cognitoCall('admin-create-user', { Username: identities.admin, MessageAction: 'SUPPRESS' })
      await cognitoCall('admin-set-user-password', { Username: identities.admin, Permanent: true, Password: identities.adminPassword })
      await cognitoCall('admin-create-user', { Username: identities.nonAdmin, MessageAction: 'SUPPRESS' })
      await cognitoCall('admin-set-user-password', { Username: identities.nonAdmin, Permanent: true, Password: identities.nonAdminPassword })
      await cognitoCall('admin-add-user-to-group', { Username: identities.admin, GroupName: PREVIEW_CONSTANTS.group })
      return { users: 2, admins: 1 }
    },
    admin: {
      form: context => browser('admin', 'form', identities.admin, context),
      callback: context => browser('admin', 'callback', identities.admin, context),
      sentinel: context => browser('admin', 'sentinel', identities.admin, context),
    },
    nonAdmin: {
      form: context => browser('non-admin', 'form', identities.nonAdmin, context),
      callback: context => browser('non-admin', 'callback', identities.nonAdmin, context),
      sentinel: context => browser('non-admin', 'sentinel', identities.nonAdmin, context),
    },
    data: {
      read: context => data('read', PREVIEW_CONSTANTS, context),
      update: context => data('update', PREVIEW_CONSTANTS, context),
      stale: context => data('stale', PREVIEW_CONSTANTS, context),
      public: context => data('public', PREVIEW_CONSTANTS, context),
    },
    restore: context => restore(PREVIEW_CONSTANTS, context),
    cleanup: async context => {
      try { await cognitoCall('admin-remove-user-from-group', { Username: identities.admin, GroupName: PREVIEW_CONSTANTS.group }) } finally {
        try { await cognitoCall('admin-delete-user', { Username: identities.admin }) } finally { await cognitoCall('admin-delete-user', { Username: identities.nonAdmin }) }
      }
      return cleanup(PREVIEW_CONSTANTS, context)
    },
  }
}

export async function runPreviewAdapter(dependencies) {
  const adapters = createPreviewAdapters(dependencies)
  return runT16Coordinator(adapters)
}

export async function main(argv = process.argv.slice(2), dependencies = null) {
  parsePreviewAdapterArgs(argv)
  if (!dependencies || typeof dependencies !== 'object') throw new Error('adapter-unconfigured')
  return runPreviewAdapter(dependencies)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(result => process.stdout.write(`${JSON.stringify(result)}\n`)).catch(() => {
    process.stderr.write('{"status":"failed","category":"adapter-unconfigured"}\n')
    process.exitCode = 1
  })
}
