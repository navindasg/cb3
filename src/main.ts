import './render/styles.css'
import { loadFont } from '@/render/font'
import { bootstrap } from '@/render/bootstrap'

// The real entry point (Phase 1 Block H). Thin by design: wait for the monospace font so the
// ASCII grid aligns on first paint (never blocks — falls back to the system stack when the
// binary is absent), then hand off to the DOM bootstrap, which wires load → catch-up →
// recompute → fixed-timestep driver → first render and the page-lifecycle save triggers.
// All game rules live in the tested engine/render modules; this file just starts them.

async function main(): Promise<void> {
  const statusRoot = document.querySelector<HTMLElement>('#status-bar')
  const mainRoot = document.querySelector<HTMLElement>('#main-content')
  if (!statusRoot || !mainRoot) {
    throw new Error('main: #status-bar and #main-content roots are required')
  }
  await loadFont(document)
  bootstrap(statusRoot, mainRoot)
}

void main()
