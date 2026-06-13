// CB2's load-bearing pattern, kept and made immutable: every resource tracks the
// current balance, the lifetime total ever earned, and the high-water mark.
// `lifetimeAccumulated` is what gates progression (e.g. the seed pivot) and never
// shrinks when you spend — only positive deltas add to it.

export interface ResourceState {
  readonly current: number
  readonly lifetimeAccumulated: number
  readonly historicalMax: number
}

export function createResource(initial = 0): ResourceState {
  return { current: initial, lifetimeAccumulated: initial, historicalMax: initial }
}

/** Apply a delta. Positive deltas grow the lifetime total; current never goes below 0. */
export function addResource(resource: ResourceState, delta: number): ResourceState {
  const current = Math.max(0, resource.current + delta)
  return {
    current,
    lifetimeAccumulated:
      delta > 0 ? resource.lifetimeAccumulated + delta : resource.lifetimeAccumulated,
    historicalMax: Math.max(resource.historicalMax, current),
  }
}

/** Spend `amount`. Returns a new state, or null if unaffordable. Does not touch lifetime totals. */
export function spendResource(resource: ResourceState, amount: number): ResourceState | null {
  if (amount < 0) throw new Error('spendResource: amount must be non-negative')
  if (resource.current < amount) return null
  return { ...resource, current: resource.current - amount }
}

export function canAfford(resource: ResourceState, amount: number): boolean {
  return resource.current >= amount
}
