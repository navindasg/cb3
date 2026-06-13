// DEV-ONLY playtest panel (DOM glue, no game rules). A small cornered overlay with time-speed
// buttons (1× / 10× / 100× / 1000×) and a "reset save" button, for blitzing the Act 0 → seed →
// beanstalk arc without grinding. The bootstrap mounts this ONLY behind `import.meta.env.DEV`, so
// it is tree-shaken out of a production build entirely (verify: it never appears in `vite build`
// output). Like main.ts and the bootstrap, this is thin DOM wiring verified by Playwright, not
// unit tests, so it is excluded from coverage. Keep it free of game logic.

export const DEV_SPEED_PRESETS = [1, 10, 100, 1000] as const

export interface DevPanelOptions {
  /** The current speed multiplier (so the label can show it on mount). */
  readonly initialSpeed: number
  /** Change the live time multiplier. */
  readonly onSpeed: (speed: number) => void
  /** Clear the save and reload for a fresh playtest. */
  readonly onReset: () => void
}

export interface DevPanel {
  dispose(): void
}

/** Build the dev panel inside `root`. Returns a handle whose dispose() removes it cleanly. */
export function createDevPanel(root: HTMLElement, options: DevPanelOptions): DevPanel {
  const doc = root.ownerDocument

  const panel = doc.createElement('div')
  panel.className = 'dev-panel'
  panel.setAttribute('data-testid', 'dev-panel')
  // Decorative-but-interactive: label it so it is obviously the dev tool, never game UI.
  panel.setAttribute('aria-label', 'dev tools')

  const title = doc.createElement('span')
  title.className = 'dev-panel-title'
  title.textContent = 'dev'
  panel.appendChild(title)

  const readout = doc.createElement('span')
  readout.className = 'dev-panel-speed'
  readout.setAttribute('data-testid', 'dev-speed-current')
  const showSpeed = (speed: number): void => {
    readout.textContent = `${speed}×`
  }
  showSpeed(options.initialSpeed)
  panel.appendChild(readout)

  const buttons: HTMLButtonElement[] = []
  for (const preset of DEV_SPEED_PRESETS) {
    const b = doc.createElement('button')
    b.type = 'button'
    b.textContent = `${preset}×`
    b.setAttribute('data-testid', `dev-speed-${preset}`)
    b.addEventListener('click', () => {
      options.onSpeed(preset)
      showSpeed(preset)
    })
    panel.appendChild(b)
    buttons.push(b)
  }

  const reset = doc.createElement('button')
  reset.type = 'button'
  reset.className = 'dev-panel-reset'
  reset.textContent = 'reset save'
  reset.setAttribute('data-testid', 'dev-reset')
  reset.addEventListener('click', () => options.onReset())
  panel.appendChild(reset)

  root.appendChild(panel)

  return {
    dispose() {
      panel.remove()
    },
  }
}
