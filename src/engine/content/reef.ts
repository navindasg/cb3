import type { GameState } from '@/engine/types/GameState'
import { addResource } from '@/engine/types/Resource'
import { setNumber } from '@/engine/state/reducers'
import type { AsteroidDef } from '@/content/reef/asteroids'
import { REEF_ASTEROID_KEY, REEF_HITS_KEY } from '@/content/reef/asteroids'

// The rock candy reef harvest (Act 2 — DESIGN §178/§90). Pure & immutable, mirroring
// engine/content/moonStrata: compute from state, return the next state, a no-op returns the SAME
// reference. You break the asteroids of a FINITE field — each hit frees rock candy and chips toward
// breaking it; breaking the last asteroid harvests the reef. v1 has no tool gate (the galleon's
// presence is enough); the gumball-cannon drift combat + later passes are Act-2 follow-ons. All
// progress lives in numbers; "harvested" is derived from the field (no flag needed), like the moon's
// "depleted".

function asteroidIndex(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[REEF_ASTEROID_KEY] ?? 0))
}

function hits(state: GameState): number {
  return Math.max(0, Math.floor(state.numbers[REEF_HITS_KEY] ?? 0))
}

/** The asteroid currently being broken, or null once the whole field is harvested. */
export function currentAsteroid(state: GameState, field: readonly AsteroidDef[]): AsteroidDef | null {
  return field[asteroidIndex(state)] ?? null
}

/** Hits sunk into the current asteroid so far (for the HUD's progress readout). */
export function asteroidProgress(state: GameState): number {
  return hits(state)
}

/** Whether the reef is harvested — every asteroid in the field broken (derived, like moon "depleted"). */
export function reefHarvested(state: GameState, field: readonly AsteroidDef[]): boolean {
  return currentAsteroid(state, field) === null
}

/** Whether a strike would land now — an unbroken asteroid remains in the field. */
export function canBreak(state: GameState, field: readonly AsteroidDef[]): boolean {
  return currentAsteroid(state, field) !== null
}

export interface BreakResult {
  readonly ok: boolean
  readonly state: GameState
  /** Rock candy freed this hit (0 when the field is already harvested). */
  readonly gained: number
  /** True on the hit that broke the current asteroid (the next one drifts in). */
  readonly broke: boolean
  readonly reason?: 'harvested'
}

/**
 * Strike the current asteroid once. Adds its per-hit rock-candy yield and chips the hit count;
 * reaching hitsToBreak breaks it and drifts the next asteroid in. Fails (SAME reference) once the
 * whole field is harvested.
 */
export function breakAsteroid(state: GameState, field: readonly AsteroidDef[]): BreakResult {
  const asteroid = currentAsteroid(state, field)
  if (!asteroid) return { ok: false, state, gained: 0, broke: false, reason: 'harvested' }

  const banked: GameState = { ...state, rockCandy: addResource(state.rockCandy, asteroid.yieldPerHit) }
  const struck = hits(state) + 1
  const broke = struck >= asteroid.hitsToBreak
  const next = broke
    ? setNumber(setNumber(banked, REEF_ASTEROID_KEY, asteroidIndex(state) + 1), REEF_HITS_KEY, 0)
    : setNumber(banked, REEF_HITS_KEY, struck)

  return { ok: true, state: next, gained: asteroid.yieldPerHit, broke }
}
