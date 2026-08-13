import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.PREVIEW_BASE_URL
if (!baseURL) throw new Error('PREVIEW_BASE_URL is required for preview E2E tests')

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: /preview-(public-routes|schedule-states|operational)\.spec\.ts/,
  retries: 0,
  outputDir: '.artifacts/playwright-preview',
  reporter: [['list'], ['html', { outputFolder: '.artifacts/playwright-preview-report', open: 'never' }]],
  use: {
    baseURL,
    locale: 'ja-JP',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'chromium-ja', use: { ...devices['Desktop Chrome'], locale: 'ja-JP' } },
    { name: 'chromium-en', use: { ...devices['Desktop Chrome'], locale: 'en-US' } },
    { name: 'mobile-ja', use: { ...devices['Desktop Chrome'], locale: 'ja-JP', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
    { name: 'mobile-en', use: { ...devices['Desktop Chrome'], locale: 'en-US', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
})
