import {
  deriveReflectionWeapon,
  createReflectionFight,
  cutFor,
  mirrorCutDamage,
  reflectionOutcome,
  resolveReflectionExchange,
  reflectionDefeated,
  paradoxPinOwned,
  maxHats,
  secondHat,
  equipSecondHat,
  unequipSecondHat,
  canBrewMirrorPotion,
  hasMirrorPotion,
  brewMirrorPotion,
  drinkMirrorPotion,
  grantReflectionReward,
  mirrorMaxHp,
  totalGummyCount,
  type ReflectionState,
  type ReflectionAction,
} from '@/engine/content/reflectionFight'
import {
  REFLECTION_BASE_HP,
  HP_PER_GUMMY,
  RIPOSTE_FACTOR,
  LUNGE_FACTOR,
  MAX_TURNS,
  CUT_PATTERN,
} from '@/content/potion/reflectionFight'
import {
  REFLECTION_DEFEATED_FLAG,
  PARADOX_PIN_OWNED_FLAG,
  HAT_TWO_KEY,
} from '@/content/flags'
import {
  SUGAR_GLASS_SHARD,
  MIRROR_POTION,
  PARADOX_PIN,
  KRAKEN_CROWN,
  FISHBOWL_HELM,
} from '@/content/items/items'
import {
  GUMMY_WORM_COUNT_KEY,
  GUMMY_FUSED_COUNT_KEY,
  GUMMY_MINT_FUSED_COUNT_KEY,
} from '@/content/gummy/molds'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { addResource } from '@/engine/types/Resource'
import type { GameState } from '@/engine/types/GameState'

/** A save with the given weapon equipped (the fight reads only the equipped hand weapon). */
const withWeapon = (weaponId: string | null): GameState => ({
  ...createDefaultSave(),
  equipped: { ...createDefaultSave().equipped, weapon: weaponId },
})

/** A save with the given gummy army sizes set in numbers (both sides get the bonus HP). */
const withArmy = (worm: number, fused = 0, mintFused = 0, weaponId: string | null = 'ironSword'): GameState => ({
  ...withWeapon(weaponId),
  numbers: {
    ...createDefaultSave().numbers,
    [GUMMY_WORM_COUNT_KEY]: worm,
    [GUMMY_FUSED_COUNT_KEY]: fused,
    [GUMMY_MINT_FUSED_COUNT_KEY]: mintFused,
  },
})

/** Own a set of items (their id + saveFlag), optionally with a primary hat equipped. */
const owning = (
  items: readonly { id: string; saveFlag: string }[],
  hat: string | null = null,
): GameState => {
  const base = createDefaultSave()
  const ownedItems = { ...base.ownedItems }
  const flags = { ...base.flags }
  for (const it of items) {
    ownedItems[it.id] = true
    flags[it.saveFlag] = true
  }
  return { ...base, ownedItems, flags, equipped: { ...base.equipped, hat } }
}

/** The guard that reads the ACTUAL cut line on a given turn (perfect play — never fooled by a feint). */
const correctGuard = (turn: number): ReflectionAction =>
  cutFor(turn).line === 'high' ? 'guard-high' : 'guard-low'
/** The guard a tell-reader makes (guards the telegraphed line — wrong on a feint). */
const tellGuard = (turn: number): ReflectionAction =>
  cutFor(turn).tell === 'high' ? 'guard-high' : 'guard-low'

const playOut = (
  start: ReflectionState,
  choose: (s: ReflectionState) => ReflectionAction,
): ReflectionState => {
  let s = start
  for (let i = 0; i < 200 && reflectionOutcome(s) === null; i++) s = resolveReflectionExchange(s, choose(s))
  return s
}

/** Best reachable final HP via perfect play (knows each cut: guard-correct or lunge); -Infinity if no win. */
const bestFinalHp = (start: ReflectionState): number => {
  const memo = new Map<string, number>()
  const search = (s: ReflectionState): number => {
    const o = reflectionOutcome(s)
    if (o === 'won') return s.yourHp
    if (o === 'lost') return -Infinity
    const key = `${s.yourHp}|${s.foeHp}|${s.turn}`
    const cached = memo.get(key)
    if (cached !== undefined) return cached
    const r = Math.max(
      search(resolveReflectionExchange(s, correctGuard(s.turn))),
      search(resolveReflectionExchange(s, 'lunge')),
    )
    memo.set(key, r)
    return r
  }
  return search(start)
}

describe('the reflection — a symmetric mirror of the player', () => {
  it('derives damage off the equipped weapon; a fast weapon strikes twice; bare hands the minimum', () => {
    expect(deriveReflectionWeapon(withWeapon('jawbreakerMace'))).toEqual({ damage: 8, strikes: 1 })
    expect(deriveReflectionWeapon(withWeapon('licoriceWhip'))).toEqual({ damage: 3, strikes: 2 })
    expect(deriveReflectionWeapon(withWeapon(null))).toEqual({ damage: 1, strikes: 1 })
  })

  it('opens both sides at the SAME HP (base + gummy army) — a fair mirror by construction', () => {
    const s = createReflectionFight(withWeapon('ironSword'))
    expect(s.yourHp).toBe(REFLECTION_BASE_HP)
    expect(s.foeHp).toBe(REFLECTION_BASE_HP)
    expect(s.yourHp).toBe(s.foeHp)
    expect(s.turn).toBe(0)
    expect(reflectionOutcome(s)).toBeNull()
  })

  it('the gummy army raises BOTH pools identically (worm + sour-fused + mint-fused)', () => {
    const st = withArmy(3, 2, 1) // 6 gummies total
    expect(totalGummyCount(st)).toBe(6)
    const expected = REFLECTION_BASE_HP + HP_PER_GUMMY * 6
    expect(mirrorMaxHp(st)).toBe(expected)
    const f = createReflectionFight(st)
    expect(f.yourHp).toBe(expected)
    expect(f.foeHp).toBe(expected) // the mirror scales with you — always equal
  })

  it('loops the cut pattern by turn', () => {
    expect(cutFor(0)).toEqual(CUT_PATTERN[0])
    expect(cutFor(CUT_PATTERN.length)).toEqual(CUT_PATTERN[0]) // wraps
    expect(cutFor(CUT_PATTERN.length + 5)).toEqual(CUT_PATTERN[5])
  })
})

describe('the reflection — the exchange', () => {
  it('a correct guard blocks clean and ripostes (no HP lost, foe chipped)', () => {
    const s = createReflectionFight(withWeapon('ironSword')) // damage 5, strikes 1
    const next = resolveReflectionExchange(s, correctGuard(0))
    expect(next.yourHp).toBe(s.yourHp) // blocked clean
    expect(next.foeHp).toBe(s.foeHp - RIPOSTE_FACTOR * 5 * 1)
  })

  it('a mis-read guard (or a feint) eats the full cut and ripostes nothing', () => {
    const s = createReflectionFight(withWeapon('ironSword'))
    const wrong = correctGuard(0) === 'guard-high' ? 'guard-low' : 'guard-high'
    const next = resolveReflectionExchange(s, wrong)
    expect(next.foeHp).toBe(s.foeHp) // no riposte
    expect(next.yourHp).toBe(s.yourHp - mirrorCutDamage(cutFor(0), s.weapon))
  })

  it('a lunge hits hard but the mirror\'s cut always lands (an even trade)', () => {
    const s = createReflectionFight(withWeapon('ironSword'))
    const next = resolveReflectionExchange(s, 'lunge')
    expect(next.foeHp).toBe(s.foeHp - LUNGE_FACTOR * 5 * 1)
    expect(next.yourHp).toBe(s.yourHp - mirrorCutDamage(cutFor(0), s.weapon))
  })

  it('is immutable and a no-op (same reference) once the duel is over', () => {
    const s = createReflectionFight(withWeapon('ironSword'))
    expect(resolveReflectionExchange(s, 'lunge')).not.toBe(s)
    expect(s.foeHp).toBe(REFLECTION_BASE_HP) // original untouched

    const done = playOut(createReflectionFight(withWeapon('ironSword')), (st) => correctGuard(st.turn))
    if (reflectionOutcome(done) !== null) expect(resolveReflectionExchange(done, 'lunge')).toBe(done)
  })

  it('scores the outcome: YOUR-down loses first (the mirror does not blink), foe down wins, the clock loses', () => {
    const base = createReflectionFight(withWeapon('ironSword'))
    expect(reflectionOutcome({ ...base, yourHp: 0 })).toBe('lost')
    expect(reflectionOutcome({ ...base, foeHp: 0, yourHp: 0 })).toBe('lost') // dead-even trade -> the mirror wins
    expect(reflectionOutcome({ ...base, foeHp: 0 })).toBe('won')
    expect(reflectionOutcome({ ...base, turn: MAX_TURNS })).toBe('lost') // wore you out
    expect(reflectionOutcome(base)).toBeNull()
  })
})

// The balance contract (grid-searched against the real engine): the mirror is SYMMETRIC, so a bigger blade never
// wins by being bigger — it only makes a bigger mirror. Naive all-LUNGE LOSES for EVERY build (greed is a dead-
// even trade the mirror wins); naive guard-by-the-TELL LOSES (you must read the feints); a maxed build makes a
// maxed mirror that is STILL winnable (never trivial); and clean reads win at every build, bare hands included
// (it is a fair fight — the READ is the whole game). Tuning lives in content/potion/reflectionFight.
describe('the reflection — the balance contract', () => {
  const builds = [null, 'woodenSpoon', 'woodenSword', 'ironSword', 'licoriceWhip', 'jawbreakerMace', 'candyCaneBow']

  it('all-lunge LOSES for every build (greed is a dead-even trade the mirror wins)', () => {
    for (const id of builds) {
      const lost = playOut(createReflectionFight(withWeapon(id)), () => 'lunge')
      expect(reflectionOutcome(lost)).toBe('lost')
    }
  })

  it('guarding by the TELL (the feints) LOSES for every build — you must read the true line', () => {
    for (const id of builds) {
      const lost = playOut(createReflectionFight(withWeapon(id)), (s) => tellGuard(s.turn))
      expect(reflectionOutcome(lost)).toBe('lost')
    }
  })

  it('clean reads WIN at every build — bare hands included (a fair, winnable mirror)', () => {
    for (const id of builds) {
      expect(bestFinalHp(createReflectionFight(withWeapon(id)))).toBeGreaterThan(0)
    }
  })

  it('a maxed build makes a maxed mirror: still winnable, but all-lunge still loses (never trivial)', () => {
    // A big army swells BOTH pools; the mirror hits as hard as you. Optimal play still wins; greed still dies.
    const maxed = withArmy(40, 20, 20, 'jawbreakerMace') // 80 gummies -> a long, heavy, even duel
    expect(bestFinalHp(createReflectionFight(maxed))).toBeGreaterThan(0)
    const lost = playOut(createReflectionFight(maxed), () => 'lunge')
    expect(reflectionOutcome(lost)).toBe('lost')
    // and the two pools are equal at that scale (the mirror never falls behind)
    const f = createReflectionFight(maxed)
    expect(f.foeHp).toBe(f.yourHp)
  })

  it('at a maxed army pure all-guard is TOO SLOW on the clock — you must MIX lunges into the light feints', () => {
    // A maxed even pool cannot be ground down by riposte-chip alone inside MAX_TURNS; the optimal (mixed) line
    // wins but pure all-correct-guard runs out the clock — the read is not enough, you must also spend the
    // light feints on lunges. (Proves the fight has depth beyond "guard everything" once the army is large.)
    const big = withArmy(40, 20, 20, 'jawbreakerMace') // 80 gummies -> a long, heavy, even duel
    const guardOnly = playOut(createReflectionFight(big), (s) => correctGuard(s.turn))
    expect(reflectionOutcome(guardOnly)).toBe('lost') // chip alone times out
    expect(bestFinalHp(createReflectionFight(big))).toBeGreaterThan(0) // but the mixed line wins
  })
})

describe('the mirror potion brew — exact cost, one-shot reagent', () => {
  const shardHeld = (): GameState => {
    const s = owning([SUGAR_GLASS_SHARD])
    return { ...s, chocolate: addResource(s.chocolate, 3), candies: addResource(s.candies, 5) }
  }

  it('can brew only with the shard + a chocolate + a candy (and no potion already in hand)', () => {
    expect(canBrewMirrorPotion(createDefaultSave())).toBe(false) // no shard
    expect(canBrewMirrorPotion(shardHeld())).toBe(true)
    const broke = owning([SUGAR_GLASS_SHARD]) // no chocolate/candy
    expect(canBrewMirrorPotion(broke)).toBe(false)
  })

  it('consumes the shard + exactly one chocolate + one candy, and grants the potion', () => {
    const before = shardHeld()
    const r = brewMirrorPotion(before)
    expect(r.ok).toBe(true)
    expect(r.state.chocolate.current).toBe(before.chocolate.current - 1)
    expect(r.state.candies.current).toBe(before.candies.current - 1)
    expect(r.state.ownedItems[SUGAR_GLASS_SHARD.id]).toBe(false) // shard consumed
    expect(r.state.flags[SUGAR_GLASS_SHARD.saveFlag]).toBe(false)
    expect(hasMirrorPotion(r.state)).toBe(true)
    expect(r.state.ownedItems[MIRROR_POTION.id]).toBe(true)
  })

  it('fails (SAME reference) without the shard or when a potion is already brewed', () => {
    const noShard = createDefaultSave()
    const r1 = brewMirrorPotion(noShard)
    expect(r1.ok).toBe(false)
    expect(r1.state).toBe(noShard)

    const brewed = brewMirrorPotion(shardHeld()).state
    const shardAgain = { ...brewed, ownedItems: { ...brewed.ownedItems, [SUGAR_GLASS_SHARD.id]: true } }
    const r2 = brewMirrorPotion(shardAgain)
    expect(r2.ok).toBe(false)
    expect(r2.reason).toBe('alreadyBrewed')
    expect(r2.state).toBe(shardAgain)
  })

  it('drinking consumes the potion (a lost fight costs the draught, not the pin)', () => {
    const brewed = brewMirrorPotion(shardHeld()).state
    expect(hasMirrorPotion(brewed)).toBe(true)
    const drunk = drinkMirrorPotion(brewed)
    expect(hasMirrorPotion(drunk)).toBe(false)
    expect(drinkMirrorPotion(drunk)).toBe(drunk) // no-op once empty (SAME ref)
  })
})

describe('the reflection reward — commit-once paradox pin', () => {
  it('reads the defeated flag (commit-once)', () => {
    expect(reflectionDefeated(createDefaultSave())).toBe(false)
    const done: GameState = { ...createDefaultSave(), flags: { [REFLECTION_DEFEATED_FLAG]: true } }
    expect(reflectionDefeated(done)).toBe(true)
  })

  it('grants the pin + sets the flag exactly once; a second call is SAME ref (farm-proof)', () => {
    const before = createDefaultSave()
    const after = grantReflectionReward(before)
    expect(after.flags[REFLECTION_DEFEATED_FLAG]).toBe(true)
    expect(after.ownedItems[PARADOX_PIN.id]).toBe(true)
    expect(after.flags[PARADOX_PIN.saveFlag]).toBe(true)
    expect(paradoxPinOwned(after)).toBe(true)
    // second call: nothing changes, SAME reference
    expect(grantReflectionReward(after)).toBe(after)
  })
})

describe('the paradox pin — the two-hat rule', () => {
  it('permits exactly one hat without the pin, two with it', () => {
    expect(maxHats(createDefaultSave())).toBe(1)
    const pinned: GameState = { ...createDefaultSave(), flags: { [PARADOX_PIN_OWNED_FLAG]: true } }
    expect(maxHats(pinned)).toBe(2)
  })

  it('equips a second owned hat only with the pin; rides the strings passthrough', () => {
    // own both hats + the pin, kraken crown as the primary
    const s = owning([KRAKEN_CROWN, FISHBOWL_HELM, PARADOX_PIN], KRAKEN_CROWN.id)
    expect(secondHat(s)).toBeNull()
    const r = equipSecondHat(s, FISHBOWL_HELM.id)
    expect(r.ok).toBe(true)
    expect(r.state.strings[HAT_TWO_KEY]).toBe(FISHBOWL_HELM.id)
    expect(secondHat(r.state)).toBe(FISHBOWL_HELM.id)
    expect(r.state.equipped.hat).toBe(KRAKEN_CROWN.id) // primary untouched
  })

  it('refuses a second hat without the pin, for a non-hat, an unowned item, or the primary hat', () => {
    const noPin = owning([KRAKEN_CROWN, FISHBOWL_HELM], KRAKEN_CROWN.id)
    expect(equipSecondHat(noPin, FISHBOWL_HELM.id).reason).toBe('noPin')

    const pinned = owning([KRAKEN_CROWN, FISHBOWL_HELM, PARADOX_PIN], KRAKEN_CROWN.id)
    expect(equipSecondHat(pinned, 'ironSword').reason).toBe('notOwned') // not owned + not a hat
    expect(equipSecondHat(pinned, KRAKEN_CROWN.id).reason).toBe('sameAsPrimary') // no wearing the same hat twice
    // an owned non-hat (the pin itself) is refused as notAHat
    expect(equipSecondHat(pinned, PARADOX_PIN.id).reason).toBe('notAHat')
  })

  it('never exceeds two hats and unequips the second cleanly', () => {
    const pinned = owning([KRAKEN_CROWN, FISHBOWL_HELM, PARADOX_PIN], KRAKEN_CROWN.id)
    const two = equipSecondHat(pinned, FISHBOWL_HELM.id).state
    // primary + second = two distinct hats, never more
    expect(new Set([two.equipped.hat, secondHat(two)]).size).toBe(2)
    const cleared = unequipSecondHat(two)
    expect(cleared.ok).toBe(true)
    expect(secondHat(cleared.state)).toBeNull()
    expect(unequipSecondHat(cleared.state).state).toBe(cleared.state) // no-op once empty
  })
})
