import type { ReadonlySignal } from '@/engine/signals/signal'
import { effect } from '@/engine/signals/signal'

// A graphical health bar for the status bar (ADR §7.4). The Candy Box health bar is a coloured
// fill that turns from green to orange to red as you bleed; we render the same tiers as a CSS
// fill with the live "current / max" inside. The tier thresholds and palette match the original
// (green by default, orange under half, red under a fifth). Pure tier helpers + a thin effect-
// bound DOM shell, like StatusBar — the only inputs are the two signals it reads.

/** Health-tier palette (matches the original's green / orange / red). */
export const HEALTH_GREEN = '#14d400'
export const HEALTH_ORANGE = '#ff8000'
export const HEALTH_RED = '#e60f00'

/** Fill ratio in [0, 1] for `hp`/`maxHp` (0 when maxHp is non-positive). */
export function healthRatio(hp: number, maxHp: number): number {
  if (maxHp <= 0) return 0
  return Math.max(0, Math.min(1, hp / maxHp))
}

/** The fill colour for a ratio: red below a fifth, orange below half, else green. */
export function healthColor(ratio: number): string {
  if (ratio < 0.2) return HEALTH_RED
  if (ratio < 0.5) return HEALTH_ORANGE
  return HEALTH_GREEN
}

export interface HealthBarOptions {
  readonly hp: ReadonlySignal<number>
  readonly maxHp: ReadonlySignal<number>
  /** Optional gate: the bar shows only while this is true (the progressive unlock). */
  readonly visible?: ReadonlySignal<boolean>
}

export interface HealthBar {
  readonly el: HTMLElement
  dispose(): void
}

/** Mount a reactive health bar inside `root`. The fill width + colour + text track the signals. */
export function createHealthBar(root: HTMLElement, options: HealthBarOptions): HealthBar {
  const doc = root.ownerDocument
  const disposers: Array<() => void> = []

  const wrap = doc.createElement('span')
  wrap.className = 'health-bar'
  wrap.setAttribute('data-testid', 'health-bar')
  wrap.setAttribute('data-region', 'hp')

  const fill = doc.createElement('span')
  fill.className = 'health-bar-fill'

  const text = doc.createElement('span')
  text.className = 'health-bar-text'
  text.style.fontVariantNumeric = 'tabular-nums lining-nums'

  wrap.appendChild(fill)
  wrap.appendChild(text)
  root.appendChild(wrap)

  disposers.push(
    effect(() => {
      const hp = options.hp.get()
      const max = options.maxHp.get()
      const ratio = healthRatio(hp, max)
      fill.style.width = `${(ratio * 100).toFixed(1)}%`
      fill.style.background = healthColor(ratio)
      text.textContent = `${Math.max(0, Math.floor(hp))} / ${max}`
    }),
  )

  if (options.visible) {
    const visible = options.visible
    disposers.push(
      effect(() => {
        wrap.style.display = visible.get() ? '' : 'none'
      }),
    )
  }

  return {
    el: wrap,
    dispose() {
      for (const d of disposers) d()
      wrap.remove()
    },
  }
}
