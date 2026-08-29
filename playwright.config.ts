import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: true,
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    command: './node_modules/.bin/vite build && ./node_modules/.bin/vite preview --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000
  },
  projects: [
    {
      name: 'chromium-desktop-1440',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 900 },
        launchOptions: {
          args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']
        }
      }
    },
    {
      name: 'webkit-desktop-1280',
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } }
    },
    {
      name: 'chromium-tablet-768',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 } }
    },
    {
      name: 'chromium-mobile-390',
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } }
    },
    {
      name: 'webkit-mobile-360',
      use: { ...devices['iPhone 13 Mini'], viewport: { width: 360, height: 780 } }
    }
  ]
})
