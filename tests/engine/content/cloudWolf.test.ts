import {
  deriveWolfWeapon,
  createWolfFight,
  moveFor,
  wolfOutcome,
  resolveWolfExchange,
  cloudWolfDefeated,
  stormImmune,
  stormFrontMaxHp,
  STORM_IMMUNE_HP_FACTOR,
  type WolfState,
  type WolfAction,
} from '@/engine/content/cloudWolf'
import {
  WOLF_PLAYER_HP,
  WOLF_HP,
  COUNTER_FACTOR,
  STRIKE_FACTOR,
  MAX_TURNS,
  WOLF_PATTERN,
} from '@/content/sky/cloudWolf'
import { CLOUD_WOLF_DEFEATED_FLAG, STORM_IMMUNE_FLAG } from '@/content/flags'
import { WOLF_WOOL_CLOAK } from '@/content/items/items'
import { createDefaultSave } from '@/engine/state/defaultSave'
import type { GameState } from '@/engine/types/GameState'

/** A save with the given weapon equipped (the fight reads only the equipped hand weapon). */
const withWeapon = (weaponId: string | null): GameState => ({
  ...createDefaultSave(),
  equipped: { ...createDefaultSave().equipped, weapon: weaponId },
})

/** The counter that reads the actual move on a given turn. */
const correctCounter = (turn: number): WolfAction =>
  moveFor(turn).move === 'lunge' ? 'counter-lunge' : 'counter-snap'
/** The counter a crouch-reader makes (counters the telegraphed crouch — wrong on a feint). */
const tellCounter = (turn: number): WolfAction =>
  moveFor(turn).crouch === 'lunge' ? 'counter-lunge' : 'counter-snap'

const playOut = (start: WolfState, choose: (s: WolfState) => WolfAction): WolfState => {
  let s = start
  for (let i = 0; i < 100 && wolfOutcome(s) === null; i++) s = resolveWolfExchange(s, choose(s))
  return s
}

/** Best reachable final HP via perfect play (knows each move: counter-correct or strike); -Infinity if no win. */
const bestFinalHp = (start: WolfState): number => {
  const memo = new Map<string, number>()
  const search = (s: WolfState): number => {
    const o = wolfOutcome(s)
    if (o === 'won') return s.yourHp
    if (o === 'lost') return -Infinity
    const key = `${s.yourHp}|${s.foeHp}|${s.turn}`
    const cached = memo.get(key)
    if (cached !== undefined) return cached
    const r = Math.max(
      search(resolveWolfExchange(s, correctCounter(s.turn))),
      search(resolveWolfExchange(s, 'strike')),
    )
    memo.set(key, r)
    return r
  }
  return search(start)
}

describe('the cloud wolf — reading the equipped weapon', () => {
  it('derives damage off the equipped weapon; a fast weapon strikes twice (reach is irrelevant in the clinch)', () => {
    expect(deriveWolfWeapon(withWeapon('jawbreakerMace'))).toEqual({ damage: 8, strikes: 1 })
    expect(deriveWolfWeapon(withWeapon('licoriceWhip'))).toEqual({ damage: 3, strikes: 2 })
    expect(deriveWolfWeapon(withWeapon(null))).toEqual({ damage: 1, strikes: 1 }) // bare hands
  })

  it('opens at full HP for both, its pattern at the first move', () => {
    const s = createWolfFight(withWeapon('ironSword'))
    expect(s.yourHp).toBe(WOLF_PLAYER_HP)
    expect(s.foeHp).toBe(WOLF_HP)
    expect(s.turn).toBe(0)
    expect(wolfOutcome(s)).toBeNull()
  })

  it('loops the pattern by turn', () => {
    expect(moveFor(0)).toEqual(WOLF_PATTERN[0])
    expect(moveFor(WOLF_PATTERN.length)).toEqual(WOLF_PATTERN[0]) // wraps
    expect(moveFor(WOLF_PATTERN.length + 5)).toEqual(WOLF_PATTERN[5])
  })
})

describe('the cloud wolf — the exchange', () => {
  it('a correct counter turns the move and cuts (no HP lost, foe chipped)', () => {
    const s = createWolfFight(withWeapon('jawbreakerMace')) // damage 8, strikes 1
    const next = resolveWolfExchange(s, correctCounter(0))
    expect(next.yourHp).toBe(s.yourHp) // turned it
    expect(next.foeHp).toBe(s.foeHp - COUNTER_FACTOR * 8 * 1)
  })

  it('a mis-read counter (or a feint) eats the bite and cuts nothing', () => {
    const s = createWolfFight(withWeapon('jawbreakerMace'))
    const wrong = correctCounter(0) === 'counter-lunge' ? 'counter-snap' : 'counter-lunge'
    const next = resolveWolfExchange(s, wrong)
    expect(next.foeHp).toBe(s.foeHp) // no cut
    expect(next.yourHp).toBe(s.yourHp - moveFor(0).bite) // ate the bite
  })

  it('a strike hits hard but the move always lands (you are committed)', () => {
    const s = createWolfFight(withWeapon('jawbreakerMace'))
    const next = resolveWolfExchange(s, 'strike')
    expect(next.foeHp).toBe(s.foeHp - STRIKE_FACTOR * 8 * 1)
    expect(next.yourHp).toBe(s.yourHp - moveFor(0).bite)
  })

  it('is immutable and a no-op (same reference) once the clinch is over', () => {
    const s = createWolfFight(withWeapon('ironSword'))
    expect(resolveWolfExchange(s, 'strike')).not.toBe(s)
    expect(s.foeHp).toBe(WOLF_HP) // original untouched

    const done = playOut(createWolfFight(withWeapon('jawbreakerMace')), (st) => correctCounter(st.turn))
    if (wolfOutcome(done) !== null) expect(resolveWolfExchange(done, 'strike')).toBe(done)
  })

  it('scores the outcome: foe down wins (beats simultaneity), HP gone or the clock loses', () => {
    const base = createWolfFight(withWeapon('ironSword'))
    expect(wolfOutcome({ ...base, foeHp: 0 })).toBe('won')
    expect(wolfOutcome({ ...base, foeHp: 0, yourHp: 0 })).toBe('won') // killing bite beats the bite
    expect(wolfOutcome({ ...base, yourHp: 0 })).toBe('lost')
    expect(wolfOutcome({ ...base, turn: MAX_TURNS })).toBe('lost') // wore you down
    expect(wolfOutcome(base)).toBeNull()
  })

  it('countering forever is a loss for a light blade — the chip is too slow before the clock', () => {
    // The wooden sword's counter (damage 3) can't grind 64 HP down inside the crew timer on chip alone; it must
    // MIX in strikes into the light snaps (bestFinalHp finds that line). A heavier blade (iron) can pure-counter.
    const s = playOut(createWolfFight(withWeapon('woodenSword')), (st) => correctCounter(st.turn))
    expect(wolfOutcome(s)).toBe('lost')
    expect(bestFinalHp(createWolfFight(withWeapon('woodenSword')))).toBeGreaterThan(0) // but a mixed line wins
  })
})

// The balance contract (grid-searched against the real engine): bare hands, grandma's spoon, and the bow (no
// use in a clinch) LOSE outright — come armed with a real forged blade; naive counter-by-the-CROUCH LOSES for
// the common blades (you must read the feints); naive all-STRIKE LOSES for the common forged blades (wooden +
// iron sword — the read is required, matching the boarding contract); and each forged blade wins with clean
// reads. Only a fast whip or the heavy mace can brute past the read (a strong weapon feels strong). Tuning
// lives in content/sky/cloudWolf; this asserts the shape holds against the engine.
describe('the cloud wolf — the balance contract', () => {
  it('cannot be won bare-handed, with the spoon, or with the bow (a real forged blade is required)', () => {
    expect(bestFinalHp(createWolfFight(withWeapon(null)))).toBe(-Infinity)
    expect(bestFinalHp(createWolfFight(withWeapon('woodenSpoon')))).toBe(-Infinity)
    expect(bestFinalHp(createWolfFight(withWeapon('candyCaneBow')))).toBe(-Infinity) // no use in a clinch
  })

  it('punishes counter-by-the-crouch (the feints) for the wooden and iron sword', () => {
    for (const id of ['woodenSword', 'ironSword']) {
      const lost = playOut(createWolfFight(withWeapon(id)), (s) => tellCounter(s.turn))
      expect(wolfOutcome(lost)).toBe('lost')
    }
  })

  it('punishes pure aggression (all-strike) for the wooden and iron sword — you eat too many bites', () => {
    for (const id of ['woodenSword', 'ironSword']) {
      const lost = playOut(createWolfFight(withWeapon(id)), () => 'strike')
      expect(wolfOutcome(lost)).toBe('lost')
    }
  })

  it('lets each forged melee weapon win with clean reads', () => {
    for (const id of ['woodenSword', 'ironSword', 'licoriceWhip', 'jawbreakerMace']) {
      expect(bestFinalHp(createWolfFight(withWeapon(id)))).toBeGreaterThan(0)
    }
  })
})

describe('the cloud wolf — the drop + storm immunity', () => {
  it('reads the defeated flag (commit-once)', () => {
    expect(cloudWolfDefeated(createDefaultSave())).toBe(false)
    const done: GameState = { ...createDefaultSave(), flags: { [CLOUD_WOLF_DEFEATED_FLAG]: true } }
    expect(cloudWolfDefeated(done)).toBe(true)
  })

  it("the wolf-wool cloak's saveFlag IS the storm-immunity flag (one truth, no duplication)", () => {
    expect(WOLF_WOOL_CLOAK.saveFlag).toBe(STORM_IMMUNE_FLAG)
    expect(WOLF_WOOL_CLOAK.slot).toBe('armour') // the first user of the unused armour slot
  })

  it('storm immunity is off until the cloak is worn, then on', () => {
    expect(stormImmune(createDefaultSave())).toBe(false)
    const cloaked: GameState = { ...createDefaultSave(), flags: { [STORM_IMMUNE_FLAG]: true } }
    expect(stormImmune(cloaked)).toBe(true)
  })

  it('boosts the storm-front max HP only while the cloak is worn (the late trivializing reward)', () => {
    const base = createDefaultSave()
    expect(stormFrontMaxHp(base, 24)).toBe(24) // no cloak: unchanged
    const cloaked: GameState = { ...base, flags: { [STORM_IMMUNE_FLAG]: true } }
    expect(stormFrontMaxHp(cloaked, 24)).toBe(24 * STORM_IMMUNE_HP_FACTOR)
    expect(STORM_IMMUNE_HP_FACTOR).toBeGreaterThan(1) // it is a buff, never a nerf
  })
})
