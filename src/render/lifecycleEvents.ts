// The browser-lifecycle event wiring (ADR §5.4). DOM glue ONLY: it owns no game rules, holds
// no state, and imports no engine logic — it translates page lifecycle signals into the
// callbacks the host (the game session) provides. Kept here in render/ because it touches
// document/navigator (the engine layer is DOM-free). All targets are injected so the whole
// thing is unit-testable in jsdom with a fake document.
//
// Wiring:
//   * visibilitychange → hidden  ⇒ onHidden  (the last reliable moment to save)
//   * visibilitychange → visible ⇒ onVisible (run offline catch-up for the gap, then resume)
//   * a debounced autosave on a 30–60s interval
//   * the first user interaction ⇒ onFirstInteraction (call navigator.storage.persist())

/** True when this load is resuming a tab the browser discarded (Chrome tab discarding). */
export function wasDiscarded(doc: Document = document): boolean {
  return (doc as Document & { wasDiscarded?: boolean }).wasDiscarded === true
}

export interface LifecycleEventOptions {
  readonly doc?: Document
  /** Called when the tab hides (persist now — beforeunload is best-effort only). */
  readonly onHidden: () => void
  /** Called when the tab returns to visible (run catch-up, resume the loop). */
  readonly onVisible: () => void
  /** Called on the debounced autosave tick. */
  readonly onAutosave?: () => void
  /** Called once on the first user interaction (e.g. navigator.storage.persist()). */
  readonly onFirstInteraction?: () => void
  /** Autosave cadence in ms (ADR §5.4: 30–60s). Default 45s. */
  readonly autosaveIntervalMs?: number
}

/** Wire the lifecycle events; returns a disposer that removes every listener + timer. */
export function wireLifecycleEvents(options: LifecycleEventOptions): () => void {
  const doc = options.doc ?? document
  const interval = options.autosaveIntervalMs ?? 45_000

  const onVisibility = (): void => {
    if (doc.visibilityState === 'hidden') options.onHidden()
    else if (doc.visibilityState === 'visible') options.onVisible()
  }
  doc.addEventListener('visibilitychange', onVisibility)

  let timer: ReturnType<typeof setInterval> | null = null
  if (options.onAutosave) {
    const autosave = options.onAutosave
    timer = setInterval(() => autosave(), interval)
  }

  // First-interaction persistence: a one-shot across a few interaction kinds.
  const interactionTypes = ['pointerdown', 'keydown', 'touchstart'] as const
  let firedFirstInteraction = false
  const onInteraction = (): void => {
    if (firedFirstInteraction) return
    firedFirstInteraction = true
    options.onFirstInteraction?.()
    for (const type of interactionTypes) doc.removeEventListener(type, onInteraction)
  }
  if (options.onFirstInteraction) {
    for (const type of interactionTypes) doc.addEventListener(type, onInteraction)
  }

  return () => {
    doc.removeEventListener('visibilitychange', onVisibility)
    if (timer !== null) clearInterval(timer)
    for (const type of interactionTypes) doc.removeEventListener(type, onInteraction)
  }
}
