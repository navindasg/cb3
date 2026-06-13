import type { ReadonlySignal } from '@/engine/signals/signal'
import { effect } from '@/engine/signals/signal'
import { formatCount } from '@/engine/number/format'

// The pinned status bar (ADR §7.4). Each readout — candy, lollipop, HP, mana — is its
// OWN effect-bound region: an effect that reads exactly one signal and writes exactly
// one <span>. Because the effect's only dependency is that one signal, a candy change
// re-renders only the candy span, never the whole bar (this is the whole point of the
// fine-grained signals — no full-DOM-replace like CB2). tabular-nums keeps digits from
// jittering as counts change.

/** One numeric readout: a label, the signal feeding it, and how to format the value. */
export interface StatusRegionSpec {
  readonly id: string
  readonly label: string
  readonly source: ReadonlySignal<number>
  /** Defaults to comma-grouped formatCount. */
  readonly format?: (value: number) => string
}

export interface StatusBar {
  /** The number of times each region's value text was written (for tests/diagnostics). */
  renderCounts(): Readonly<Record<string, number>>
  /** Tear down every region's effect — no leaks across place switches. */
  dispose(): void
}

/**
 * Build a status bar inside `root`. Returns a handle whose dispose() detaches every
 * region effect. Each region is an independent <span class="status-region"> with a label
 * and a value span; only the value text updates reactively.
 */
export function createStatusBar(root: HTMLElement, specs: readonly StatusRegionSpec[]): StatusBar {
  const doc = root.ownerDocument
  const disposers: Array<() => void> = []
  const counts: Record<string, number> = {}

  for (const spec of specs) {
    counts[spec.id] = 0

    const region = doc.createElement('span')
    region.className = 'status-region'
    region.setAttribute('data-region', spec.id)

    const label = doc.createElement('span')
    label.className = 'status-label'
    label.textContent = spec.label

    const value = doc.createElement('span')
    value.className = 'status-value'
    value.style.fontVariantNumeric = 'tabular-nums lining-nums'

    region.appendChild(label)
    region.appendChild(value)
    root.appendChild(region)

    const fmt = spec.format ?? formatCount
    // The ONLY dependency of this effect is spec.source — so it (and only it) re-runs
    // when that signal changes, updating just this region's value text.
    const dispose = effect(() => {
      value.textContent = fmt(spec.source.get())
      counts[spec.id] = (counts[spec.id] ?? 0) + 1
    })
    disposers.push(dispose)
  }

  return {
    renderCounts: () => ({ ...counts }),
    dispose() {
      for (const d of disposers) d()
    },
  }
}
