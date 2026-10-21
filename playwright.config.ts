import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 4173);

// Browsers: set PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers locally (preinstalled chromium-1194).
const visual = process.env.VISUAL === '1' || process.env.SCREENSHOTS === '1';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  // Visual baselines live beside the spec, one per name (chromium only; see docs/visual-tests.md).
  snapshotPathTemplate: '{testDir}/__screenshots__/{arg}{ext}',
  expect: { toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: 'disabled' } },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}/`, trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testIgnore: /visual\.spec\.ts/ },
    {
      name: 'phone-landscape',
      use: { ...devices['Pixel 7 landscape'] },
      testMatch: /(sandbox|lessons)\.spec\.ts/,
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [/visual\.spec\.ts/, /guard\.spec\.ts/],
    },
    // Opt-in (VISUAL=1 or SCREENSHOTS=1) so pixel diffs never gate normal runs.
    ...(visual
      ? [
          {
            name: 'visual',
            testMatch: /visual\.spec\.ts/,
            use: {
              ...devices['Desktop Chrome'],
              viewport: { width: 390, height: 844 },
              deviceScaleFactor: process.env.SCREENSHOTS === '1' ? 2 : 1,
            },
          },
        ]
      : []),
  ],
  webServer: {
    command: `npm run build:all && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
