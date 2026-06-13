import { signal, computed, effect, batch } from '@/engine/signals/signal'

describe('signal / effect', () => {
  it('runs the effect immediately, then on dependency change', () => {
    const count = signal(0)
    const seen: number[] = []
    effect(() => seen.push(count.get()))
    expect(seen).toEqual([0])
    count.set(1)
    expect(seen).toEqual([0, 1])
  })

  it('equality-gates identical writes', () => {
    const s = signal(5)
    let runs = 0
    effect(() => {
      s.get()
      runs++
    })
    expect(runs).toBe(1)
    s.set(5) // same value -> no re-run
    expect(runs).toBe(1)
    s.set(6)
    expect(runs).toBe(2)
  })

  it('peek() reads without creating a dependency', () => {
    const s = signal(0)
    let runs = 0
    effect(() => {
      s.peek()
      runs++
    })
    s.set(1)
    expect(runs).toBe(1)
  })

  it('disposer detaches the effect', () => {
    const s = signal(0)
    let runs = 0
    const dispose = effect(() => {
      s.get()
      runs++
    })
    expect(runs).toBe(1)
    dispose()
    s.set(1)
    expect(runs).toBe(1)
  })

  it('cleans up stale dependencies across runs', () => {
    const toggle = signal(true)
    const a = signal('a')
    const b = signal('b')
    const seen: string[] = []
    effect(() => seen.push(toggle.get() ? a.get() : b.get()))
    expect(seen).toEqual(['a'])

    b.set('b2') // not a current dependency -> no re-run
    expect(seen).toEqual(['a'])

    toggle.set(false) // now depends on b, not a
    expect(seen).toEqual(['a', 'b2'])

    a.set('a2') // stale dep -> no re-run
    expect(seen).toEqual(['a', 'b2'])

    b.set('b3')
    expect(seen).toEqual(['a', 'b2', 'b3'])
  })
})

describe('computed', () => {
  it('memoizes and recomputes only when a dependency changes', () => {
    const a = signal(2)
    const b = signal(3)
    let computes = 0
    const sum = computed(() => {
      computes++
      return a.get() + b.get()
    })
    expect(sum.get()).toBe(5)
    expect(sum.get()).toBe(5)
    expect(computes).toBe(1) // reads are memoized
    a.set(10)
    expect(sum.get()).toBe(13)
    expect(computes).toBe(2)
  })

  it('propagates through an effect', () => {
    const a = signal(1)
    const doubled = computed(() => a.get() * 2)
    const seen: number[] = []
    effect(() => seen.push(doubled.get()))
    expect(seen).toEqual([2])
    a.set(5)
    expect(seen).toEqual([2, 10])
  })
})

describe('batch', () => {
  it('coalesces multiple writes into a single effect run', () => {
    const a = signal(1)
    const b = signal(2)
    let runs = 0
    effect(() => {
      a.get()
      b.get()
      runs++
    })
    expect(runs).toBe(1)
    batch(() => {
      a.set(10)
      b.set(20)
    })
    expect(runs).toBe(2) // exactly one extra run, not two
  })

  it('is nesting-safe (flushes only at depth 0)', () => {
    const s = signal(0)
    let runs = 0
    effect(() => {
      s.get()
      runs++
    })
    batch(() => {
      s.set(1)
      batch(() => s.set(2))
      expect(runs).toBe(1) // no flush inside the outer batch
    })
    expect(runs).toBe(2)
    expect(s.peek()).toBe(2)
  })
})
