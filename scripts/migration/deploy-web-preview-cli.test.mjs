import { describe, expect, it } from 'vitest'
import { main } from './deploy-web-preview-cli.mjs'

describe('T15B CLI boundary', () => {
  it('returns help without invoking AWS', async () => { await expect(main(['--help'])).resolves.toContain('usage:') })
  it('rejects incomplete or alternate arguments before AWS', async () => {
    await expect(main(['--mode', 'operator', '--web-dir', '/tmp/build'])).rejects.toMatchObject({ category: 'configuration' })
    await expect(main(['--mode', 'operator', '--profile', 'other', '--web-dir', '/tmp/build', '--report-dir', '/tmp/report'])).rejects.toMatchObject({ category: 'configuration' })
  })
})
