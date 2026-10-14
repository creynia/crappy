import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.PORT ?? 4173);

// Browsers: set PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers locally (preinstalled chromium-1194).
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://localhost:${PORT}/`, trace: 'retain-on-failure' },
  projects: [
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    {
      name: 'phone-landscape',
      use: { ...devices['Pixel 7 landscape'] },
      testMatch: /(sandbox|lessons|layout)\.spec\.ts/,
    },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run build:all && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
