import type { GameState } from '@/engine/types/GameState'
import type { ItemDef, LetterDef } from '@/engine/types/defs'
import { setNumber, setFlag } from '@/engine/state/reducers'
import { grantItem } from '@/engine/shop/purchase'

// The village mailbox (§30) + grandma's attic (§288), as pure logic. The engine owns the read/latch
// rules; the letter/attic DATA lives in content (content/letters). ADR §3: the engine re-declares the
// content flag/number strings it needs in lock-step (the moonStrata idiom) — it never imports a content
// value. Everything here is immutable and farm-proof: letters grant nothing (a read-marker is idempotent),
// and the attic + its wrapper grant exactly once. There is nothing to farm; the reward is lore.

// --- the mailbox: milestone letters from the first climber ---------------------------------------

/** numbers-namespace prefix for a letter's read marker (read-once bookkeeping, cosmetic). */
const LETTER_READ_PREFIX = 'letterRead:'

/** Whether `letter`'s milestone has been reached (its gate flag is set) — i.e. it has been delivered. */
export function letterAvailable(state: GameState, letter: LetterDef): boolean {
  return state.flags[letter.gateFlag] === true
}

/** The letters delivered so far (milestone reached), in registry order. Pure. */
export function availableLetters(state: GameState, letters: readonly LetterDef[]): readonly LetterDef[] {
  return letters.filter((l) => letterAvailable(state, l))
}

/** Whether `letter` has been opened (its read marker is set). Cosmetic — read/unread is lore-only. */
export function letterRead(state: GameState, letter: LetterDef): boolean {
  return state.flags[LETTER_READ_PREFIX + letter.id] === true
}

/** How many delivered letters remain unread (drives the mailbox's "you have mail" hint). */
export function unreadCount(state: GameState, letters: readonly LetterDef[]): number {
  return availableLetters(state, letters).filter((l) => !letterRead(state, l)).length
}

/**
 * Mark `letter` read. Idempotent: a second read is a no-op (SAME reference), so re-opening the mailbox
 * never changes anything and there is nothing to farm. Only sets the marker for a DELIVERED letter.
 */
export function markLetterRead(state: GameState, letter: LetterDef): GameState {
  if (!letterAvailable(state, letter)) return state
  return setFlag(state, LETTER_READ_PREFIX + letter.id, true)
}

// --- grandma's attic: the old-days ×3 secret + the wrapper ---------------------------------------

/** numbers-namespace key holding how many times you have asked Grandma about the old days. */
export const OLD_DAYS_ASKED_KEY = 'oldDaysAsked'

/** How many times you must ask before she relents and opens the attic ladder. */
export const OLD_DAYS_THRESHOLD = 3

/** content/flags (lock-step, ADR §3): set when the attic has been opened and its keepsakes granted. */
export const ATTIC_OPENED_FLAG = 'atticOpened'

/** content/items (lock-step, ADR §3): the wrapper's saveFlag IS the mantle-sword unlock flag. */
export const MANTLE_SWORD_UNLOCK_FLAG = 'mantleSwordUnlocked'

/** How many times you have asked about the old days so far. */
export function oldDaysAsked(state: GameState): number {
  return state.numbers[OLD_DAYS_ASKED_KEY] ?? 0
}

/** Whether the attic is unlocked (asked about the old days at least the threshold number of times). */
export function atticUnlocked(state: GameState): boolean {
  return oldDaysAsked(state) >= OLD_DAYS_THRESHOLD
}

/** Whether the attic has already been opened (its keepsakes granted). */
export function atticOpened(state: GameState): boolean {
  return state.flags[ATTIC_OPENED_FLAG] === true
}

export interface AskResult {
  readonly state: GameState
  /** True on the exact ask that reaches the threshold and unlocks the attic (fires once). */
  readonly justUnlocked: boolean
}

/**
 * Ask Grandma about the old days: bump the monotonic counter by one. Returns justUnlocked=true ONLY on
 * the exact ask that first crosses the threshold (so the "she nods at the ladder" beat fires once).
 * Asking again past the threshold keeps counting (harmless, monotonic) but never re-unlocks. Immutable.
 */
export function askAboutOldDays(state: GameState): AskResult {
  const before = oldDaysAsked(state)
  const after = before + 1
  const next = setNumber(state, OLD_DAYS_ASKED_KEY, after)
  const justUnlocked = before < OLD_DAYS_THRESHOLD && after >= OLD_DAYS_THRESHOLD
  return { state: next, justUnlocked }
}

export interface OpenAtticResult {
  readonly ok: boolean
  readonly state: GameState
  readonly reason?: 'locked' | 'alreadyOpened'
}

/**
 * Open the attic and take its keepsakes (the pogo stick, the old map fragment, and the wrapper — the
 * wrapper's grant sets MANTLE_SWORD_UNLOCK_FLAG, cashing the mantle-sword foreshadow). Commit-once: fails
 * (SAME reference) if the attic is still locked (asked < 3) or already opened. The `items` are the attic
 * ItemDefs (content/letters.ATTIC_ITEMS). Immutable; farm-proof (the flag blocks a second grant).
 */
export function openAttic(state: GameState, items: readonly ItemDef[]): OpenAtticResult {
  if (!atticUnlocked(state)) return { ok: false, state, reason: 'locked' }
  if (atticOpened(state)) return { ok: false, state, reason: 'alreadyOpened' }
  let next = setFlag(state, ATTIC_OPENED_FLAG, true)
  for (const item of items) next = grantItem(next, item)
  return { ok: true, state: next }
}
