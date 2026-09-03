import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  timeout: 180000,
  use: {
    baseURL: 'http://localhost:3005',
  },
});
