import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PREVIEW_BASE_URL
if (!baseURL) throw new Error('PREVIEW_BASE_URL is required for preview E2E tests')

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /preview-public-routes\.spec\.ts/,
  outputDir: '.artifacts/playwright-preview',
  reporter: [['list'], ['html', { outputFolder: '.artifacts/playwright-preview-report', open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
})
