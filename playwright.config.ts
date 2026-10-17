import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  use: { baseURL: 'http://127.0.0.1:4187', trace: 'retain-on-failure' },
  projects: [360, 390, 430].map((width) => ({
    name: `mobile-${width}`,
    use: {
      browserName: 'chromium',
      launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
        ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
        : undefined,
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
