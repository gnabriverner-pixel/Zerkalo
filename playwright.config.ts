import { defineConfig } from '@playwright/test';
import fs from 'fs';

const defaultChromiumPath = '/Users/artemkrysin/Library/Caches/ms-playwright/chromium-1155/chrome-mac/Chromium.app/Contents/MacOS/Chromium';
const executablePath = fs.existsSync(defaultChromiumPath) ? defaultChromiumPath : undefined;

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 180000,
  use: {
    baseURL: 'http://localhost:3005',
    ...(executablePath ? { launchOptions: { executablePath } } : {}),
  },
  webServer: {
    command: 'PORT=3005 npx tsx server.ts',
    port: 3005,
    reuseExistingServer: true,
    timeout: 60000,
  },
});
