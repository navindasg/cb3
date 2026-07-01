import {
  fossilStarIgnited,
  canAwakenFossil,
  igniteFossilStar,
  deriveNewbornWeapon,
  createNewbornFight,
  newbornOutcome,
  resolveNewborn,
  type NewbornState,
  type NewbornAction,
} from '@/engine/content/fossilStar'
import {
  FOSSIL_STAR_COST,
  NEWBORN_HP,
  NEWBORN_PLAYER_HP,
  NEWBORN_MAX_TURNS,
  NEWBORN_FAST_COOLDOWN_MS,
} from '@/content/mines/fossilStar'
import {
  FOSSIL_STAR_IGNITED_FLAG,
  ENDING_CHOSEN_FLAG,
  ENDING_HATCH,
  ENDING_FEED,
  ENDING_EAT,
} from '@/content/flags'
import { STARTING_STARS } from '@/engine/content/starCounter'
import { addResource } from '@/engine/types/Resource'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { beginDarkSave } from '@/engine/state/newGamePlus'
import { chooseHatch } from '@/engine/content/endings'
import type { GameState } from '@/engine/types/GameState'

/** A post-game save (an ending chosen) holding `stardust`, no fossil ignited yet. */
const postGame = (stardust: number, over: Partial<GameState> = {}): GameState => {
  const s = createDefaultSave()
  return {
    ...s,
    strings: { ...s.strings, [ENDING_CHOSEN_FLAG]: ENDING_HATCH },
    stardust: addResource(s.stardust, stardust),
    ...over,
  }
}

/** A save with the given weapon equipped (the dance reads only the equipped hand weapon). */
const withWeapon = (weaponId: string | null): GameState => ({
  ...createDefaultSave(),
  equipped: { ...createDefaultSave().equipped, weapon: weaponId },
})

// ============================================================================
// canAwakenFossil — the post-game 1000-stardust gate (never on the main spine)
// ============================================================================

describe('canAwakenFossil — post-game only, 1000 stardust', () => {
  it('is shut on a fresh save (no ending chosen, no stardust)', () => {
    expect(canAwakenFossil(createDefaultSave())).toBe(false)
  })

  it('is shut mid-spine even with 1000 stardust when NO ending is chosen (never blocks the spine)', () => {
    const s = { ...createDefaultSave(), stardust: addResource(createDefaultSave().stardust, FOSSIL_STAR_COST) }
    expect(typeof s.strings[ENDING_CHOSEN_FLAG]).not.toBe('string')
    expect(canAwakenFossil(s)).toBe(false)
  })

  it('is shut post-game when short the stardust (999 is not enough)', () => {
    expect(canAwakenFossil(postGame(FOSSIL_STAR_COST - 1))).toBe(false)
  })

  it('opens post-game with EXACTLY 1000 stardust', () => {
    expect(canAwakenFossil(postGame(FOSSIL_STAR_COST))).toBe(true)
  })

  it('opens post-game with more than 1000 stardust', () => {
    expect(canAwakenFossil(postGame(FOSSIL_STAR_COST + 5000))).toBe(true)
  })

  it('opens for EVERY chosen ending (hatch / feed / eat)', () => {
    for (const ending of [ENDING_HATCH, ENDING_FEED, ENDING_EAT]) {
      const s = postGame(FOSSIL_STAR_COST, { strings: { [ENDING_CHOSEN_FLAG]: ending } })
      expect(canAwakenFossil(s)).toBe(true)
    }
  })

  it('is shut once the fossil is already ignited (post-game, funded)', () => {
    const s = postGame(FOSSIL_STAR_COST, { flags: { [FOSSIL_STAR_IGNITED_FLAG]: true } })
    expect(canAwakenFossil(s)).toBe(false)
  })

  it('is SHUT on a fresh dark save — beginDarkSave leaves endingChosen unset AND resets stardust to 0', () => {
    // The true post-EAT gate state: chooseEat -> beginDarkSave starts from createDefaultSave() and carries
    // forward ONLY the lifetime totals + run counter — it does NOT carry stardust (reset to 0) and does NOT
    // stamp endingChosen (the §287 dark run must reach its own choice again). So the epilogue is NOT reachable
    // on a fresh dark save; both gate conditions fail (no ending chosen AND 0 stardust). Not a soft-lock — the
    // comet/star-sea faucets stay live to re-earn stardust, and re-beating the star-eater re-opens the choice.
    const fresh = beginDarkSave(postGame(FOSSIL_STAR_COST, { starsRemaining: 5000 }))
    expect(typeof fresh.strings[ENDING_CHOSEN_FLAG]).not.toBe('string')
    expect(fresh.stardust.current).toBe(0)
    expect(canAwakenFossil(fresh)).toBe(false)
  })

  it('is reachable in a RE-COMPLETED dark run: re-earn stardust + re-choose an ending, then it opens', () => {
    // The genuinely-reachable dark-run path (NOT carryover): replay the dark loop, re-earn 1000 stardust via the
    // still-live faucets, re-beat the star-eater and re-choose an ending (chooseHatch re-sets endingChosen) —
    // THEN the fossil accepts the stardust. Modelled by igniting on a dark save that has re-earned both.
    const relit = chooseHatch({
      ...beginDarkSave(postGame(FOSSIL_STAR_COST, { starsRemaining: 5000 })),
      stardust: addResource(createDefaultSave().stardust, FOSSIL_STAR_COST),
    })
    expect(typeof relit.strings[ENDING_CHOSEN_FLAG]).toBe('string') // re-chosen in the dark run
    expect(relit.flags['darkRun']).toBe(true) // still the dark run
    expect(canAwakenFossil(relit)).toBe(true)
  })
})

// ============================================================================
// igniteFossilStar — the ONE up-tick, commit-once, farm-proof
// ============================================================================

describe('igniteFossilStar — the +1 tick (commit-once, spends the stardust)', () => {
  it('spends 1000 stardust, sets the ignited flag, and ticks starsRemaining +1, all in one dispatch', () => {
    const before = postGame(FOSSIL_STAR_COST, { starsRemaining: 5000 })
    expect(fossilStarIgnited(before)).toBe(false)
    const after = igniteFossilStar(before)
    expect(after.stardust.current).toBe(0) // 1000 spent
    expect(after.starsRemaining).toBe(5001) // exactly one gained
    expect(after.flags[FOSSIL_STAR_IGNITED_FLAG]).toBe(true)
    expect(fossilStarIgnited(after)).toBe(true)
  })

  it('leaves any stardust above the cost in the hoard (spends only 1000)', () => {
    const before = postGame(FOSSIL_STAR_COST + 250, { starsRemaining: 100 })
    const after = igniteFossilStar(before)
    expect(after.stardust.current).toBe(250)
    expect(after.starsRemaining).toBe(101)
  })

  it('is commit-once: a second call returns the SAME reference (no double star, no double spend)', () => {
    const before = postGame(FOSSIL_STAR_COST + 5000, { starsRemaining: 100 })
    const once = igniteFossilStar(before)
    const twice = igniteFossilStar(once)
    expect(twice).toBe(once) // SAME reference — never re-fires
    expect(twice.starsRemaining).toBe(101) // still exactly one gained
    expect(twice.stardust.current).toBe(5000) // still only 1000 spent
  })

  it('clamps starsRemaining at STARTING_STARS (never above 8128 — the relight-clamp path)', () => {
    const before = postGame(FOSSIL_STAR_COST, { starsRemaining: STARTING_STARS })
    const after = igniteFossilStar(before)
    expect(after.starsRemaining).toBe(STARTING_STARS) // clamped, not 8129
    expect(fossilStarIgnited(after)).toBe(true) // still records the ignite + spends
    expect(after.stardust.current).toBe(0)
  })

  it('does nothing (SAME reference) when canAwakenFossil is false — no ending chosen', () => {
    const before = { ...createDefaultSave(), stardust: addResource(createDefaultSave().stardust, FOSSIL_STAR_COST) }
    const after = igniteFossilStar(before)
    expect(after).toBe(before)
    expect(fossilStarIgnited(after)).toBe(false)
  })

  it('does nothing (SAME reference) when short the stardust (post-game, 999)', () => {
    const before = postGame(FOSSIL_STAR_COST - 1)
    const after = igniteFossilStar(before)
    expect(after).toBe(before)
  })

  it('does not mutate the input state (immutability)', () => {
    const before = postGame(FOSSIL_STAR_COST, { starsRemaining: 100 })
    const starsBefore = before.starsRemaining
    const stardustBefore = before.stardust.current
    igniteFossilStar(before)
    expect(before.starsRemaining).toBe(starsBefore)
    expect(before.stardust.current).toBe(stardustBefore)
    expect(before.flags[FOSSIL_STAR_IGNITED_FLAG]).toBeUndefined()
  })

  it('is the ONLY up-tick: starsRemaining only ever INCREASES here (a gift, never loot to farm)', () => {
    const before = postGame(FOSSIL_STAR_COST, { starsRemaining: 8000 })
    const after = igniteFossilStar(before)
    expect(after.starsRemaining).toBeGreaterThan(before.starsRemaining)
    expect(after.starsRemaining - before.starsRemaining).toBe(1)
  })

  it('fires in a RE-COMPLETED dark run: the ignite works on a re-earned + re-chosen dark-run state', () => {
    // A dark run reaches the epilogue by RE-EARNING stardust and RE-choosing an ending (chooseHatch), NOT by
    // carryover — beginDarkSave never emits an ended dark save with a stardust hoard. This models that genuinely
    // -reachable state (dark save + re-earned 1000 stardust + re-chosen ending) and asserts the ignite fires on it.
    const darkSave = beginDarkSave({ ...createDefaultSave(), nGPlusRun: 0 }) // endingChosen unset, stardust 0
    const before = chooseHatch({
      ...darkSave,
      stardust: addResource(darkSave.stardust, FOSSIL_STAR_COST), // re-earned via the still-live faucets
      starsRemaining: 3000,
    })
    expect(before.flags['darkRun']).toBe(true)
    expect(before.nGPlusRun).toBe(1) // beginDarkSave bumped the run counter
    const after = igniteFossilStar(before)
    expect(after.starsRemaining).toBe(3001)
    expect(after.nGPlusRun).toBe(1) // NG+ scaffold untouched
    expect(after.flags['darkRun']).toBe(true)
  })
})

// ============================================================================
// the newborn-star dance — the optional transient fight (grid-searched)
// ============================================================================

describe('deriveNewbornWeapon — reads the equipped hand weapon', () => {
  it('derives damage off the equipped weapon; a fast weapon strikes twice', () => {
    expect(deriveNewbornWeapon(withWeapon('ironSword'))).toEqual({ damage: 5, strikes: 1 })
    // the whip (cd 350 < NEWBORN_FAST_COOLDOWN_MS 400) strikes twice
    expect(deriveNewbornWeapon(withWeapon('licoriceWhip')).strikes).toBe(2)
  })

  it('falls back to bare hands (damage 1, one strike) with nothing equipped', () => {
    expect(deriveNewbornWeapon(withWeapon(null))).toEqual({ damage: 1, strikes: 1 })
  })
})

/** Best reachable outcome via perfect play (each exchange: strike or steady); true if a win exists. */
const winnable = (start: NewbornState): boolean => {
  const memo = new Map<string, boolean>()
  const search = (s: NewbornState): boolean => {
    const o = newbornOutcome(s)
    if (o === 'won') return true
    if (o === 'lost') return false
    const key = `${s.yourHp}|${s.starHp}|${s.turn}`
    const cached = memo.get(key)
    if (cached !== undefined) return cached
    const r = search(resolveNewborn(s, 'strike')) || search(resolveNewborn(s, 'steady'))
    memo.set(key, r)
    return r
  }
  return search(start)
}

const playOut = (start: NewbornState, choose: (s: NewbornState) => NewbornAction): NewbornState => {
  let s = start
  for (let i = 0; i < 200 && newbornOutcome(s) === null; i++) s = resolveNewborn(s, choose(s))
  return s
}

describe('the newborn-star dance — the fight resolves + tiebreaks', () => {
  it('a fresh dance opens with both at full HP, turn 0', () => {
    const s = createNewbornFight(withWeapon('ironSword'))
    expect(s.yourHp).toBe(NEWBORN_PLAYER_HP)
    expect(s.starHp).toBe(NEWBORN_HP)
    expect(s.turn).toBe(0)
    expect(newbornOutcome(s)).toBeNull()
  })

  it('resolving is a no-op (SAME reference) once the fight is over', () => {
    const won: NewbornState = { ...createNewbornFight(withWeapon('ironSword')), starHp: 0 }
    expect(newbornOutcome(won)).toBe('won')
    expect(resolveNewborn(won, 'strike')).toBe(won)
  })

  it('the star-down check beats simultaneity (a killing strike wins even as the flare would drop you)', () => {
    // Contrive a state where a strike drops the star to <=0 the same exchange it would drop you to <=0.
    const s: NewbornState = {
      ...createNewbornFight(withWeapon('ironSword')),
      starHp: 1,
      yourHp: 1,
    }
    const after = resolveNewborn(s, 'strike')
    expect(after.starHp).toBeLessThanOrEqual(0)
    expect(newbornOutcome(after)).toBe('won') // the killing blow wins the tie
  })

  it('does not mutate the input state (immutability)', () => {
    const s = createNewbornFight(withWeapon('ironSword'))
    const yourHp = s.yourHp
    resolveNewborn(s, 'strike')
    expect(s.yourHp).toBe(yourHp)
  })
})

describe('the newborn-star dance — GRID SEARCH (bare-hands loses, a forged blade wins)', () => {
  it('BARE HANDS cannot win under ANY line (the tick is already yours — the dance is a real dance)', () => {
    expect(winnable(createNewbornFight(withWeapon(null)))).toBe(false)
  })

  it('BARE-HANDS all-strike LOSES (bleeds out / times out — never fells the newborn)', () => {
    const end = playOut(createNewbornFight(withWeapon(null)), () => 'strike')
    expect(newbornOutcome(end)).toBe('lost')
  })

  it('every FORGED blade CAN win the dance with a measured mix', () => {
    for (const id of ['woodenSpoon', 'woodenSword', 'ironSword', 'licoriceWhip', 'jawbreakerMace', 'popRockPike']) {
      expect(winnable(createNewbornFight(withWeapon(id)))).toBe(true)
    }
  })

  it('the clock is real: a slow bare hand cannot fell the newborn inside NEWBORN_MAX_TURNS by steadying', () => {
    const end = playOut(createNewbornFight(withWeapon(null)), () => 'steady')
    expect(newbornOutcome(end)).toBe('lost')
    expect(end.turn).toBeGreaterThanOrEqual(NEWBORN_MAX_TURNS)
  })

  it('a fast weapon (the whip, two strikes) wins comfortably (the double-swing niche pays off)', () => {
    expect(deriveNewbornWeapon(withWeapon('licoriceWhip')).strikes).toBe(2)
    expect(winnable(createNewbornFight(withWeapon('licoriceWhip')))).toBe(true)
  })

  it('the fast-cooldown threshold is exactly NEWBORN_FAST_COOLDOWN_MS (the whip at 350 is under it)', () => {
    expect(NEWBORN_FAST_COOLDOWN_MS).toBe(400)
  })
})
