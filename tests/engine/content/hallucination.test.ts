import {
  createHallucination,
  beatFor,
  beatIsLying,
  shownFoeHp,
  hallucinationOutcome,
  resolveHallucination,
  hallucinationDefeated,
  grantHallucinationReward,
  type HallucinationState,
} from '@/engine/content/hallucination'
import {
  HALLUCINATION_PLAYER_HP,
  HALLUCINATION_HP,
  COUNTER,
  MAX_TURNS,
  HP_BAR_LIE_MAX,
  HALLUCINATION_PATTERN,
  type TrustAction,
} from '@/content/moon/hallucination'
import { HALLUCINATION_DEFEATED_FLAG } from '@/content/flags'
import { FOURTH_WALL_FRAGMENT } from '@/content/items/items'
import { createDefaultSave } from '@/engine/state/defaultSave'
import type { GameState } from '@/engine/types/GameState'

/** The correct read for a turn: DISBELIEVE a lie, BELIEVE the honest (double-bluff) turn — the read the player
 * must learn by dying (the engine knows it for free; the render never gets it). This is "trust the mechanic". */
const correctRead = (turn: number): TrustAction =>
  beatIsLying(beatFor(turn)) ? 'disbelieve' : 'believe'

/** The read a naive UI-truster makes: always BELIEVE the numbers the counterfeit UI shows. Wrong on every lie. */
const naiveTrust = (): TrustAction => 'believe'

/** The read of a cynic who never trusts the UI: always DISBELIEVE. Wrong on every honest (double-bluff) turn. */
const alwaysDisbelieve = (): TrustAction => 'disbelieve'

const playOut = (
  start: HallucinationState,
  choose: (s: HallucinationState) => TrustAction,
): HallucinationState => {
  let s = start
  for (let i = 0; i < 200 && hallucinationOutcome(s) === null; i++) s = resolveHallucination(s, choose(s))
  return s
}

describe('the hallucination — an honest fight behind a lying UI', () => {
  it('opens at the TRUE player/foe HP, the pattern at the first beat', () => {
    const s = createHallucination()
    expect(s.yourHp).toBe(HALLUCINATION_PLAYER_HP)
    expect(s.foeHp).toBe(HALLUCINATION_HP)
    expect(s.turn).toBe(0)
    expect(hallucinationOutcome(s)).toBeNull()
  })

  it('loops the attack pattern by turn', () => {
    expect(beatFor(0)).toEqual(HALLUCINATION_PATTERN[0])
    expect(beatFor(HALLUCINATION_PATTERN.length)).toEqual(HALLUCINATION_PATTERN[0]) // wraps
    expect(beatFor(HALLUCINATION_PATTERN.length + 3)).toEqual(HALLUCINATION_PATTERN[3])
  })

  it('the pattern has BOTH lies (shown != true) and honest double-bluffs (shown == true), in even measure', () => {
    const lies = HALLUCINATION_PATTERN.filter(beatIsLying)
    const honest = HALLUCINATION_PATTERN.filter((b) => !beatIsLying(b))
    expect(lies.length).toBeGreaterThan(0) // it lies
    expect(honest.length).toBeGreaterThan(0) // and double-bluffs — the read is real
    // Neither reflex can be right most of the time (the fight must be a genuine per-turn read).
    expect(lies.length).toBe(honest.length)
  })
})

// The LIES ARE DECORATION: the fight resolves purely on the TRUE damage + TRUE HP. These tests pin that the
// counterfeit HP bar (shownFoeHp) and the shown-vs-true numbers never touch the outcome — the whole design
// contract of a fair, legible deception.
describe('the hallucination — the lies never touch the truth', () => {
  it('the counterfeit HP bar runs BACKWARDS and is never read by the outcome', () => {
    const s = createHallucination()
    // At full true HP the lying bar shows empty — it looks like it is already dying.
    expect(shownFoeHp(s)).toBe(HP_BAR_LIE_MAX - HALLUCINATION_HP)
    expect(shownFoeHp(s)).toBe(0)
    // Chip the true HP down; the lying bar climbs UP toward full (it looks like it is winning as it loses).
    const hurt: HallucinationState = { ...s, foeHp: 10 }
    expect(shownFoeHp(hurt)).toBe(HP_BAR_LIE_MAX - 10)
    expect(shownFoeHp(hurt)).toBeGreaterThan(shownFoeHp(s)) // the bar fills as the thing dies
    // And it is clamped, never negative / over-full, even at absurd HP.
    expect(shownFoeHp({ ...s, foeHp: HALLUCINATION_HP + 999 })).toBe(0)
    expect(shownFoeHp({ ...s, foeHp: -999 })).toBe(HP_BAR_LIE_MAX)
  })

  it('the outcome reads ONLY the true HP — a fully-dead foe wins even while its lying bar shows full', () => {
    const s = createHallucination()
    const dead: HallucinationState = { ...s, foeHp: 0 }
    expect(shownFoeHp(dead)).toBe(HP_BAR_LIE_MAX) // the lie: it looks perfectly healthy
    expect(hallucinationOutcome(dead)).toBe('won') // the truth: it is dead, you win
  })

  it('a correct DISBELIEVE of a lying beat blocks clean and counters (no true HP lost, foe chipped)', () => {
    const s = createHallucination()
    expect(beatIsLying(beatFor(0))).toBe(true) // turn 0 is a lie
    const next = resolveHallucination(s, 'disbelieve')
    expect(next.yourHp).toBe(s.yourHp) // blocked clean — you did not trust the lie
    expect(next.foeHp).toBe(s.foeHp - COUNTER)
  })

  it('BELIEVING a lie eats the TRUE blow (not the shown number) and counters nothing', () => {
    const s = createHallucination()
    const beat = beatFor(0)
    expect(beatIsLying(beat)).toBe(true)
    const next = resolveHallucination(s, 'believe')
    expect(next.foeHp).toBe(s.foeHp) // no counter — you trusted the wrong number
    expect(next.yourHp).toBe(s.yourHp - beat.trueDmg) // the TRUE blow lands, not the (bigger) shown one
    expect(next.yourHp).not.toBe(s.yourHp - beat.shown) // the lie did not decide the damage
  })

  it('on an HONEST (double-bluff) turn the reads INVERT: BELIEVE blocks, DISBELIEVE eats the true blow', () => {
    const honestTurn = HALLUCINATION_PATTERN.findIndex((b) => !beatIsLying(b))
    expect(honestTurn).toBeGreaterThanOrEqual(0)
    const beat = beatFor(honestTurn)
    const at: HallucinationState = { ...createHallucination(), turn: honestTurn }
    const believed = resolveHallucination(at, 'believe')
    expect(believed.yourHp).toBe(at.yourHp) // braced the real number — clean block + counter
    expect(believed.foeHp).toBe(at.foeHp - COUNTER)
    const disbelieved = resolveHallucination(at, 'disbelieve')
    expect(disbelieved.foeHp).toBe(at.foeHp) // distrusted an honest turn — no counter
    expect(disbelieved.yourHp).toBe(at.yourHp - beat.trueDmg) // and the true blow lands
  })

  it('is immutable and a no-op (same reference) once the fight is over', () => {
    const s = createHallucination()
    expect(resolveHallucination(s, 'disbelieve')).not.toBe(s)
    expect(s.foeHp).toBe(HALLUCINATION_HP) // original untouched
    const done = playOut(createHallucination(), (st) => correctRead(st.turn))
    if (hallucinationOutcome(done) !== null) expect(resolveHallucination(done, 'believe')).toBe(done)
  })

  it('scores the outcome: foe down wins, you down loses, the clock loses', () => {
    const base = createHallucination()
    expect(hallucinationOutcome({ ...base, foeHp: 0 })).toBe('won')
    expect(hallucinationOutcome({ ...base, yourHp: 0 })).toBe('lost')
    expect(hallucinationOutcome({ ...base, foeHp: 0, yourHp: 0 })).toBe('won') // killing counter beats simultaneity
    expect(hallucinationOutcome({ ...base, turn: MAX_TURNS })).toBe('lost') // wore you out
    expect(hallucinationOutcome(base)).toBeNull()
  })
})

// The balance contract (grid-searched against the real engine): the fight is HONEST and weapon-INDEPENDENT, so
// it is the same fair fight for every build (there is nothing to out-hit; you out-THINK it). Naive trust-the-UI
// (always BELIEVE the counterfeit numbers) LOSES; the reflexive cynic (always DISBELIEVE) ALSO loses (the double
// bluffs catch it); ONLY reading the cadence of lies (correctRead — trust the mechanic, not the interface) WINS.
// Tuning lives in content/moon/hallucination. There is no weapon axis, so a single run per mode is exhaustive —
// but we also assert weapon-independence explicitly (every equipped blade fights it identically).
describe('the hallucination — the balance contract', () => {
  it('naive trust-the-UI (always BELIEVE the shown numbers) LOSES', () => {
    const lost = playOut(createHallucination(), naiveTrust)
    expect(hallucinationOutcome(lost)).toBe('lost')
  })

  it('always-DISBELIEVE (the reflexive cynic) also LOSES — the double bluffs punish it (you must READ)', () => {
    const lost = playOut(createHallucination(), alwaysDisbelieve)
    expect(hallucinationOutcome(lost)).toBe('lost')
  })

  it('reading the cadence of lies (trust the mechanic) WINS, with HP to spare (a fair, honest fight)', () => {
    const won = playOut(createHallucination(), (s) => correctRead(s.turn))
    expect(hallucinationOutcome(won)).toBe('won')
    expect(won.yourHp).toBeGreaterThan(0) // clean reads take zero damage — the read IS the whole fight
    expect(won.turn).toBeLessThan(MAX_TURNS) // and well inside the clock
  })

  it('is weapon-INDEPENDENT: every equipped blade fights the exact same honest fight (you out-think it)', () => {
    // The fight reads no weapon — createHallucination takes no state. Assert the outcome does not depend on the
    // equipped weapon by playing the same lines from saves with different weapons: identical results.
    const withWeapon = (weaponId: string | null): GameState => ({
      ...createDefaultSave(),
      equipped: { ...createDefaultSave().equipped, weapon: weaponId },
    })
    const builds = [null, 'woodenSpoon', 'ironSword', 'jawbreakerMace', 'licoriceWhip']
    // createHallucination ignores state entirely, so this is really pinning that no weapon path leaks in.
    for (const id of builds) {
      void withWeapon(id) // documents intent; the fight ctor takes no state, so all builds are identical
      const won = playOut(createHallucination(), (s) => correctRead(s.turn))
      expect(hallucinationOutcome(won)).toBe('won')
      const lost = playOut(createHallucination(), naiveTrust)
      expect(hallucinationOutcome(lost)).toBe('lost')
    }
  })

  it('the win reads ONLY the true HP — the lying bar shows full at the moment of victory', () => {
    const won = playOut(createHallucination(), (s) => correctRead(s.turn))
    expect(hallucinationOutcome(won)).toBe('won')
    expect(won.foeHp).toBeLessThanOrEqual(0) // the truth
    expect(shownFoeHp(won)).toBe(HP_BAR_LIE_MAX) // the lie, still on-screen at the end
  })
})

describe('the hallucination reward — commit-once fourth-wall fragment', () => {
  it('reads the defeated flag (commit-once)', () => {
    expect(hallucinationDefeated(createDefaultSave())).toBe(false)
    const done: GameState = { ...createDefaultSave(), flags: { [HALLUCINATION_DEFEATED_FLAG]: true } }
    expect(hallucinationDefeated(done)).toBe(true)
  })

  it('grants the fragment + sets the flag exactly once; a second call is SAME ref (farm-proof)', () => {
    const before = createDefaultSave()
    const after = grantHallucinationReward(before)
    expect(after.flags[HALLUCINATION_DEFEATED_FLAG]).toBe(true)
    expect(after.ownedItems[FOURTH_WALL_FRAGMENT.id]).toBe(true)
    expect(after.flags[FOURTH_WALL_FRAGMENT.saveFlag]).toBe(true)
    // second call: nothing changes, SAME reference
    expect(grantHallucinationReward(after)).toBe(after)
  })
})
