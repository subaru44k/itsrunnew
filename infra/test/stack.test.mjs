import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

test('CDK app synthesizes', () => {
  const infra = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  execFileSync('npx', ['cdk', 'synth', '--quiet'], { cwd: infra, stdio: 'ignore' })
  assert.ok(true)
})
