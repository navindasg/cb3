import type { GameState } from '@/engine/types/GameState'
import { meleeWeapon } from '@/content/items/playerLoadout'
import { setString } from '@/engine/state/reducers'
import { spendResource } from '@/engine/types/Resource'
import { gummyWormCount, gummyFusedCount, gummyMintFusedCount } from '@/engine/content/gummyVat'
import { grantItem } from '@/engine/shop/purchase'
// DELIBERATE, non-cargo-cult divergence from the kraken/boarding drop idiom (where the RENDER layer owns the
// item-def import + the commit-once grant, and the engine sim is item-agnostic): here the brew/drink/grant/equip
// reducers live in the engine ON PURPOSE so they stay pure-tested (reflectionScreens is coverage-excluded glue).
// ItemDefs are CONFIG data (ADR §3 permits the engine to read content config), not content FLAG VALUES — flags
// are still re-declared in lock-step below. Do NOT copy this into a fresh boss without the same testability reason.
import { SUGAR_GLASS_SHARD, PARADOX_PIN, MIRROR_POTION, ITEM_MAP } from '@/content/items/items'
import {
  REFLECTION_BASE_HP,
  HP_PER_GUMMY,
  RIPOSTE_FACTOR,
  LUNGE_FACTOR,
  CUT_WEAPON_FACTOR,
  FAST_COOLDOWN_MS,
  MAX_TURNS,
  CUT_PATTERN,
  type ReflectionCut,
  type ReflectionLine,
} from '@/content/potion/reflectionFight'

// Your reflection's guard/lunge sim (Phase 5 — hidden boss 2, the X-potion homage, DESIGN §17/§18). A pure,
// immutable, TRANSIENT turn-based duel (like the boarding melee / cloud wolf it never touches GameState mid-
// fight; an abandoned or lost fight is forfeit, and only the cleared flag + the paradox-pin drop are persisted,
// owned by the screen). Deterministic (no RNG, no rAF). It is a MIRROR: both sides read your EQUIPPED HAND
// WEAPON (via meleeWeapon) and your gummy army (bonus HP for both), so a bigger blade only makes a bigger
// mirror. Symmetric by construction — the READ breaks the tie. This mirrors engine/content/boardingDuel one-for-
// one (its proven spine), and is grid-searched in the test so all-lunge loses for every build (greed loses), a
// maxed build makes a maxed mirror (still winnable), and clean reads win.
//
// This module also owns the mirror POTION brew (exact-cost, the caramel-boil / plant-moonpop shape) and the
// PARADOX PIN's two-hat equip rule (a small pure reducer + reader). The screen calls these; the layering stays
// clean (the engine reads content flag STRINGS in lock-step, never imports a content value — ADR §3).

export type ReflectionAction = 'guard-high' | 'guard-low' | 'lunge'
export type ReflectionOutcome = 'won' | 'lost' | null

/**
 * Kept in lock-step with content/flags.REFLECTION_DEFEATED_FLAG (content owns the named constant — the
 * moonStrata idiom). The engine reads the literal here rather than importing the content value (ADR §3).
 */
const REFLECTION_DEFEATED_FLAG = 'reflectionDefeated'

/** content/flags.PARADOX_PIN_OWNED_FLAG (the pin's own saveFlag — one truth). Read in lock-step (ADR §3). */
const PARADOX_PIN_OWNED_FLAG = 'paradoxPinOwned'

/** content/flags.HAT_TWO_KEY — the strings-namespace key holding the SECOND equipped hat (paradox pin only). */
const HAT_TWO_KEY = 'hatTwo'

/** Whether your reflection has been beaten (the paradox pin granted, the fight retired — commit-once). */
export function reflectionDefeated(state: GameState): boolean {
  return state.flags[REFLECTION_DEFEATED_FLAG] === true
}

/** Whether the paradox pin is owned — with it, you may wear a second hat (the equip rule below reads this). */
export function paradoxPinOwned(state: GameState): boolean {
  return state.flags[PARADOX_PIN_OWNED_FLAG] === true
}

// --- the two-hat rule (the paradox pin's reward) --------------------------------------------------------------

/** How many hats you may wear at once: two once the paradox pin is owned, otherwise the usual one. Pure. */
export function maxHats(state: GameState): number {
  return paradoxPinOwned(state) ? 2 : 1
}

/** The SECOND equipped hat's item id (the strings-namespace slot), or null. Only meaningful with the pin. */
export function secondHat(state: GameState): string | null {
  const id = state.strings[HAT_TWO_KEY]
  return id && id.length > 0 ? id : null
}

export interface EquipHatResult {
  readonly ok: boolean
  readonly state: GameState
  readonly reason?: 'noPin' | 'notOwned' | 'notAHat' | 'sameAsPrimary'
}

/**
 * Equip an owned hat into the SECOND hat slot (the paradox pin's reward). Fails (SAME reference) without the pin,
 * if the item is not an owned hat, or if it duplicates the primary hat (you cannot wear the same hat twice).
 * Immutable — the second hat rides the strings z.record (no schema bump). The primary hat slot is untouched;
 * this is purely additive. Hats confer no combat stat yet, so this is a legible equip rule + the honest hook a
 * future hat effect would read (the tricorn/parrot/kraken-crown morale, §272/§235).
 */
export function equipSecondHat(state: GameState, itemId: string): EquipHatResult {
  if (!paradoxPinOwned(state)) return { ok: false, state, reason: 'noPin' }
  if (state.ownedItems[itemId] !== true) return { ok: false, state, reason: 'notOwned' }
  const item = ITEM_MAP.get(itemId)
  if (!item || item.slot !== 'hat') return { ok: false, state, reason: 'notAHat' }
  if (state.equipped.hat === itemId) return { ok: false, state, reason: 'sameAsPrimary' }
  return { ok: true, state: setString(state, HAT_TWO_KEY, itemId) }
}

/** Clear the second hat slot. No-op (SAME reference) when it is already empty. Immutable. */
export function unequipSecondHat(state: GameState): EquipHatResult {
  if (secondHat(state) === null) return { ok: false, state, reason: 'notOwned' }
  return { ok: true, state: setString(state, HAT_TWO_KEY, '') }
}

// --- the mirror potion brew (exact-cost) ----------------------------------------------------------------------

/** Whether the mirror potion can be brewed right now: you hold the sugar-glass shard + a chocolate + at least
 * one candy (and you have not already brewed one still un-drunk). Exact-cost, the plant-moonpop / feedExactly
 * shape — the brew spends EXACTLY one candy, one chocolate, and the one shard (consumed). */
export function canBrewMirrorPotion(state: GameState): boolean {
  return (
    state.ownedItems[SUGAR_GLASS_SHARD.id] === true &&
    state.ownedItems[MIRROR_POTION.id] !== true &&
    state.chocolate.current >= 1 &&
    state.candies.current >= 1
  )
}

/** Whether a brewed mirror potion is in hand, waiting to be drunk (summons the reflection). */
export function hasMirrorPotion(state: GameState): boolean {
  return state.ownedItems[MIRROR_POTION.id] === true
}

export interface BrewResult {
  readonly ok: boolean
  readonly state: GameState
  readonly reason?: 'noShard' | 'alreadyBrewed' | 'unaffordable'
}

/**
 * Brew the mirror potion: consume the sugar-glass shard (its owned flag cleared), spend EXACTLY one chocolate
 * and one candy, and grant the MIRROR_POTION item (the draught in hand). Fails (SAME reference) without the
 * shard, if a potion is already brewed, or if either resource is short — spendResource returns null rather than
 * overdrafting, so nothing is touched. Immutable. The shard goes in and the reflection comes out.
 */
export function brewMirrorPotion(state: GameState): BrewResult {
  if (state.ownedItems[SUGAR_GLASS_SHARD.id] !== true) return { ok: false, state, reason: 'noShard' }
  if (state.ownedItems[MIRROR_POTION.id] === true) return { ok: false, state, reason: 'alreadyBrewed' }

  const chocolate = spendResource(state.chocolate, 1)
  if (!chocolate) return { ok: false, state, reason: 'unaffordable' }
  const candies = spendResource(state.candies, 1)
  if (!candies) return { ok: false, state, reason: 'unaffordable' }

  // Consume the shard (clear its owned flag + item) and grant the brewed potion.
  const consumed: GameState = {
    ...state,
    chocolate,
    candies,
    flags: { ...state.flags, [SUGAR_GLASS_SHARD.saveFlag]: false },
    ownedItems: { ...state.ownedItems, [SUGAR_GLASS_SHARD.id]: false },
  }
  return { ok: true, state: grantItem(consumed, MIRROR_POTION) }
}

/** Consume the brewed potion (drinking it summons the reflection). Clears the potion's owned flag + item so a
 * lost fight costs the draught, not the pin. Immutable; a no-op (SAME ref) if no potion is in hand. */
export function drinkMirrorPotion(state: GameState): GameState {
  if (state.ownedItems[MIRROR_POTION.id] !== true) return state
  return {
    ...state,
    flags: { ...state.flags, [MIRROR_POTION.saveFlag]: false },
    ownedItems: { ...state.ownedItems, [MIRROR_POTION.id]: false },
  }
}

// --- the fight ------------------------------------------------------------------------------------------------

/** Your fighting hand as the duel reads it off the equipped weapon (both sides read the same one — a mirror). */
export interface ReflectionWeapon {
  readonly damage: number
  /** Swings per exchange (a fast weapon ripostes/lunges twice). */
  readonly strikes: number
}

export interface ReflectionState {
  readonly yourHp: number
  readonly yourMaxHp: number
  readonly foeHp: number
  readonly foeMaxHp: number
  /** Exchanges resolved so far (the mirror wears you out at MAX_TURNS). */
  readonly turn: number
  readonly weapon: ReflectionWeapon
}

/** Read your fighting hand off the equipped weapon (or bare hands). Pure — the mirror reads the identical one. */
export function deriveReflectionWeapon(state: GameState): ReflectionWeapon {
  const w = meleeWeapon(state)[0]!
  return { damage: w.damage, strikes: w.cooldownMs < FAST_COOLDOWN_MS ? 2 : 1 }
}

/** The total gummy army behind you (worm + sour-fused + mint-fused) — the shared HP bonus for both sides. */
export function totalGummyCount(state: GameState): number {
  return gummyWormCount(state) + gummyFusedCount(state) + gummyMintFusedCount(state)
}

/** Both fighters' max HP: the base pool plus the gummy-army bonus. Identical by construction — a fair mirror. */
export function mirrorMaxHp(state: GameState): number {
  return REFLECTION_BASE_HP + HP_PER_GUMMY * totalGummyCount(state)
}

/** A fresh duel: you AND the mirror at the same HP (base + army), the mirror's bout at the first cut. */
export function createReflectionFight(state: GameState): ReflectionState {
  const hp = mirrorMaxHp(state)
  return {
    yourHp: hp,
    yourMaxHp: hp,
    foeHp: hp,
    foeMaxHp: hp,
    turn: 0,
    weapon: deriveReflectionWeapon(state),
  }
}

/** The cut the reflection is making this exchange (loops the pattern if the duel runs long). */
export function cutFor(turn: number): ReflectionCut {
  return CUT_PATTERN[turn % CUT_PATTERN.length]!
}

/**
 * The mirror's cut damage when it lands: it lunges back at you off the SAME blade (LUNGE_FACTOR x its weapon x
 * strikes) plus the cut's small base bite. Reading it right takes ZERO of this; lunging or mis-reading eats all
 * of it. Because it lunges as hard as your lunge, a pure aggression trade is dead-even — and the mirror wins the
 * dead-even trade (the outcome check below reads yourHp first, so simultaneity favors the mirror). Greed loses.
 */
export function mirrorCutDamage(cut: ReflectionCut, weapon: ReflectionWeapon): number {
  return LUNGE_FACTOR * CUT_WEAPON_FACTOR * weapon.damage * weapon.strikes + cut.dmg
}

/**
 * The duel's result, or null while it is still on. Checked on the resolved state. YOUR-down check comes FIRST
 * (unlike the sibling fights): the mirror does not blink — in a simultaneous, dead-even trade IT survives, so
 * naive all-lunge (a pure trade against something that hits exactly as hard as you) loses. You must break the
 * symmetry by GUARDING (take zero, riposte) — the one thing a lunge cannot do. `maxTurns` is the clock.
 */
export function reflectionOutcome(
  state: ReflectionState,
  maxTurns: number = MAX_TURNS,
): ReflectionOutcome {
  if (state.yourHp <= 0) return 'lost' // the mirror wins the tie — it fights how you fight, and does not blink
  if (state.foeHp <= 0) return 'won'
  if (state.turn >= maxTurns) return 'lost' // it wore you out
  return null
}

/**
 * Resolve one exchange. GUARD a line: if it matches the mirror's ACTUAL cut you block it clean (no damage) and
 * riposte for RIPOSTE_FACTOR x damage x strikes; if you mis-read (or it feinted), the cut lands full and you do
 * not riposte. LUNGE: deal LUNGE_FACTOR x damage x strikes, but you are committed — the cut always lands. The
 * mirror's cut and your lunge come off the SAME blade, so the trade is even; the outcome check tips the even
 * trade to the mirror. Pure — returns a new state; a no-op (SAME reference) once the duel is over.
 */
export function resolveReflectionExchange(
  state: ReflectionState,
  action: ReflectionAction,
  maxTurns: number = MAX_TURNS,
): ReflectionState {
  if (reflectionOutcome(state, maxTurns) !== null) return state

  const cut = cutFor(state.turn)
  const riposte = RIPOSTE_FACTOR * state.weapon.damage * state.weapon.strikes
  const lunge = LUNGE_FACTOR * state.weapon.damage * state.weapon.strikes
  const cutDmg = mirrorCutDamage(cut, state.weapon)

  let foeHp = state.foeHp
  let yourHp = state.yourHp

  if (action === 'lunge') {
    foeHp -= lunge
    yourHp -= cutDmg // committed: the cut always lands
  } else {
    const guardLine: ReflectionLine = action === 'guard-high' ? 'high' : 'low'
    if (guardLine === cut.line) {
      foeHp -= riposte // read it right: block clean + riposte
    } else {
      yourHp -= cutDmg // mis-read (or feinted): the cut lands, no riposte
    }
  }

  return { ...state, foeHp, yourHp, turn: state.turn + 1 }
}

// --- the drop (commit-once) -----------------------------------------------------------------------------------

/**
 * Grant the paradox pin exactly once, on the first reflection win. Sets the cleared flag + the pin (its own
 * saveFlag + ownedItems, via grantItem — the pin has no slot, so it just banks as a keepsake). A second call
 * (already cleared) returns the SAME reference — farm-proof, the kraken/boarding idiom. Pure & immutable.
 */
export function grantReflectionReward(state: GameState): GameState {
  if (reflectionDefeated(state)) return state
  const cleared: GameState = {
    ...state,
    flags: { ...state.flags, [REFLECTION_DEFEATED_FLAG]: true },
  }
  return grantItem(cleared, PARADOX_PIN)
}
