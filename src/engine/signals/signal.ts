// Hand-rolled fine-grained reactivity (~80 lines) — the reactive substrate for
// hundreds of small interdependent counters, with no framework dependency.
// Hardened against the three classic "toy signal" flaws:
//   (1) stale dependencies are cleaned before every effect re-run,
//   (2) `computed` is memoized in a backing signal (recomputes only on change),
//   (3) writes are equality-gated so identical sets never re-fire subscribers.

type Subscriber = {
  run: () => void
  deps: Set<Set<Subscriber>>
}

let activeSub: Subscriber | null = null
let batchDepth = 0
const pending = new Set<Subscriber>()

function track(subscribers: Set<Subscriber>): void {
  if (activeSub) {
    subscribers.add(activeSub)
    activeSub.deps.add(subscribers)
  }
}

function trigger(subscribers: Set<Subscriber>): void {
  // Snapshot: a subscriber's run() re-subscribes, mutating the set mid-iteration.
  for (const sub of [...subscribers]) {
    if (batchDepth > 0) pending.add(sub)
    else sub.run()
  }
}

function cleanup(sub: Subscriber): void {
  for (const dep of sub.deps) dep.delete(sub)
  sub.deps.clear()
}

export interface Signal<T> {
  get(): T
  set(next: T): void
  peek(): T
}

export interface ReadonlySignal<T> {
  get(): T
  peek(): T
}

/** A writable reactive value. `get()` tracks; `peek()` reads without tracking. */
export function signal<T>(initial: T): Signal<T> {
  let value = initial
  const subscribers = new Set<Subscriber>()
  return {
    get() {
      track(subscribers)
      return value
    },
    set(next: T) {
      if (Object.is(next, value)) return // (flaw 3) equality gate
      value = next
      trigger(subscribers)
    },
    peek() {
      return value
    },
  }
}

/** Run `fn` now and again whenever any signal it read changes. Returns a disposer. */
export function effect(fn: () => void): () => void {
  const sub: Subscriber = {
    deps: new Set(),
    run() {
      cleanup(sub) // (flaw 1) drop last run's deps before re-tracking
      const prev = activeSub
      activeSub = sub
      try {
        fn()
      } finally {
        activeSub = prev
      }
    },
  }
  sub.run()
  return () => cleanup(sub)
}

/** A derived value, memoized in a backing signal — recomputes only when a dep changes. */
export function computed<T>(fn: () => T): ReadonlySignal<T> {
  const cache = signal<T>(undefined as unknown as T) // (flaw 2)
  effect(() => cache.set(fn()))
  return { get: () => cache.get(), peek: () => cache.peek() }
}

/** Coalesce many writes: subscribers fire once, after `fn` returns. Nesting-safe. */
export function batch(fn: () => void): void {
  batchDepth++
  try {
    fn()
  } finally {
    batchDepth--
    if (batchDepth === 0) {
      const toRun = [...pending]
      pending.clear()
      for (const sub of toRun) sub.run()
    }
  }
}
