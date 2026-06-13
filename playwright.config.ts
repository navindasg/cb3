import { defineConfig, devices } from '@playwright/test'

// Playwright e2e for the Phase 1 critical flows (Block H). Kept OUT of the Vitest include glob
// (vitest only globs tests/**/*.test.ts) so the two runners never collide. The suite drives the
// real DOM bootstrap against the Vite dev server. Browsers are installed best-effort via
// `pnpm exec playwright install chromium`; if they are absent in this environment the suite is
// simply not run (the unit gate — pnpm typecheck && pnpm coverage — is the block's green gate).

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5189',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // A dedicated, strict port so the e2e run never reuses an unrelated dev server.
    command: 'pnpm dev --port 5189 --strictPort',
    url: 'http://localhost:5189',
    reuseExistingServer: false,
    timeout: 120_000,
  },
})
