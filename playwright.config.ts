import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:8083',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },

    // Mobile web browsers (simulated)
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 5'],
        // Use localhost accessible from mobile
        baseURL: process.env.MOBILE_BASE_URL || 'http://localhost:8083',
      },
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 12'],
        baseURL: process.env.MOBILE_BASE_URL || 'http://localhost:8083',
      },
    },
    {
      name: 'tablet-chrome',
      use: {
        ...devices['iPad Pro'],
        baseURL: process.env.MOBILE_BASE_URL || 'http://localhost:8083',
      },
    },

    // iOS Simulator (requires real device connection)
    ...(process.env.IOS_SIMULATOR ? [{
      name: 'ios-simulator',
      use: {
        ...devices['iPhone 12'],
        // For iOS simulator, you'll need to use your machine's local IP
        // e.g., http://192.168.1.100:8080 instead of localhost
        baseURL: process.env.IOS_BASE_URL || 'http://192.168.1.100:8080',
        browserName: 'webkit',
      },
    }] : []),

    // Android Emulator (requires real device connection)
    ...(process.env.ANDROID_EMULATOR ? [{
      name: 'android-emulator',
      use: {
        ...devices['Pixel 5'],
        // For Android emulator, use 10.0.2.2 to access host machine
        baseURL: process.env.ANDROID_BASE_URL || 'http://10.0.2.2:8080',
        browserName: 'chromium',
      },
    }] : []),
  ],

  // Only start webServer locally, not in CI where Docker handles it
  ...(process.env.CI ? {} : {
    webServer: {
      command: 'yarn dev --host',
      url: 'http://localhost:8083',
      reuseExistingServer: true,
    },
  }),
});
