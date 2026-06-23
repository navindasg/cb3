import type { GameState, ResourceKey } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'
import { setNumber, setFlag, setString } from '@/engine/state/reducers'
import { act1GateCleared } from '@/engine/content/actGate'
import {
  GALLEON_COMMISSION,
  GALLEON_CONTRIB_PREFIX,
  GALLEON_NAME_KEY,
} from '@/content/ship/galleon'

// The galleon commission (Act 2 — the sky port, DESIGN §13/§177). Pure & immutable, mirroring
// engine/content/gummyVat + moonStrata: compute from state, return the next state, a no-op returns the
// SAME reference. The sky port opens once the Act-1 gate is cleared (celestial navigation + the
// fishbowl helm). The player contributes materials toward GALLEON_COMMISSION — a major candy/material
// sink — and a per-resource ledger lives in the numbers namespace. When every line is met the galleon
// can be named: the name goes in strings and sets the commissioned flag (she is laid down at the
// dock). Hull tiers, drift (zero-G), and ship combat build on this in later slices.

/**
 * content/flags.GALLEON_COMMISSIONED_FLAG — set when the named galleon is laid down. The engine writes
 * the SAME literal in lock-step (the moonStrata idiom) rather than importing the content value, so the
 * layering stays clean (ADR §3). The GALLEON_* config keys/catalog below ARE imported (config data).
 */
const GALLEON_COMMISSIONED_FLAG = 'galleonCommissioned'

/** Whether the sky port is open — the Act-1 gate is cleared (celestial nav + the fishbowl helm). */
export function skyPortOpen(state: GameState): boolean {
  return act1GateCleared(state)
}

const contribKey = (resource: ResourceKey): string => `${GALLEON_CONTRIB_PREFIX}${resource}`

/** How much of `resource` has been delivered toward its commission line. */
export function contributed(state: GameState, resource: ResourceKey): number {
  return Math.max(0, state.numbers[contribKey(resource)] ?? 0)
}

/** The required total for `resource` (0 if the resource is not part of the commission). */
function requiredFor(resource: ResourceKey): number {
  return GALLEON_COMMISSION.find((l) => l.resource === resource)?.amount ?? 0
}

/** How much of `resource` the shipwright still needs (0 once the line is met or off-commission). */
export function remaining(state: GameState, resource: ResourceKey): number {
  return Math.max(0, requiredFor(resource) - contributed(state, resource))
}

/** Whether every commission line is fully delivered. */
export function commissionComplete(state: GameState): boolean {
  return GALLEON_COMMISSION.every((l) => contributed(state, l.resource) >= l.amount)
}

/** Whether the galleon has been named + laid down (the commission is closed). */
export function galleonCommissioned(state: GameState): boolean {
  return state.flags[GALLEON_COMMISSIONED_FLAG] === true
}

/** The name the player gave the galleon, or '' if not yet named. */
export function galleonName(state: GameState): string {
  return state.strings[GALLEON_NAME_KEY] ?? ''
}

export interface ContributeResult {
  readonly ok: boolean
  readonly state: GameState
  /** How much was actually delivered (0 on failure). */
  readonly delivered: number
  readonly reason?: 'closed' | 'lineFull' | 'nothingToGive'
}

/**
 * Deliver as much of `resource` as the player holds toward its commission line, capped at what the
 * line still needs. Spends the resource (the sink) and records it in the ledger. Fails (SAME ref) when
 * the port is shut, the line is already full, or the player holds none of the resource. Immutable.
 */
export function contribute(state: GameState, resource: ResourceKey): ContributeResult {
  if (!skyPortOpen(state)) return { ok: false, state, delivered: 0, reason: 'closed' }
  const need = remaining(state, resource)
  if (need <= 0) return { ok: false, state, delivered: 0, reason: 'lineFull' }

  // Resources tick as floats (the producers drip sub-unit amounts), but the commission is a
  // whole-unit ledger: floor the delivery so repeated partial contributions can never leave a line a
  // fractional hair short of complete (commissionComplete is a strict >=). The player keeps the dust.
  const give = Math.floor(Math.min(state[resource].current, need))
  if (give <= 0) return { ok: false, state, delivered: 0, reason: 'nothingToGive' }

  const spent = spendResource(state[resource], give)
  if (!spent) return { ok: false, state, delivered: 0, reason: 'nothingToGive' }

  const paid: GameState = { ...state, [resource]: spent }
  const next = setNumber(paid, contribKey(resource), contributed(state, resource) + give)
  return { ok: true, state: next, delivered: give }
}

export interface NameResult {
  readonly ok: boolean
  readonly state: GameState
  readonly reason?: 'incomplete' | 'alreadyNamed' | 'emptyName'
}

/**
 * Name the galleon + lay her down: store the (trimmed) name in strings and set the commissioned flag.
 * Fails (SAME ref) unless the commission is complete, not yet named, and the name is non-empty after
 * trimming. Immutable.
 */
export function nameGalleon(state: GameState, name: string): NameResult {
  if (!commissionComplete(state)) return { ok: false, state, reason: 'incomplete' }
  if (galleonCommissioned(state)) return { ok: false, state, reason: 'alreadyNamed' }

  const trimmed = name.trim()
  if (trimmed.length === 0) return { ok: false, state, reason: 'emptyName' }

  const named = setString(state, GALLEON_NAME_KEY, trimmed)
  return { ok: true, state: setFlag(named, GALLEON_COMMISSIONED_FLAG, true) }
}
