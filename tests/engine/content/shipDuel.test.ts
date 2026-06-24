import {
  deriveStats,
  createDuel,
  resolveManeuver,
  duelOutcome,
  sourbeardDefeats,
  sourbeardRetired,
  foeHpFor,
  foeShotFor,
  type DuelState,
  type Maneuver,
} from '@/engine/content/shipDuel'
import {
  GALLEON_HULL_KEY,
  GALLEON_SAILS_KEY,
  GALLEON_CANNON_KEY,
} from '@/content/ship/galleonUpgrade'
import {
  HULL_HP,
  CANNON_DAMAGE,
  SAIL_EVASION,
  MAX_DEFEATS,
  MAX_ROUNDS,
  START_RANGE,
  RANGE_CLOSE,
  SOURBEARD_DEFEATS_KEY,
} from '@/content/ship/shipDuel'
import { createDefaultSave } from '@/engine/state/defaultSave'
import type { GameState } from '@/engine/types/GameState'

/** A save with the given yard tiers + prior Sourbeard defeats. */
const withShip = (hull: number, cannon: number, sail: number, defeats = 0): GameState => ({
  ...createDefaultSave(),
  numbers: {
    [GALLEON_HULL_KEY]: hull,
    [GALLEON_CANNON_KEY]: cannon,
    [GALLEON_SAILS_KEY]: sail,
    [SOURBEARD_DEFEATS_KEY]: defeats,
  },
})

/** Play a duel to its end with a fixed strategy (the screen's player is the human; this drives tests). */
const playOut = (start: DuelState, choose: (s: DuelState) => Maneuver): DuelState => {
  let s = start
  for (let i = 0; i < 50 && duelOutcome(s) === null; i++) s = resolveManeuver(s, choose(s))
  return s
}

// Strategies a player might use:
// The intuitive winning play — fight at MID range, veer off if the foe drifts to deadly point-blank,
// close up only when you need to (it kills at mid once the foe is low). No clairvoyance required.
const tactical = (s: DuelState): Maneuver =>
  s.range > 1 ? 'veer' : s.range < 1 ? 'press' : 'hold'
// Naive aggression — charge to point-blank and slug it out (now a trap: point-blank is lethal to you).
const pressSpam = (s: DuelState): Maneuver => (s.range < RANGE_CLOSE ? 'press' : 'hold')
// Running — kite at long range; the boarding timer punishes it.
const kite = (s: DuelState): Maneuver => (s.range > 0 ? 'veer' : 'hold')

describe('the broadside duel — reading the shipwright yard', () => {
  it('derives HP/damage/evasion from the hull/cannon/sail tiers', () => {
    const base = deriveStats(withShip(1, 1, 1))
    expect(base.maxHp).toBe(HULL_HP[1])
    expect(base.damage).toBe(CANNON_DAMAGE[1])
    expect(base.evasion).toBe(SAIL_EVASION[1])
    expect(base.fullSlip).toBe(false) // sail tier 1 only half-slips a veer

    const fitted = deriveStats(withShip(3, 2, 2))
    expect(fitted.maxHp).toBe(HULL_HP[3])
    expect(fitted.damage).toBe(CANNON_DAMAGE[2])
    expect(fitted.fullSlip).toBe(true) // storm-silk (tier 2) fully slips a veer
  })

  it('a fresh duel opens at long range, full hull, foe scaled to the encounter', () => {
    const d = createDuel(withShip(1, 1, 1))
    expect(d.range).toBe(START_RANGE)
    expect(d.yourHp).toBe(d.yourMaxHp)
    expect(d.foeHp).toBe(foeHpFor(0))
    expect(d.foeShot).toBe(foeShotFor(0))
    expect(duelOutcome(d)).toBeNull()
  })
})

describe('the broadside duel — the tactical curve (deterministic)', () => {
  it('a base-stats galleon CAN sink Sourbeard with intuitive play (encounter 1)', () => {
    const end = playOut(createDuel(withShip(1, 1, 1)), tactical)
    expect(duelOutcome(end)).toBe('won')
    expect(end.yourHp).toBeGreaterThan(0)
  })

  it('naive aggression (charging to point-blank) gets you SUNK — closing is not free', () => {
    const end = playOut(createDuel(withShip(1, 1, 1)), pressSpam)
    expect(duelOutcome(end)).toBe('lost')
    expect(end.foeHp).toBeGreaterThan(0) // sunk before sinking him
  })

  it('running (kiting at long range) gets you BOARDED — the timer punishes dithering', () => {
    const end = playOut(createDuel(withShip(1, 1, 1)), kite)
    expect(duelOutcome(end)).toBe('lost')
    expect(end.round).toBe(MAX_ROUNDS) // boarded, not sunk
  })

  it('storm-silk sails (the veer-slip) leave you with more hull than cotton-candy sails', () => {
    const cotton = playOut(createDuel(withShip(1, 1, 1)), tactical)
    const stormSilk = playOut(createDuel(withShip(1, 1, 2)), tactical)
    expect(duelOutcome(stormSilk)).toBe('won')
    expect(stormSilk.yourHp).toBeGreaterThan(cotton.yourHp)
  })

  it('the escalation REQUIRES the yard: a hull-only ship loses the rematch; the comet cannon wins it', () => {
    // encounter 2 (one prior defeat) — a tougher Black Lollipop.
    // Hull + sails but the base gumball broadside (cannon tier 1) cannot out-gun her in time:
    expect(duelOutcome(playOut(createDuel(withShip(3, 1, 2, 1)), tactical))).toBe('lost')
    // The comet's pop rock guns (cannon tier 2) tip the DPS race:
    expect(duelOutcome(playOut(createDuel(withShip(2, 2, 2, 1)), tactical))).toBe('won')
  })

  it('the final rematch (encounter 3) is still winnable with a well-fitted ship', () => {
    expect(duelOutcome(playOut(createDuel(withShip(3, 2, 2, 2)), tactical))).toBe('won')
  })
})

describe('the broadside duel — resolution rules', () => {
  it('every maneuver fires a broadside (press, hold and veer all damage the foe)', () => {
    const d = createDuel(withShip(2, 2, 2))
    for (const m of ['press', 'hold', 'veer'] as Maneuver[]) {
      expect(resolveManeuver(d, m).foeHp).toBeLessThan(d.foeHp)
    }
  })

  it('a veer with storm-silk sails slips the foe shot (no hull lost that round)', () => {
    const d: DuelState = { ...createDuel(withShip(2, 2, 2)), range: 1 }
    const veered = resolveManeuver(d, 'veer')
    expect(veered.yourHp).toBe(d.yourHp) // fully slipped
    expect(veered.range).toBeLessThanOrEqual(1)
  })

  it('pressing closes the range; the foe also drifts closer on its cadence', () => {
    const d = createDuel(withShip(2, 2, 2))
    const pressed = resolveManeuver(d, 'press')
    expect(pressed.range).toBeGreaterThan(d.range)
  })

  it('the killing blow lands before the foe can reply (no hull lost on the winning shot)', () => {
    const d: DuelState = { ...createDuel(withShip(3, 2, 2)), foeHp: 1, range: RANGE_CLOSE }
    const end = resolveManeuver(d, 'hold')
    expect(duelOutcome(end)).toBe('won')
    expect(end.yourHp).toBe(d.yourHp) // she made no reply
  })

  it('is a no-op (same reference) once the duel is decided', () => {
    const won: DuelState = { ...createDuel(withShip(1, 1, 1)), foeHp: 0 }
    expect(resolveManeuver(won, 'press')).toBe(won)
  })
})

describe('the broadside duel — the recurring rival', () => {
  it('counts defeats, clamped to the arc length', () => {
    expect(sourbeardDefeats(withShip(1, 1, 1, 0))).toBe(0)
    expect(sourbeardDefeats(withShip(1, 1, 1, 2))).toBe(2)
    expect(sourbeardDefeats({ ...createDefaultSave(), numbers: { [SOURBEARD_DEFEATS_KEY]: 99 } })).toBe(MAX_DEFEATS)
  })

  it('is retired only after the full three-defeat arc', () => {
    expect(sourbeardRetired(withShip(1, 1, 1, 2))).toBe(false)
    expect(sourbeardRetired(withShip(1, 1, 1, 3))).toBe(true)
  })

  it('the foe escalates each rematch', () => {
    expect(foeHpFor(1)).toBeGreaterThan(foeHpFor(0))
    expect(foeShotFor(2)).toBeGreaterThan(foeShotFor(1))
  })
})
