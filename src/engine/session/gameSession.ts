import type { GameState } from '@/engine/types/GameState'
import type { ProducerDef } from '@/engine/types/defs'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { recomputeCaches } from '@/engine/state/recomputeCaches'
import { runLifecyclePass } from '@/engine/loop/lifecycle'
import { applyOfflineCatchup } from '@/engine/loop/catchup'
import { makeEnvelope, encodeSave } from '@/engine/save/envelope'
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
// `store.autosave()` rotates writes across autosave1..N, so no single slot is reliably
// the newest — after the pointer wraps, autosave1 is the OLDEST. The load path must pick
// the genuinely most-recent slot, never a hardcoded one.
const AUTOSAVE_SLOTS = 3
const AUTOSAVE_SLOT_NAMES = Array.from({ length: AUTOSAVE_SLOTS }, (_, i) => `autosave${i + 1}`)

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

/**
 * The name of the most-recently-written autosave slot, or null when none carry a
 * readable meta. Picks by `readMeta(slot).savedAt` (the persisted wall clock) so it
 * tracks the rotation pointer without depending on its exact off-by-one semantics.
 */
function newestAutosaveSlot(store: SaveStore): string | null {
  let best: { slot: string; savedAt: number } | null = null
  for (const slot of AUTOSAVE_SLOT_NAMES) {
    const meta = store.readMeta(slot)
    if (meta === null) continue
    if (best === null || meta.savedAt > best.savedAt) best = { slot, savedAt: meta.savedAt }
  }
  return best?.slot ?? null
}

/** The newest autosaved state, or null when there is none / none are loadable. */
function loadAutosave(store: SaveStore): { state: GameState; lastTick: number } | null {
  const slot = newestAutosaveSlot(store)
  if (slot === null) return null
  const raw = store.loadRaw(slot)
  if (raw === null) return null
  const result = importSave(raw)
  if (!result.ok) return null
  return { state: result.envelope.state, lastTick: result.envelope.lastTick }
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
    // The live loop just credited dtMs of foreground production, so advance the catch-up
    // anchor in lockstep. This keeps the live loop and offline catch-up partitioning
    // wall-clock time with no gap and no overlap: the driver's per-frame clamp leaves any
    // long-frame remainder uncredited, and catch-up (now - lastTick) picks up exactly that
    // remainder plus any frozen-background gap — never double-counting.
    lastTick += dtMs
    if (events.length > 0) options.onEvents?.(events)
  }

  function dispatch(reducer: StateReducer): void {
    commit(reducer(state))
  }

  function save(): WriteResult {
    // Persist the CURRENT anchor. Saving is persistence, not a production event, so it must
    // NOT re-anchor lastTick: a throttled background autosave fires while the live loop is
    // frozen, and moving lastTick forward there would silently eat the offline gap (it would
    // skip past elapsed seconds without ever crediting the production they represent). Only
    // the live loop (advance) and catch-up move lastTick.
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
      // Credit the wall-clock gap since production was last credited. The live loop advances
      // lastTick in the foreground; while the tab was hidden the loop was frozen, so lastTick
      // is the moment we left and `now - lastTick` is exactly the un-credited away time. We
      // never re-anchor from disk (rotating autosaves can hold an older lastTick, and saving
      // no longer touches the anchor anyway).
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
