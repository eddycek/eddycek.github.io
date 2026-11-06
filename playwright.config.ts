import { defineConfig, devices } from '@playwright/test';

/**
 * Responsive checks on phones and tablets. Runs against the production build
 * (astro preview), so run `npm run build` first or use `npm run test:responsive`.
 */
export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: 'http://localhost:4322',
    locale: 'cs-CZ',
    reducedMotion: 'reduce',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'iphone-se', use: { ...devices['iPhone SE'] } },
    { name: 'iphone-15-pro', use: { ...devices['iPhone 15 Pro'] } },
    { name: 'pixel-7', use: { ...devices['Pixel 7'] } },
    { name: 'ipad-mini', use: { ...devices['iPad Mini'] } },
    { name: 'ipad-pro-landscape', use: { ...devices['iPad Pro 11 landscape'] } },
    { name: 'galaxy-tab-s4', use: { ...devices['Galaxy Tab S4'] } },
  ],
  webServer: {
    command: 'npx astro preview --port 4322 --ignore-lock',
    url: 'http://localhost:4322',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
