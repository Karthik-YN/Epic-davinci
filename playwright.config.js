// Browser (end-to-end) tests: npm run test:e2e
// Starts the app on a throwaway database and drives it in Chromium.
const { defineConfig, devices } = require('@playwright/test');

const PORT = 3210;

module.exports = defineConfig({
  testDir: 'tests/e2e',
  testMatch: '*.e2e.js',
  workers: 1,
  timeout: 45000,
  expect: { timeout: 7000 },
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node tests/e2e/server.js',
    url: `http://localhost:${PORT}/api/settings`,
    env: { PORT: String(PORT) },
    reuseExistingServer: false,
    timeout: 30000,
  },
  projects: [
    {
      name: 'desktop',
      testIgnore: 'mobile.e2e.js',
      use: { viewport: { width: 1366, height: 900 } },
    },
    {
      name: 'mobile',
      testMatch: 'mobile.e2e.js',
      use: { ...devices['Pixel 7'] },
    },
  ],
});
