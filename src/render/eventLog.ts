// The event log (the deadpan narrative beats). The old log appended forever and read as
// bloated clutter; this one keeps only the last few lines and fades older ones out, so the most
// recent beat is always the brightest and the column never grows without bound. CB2's QuestLog
// aged purely by COUNT (last ten, no fade); the count cap is the homage, the opacity gradient is
// CB3's de-clutter. Pure DOM glue with one tiny pure helper (lineOpacity) for the gradient.

/** Default number of log lines kept on screen before the oldest is dropped. */
export const DEFAULT_MAX_LINES = 5

/** Resting opacity for a line `ageFromNewest` steps behind the newest (0 = newest). Clamped. */
export function lineOpacity(ageFromNewest: number): number {
  return Math.max(0.18, 1 - ageFromNewest * 0.22)
}

export interface EventLogOptions {
  /** Max lines kept before the oldest is removed (defaults to DEFAULT_MAX_LINES). */
  readonly maxLines?: number
}

export interface EventLog {
  /** The log container element (mounted into `root`). */
  readonly el: HTMLElement
  /** Append a line; drops the oldest past the cap and re-grades every line's opacity. */
  push(text: string): void
  /** Detach the log element. */
  dispose(): void
}

/** Mount a capped, fading event log inside `root`. */
export function createEventLog(root: HTMLElement, options: EventLogOptions = {}): EventLog {
  const doc = root.ownerDocument
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES

  const el = doc.createElement('div')
  el.className = 'event-log'
  el.setAttribute('aria-live', 'polite')
  root.appendChild(el)

  function regrade(): void {
    const lines = el.children
    const total = lines.length
    for (let i = 0; i < total; i++) {
      const line = lines[i] as HTMLElement
      // Children are oldest-first; age-from-newest grows toward the top of the column.
      line.style.opacity = lineOpacity(total - 1 - i).toString()
    }
  }

  return {
    el,
    push(text: string): void {
      const line = doc.createElement('p')
      line.className = 'event-log-line'
      line.textContent = text
      el.appendChild(line)
      while (el.children.length > maxLines) {
        el.firstElementChild?.remove()
      }
      regrade()
    },
    dispose(): void {
      el.remove()
    },
  }
}
