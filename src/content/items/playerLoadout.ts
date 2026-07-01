import type { Weapon } from '@/engine/quest/Entity'
import type { GameState } from '@/engine/types/GameState'
import { ITEM_MAP, MANTLE_SWORD } from '@/content/items/items'

// Maps the persisted loadout (GameState.equipped.weapon) to the quest player's combat weapon(s).
// The Scene player is built with these (SceneConfig.playerWeapons). With nothing equipped you go
// in bare-handed: a weak, short, slow swing — enough to chip a gummy slime, but you will want
// grandma's spoon. Pure: reads the equipped item's WeaponStats; returns plain Weapon records.

/** The fallback weapon when no weapon is equipped (your own two fists). */
export const BARE_HANDS: Weapon = { id: 'bareHands', damage: 1, range: 1.2, cooldownMs: 700 }

// The heirloom sword's "wrapper" scaling (§288). Grandma's sword is not a fixed number — it is the whole
// weight of your lifetime behind a swing. Its damage scales off lifetimeCandiesEaten (the mantle sword's
// design intent, never stated in the game): the base heirloom damage plus a slow, monotonic bonus that
// grows with everything you have ever eaten. sqrt-scaled so it climbs forever but never runaway-fast, and
// floored so the number stays a clean integer. A fresh save (0 eaten) still swings at the base. The bonus
// is only ever ADDED (never negative), so the sword only ever gets heavier — never lighter.

/** Candies-eaten per +1 damage step, at the sqrt scale (tuned so the bonus is gentle and open-ended). */
export const MANTLE_SWORD_SCALE_DIVISOR = 10_000

/**
 * The mantle sword's damage cap for the DISCRETE telegraph fights (the boarding melee, the star-eater's
 * on-foot + core phases, the sour kraken). Those bouts are grid-searched so all-lunge/all-strike LOSES for
 * every forged blade at <= this damage (strikes 1); the hero sword's raw weight + scaling would let pure
 * aggression brute past the read, so it is HELD here to the iron sword's damage (the pop-rock-pike precedent,
 * items.ts). Its full scaled weight bites only in open real-time quest combat, which has no all-lunge contract.
 */
export const MANTLE_SWORD_MELEE_CAP = 5

/** The heirloom sword's damage for a given lifetime candies-eaten total. Pure, monotonic non-decreasing. */
export function mantleSwordDamage(lifetimeCandiesEaten: number): number {
  const base = MANTLE_SWORD.weapon!.damage
  const eaten = Math.max(0, lifetimeCandiesEaten)
  return base + Math.floor(Math.sqrt(eaten / MANTLE_SWORD_SCALE_DIVISOR))
}

/** The equipped weapon's stats for the current loadout (the mantle sword scaled off lifetime), or bare
 * hands. `cap` (default none) holds the mantle sword's damage for the discrete telegraph fights. Pure. */
function equippedWeapon(state: GameState, cap?: number): readonly Weapon[] {
  const equippedId = state.equipped.weapon
  const item = equippedId ? ITEM_MAP.get(equippedId) : undefined
  if (item?.weapon) {
    // The heirloom sword alone scales its damage off your lifetime (the "wrapper" intent); every other
    // weapon carries fixed stats. Reach + speed are unchanged — only the weight behind it grows. In the
    // discrete telegraph fights the scaled weight is capped (see MANTLE_SWORD_MELEE_CAP).
    let damage = item.weapon.damage
    if (item.id === MANTLE_SWORD.id) {
      damage = cap === undefined ? mantleSwordDamage(state.lifetimeCandiesEaten) : Math.min(cap, mantleSwordDamage(state.lifetimeCandiesEaten))
    }
    return [{ id: item.id, damage, range: item.weapon.range, cooldownMs: item.weapon.cooldownMs }]
  }
  return [BARE_HANDS]
}

/** The quest weapon(s) for the current loadout — the equipped weapon's stats (fully scaled), or bare hands. */
export function playerQuestWeapons(state: GameState): readonly Weapon[] {
  return equippedWeapon(state)
}

/**
 * The equipped weapon as the DISCRETE telegraph fights read it — identical to playerQuestWeapons except the
 * mantle sword's damage is held to MANTLE_SWORD_MELEE_CAP (the balance hold). The boarding melee, the star-
 * eater's on-foot/core phases and the sour kraken derive their hand off THIS, so the hero sword's scaling
 * never breaks their grid-searched all-lunge/all-strike-loses contracts. Pure.
 */
export function meleeWeapon(state: GameState): readonly Weapon[] {
  return equippedWeapon(state, MANTLE_SWORD_MELEE_CAP)
}
