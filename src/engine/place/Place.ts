// A Place is any screen the player can be in (a map, a zone, a quest, a shop).
// Exactly one is active at a time. `mount()` wires up the place's reactive effects
// and listeners and returns a disposer that tears them all down — the typed
// replacement for CB2's global resetResourcesCallbacks(), with no leaks.

export interface Place {
  readonly id: string
  mount(): () => void
}
