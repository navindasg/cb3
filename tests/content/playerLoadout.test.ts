import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  playerQuestWeapons,
  meleeWeapon,
  BARE_HANDS,
  mantleSwordDamage,
  MANTLE_SWORD_SCALE_DIVISOR,
  MANTLE_SWORD_MELEE_CAP,
} from '@/content/items/playerLoadout'
import { MANTLE_SWORD } from '@/content/items/items'
import type { GameState } from '@/engine/types/GameState'

function withWeapon(weapon: string | null): GameState {
  const s = createDefaultSave()
  return { ...s, equipped: { ...s.equipped, weapon } }
}

function withMantleAndEaten(lifetimeCandiesEaten: number): GameState {
  return { ...withWeapon(MANTLE_SWORD.id), lifetimeCandiesEaten }
}

describe('playerQuestWeapons', () => {
  it('maps the equipped weapon item to a quest weapon with its stats', () => {
    const [w] = playerQuestWeapons(withWeapon('woodenSpoon'))
    expect(w?.id).toBe('woodenSpoon')
    expect(w?.damage).toBe(2)
    expect(w?.range).toBe(2)
    expect(w?.cooldownMs).toBe(500)
  })

  it('a sharper weapon carries its sharper stats', () => {
    const [w] = playerQuestWeapons(withWeapon('ironSword'))
    expect(w?.damage).toBe(5)
    expect(w?.cooldownMs).toBe(400)
  })

  it('falls back to bare hands when nothing is equipped', () => {
    expect(playerQuestWeapons(withWeapon(null))).toEqual([BARE_HANDS])
  })
})

describe('the wrapper — the mantle sword scales off lifetimeCandiesEaten (§288)', () => {
  const base = MANTLE_SWORD.weapon!.damage

  it('at zero lifetime candies eaten it swings at exactly the base heirloom damage', () => {
    expect(mantleSwordDamage(0)).toBe(base)
  })

  it('adds one damage per full sqrt-scale step (10k, 40k, 90k eaten → +1, +2, +3)', () => {
    expect(mantleSwordDamage(MANTLE_SWORD_SCALE_DIVISOR)).toBe(base + 1) // sqrt(1) = 1
    expect(mantleSwordDamage(4 * MANTLE_SWORD_SCALE_DIVISOR)).toBe(base + 2) // sqrt(4) = 2
    expect(mantleSwordDamage(9 * MANTLE_SWORD_SCALE_DIVISOR)).toBe(base + 3) // sqrt(9) = 3
  })

  it('is monotonic non-decreasing across a wide range of lifetimes', () => {
    let prev = -Infinity
    for (const eaten of [0, 1, 5_000, 9_999, 10_000, 40_000, 100_000, 1_000_000, 1e9]) {
      const dmg = mantleSwordDamage(eaten)
      expect(dmg).toBeGreaterThanOrEqual(prev)
      prev = dmg
    }
  })

  it('never drops below base for negative/garbage lifetimes (clamped at 0)', () => {
    expect(mantleSwordDamage(-1)).toBe(base)
    expect(mantleSwordDamage(-1e9)).toBe(base)
  })

  it('always returns a clean integer (floored)', () => {
    for (const eaten of [1, 12_345, 55_555, 999_999]) {
      expect(Number.isInteger(mantleSwordDamage(eaten))).toBe(true)
    }
  })

  it('the equipped mantle sword reports the SCALED damage through playerQuestWeapons', () => {
    const [w] = playerQuestWeapons(withMantleAndEaten(9 * MANTLE_SWORD_SCALE_DIVISOR))
    expect(w?.id).toBe(MANTLE_SWORD.id)
    expect(w?.damage).toBe(base + 3)
    // reach + speed are the item's fixed stats — only the weight behind it grows.
    expect(w?.range).toBe(MANTLE_SWORD.weapon!.range)
    expect(w?.cooldownMs).toBe(MANTLE_SWORD.weapon!.cooldownMs)
  })

  it('only the mantle sword scales — every other weapon is fixed regardless of lifetime', () => {
    const glutton = { ...withWeapon('ironSword'), lifetimeCandiesEaten: 1e9 }
    const [w] = playerQuestWeapons(glutton)
    expect(w?.damage).toBe(5) // iron sword's fixed damage, untouched by lifetime
  })
})

describe('meleeWeapon — the discrete telegraph fights read a CAPPED mantle sword (the balance hold)', () => {
  it('holds the mantle sword to the iron sword\'s damage even at a huge lifetime (all-lunge stays safe)', () => {
    const [w] = meleeWeapon(withMantleAndEaten(9 * MANTLE_SWORD_SCALE_DIVISOR)) // real-time would swing at base+3
    expect(w?.id).toBe(MANTLE_SWORD.id)
    expect(w?.damage).toBe(MANTLE_SWORD_MELEE_CAP) // 5, not 15 — the hero weight is held in the duels
    // reach + speed are untouched (only the damage is capped)
    expect(w?.range).toBe(MANTLE_SWORD.weapon!.range)
    expect(w?.cooldownMs).toBe(MANTLE_SWORD.weapon!.cooldownMs)
  })

  it('never lets the cap exceed the true scaled damage (min of the two)', () => {
    // At zero lifetime the base (12) is already above the cap, so the cap always binds for the mantle sword.
    const [w] = meleeWeapon(withMantleAndEaten(0))
    expect(w?.damage).toBe(MANTLE_SWORD_MELEE_CAP)
  })

  it('does NOT cap any other weapon — only the mantle sword is held', () => {
    expect(meleeWeapon(withWeapon('jawbreakerMace'))[0]?.damage).toBe(8) // mace unchanged
    expect(meleeWeapon(withWeapon('ironSword'))[0]?.damage).toBe(5)
    expect(meleeWeapon(withWeapon(null))).toEqual([BARE_HANDS])
  })

  it('the mantle sword swings at its FULL scaled damage in real-time combat (playerQuestWeapons, uncapped)', () => {
    const big = withMantleAndEaten(9 * MANTLE_SWORD_SCALE_DIVISOR)
    expect(playerQuestWeapons(big)[0]?.damage).toBe(MANTLE_SWORD.weapon!.damage + 3) // uncapped: 15
    expect(meleeWeapon(big)[0]?.damage).toBe(MANTLE_SWORD_MELEE_CAP) // capped: 5
  })
})
