import type { ReadonlySignal } from '@/engine/signals/signal'
import { effect } from '@/engine/signals/signal'
import { formatCount } from '@/engine/number/format'

// The pinned status bar (ADR §7.4). Each readout — candy, HP — is its OWN effect-bound region:
// an effect that reads exactly the signals it shows and writes exactly one <span>. Because the
// effect's dependencies are just those signals, a candy change re-renders only the candy span,
// never the whole bar (the point of the fine-grained signals — no full-DOM-replace like CB2).
// A region may also declare a `visible` signal (the progressive GUI unlock gates each readout)
// and a `max` signal (so a readout can render "current / max" and update when either changes).
// tabular-nums keeps digits from jittering as counts change.

/** One numeric readout: a label, the signal feeding it, and how to format the value. */
export interface StatusRegionSpec {
  readonly id: string
  readonly label: string
  readonly source: ReadonlySignal<number>
  /** Optional companion signal for "current / max" style readouts. */
  readonly max?: ReadonlySignal<number>
  /** Optional gate: the region is shown only while this signal is true (absent ⇒ always shown). */
  readonly visible?: ReadonlySignal<boolean>
  /** Defaults to comma-grouped formatCount. Receives the max value when a `max` signal is set. */
  readonly format?: (value: number, max?: number) => string
}

export interface StatusBar {
  /** The number of times each region's value text was written (for tests/diagnostics). */
  renderCounts(): Readonly<Record<string, number>>
  /** Tear down every region's effect — no leaks across place switches. */
  dispose(): void
}

/**
 * Build a status bar inside `root`. Returns a handle whose dispose() detaches every region
 * effect. Each region is an independent <span class="status-region"> with a label and a value
 * span; only the value text (and visibility) updates reactively.
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
    // The ONLY dependencies of this effect are spec.source (+ spec.max) — so it (and only it)
    // re-runs when those signals change, updating just this region's value text.
    const disposeValue = effect(() => {
      const max = spec.max?.get()
      value.textContent = fmt(spec.source.get(), max)
      counts[spec.id] = (counts[spec.id] ?? 0) + 1
    })
    disposers.push(disposeValue)

    if (spec.visible) {
      const visible = spec.visible
      const disposeVisible = effect(() => {
        region.style.display = visible.get() ? '' : 'none'
      })
      disposers.push(disposeVisible)
    }
  }

  return {
    renderCounts: () => ({ ...counts }),
    dispose() {
      for (const d of disposers) d()
    },
  }
}
