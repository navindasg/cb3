import { wireLifecycleEvents, wasDiscarded } from '@/render/lifecycleEvents'

// A minimal document-like target that supports visibilitychange + a settable visibilityState.
function fakeDocument(): {
  doc: Document
  setVisibility: (v: 'visible' | 'hidden') => void
} {
  let visibility: 'visible' | 'hidden' = 'visible'
  const listeners = new Map<string, Set<EventListener>>()
  const doc = {
    get visibilityState() {
      return visibility
    },
    addEventListener(type: string, fn: EventListener) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(fn)
    },
    removeEventListener(type: string, fn: EventListener) {
      listeners.get(type)?.delete(fn)
    },
    dispatchEvent(event: Event) {
      for (const fn of listeners.get(event.type) ?? []) fn(event)
      return true
    },
  } as unknown as Document
  return {
    doc,
    setVisibility(v) {
      visibility = v
      doc.dispatchEvent(new Event('visibilitychange'))
    },
  }
}

describe('wasDiscarded', () => {
  it('is false when the flag is absent', () => {
    expect(wasDiscarded({} as Document)).toBe(false)
  })

  it('reflects document.wasDiscarded when present', () => {
    expect(wasDiscarded({ wasDiscarded: true } as unknown as Document)).toBe(true)
  })
})

describe('wireLifecycleEvents', () => {
  it('calls onHidden when the document becomes hidden', () => {
    const { doc, setVisibility } = fakeDocument()
    let hidden = 0
    wireLifecycleEvents({ doc, onHidden: () => (hidden += 1), onVisible: () => {} })
    setVisibility('hidden')
    expect(hidden).toBe(1)
  })

  it('calls onVisible when the document returns to visible', () => {
    const { doc, setVisibility } = fakeDocument()
    let visible = 0
    wireLifecycleEvents({ doc, onHidden: () => {}, onVisible: () => (visible += 1) })
    setVisibility('hidden')
    setVisibility('visible')
    expect(visible).toBe(1)
  })

  it('fires the debounced autosave on the injected interval', () => {
    vi.useFakeTimers()
    const { doc } = fakeDocument()
    let saves = 0
    wireLifecycleEvents({
      doc,
      onHidden: () => {},
      onVisible: () => {},
      onAutosave: () => (saves += 1),
      autosaveIntervalMs: 30_000,
    })
    vi.advanceTimersByTime(95_000) // 3 intervals
    expect(saves).toBe(3)
    vi.useRealTimers()
  })

  it('requests persistence exactly once on the first user interaction', () => {
    const { doc } = fakeDocument()
    let persistCalls = 0
    wireLifecycleEvents({
      doc,
      onHidden: () => {},
      onVisible: () => {},
      onFirstInteraction: () => (persistCalls += 1),
    })
    doc.dispatchEvent(new Event('pointerdown'))
    doc.dispatchEvent(new Event('keydown'))
    doc.dispatchEvent(new Event('pointerdown'))
    expect(persistCalls).toBe(1) // only the first
  })

  it('dispose removes the listeners and stops the autosave timer', () => {
    vi.useFakeTimers()
    const { doc, setVisibility } = fakeDocument()
    let hidden = 0
    let saves = 0
    const dispose = wireLifecycleEvents({
      doc,
      onHidden: () => (hidden += 1),
      onVisible: () => {},
      onAutosave: () => (saves += 1),
      autosaveIntervalMs: 30_000,
    })
    dispose()
    setVisibility('hidden')
    vi.advanceTimersByTime(120_000)
    expect(hidden).toBe(0)
    expect(saves).toBe(0)
    vi.useRealTimers()
  })
})
