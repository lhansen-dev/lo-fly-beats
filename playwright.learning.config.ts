import { defineConfig, devices } from '@playwright/test'

// Phase 4 retains the development-only experiment; production browser tests skip it.
process.env.LEARNING_BROWSER = '1'
export default defineConfig({
  testDir: 'tests/browser', testMatch: 'learning.spec.ts', workers: 1,
  expect: { timeout: 15_000 },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4174 --strictPort',
    url: 'http://127.0.0.1:4174', reuseExistingServer: !process.env.CI, timeout: 30_000,
  },
  use: { baseURL: 'http://127.0.0.1:4174', trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
