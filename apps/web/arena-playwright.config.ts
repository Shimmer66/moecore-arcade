import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  testMatch: [
    'arena-campaign.spec.ts',
    'arena-endless.spec.ts',
    'arena-editor.spec.ts',
    'arena-hidden.spec.ts',
    'arena-usability.spec.ts',
  ],
  outputDir: './.cache/arena-playwright',
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:4189', screenshot: 'only-on-failure' },
  projects: [
    { name: 'desktop', use: devices['Desktop Chrome'] },
    { name: 'mobile', use: devices['Pixel 7'] },
  ],
  webServer: {
    command: 'npm run dev -- --port 4189 --strictPort',
    url: 'http://127.0.0.1:4189',
    reuseExistingServer: true,
  },
});
