import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      // main.ts + render/bootstrap.ts are the thin DOM wiring (composition of already-tested
      // engine/render modules); they own no game logic and are verified end-to-end by the
      // Playwright suite, not unit tests. All logic-bearing code stays covered by real tests.
      exclude: ['src/main.ts', 'src/render/bootstrap.ts', 'src/**/*.d.ts'],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})
