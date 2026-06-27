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
      // render/devPanel.ts is DEV-only DOM glue (tree-shaken from prod), same exclusion rationale.
      exclude: [
        'src/main.ts',
        'src/render/bootstrap.ts',
        'src/render/townScreens.ts',
        'src/render/skyScreens.ts',
        'src/render/moonScreens.ts',
        'src/render/skyPortScreens.ts',
        'src/render/reefScreens.ts',
        'src/render/cometScreens.ts',
        'src/render/sourbeardScreens.ts',
        'src/render/sourPlanetScreens.ts',
        'src/render/krakenScreens.ts',
        'src/render/mintPlanetScreens.ts',
        'src/render/scaffoldScreens.ts',
        'src/render/questScreens.ts',
        'src/render/devPanel.ts',
        // Overworld.ts is the responsive DOM shell: it lives off getBoundingClientRect/innerHeight
        // measurements that jsdom reports as 0, so its fit math is verified live (Playwright),
        // not in unit tests. Its pure model (overworldModel.ts) IS fully unit-tested.
        'src/render/Overworld.ts',
        'src/**/*.d.ts',
      ],
      thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
    },
  },
})
