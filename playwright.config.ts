import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './arena-menu-kit/tests',
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    headless: true,
    viewport: { width: 1440, height: 900 },
  },
});
