import {
  createStarEater,
  createBroadside,
  createOnFoot,
  onFootOutcome,
  resolveOnFoot,
  createCore,
  advancePhase,
  forfeit,
  starEaterDefeated,
  starEaterAvailable,
  eaterCounterShown,
  shouldShowEaterCounter,
  markEaterCounterShown,
  winStarEater,
} from '@/engine/content/starEater'
import { resolveManeuver, duelOutcome, type DuelState, type Maneuver } from '@/engine/content/shipDuel'
import {
  cutFor,
  type BoardingState,
  type BoardingAction,
} from '@/engine/content/boardingDuel'
import {
  resolveCoreTurn,
  coreOutcome,
  clawFor,
  type CoreDefenseState,
  type CoreAction,
} from '@/engine/content/coreDefense'
import {
  GALLEON_HULL_KEY,
  GALLEON_SAILS_KEY,
  GALLEON_CANNON_KEY,
} from '@/content/ship/galleonUpgrade'
import { RANGE_CLOSE } from '@/content/ship/shipDuel'
import { EATER_SHIP_HP, EATER_ONFOOT_HP, CORE_EATER_HP, EATER_STAR_COUNT } from '@/content/sun/starEater'
import {
  STAR_EATER_DEFEATED_FLAG,
  EATER_COUNTER_SHOWN_FLAG,
  SOLAR_DRAGON_MET_FLAG,
} from '@/content/flags'
import { createDefaultSave } from '@/engine/state/defaultSave'
import type { GameState } from '@/engine/types/GameState'

// ---------- save builders ----------

/** A save with the given yard tiers (the broadside phase reads these via shipDuel.deriveStats). */
const withShip = (hull: number, cannon: number, sail: number): GameState => ({
  ...createDefaultSave(),
  numbers: { [GALLEON_HULL_KEY]: hull, [GALLEON_CANNON_KEY]: cannon, [GALLEON_SAILS_KEY]: sail },
})
const MAXED = withShip(3, 3, 3)
const BASE = withShip(1, 1, 1)

/** A save with the given weapon equipped (phases 2 + 3 read the equipped hand weapon). */
const withWeapon = (weaponId: string | null): GameState => ({
  ...createDefaultSave(),
  equipped: { ...createDefaultSave().equipped, weapon: weaponId },
})

// ---------- phase 1 (broadside) drivers — the shipDuel sim ----------

const playDuel = (start: DuelState, choose: (s: DuelState) => Maneuver): DuelState => {
  let s = start
  for (let i = 0; i < 50 && duelOutcome(s) === null; i++) s = resolveManeuver(s, choose(s))
  return s
}
const bestDuelHp = (start: DuelState): number => {
  const memo = new Map<string, number>()
  const search = (s: DuelState): number => {
    const o = duelOutcome(s)
    if (o === 'won') return s.yourHp
    if (o === 'lost') return -Infinity
    const key = `${s.yourHp.toFixed(2)}|${s.foeHp.toFixed(2)}|${s.range}|${s.round}`
    const cached = memo.get(key)
    if (cached !== undefined) return cached
    const r = Math.max(
      search(resolveManeuver(s, 'press')),
      search(resolveManeuver(s, 'hold')),
      search(resolveManeuver(s, 'veer')),
    )
    memo.set(key, r)
    return r
  }
  return search(start)
}

// ---------- phase 2 (on foot) drivers — the boardingDuel sim ----------

const correctGuard = (turn: number): BoardingAction =>
  cutFor(turn).line === 'high' ? 'guard-high' : 'guard-low'
const tellGuard = (turn: number): BoardingAction =>
  cutFor(turn).tell === 'high' ? 'guard-high' : 'guard-low'
// The finale reuses the boarding sim on its OWN longer clock; drive it through the finale wrappers
// (onFootOutcome / resolveOnFoot) so the phase-2 contract is checked on the timer the player actually plays.
const playBoarding = (
  start: BoardingState,
  choose: (s: BoardingState) => BoardingAction,
): BoardingState => {
  let s = start
  for (let i = 0; i < 200 && onFootOutcome(s) === null; i++) s = resolveOnFoot(s, choose(s))
  return s
}
const bestBoardingHp = (start: BoardingState): number => {
  const memo = new Map<string, number>()
  const search = (s: BoardingState): number => {
    const o = onFootOutcome(s)
    if (o === 'won') return s.yourHp
    if (o === 'lost') return -Infinity
    const key = `${s.yourHp}|${s.foeHp}|${s.turn}`
    const cached = memo.get(key)
    if (cached !== undefined) return cached
    const r = Math.max(search(resolveOnFoot(s, correctGuard(s.turn))), search(resolveOnFoot(s, 'lunge')))
    memo.set(key, r)
    return r
  }
  return search(start)
}

// ---------- phase 3 (core) drivers — the coreDefense sim ----------

const coreGuard = (turn: number): CoreAction =>
  clawFor(turn).line === 'high' ? 'guard-high' : 'guard-low'
const playCore = (start: CoreDefenseState, choose: (s: CoreDefenseState) => CoreAction): CoreDefenseState => {
  let s = start
  for (let i = 0; i < 200 && coreOutcome(s) === null; i++) s = resolveCoreTurn(s, choose(s))
  return s
}
const bestCoreHp = (start: CoreDefenseState): number => {
  const memo = new Map<string, number>()
  const search = (s: CoreDefenseState): number => {
    const o = coreOutcome(s)
    if (o === 'won') return s.yourHp
    if (o === 'lost') return -Infinity
    const key = `${s.yourHp}|${s.eggHp}|${s.eaterHp}|${s.turn}`
    const cached = memo.get(key)
    if (cached !== undefined) return cached
    const r = Math.max(search(resolveCoreTurn(s, coreGuard(s.turn))), search(resolveCoreTurn(s, 'strike')))
    memo.set(key, r)
    return r
  }
  return search(start)
}

// =====================================================================

describe('the star-eater — phase construction reuses the existing engines', () => {
  it('phase 1 builds a DuelState off the galleon tiers vs the fresh eater foe (NOT Sourbeard numbers)', () => {
    const d = createBroadside(MAXED)
    expect(d.foeHp).toBe(EATER_SHIP_HP)
    expect(d.foeMaxHp).toBe(EATER_SHIP_HP)
    // your stats come from the maxed yard (hull t3 -> 112 HP, cannon t3 -> 24 dmg, sail t3 -> 0.64 evasion)
    expect(d.yourHp).toBe(112)
    expect(d.stats.damage).toBe(24)
    expect(d.stats.fullSlip).toBe(true)
    expect(duelOutcome(d)).toBeNull()
  })

  it('phase 2 builds a BoardingState off the equipped weapon at the higher eater HP', () => {
    const b = createOnFoot(withWeapon('ironSword'))
    expect(b.foeHp).toBe(EATER_ONFOOT_HP)
    expect(b.weapon).toEqual({ damage: 5, strikes: 1 })
    expect(onFootOutcome(b)).toBeNull()
  })

  it('phase 3 builds a core defense off the equipped weapon', () => {
    const c = createCore(withWeapon('jawbreakerMace'))
    expect(c.eaterHp).toBe(CORE_EATER_HP)
    expect(c.weapon).toEqual({ damage: 8, strikes: 1 })
    expect(coreOutcome(c)).toBeNull()
  })
})

describe('the star-eater — the phase cursor', () => {
  it('starts at the broadside, neither won nor lost', () => {
    const p = createStarEater()
    expect(p).toEqual({ phase: 'broadside', won: false, lost: false })
  })

  it('advances broadside -> onFoot -> core -> won on each phase win', () => {
    let p = createStarEater()
    p = advancePhase(p)
    expect(p.phase).toBe('onFoot')
    p = advancePhase(p)
    expect(p.phase).toBe('core')
    p = advancePhase(p)
    expect(p).toEqual({ phase: 'core', won: true, lost: false })
  })

  it('forfeits the whole fight on any phase loss (transient — restarts)', () => {
    const lost = forfeit(createStarEater())
    expect(lost.lost).toBe(true)
    expect(lost.won).toBe(false)
  })

  it('advance / forfeit are no-ops (same reference) once terminal', () => {
    const won = advancePhase(advancePhase(advancePhase(createStarEater())))
    expect(advancePhase(won)).toBe(won)
    expect(forfeit(won)).toBe(won)
    const lost = forfeit(createStarEater())
    expect(forfeit(lost)).toBe(lost)
    expect(advancePhase(lost)).toBe(lost)
  })
})

describe('the star-eater — availability + the commit-once win', () => {
  it('is available once the solar dragon is met and not yet defeated', () => {
    expect(starEaterAvailable(createDefaultSave())).toBe(false)
    const met: GameState = { ...createDefaultSave(), flags: { [SOLAR_DRAGON_MET_FLAG]: true } }
    expect(starEaterAvailable(met)).toBe(true)
    const done: GameState = {
      ...createDefaultSave(),
      flags: { [SOLAR_DRAGON_MET_FLAG]: true, [STAR_EATER_DEFEATED_FLAG]: true },
    }
    expect(starEaterAvailable(done)).toBe(false)
  })

  it('winStarEater sets the defeated flag once, then is a no-op (same reference)', () => {
    const before = createDefaultSave()
    expect(starEaterDefeated(before)).toBe(false)
    const after = winStarEater(before)
    expect(starEaterDefeated(after)).toBe(true)
    expect(after.flags[STAR_EATER_DEFEATED_FLAG]).toBe(true)
    expect(winStarEater(after)).toBe(after) // commit-once: SAME reference
  })

  it('the win flag persists through the flags z.record (no schema bump — it is a flag)', () => {
    const after = winStarEater(createDefaultSave())
    expect(after.flags[STAR_EATER_DEFEATED_FLAG]).toBe(true)
  })
})

describe('the star-eater — the §286 mid-fight reveal (made exactly once)', () => {
  it('fires only at the phase-2 -> phase-3 boundary, and never twice', () => {
    const fresh = createDefaultSave()
    // not at the core phase yet -> not shown
    expect(shouldShowEaterCounter(createStarEater(), fresh)).toBe(false)
    expect(shouldShowEaterCounter(advancePhase(createStarEater()), fresh)).toBe(false) // onFoot
    // at the core phase, latch unset -> show
    const atCore = advancePhase(advancePhase(createStarEater()))
    expect(atCore.phase).toBe('core')
    expect(shouldShowEaterCounter(atCore, fresh)).toBe(true)
    // once latched -> never again
    const shown = markEaterCounterShown(fresh)
    expect(eaterCounterShown(shown)).toBe(true)
    expect(shouldShowEaterCounter(atCore, shown)).toBe(false)
  })

  it('does not fire on a won or lost cursor (only the live boundary)', () => {
    const fresh = createDefaultSave()
    const won = advancePhase(advancePhase(advancePhase(createStarEater())))
    expect(shouldShowEaterCounter(won, fresh)).toBe(false)
    const lostAtCore = forfeit(advancePhase(advancePhase(createStarEater())))
    expect(shouldShowEaterCounter(lostAtCore, fresh)).toBe(false)
  })

  it('markEaterCounterShown is commit-once (same reference once set)', () => {
    const shown = markEaterCounterShown(createDefaultSave())
    expect(shown.flags[EATER_COUNTER_SHOWN_FLAG]).toBe(true)
    expect(markEaterCounterShown(shown)).toBe(shown)
  })

  it('the eater star count is the §286 figure (content data, exactly one above the opening sky read)', () => {
    expect(EATER_STAR_COUNT).toBe(8101)
  })
})

// =====================================================================
// THE BALANCE CONTRACT (grid-searched per phase against the REAL reused engines). The three phases read the
// three stat axes the game built (ship tiers, the weapon ladder, the read). The contract: naive play LOSES
// each phase, and the FULL KIT (maxed hull/cannon/sail + a forged blade) is REQUIRED to clear all three.

describe('the star-eater — phase 1 balance: the broadside reads the maxed ship tiers', () => {
  // The intuitive winning play — fight at MID range, veer off if the foe drifts to deadly point-blank.
  const tactical = (s: DuelState): Maneuver => (s.range > 1 ? 'veer' : s.range < 1 ? 'press' : 'hold')

  it('the base/low galleon LOSES (a maxed ship is required)', () => {
    expect(bestDuelHp(createBroadside(BASE))).toBe(-Infinity)
    expect(bestDuelHp(createBroadside(withShip(2, 2, 2)))).toBe(-Infinity) // even all-tier-2 loses
    expect(bestDuelHp(createBroadside(withShip(2, 3, 2)))).toBe(-Infinity) // strong but not maxed loses
  })

  it('the BEST REACHABLE ship (all tiers buildable) clears it; sub-maxed combos lose', () => {
    // MAXED = (3,3,3) is now actually buildable: cannon t3 (the nougat bombard) was un-deferred for the
    // finale (review) with a real price + unlockFlag (galleonUpgrade), mirroring the solar sails. So this
    // asserts REAL winnability with the best ship a player can build, not a config nobody can reach.
    expect(bestDuelHp(createBroadside(MAXED))).toBeGreaterThan(0)
    // The cannon is the binding DPS axis: drop it to tier 2 (with hull + sails maxed) and you cannot out-
    // gun the eater inside the boarding clock — a strict loss (the comet-and-beyond gun ladder must be maxed).
    expect(bestDuelHp(createBroadside(withShip(3, 2, 3)))).toBe(-Infinity)
    // And any further drop (a second axis below max) loses too — the maxed kit is the practical requirement.
    expect(bestDuelHp(createBroadside(withShip(2, 3, 2)))).toBe(-Infinity)
    expect(bestDuelHp(createBroadside(withShip(2, 2, 2)))).toBe(-Infinity)
  })

  it('the maxed ship can win with the intuitive mid-range tactical line', () => {
    expect(duelOutcome(playDuel(createBroadside(MAXED), tactical))).toBe('won')
  })

  it('naive aggression (charge to point-blank) is a trap even for the maxed ship', () => {
    const pressSpam = (s: DuelState): Maneuver => (s.range < RANGE_CLOSE ? 'press' : 'hold')
    expect(duelOutcome(playDuel(createBroadside(MAXED), pressSpam))).toBe('lost')
  })
})

describe('the star-eater — phase 2 balance: the on-foot climax reads the equipped weapon', () => {
  it('cannot be won bare-handed or with the bow (a real forged blade is required)', () => {
    expect(bestBoardingHp(createOnFoot(withWeapon(null)))).toBe(-Infinity)
    expect(bestBoardingHp(createOnFoot(withWeapon('candyCaneBow')))).toBe(-Infinity)
  })

  // The naive-loses contract covers the FULL forged arsenal — the mace and the whip included, not just the
  // weak blades (the Inc-20 durable lesson: a grid-search that omits the bait build proves nothing about it).
  // Kept in lock-step with the wins-with-reads list below so a future weapon can't slip the gate (review).
  // The mantle sword (hero-tier, base damage 12) is included: it is HELD to the iron sword's damage inside
  // the discrete fights via meleeWeapon (MANTLE_SWORD_MELEE_CAP), so its raw weight/scaling cannot let naive
  // play brute past the read — an uncapped mantle sword all-lunge WINS (durable Inc-21 lesson: re-run the
  // grid-search when a new weapon touches a tuned fight).
  const FORGED_BLADES = ['woodenSword', 'ironSword', 'licoriceWhip', 'jawbreakerMace', 'popRockPike', 'mantleSword']

  it('punishes naive guard-by-the-tell for EVERY forged blade (you must read the feints)', () => {
    for (const id of FORGED_BLADES) {
      expect(onFootOutcome(playBoarding(createOnFoot(withWeapon(id)), (s) => tellGuard(s.turn)))).toBe('lost')
    }
  })

  it('punishes pure aggression (all-lunge) for EVERY forged blade — the mace and whip too', () => {
    for (const id of FORGED_BLADES) {
      expect(onFootOutcome(playBoarding(createOnFoot(withWeapon(id)), () => 'lunge'))).toBe('lost')
    }
  })

  it('the mantle sword all-lunge loses even at a huge lifetime (the melee cap holds regardless of scaling)', () => {
    const glutton: GameState = { ...withWeapon('mantleSword'), lifetimeCandiesEaten: 1e9 }
    expect(onFootOutcome(playBoarding(createOnFoot(glutton), () => 'lunge'))).toBe('lost')
  })

  it('lets each forged blade win with clean reads', () => {
    for (const id of FORGED_BLADES) {
      expect(bestBoardingHp(createOnFoot(withWeapon(id)))).toBeGreaterThan(0)
    }
  })
})

describe('the star-eater — phase 3 balance: the core defense reads the equipped weapon', () => {
  it('cannot be won bare-handed or with the bow (a real forged blade is required)', () => {
    expect(bestCoreHp(createCore(withWeapon(null)))).toBe(-Infinity)
    expect(bestCoreHp(createCore(withWeapon('candyCaneBow')))).toBe(-Infinity)
  })

  it('punishes naive all-strike for EVERY forged blade — the mace and whip too (you must guard the egg)', () => {
    // The mantle sword is included and held to the iron sword's damage inside the fight (MANTLE_SWORD_MELEE_CAP),
    // so even the hero blade's all-striker loses the egg — its scaling cannot brute the core (durable Inc-21).
    for (const id of ['woodenSword', 'ironSword', 'licoriceWhip', 'jawbreakerMace', 'popRockPike', 'mantleSword']) {
      expect(coreOutcome(playCore(createCore(withWeapon(id)), () => 'strike'))).toBe('lost')
    }
  })

  it('the mantle sword all-strike loses even at a huge lifetime (the melee cap holds regardless of scaling)', () => {
    const glutton: GameState = { ...withWeapon('mantleSword'), lifetimeCandiesEaten: 1e9 }
    expect(coreOutcome(playCore(createCore(glutton), () => 'strike'))).toBe('lost')
  })

  it('lets each forged blade win with clean reads', () => {
    for (const id of ['woodenSword', 'ironSword', 'licoriceWhip', 'jawbreakerMace', 'popRockPike', 'mantleSword']) {
      expect(bestCoreHp(createCore(withWeapon(id)))).toBeGreaterThan(0)
    }
  })
})

describe('the star-eater — the FULL KIT is required across all three phases (not merely helpful)', () => {
  it('a base ship with a forged blade still loses phase 1; a maxed ship with bare hands still loses phase 2+3', () => {
    // The ship tiers cannot be substituted by the blade (phase 1 reads only the ship):
    expect(bestDuelHp(createBroadside(BASE))).toBe(-Infinity)
    // The blade cannot be substituted by the ship (phases 2+3 read only the weapon):
    expect(bestBoardingHp(createOnFoot(withWeapon(null)))).toBe(-Infinity)
    expect(bestCoreHp(createCore(withWeapon(null)))).toBe(-Infinity)
  })

  it('the maxed ship + a forged blade clears every phase (the full kit wins)', () => {
    expect(bestDuelHp(createBroadside(MAXED))).toBeGreaterThan(0)
    for (const id of ['woodenSword', 'ironSword', 'licoriceWhip', 'jawbreakerMace', 'popRockPike', 'mantleSword']) {
      expect(bestBoardingHp(createOnFoot(withWeapon(id)))).toBeGreaterThan(0)
      expect(bestCoreHp(createCore(withWeapon(id)))).toBeGreaterThan(0)
    }
  })
})
