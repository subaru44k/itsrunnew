import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const root = resolve(new URL('../..', import.meta.url).pathname)
const output = resolve(root, '.artifacts/admin-e2e-output')
const child = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['nuxt', 'generate'], {
  cwd: resolve(root, 'web'),
  stdio: 'inherit',
  env: {
    ...process.env,
    ADMIN_E2E_OUTPUT: output,
    ADMIN_E2E: 'true',
    NUXT_PUBLIC_COGNITO_AUTHORITY: 'https://admin-e2e.invalid',
    NUXT_PUBLIC_COGNITO_CLIENT_ID: 'admin-e2e-client',
  },
})
child.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)))
