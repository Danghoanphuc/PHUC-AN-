import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/ui',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: 'http://127.0.0.1:8081',
    viewport: { width: 390, height: 844 },
    trace: 'retain-on-failure',
  },
  outputDir: 'test-output/playwright',
  webServer: {
    command: 'node scripts/serve-preview.mjs',
    url: 'http://127.0.0.1:8081',
    reuseExistingServer: true,
  },
});
