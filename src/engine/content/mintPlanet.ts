import type { GameState } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'
import { setNumber, setFlag } from '@/engine/state/reducers'
import {
  LABYRINTH_ROOMS,
  LABYRINTH_START,
  LABYRINTH_HEART,
  PEPPERMINT_CONDENSER_KEY,
  CONDENSER_ROCK_CANDY_COST,
  CONDENSER_CANDY_COST,
  PEPPERMINT_PER_CONDENSER_PER_SEC,
  type LabyrinthRoom,
} from '@/content/planet/mintPlanet'

// The mint planet (Act 2 — quest 10, DESIGN §182/§184). Pure & immutable, mirroring the other content
// engines. Three parts: the ICE LABYRINTH (a transient "follow the cold" maze — never persisted, like a
// quest), the FROST WYRM (a one-off freeing that sets a flag), and the PEPPERMINT CONDENSERS (a buildable
// passive producer, post-wyrm). Plus the §184 act-2 gate predicate. The labyrinth state lives in the
// screen; only the wyrm flag, the condenser count, and the peppermint resource are persisted.

const roomById = (id: string): LabyrinthRoom | undefined => LABYRINTH_ROOMS.find((r) => r.id === id)

// --- the ice labyrinth (transient "follow the cold" maze) ---------------------------------------------

export interface LabyrinthState {
  readonly room: string
}

/** A fresh descent — at the labyrinth's mouth. */
export function createLabyrinth(): LabyrinthState {
  return { room: LABYRINTH_START }
}

/** Whether you have reached the frozen heart (the frost wyrm waits there). */
export function labyrinthSolved(state: LabyrinthState): boolean {
  return state.room === LABYRINTH_HEART
}

/**
 * Take a passage out of the current room (by index). The coldest passage leads deeper; a warmer one
 * wanders you back to the mouth — "the labyrinth keeps you". Pure; a no-op (SAME reference) at the heart
 * or on a bad index.
 */
export function takePassage(state: LabyrinthState, passageIndex: number): LabyrinthState {
  const room = roomById(state.room)
  const passage = room?.passages[passageIndex]
  if (!passage) return state
  return { room: passage.to }
}

/** The index of the coldest passage out of a room — the way deeper. Drives the on-screen cold hint and
 * the deterministic tests; the player follows the temperatures by eye. -1 at the heart (no passages). */
export function coldestPassage(roomId: string): number {
  const room = roomById(roomId)
  if (!room || room.passages.length === 0) return -1
  let best = 0
  for (let i = 1; i < room.passages.length; i++) {
    if (room.passages[i]!.temp < room.passages[best]!.temp) best = i
  }
  return best
}

// --- the frost wyrm (a one-off freeing) ---------------------------------------------------------------

/**
 * Kept in lock-step with content/flags.FROST_WYRM_FREED_FLAG (content owns the named constant — the
 * moonStrata idiom). The engine reads the literal here rather than importing the content value (ADR §3).
 */
const FROST_WYRM_FREED_FLAG = 'frostWyrmFreed'

/** Whether the frost wyrm has been freed — the peppermint fields are open. */
export function frostWyrmFreed(state: GameState): boolean {
  return state.flags[FROST_WYRM_FREED_FLAG] === true
}

export interface FreeResult {
  readonly ok: boolean
  readonly state: GameState
}

/** Free the frost wyrm (break the peppermint-frost from around it). A no-op (SAME reference) once freed.
 * Opens peppermint mining. Immutable. */
export function freeFrostWyrm(state: GameState): FreeResult {
  if (frostWyrmFreed(state)) return { ok: false, state }
  return { ok: true, state: setFlag(state, FROST_WYRM_FREED_FLAG) }
}

// --- peppermint condensers (the buildable producer, post-wyrm) ----------------------------------------

/** How many peppermint condensers you have built. */
export function condenserCount(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[PEPPERMINT_CONDENSER_KEY] ?? 0))
}

/** Peppermint the condensers sublimate per second (the producer reads the same product). */
export function peppermintRate(state: GameState): number {
  return condenserCount(state) * PEPPERMINT_PER_CONDENSER_PER_SEC
}

/** Whether a condenser can be built now (the wyrm freed and both inputs affordable). */
export function canBuildCondenser(state: GameState): boolean {
  return (
    frostWyrmFreed(state) &&
    state.rockCandy.current >= CONDENSER_ROCK_CANDY_COST &&
    state.candies.current >= CONDENSER_CANDY_COST
  )
}

export interface BuildResult {
  readonly ok: boolean
  readonly state: GameState
  readonly reason?: 'locked' | 'unaffordable'
}

/**
 * Build one peppermint condenser: spend rock candy + candies, increment the count. Fails (SAME reference)
 * until the wyrm is freed, or when either input is short (spendResource returns null rather than
 * overdrafting). Immutable.
 */
export function buildCondenser(state: GameState): BuildResult {
  if (!frostWyrmFreed(state)) return { ok: false, state, reason: 'locked' }

  const rockCandy = spendResource(state.rockCandy, CONDENSER_ROCK_CANDY_COST)
  if (!rockCandy) return { ok: false, state, reason: 'unaffordable' }
  const candies = spendResource(state.candies, CONDENSER_CANDY_COST)
  if (!candies) return { ok: false, state, reason: 'unaffordable' }

  const paid: GameState = { ...state, rockCandy, candies }
  return { ok: true, state: setNumber(paid, PEPPERMINT_CONDENSER_KEY, condenserCount(state) + 1) }
}
