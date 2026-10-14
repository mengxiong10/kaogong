import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  use: { baseURL: 'http://127.0.0.1:4187', trace: 'retain-on-failure' },
  projects: [360, 390, 430].map((width) => ({
    name: `mobile-${width}`,
    use: {
      browserName: 'chromium',
      viewport: { width, height: 844 },
      isMobile: true,
      hasTouch: true,
    },
  })),
  webServer: {
    command: 'pnpm dev --port 4187 --strictPort',
    url: 'http://127.0.0.1:4187',
    reuseExistingServer: false,
  },
});
