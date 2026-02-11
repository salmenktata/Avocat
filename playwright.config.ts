import { defineConfig, devices } from '@playwright/test'

/**
 * Playwright Configuration for Qadhya E2E Tests
 * Sprint 5 - Enhanced with multiple browsers, video, locale FR
 */
export default defineConfig({
  testDir: './e2e',

  /* Run tests in files in parallel */
  fullyParallel: true,

  /* Timeout global par test */
  timeout: 60 * 1000, // 60 secondes

  /* Expect timeout pour assertions */
  expect: {
    timeout: 10 * 1000, // 10 secondes
  },

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter to use */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['list'],
  ],

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:7002',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'retain-on-failure',

    /* Headless mode */
    headless: process.env.CI === 'true',

    /* Viewport */
    viewport: { width: 1280, height: 720 },

    /* Ignore HTTPS errors (dev only) */
    ignoreHTTPSErrors: true,

    /* Locale FR */
    locale: 'fr-FR',
    timezoneId: 'Africa/Tunis',
  },

  /* Configure projects for major browsers */
  projects: [
    // Desktop Chrome
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },

    // Desktop Firefox
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    // Desktop Safari
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile Chrome (optionnel)
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },

    // Mobile Safari (optionnel)
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: process.env.CI ? undefined : {
    command: 'npm run dev',
    url: 'http://localhost:7002',
    reuseExistingServer: true,
    timeout: 120 * 1000,
  },
})
