import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1, // The API deliberately bounds document work; don't overload it in CI.
  timeout: 90_000,
  expect: { timeout: 20_000 },
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'android-chromium', use: { ...devices['Pixel 7'] } },
    { name: 'iphone-webkit', use: { ...devices['iPhone 13'] } },
    { name: 'small-phone-chromium', use: { ...devices['Pixel 7'], viewport: { width: 320, height: 640 } } },
  ],
  webServer: [
    { command: `${process.env.SHARESHIELD_TEST_PYTHON || '../.venv/bin/python'} -m uvicorn backend.app:app --app-dir .. --host 127.0.0.1 --port 8000`, url: 'http://127.0.0.1:8000/health', timeout: 60_000 },
    { command: 'npm run dev', url: 'http://127.0.0.1:5173', timeout: 30_000 },
  ],
})
