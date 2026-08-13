import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /(admin-local|public-parity-local)\.spec\.ts/,
  outputDir: '.artifacts/playwright-admin',
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: {
    command: 'node ../scripts/migration/build-admin-e2e.mjs && WEB_OUTPUT_DIR=../.artifacts/admin-e2e-output/public node ../scripts/migration/serve-web-output.mjs',
    cwd: 'web',
    url: 'http://localhost:3000/manage',
    reuseExistingServer: false,
    timeout: 120000,
    env: { PORT: '3000' },
  },
  projects: [
    { name: 'admin-desktop-ja', use: { ...devices['Desktop Chrome'], locale: 'ja-JP' } },
    { name: 'admin-desktop-en', use: { ...devices['Desktop Chrome'], locale: 'en-US' } },
    { name: 'admin-mobile-ja', use: { ...devices['Desktop Chrome'], locale: 'ja-JP', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'admin-mobile-en', use: { ...devices['Desktop Chrome'], locale: 'en-US', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
})
