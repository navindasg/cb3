import type { GameState } from '@/engine/types/GameState'
import type { ProducerDef } from '@/engine/types/defs'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { recomputeCaches } from '@/engine/state/recomputeCaches'
import { runLifecyclePass } from '@/engine/loop/lifecycle'
import { applyOfflineCatchup } from '@/engine/loop/catchup'
import { decodeSave, makeEnvelope, encodeSave } from '@/engine/save/envelope'
import { importSave, type ImportResult } from '@/engine/save/validate'
import { createSaveStore, type SaveStore, type StorageLike, type WriteResult } from '@/engine/save/localStorage'
import { setFlag } from '@/engine/state/reducers'

// The headless game session — the load → catch-up → recompute → advance core of the bootstrap,
// kept OUT of the DOM so it is fully unit-testable (the thin DOM shell, src/main.ts + the
// render bootstrap, only wires events to these methods). It owns the canonical GameState, runs
// the lifecycle pass on each sim step, persists via the save store, and exposes the catch-up
// hooks the visibility wiring calls (onHidden/onVisible). All economy/scripted logic is in the
// pure engine modules; this is the orchestrator that holds the current reference and the clock.

const DEFAULT_OFFLINE_CAP_MS = 72 * 60 * 60 * 1000 // 72h, the §5 tuning knob
const AUTOSAVE_LOAD_SLOT = 'autosave1'

/** Flag set when the opening line has been acknowledged (gates the village reveal). */
export const OPENER_SEEN_FLAG = 'openerSeen'
/** Flag the map reads to reveal the village stratum. Set after the opener. */
export const VILLAGE_UNLOCKED_FLAG = 'villageUnlocked'
/** Flag the map reads to reveal the mines stratum. Set when the player is told of the mines. */
export const MINES_REVEALED_FLAG = 'minesRevealed'
/** Flag the map reads to reveal the observatory stratum (the hill above the village). */
export const OBSERVATORY_UNLOCKED_FLAG = 'observatoryUnlocked'

/** A wall clock; injected so catch-up deltas are testable without real time. */
export interface WallClock {
  now(): number
}

export interface GameSessionOptions {
  readonly storage?: StorageLike
  readonly producers: readonly ProducerDef[]
  readonly clock?: WallClock
  readonly offlineCapMs?: number
  /** Surface lifecycle narrative events (seed lands, clouds reached) to the host UI. */
  readonly onEvents?: (events: readonly string[]) => void
}

/** A pure state reducer the host can dispatch (e.g. eatCandies bound to a button). */
export type StateReducer = (state: GameState) => GameState

export interface GameSession {
  getState(): GameState
  /** Run one lifecycle pass of `dtMs` of game time (called by the fixed-timestep driver). */
  advance(dtMs: number): void
  /** Apply a pure reducer and commit the result. */
  dispatch(reducer: StateReducer): void
  /** Acknowledge the opening line: reveal the village. */
  acknowledgeOpener(): void
  /** Reveal the sugar mines stratum (the player has been told of them). */
  revealMines(): void
  /** Persist the current state to the rotating autosave. */
  save(): WriteResult
  /** Persist now (the last reliable moment before the tab hides). */
  onHidden(): void
  /** Credit the wall-clock gap since the last save, then resume. */
  onVisible(): void
  /** Decode + validate + load a pasted save string; keep the current save on failure. */
  importSaveString(encoded: string): ImportResult
  /** The current state as a shareable LZ-string base64 export. */
  exportSaveString(): string
  /** Observe every commit. Returns a disposer. */
  subscribe(listener: (state: GameState) => void): () => void
}

/** The autosaved state, or null when there is none / it is unreadable. */
function loadAutosave(store: SaveStore): { state: GameState; lastTick: number } | null {
  const raw = store.loadRaw(AUTOSAVE_LOAD_SLOT)
  if (raw === null) return null
  const result = importSave(raw)
  if (!result.ok) return null
  return { state: result.envelope.state, lastTick: result.envelope.lastTick }
}

/** Read the lastTick from a raw autosave envelope without full validation (best-effort). */
function readLastTick(raw: string, fallback: number): number {
  try {
    const decoded = decodeSave(raw) as { lastTick?: unknown }
    return typeof decoded.lastTick === 'number' && Number.isFinite(decoded.lastTick)
      ? decoded.lastTick
      : fallback
  } catch {
    return fallback
  }
}

export function createGameSession(options: GameSessionOptions): GameSession {
  const clock: WallClock = options.clock ?? { now: () => Date.now() }
  const offlineCapMs = options.offlineCapMs ?? DEFAULT_OFFLINE_CAP_MS
  const store = createSaveStore({ storage: options.storage })
  const listeners = new Set<(state: GameState) => void>()

  // --- load: autosave or a fresh game, then recompute derived caches once (decision 4) ---
  const loaded = loadAutosave(store)
  let state = recomputeCaches(loaded ? loaded.state : createDefaultSave())
  // `lastTick` tracks the wall-clock moment the state was last current; it advances on every
  // save and is the anchor for offline catch-up.
  let lastTick = loaded ? loaded.lastTick : clock.now()

  // --- offline catch-up: credit the gap between the save's lastTick and now (decision D3) ---
  if (loaded) {
    runCatchup()
  }

  function commit(next: GameState): void {
    if (next === state) return
    state = next
    for (const listener of [...listeners]) listener(state)
  }

  function runCatchup(): void {
    const elapsed = clock.now() - lastTick // negative (rollback) is clamped to 0 in catch-up
    const { state: caught } = applyOfflineCatchup(state, elapsed, options.producers, {
      capMs: offlineCapMs,
    })
    lastTick = clock.now()
    commit(caught)
  }

  function advance(dtMs: number): void {
    const { state: next, events } = runLifecyclePass(state, options.producers, dtMs)
    commit(next)
    if (events.length > 0) options.onEvents?.(events)
  }

  function dispatch(reducer: StateReducer): void {
    commit(reducer(state))
  }

  function save(): WriteResult {
    lastTick = clock.now()
    return store.autosave(makeEnvelope(state, lastTick))
  }

  return {
    getState: () => state,
    advance,
    dispatch,
    acknowledgeOpener() {
      commit(setFlag(setFlag(state, OPENER_SEEN_FLAG), VILLAGE_UNLOCKED_FLAG))
    },
    revealMines() {
      commit(setFlag(state, MINES_REVEALED_FLAG))
    },
    save,
    onHidden() {
      save()
    },
    onVisible() {
      // Re-anchor lastTick from the last persisted save so the gap is measured against it.
      const raw = store.loadRaw(AUTOSAVE_LOAD_SLOT)
      if (raw !== null) lastTick = readLastTick(raw, lastTick)
      runCatchup()
    },
    importSaveString(encoded: string): ImportResult {
      const result = importSave(encoded)
      if (result.ok) {
        lastTick = clock.now()
        commit(recomputeCaches(result.envelope.state))
      }
      return result
    },
    exportSaveString: () => encodeSave(makeEnvelope(state, clock.now())),
    subscribe(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
}
