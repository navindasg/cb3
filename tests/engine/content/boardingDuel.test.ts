import {
  deriveMeleeWeapon,
  createBoarding,
  cutFor,
  boardingOutcome,
  resolveExchange,
  sourbeardBoarded,
  boardingAvailable,
  type BoardingState,
  type BoardingAction,
} from '@/engine/content/boardingDuel'
import {
  BOARDING_PLAYER_HP,
  SOURBEARD_MELEE_HP,
  RIPOSTE_FACTOR,
  LUNGE_FACTOR,
  MAX_TURNS,
  CUT_PATTERN,
  SOURBEARD_DEFEATS_KEY,
} from '@/content/ship/boardingDuel'
import { MAX_DEFEATS } from '@/content/ship/shipDuel'
import { SOURBEARD_BOARDED_FLAG } from '@/content/flags'
import { createDefaultSave } from '@/engine/state/defaultSave'
import type { GameState } from '@/engine/types/GameState'

const withWeapon = (weaponId: string | null): GameState => ({
  ...createDefaultSave(),
  equipped: { ...createDefaultSave().equipped, weapon: weaponId },
})

/** The guard that reads the actual cut line correctly on a given turn. */
const correctGuard = (turn: number): BoardingAction =>
  cutFor(turn).line === 'high' ? 'guard-high' : 'guard-low'
/** The guard a tell-reader makes (guards the telegraphed stance — wrong on a feint). */
const tellGuard = (turn: number): BoardingAction =>
  cutFor(turn).tell === 'high' ? 'guard-high' : 'guard-low'

const playOut = (start: BoardingState, choose: (s: BoardingState) => BoardingAction): BoardingState => {
  let s = start
  for (let i = 0; i < 100 && boardingOutcome(s) === null; i++) s = resolveExchange(s, choose(s))
  return s
}

/** Best reachable final HP via perfect play (knows each line: guard-correct or lunge); -Infinity if no win. */
const bestFinalHp = (start: BoardingState): number => {
  const memo = new Map<string, number>()
  const search = (s: BoardingState): number => {
    const o = boardingOutcome(s)
    if (o === 'won') return s.yourHp
    if (o === 'lost') return -Infinity
    const key = `${s.yourHp}|${s.foeHp}|${s.turn}`
    const cached = memo.get(key)
    if (cached !== undefined) return cached
    const r = Math.max(
      search(resolveExchange(s, correctGuard(s.turn))),
      search(resolveExchange(s, 'lunge')),
    )
    memo.set(key, r)
    return r
  }
  return search(start)
}

describe('the boarding melee — reading the equipped weapon', () => {
  it('derives damage off the equipped weapon; a fast weapon strikes twice (reach is irrelevant on foot)', () => {
    expect(deriveMeleeWeapon(withWeapon('jawbreakerMace'))).toEqual({ damage: 8, strikes: 1 })
    expect(deriveMeleeWeapon(withWeapon('licoriceWhip'))).toEqual({ damage: 3, strikes: 2 })
    expect(deriveMeleeWeapon(withWeapon(null))).toEqual({ damage: 1, strikes: 1 }) // bare hands
  })

  it('opens at full HP for both, his bout at the first cut', () => {
    const s = createBoarding(withWeapon('ironSword'))
    expect(s.yourHp).toBe(BOARDING_PLAYER_HP)
    expect(s.foeHp).toBe(SOURBEARD_MELEE_HP)
    expect(s.turn).toBe(0)
    expect(boardingOutcome(s)).toBeNull()
  })

  it('loops the cut pattern by turn', () => {
    expect(cutFor(0)).toEqual(CUT_PATTERN[0])
    expect(cutFor(CUT_PATTERN.length)).toEqual(CUT_PATTERN[0]) // wraps
    expect(cutFor(CUT_PATTERN.length + 5)).toEqual(CUT_PATTERN[5])
  })
})

describe('the boarding melee — the exchange', () => {
  it('a correct guard blocks the cut and ripostes (no HP lost, foe chipped)', () => {
    const s = createBoarding(withWeapon('jawbreakerMace')) // damage 8, strikes 1
    const next = resolveExchange(s, correctGuard(0))
    expect(next.yourHp).toBe(s.yourHp) // blocked
    expect(next.foeHp).toBe(s.foeHp - RIPOSTE_FACTOR * 8 * 1)
  })

  it('a mis-read guard (or a feint) eats the cut and ripostes nothing', () => {
    const s = createBoarding(withWeapon('jawbreakerMace'))
    const wrong = correctGuard(0) === 'guard-high' ? 'guard-low' : 'guard-high'
    const next = resolveExchange(s, wrong)
    expect(next.foeHp).toBe(s.foeHp) // no riposte
    expect(next.yourHp).toBe(s.yourHp - cutFor(0).dmg) // ate the cut
  })

  it('a lunge hits hard but the cut always lands (you are committed)', () => {
    const s = createBoarding(withWeapon('jawbreakerMace'))
    const next = resolveExchange(s, 'lunge')
    expect(next.foeHp).toBe(s.foeHp - LUNGE_FACTOR * 8 * 1)
    expect(next.yourHp).toBe(s.yourHp - cutFor(0).dmg)
  })

  it('is immutable and a no-op (same reference) once the bout is over', () => {
    const s = createBoarding(withWeapon('ironSword'))
    expect(resolveExchange(s, 'lunge')).not.toBe(s)
    expect(s.foeHp).toBe(SOURBEARD_MELEE_HP) // original untouched

    const done = playOut(createBoarding(withWeapon('jawbreakerMace')), (st) => correctGuard(st.turn))
    if (boardingOutcome(done) !== null) expect(resolveExchange(done, 'lunge')).toBe(done)
  })

  it('scores the outcome: foe down wins (beats simultaneity), HP gone or the crew timer loses', () => {
    const base = createBoarding(withWeapon('ironSword'))
    expect(boardingOutcome({ ...base, foeHp: 0 })).toBe('won')
    expect(boardingOutcome({ ...base, foeHp: 0, yourHp: 0 })).toBe('won') // killing thrust beats the cut
    expect(boardingOutcome({ ...base, yourHp: 0 })).toBe('lost')
    expect(boardingOutcome({ ...base, turn: MAX_TURNS })).toBe('lost') // overrun by his crew
    expect(boardingOutcome(base)).toBeNull()
  })
})

describe('the boarding melee — availability gating', () => {
  const withDefeats = (defeats: number, boarded = false): GameState => ({
    ...createDefaultSave(),
    numbers: { [SOURBEARD_DEFEATS_KEY]: defeats },
    flags: boarded ? { [SOURBEARD_BOARDED_FLAG]: true } : {},
  })

  it('opens only after the broadside arc is won (3 defeats), and not once already boarded', () => {
    expect(boardingAvailable(withDefeats(0))).toBe(false)
    expect(boardingAvailable(withDefeats(2))).toBe(false)
    expect(boardingAvailable(withDefeats(MAX_DEFEATS))).toBe(true)
    expect(boardingAvailable(withDefeats(MAX_DEFEATS, true))).toBe(false) // already done
  })

  it('reads the boarded flag', () => {
    expect(sourbeardBoarded(createDefaultSave())).toBe(false)
    expect(sourbeardBoarded(withDefeats(MAX_DEFEATS, true))).toBe(true)
  })
})

// The balance contract (grid-searched against the real engine): bare hands LOSE (come armed with a real
// blade — the bow is useless on foot), naive guard-by-the-TELL LOSES for the common blades (you must read
// the feints), and each forged melee weapon can win with clean reads. Tuning lives in content/ship/boardingDuel.
describe('the boarding melee — the balance contract', () => {
  it('cannot be won bare-handed (a real blade is required)', () => {
    expect(bestFinalHp(createBoarding(withWeapon(null)))).toBe(-Infinity)
    expect(bestFinalHp(createBoarding(withWeapon('candyCaneBow')))).toBe(-Infinity) // the bow is no use on foot
  })

  it('punishes guard-by-the-tell (the feints) for the sword and iron sword', () => {
    for (const id of ['woodenSword', 'ironSword']) {
      const lost = playOut(createBoarding(withWeapon(id)), (s) => tellGuard(s.turn))
      expect(boardingOutcome(lost)).toBe('lost')
    }
  })

  it('punishes pure aggression (all-lunge) for the sword and iron sword — you eat too many cuts', () => {
    // The pop rock pike is included on purpose: its damage is held at the iron sword's (its premium is
    // reach, which is irrelevant on foot), so a NEW premium weapon does not let all-lunge brute past the
    // read here — exactly the boundary that kept the pike at damage 5 (see items.ts POP_ROCK_PIKE).
    // The mantle sword is included too: it is a hero-tier scaling weapon (base damage 12), but its damage
    // is HELD to the iron sword's (5) inside the discrete fights via meleeWeapon (MANTLE_SWORD_MELEE_CAP),
    // so its raw weight/scaling does NOT let all-lunge brute past the read here (durable Inc-21 lesson: a
    // new weapon must re-run this grid-search, not just be unit-tested — an uncapped mantle sword WINS).
    for (const id of ['woodenSword', 'ironSword', 'popRockPike', 'mantleSword']) {
      const lost = playOut(createBoarding(withWeapon(id)), () => 'lunge')
      expect(boardingOutcome(lost)).toBe('lost')
    }
  })

  it('the mantle sword all-lunge loses even at a huge lifetime (the melee cap holds regardless of scaling)', () => {
    const glutton: GameState = { ...withWeapon('mantleSword'), lifetimeCandiesEaten: 1e9 }
    const lost = playOut(createBoarding(glutton), () => 'lunge')
    expect(boardingOutcome(lost)).toBe('lost')
  })

  it('lets each forged blade win with clean reads', () => {
    for (const id of ['woodenSword', 'ironSword', 'licoriceWhip', 'jawbreakerMace', 'popRockPike', 'mantleSword']) {
      expect(bestFinalHp(createBoarding(withWeapon(id)))).toBeGreaterThan(0)
    }
  })
})
