import {
  deriveWeapon,
  createFight,
  fightOutcome,
  telegraphedArm,
  strikeTarget,
  resolveTurn,
  type KrakenState,
  type KrakenAction,
} from '@/engine/content/krakenFight'
import {
  KRAKEN_PLAYER_HP,
  TENTACLE_COUNT,
  TENTACLE_HP,
  STRIKE_DMG_BY_DIST,
  MAX_TURNS,
  FAST_COOLDOWN_MS,
} from '@/content/planet/krakenFight'
import { createDefaultSave } from '@/engine/state/defaultSave'
import type { GameState } from '@/engine/types/GameState'

/** A save with the given weapon equipped (the fight reads only the equipped hand weapon). */
const withWeapon = (weaponId: string | null): GameState => ({
  ...createDefaultSave(),
  equipped: { ...createDefaultSave().equipped, weapon: weaponId },
})

/** Play a fight to its end with a fixed strategy. */
const playOut = (start: KrakenState, choose: (s: KrakenState) => KrakenAction): KrakenState => {
  let s = start
  for (let i = 0; i < 100 && fightOutcome(s) === null; i++) s = resolveTurn(s, choose(s))
  return s
}

/** Best reachable final HP via perfect play (minimax over the two actions); -Infinity if no win exists. */
const bestFinalHp = (start: KrakenState): number => {
  const memo = new Map<string, number>()
  const search = (s: KrakenState): number => {
    const o = fightOutcome(s)
    if (o === 'won') return s.yourHp
    if (o === 'lost') return -Infinity
    const key = `${s.yourHp}|${s.turn}|${s.tentacles.map((t) => `${t.id}:${t.hp}:${t.dist}`).join(',')}`
    const cached = memo.get(key)
    if (cached !== undefined) return cached
    const r = Math.max(search(resolveTurn(s, 'strike')), search(resolveTurn(s, 'brace')))
    memo.set(key, r)
    return r
  }
  return search(start)
}

const alwaysStrike = (): KrakenAction => 'strike'

describe('the sour kraken — reading the equipped weapon', () => {
  it('derives damage/reach off the equipped weapon, and a fast weapon strikes twice', () => {
    const mace = deriveWeapon(withWeapon('jawbreakerMace'))
    expect(mace).toEqual({ damage: 8, reach: 1.5, strikes: 1 })

    const whip = deriveWeapon(withWeapon('licoriceWhip'))
    expect(whip.strikes).toBe(2) // cooldown 350 < FAST_COOLDOWN_MS
    expect(whip.reach).toBe(3)

    expect(FAST_COOLDOWN_MS).toBe(400)
  })

  it('falls back to bare hands with nothing equipped', () => {
    const w = deriveWeapon(withWeapon(null))
    expect(w).toEqual({ damage: 1, reach: 1.2, strikes: 1 })
  })

  it('opens with every arm at full hp, you at full hp, turn zero', () => {
    const s = createFight(withWeapon('ironSword'))
    expect(s.tentacles).toHaveLength(TENTACLE_COUNT)
    expect(s.tentacles.every((t) => t.hp === TENTACLE_HP)).toBe(true)
    expect(s.yourHp).toBe(KRAKEN_PLAYER_HP)
    expect(s.yourMaxHp).toBe(KRAKEN_PLAYER_HP)
    expect(s.turn).toBe(0)
    expect(fightOutcome(s)).toBeNull()
  })
})

describe('the sour kraken — telegraph, reach, and the turn', () => {
  it('telegraphs the farthest arm (its longest reach winds up first), tie broken by id', () => {
    const s = createFight(withWeapon('ironSword'))
    const tel = telegraphedArm(s)!
    const maxDist = Math.max(...s.tentacles.map((t) => t.dist))
    expect(tel.dist).toBe(maxDist)
  })

  it('a short weapon can only target arms within its reach (else the nearest reachable)', () => {
    const s = createFight(withWeapon('jawbreakerMace')) // reach 1.5
    const target = strikeTarget(s)
    // no arm opens at dist <= 1.5 (start dists are 2,3,3,4,5), so the swing whiffs
    expect(target).toBeNull()
  })

  it('a long weapon reaches the telegraphed arm and intercepts its blow (no damage taken)', () => {
    const s = createFight(withWeapon('candyCaneBow')) // reach 5, reaches everything
    const before = s.yourHp
    const next = resolveTurn(s, 'strike')
    expect(next.yourHp).toBe(before) // intercepted the telegraphed arm -> no blow lands
    // and it chipped that arm
    const tel = telegraphedArm(s)!
    const sameArm = next.tentacles.find((t) => t.id === tel.id)
    expect(sameArm && sameArm.hp).toBeLessThan(TENTACLE_HP)
  })

  it('eating an un-intercepted blow hurts; bracing halves it', () => {
    const s = createFight(withWeapon('jawbreakerMace')) // cannot reach the far telegraphed arm
    const tel = telegraphedArm(s)!
    const blow = STRIKE_DMG_BY_DIST[tel.dist]!

    const struck = resolveTurn(s, 'strike') // whiffs (nothing in reach) -> eats full blow
    expect(struck.yourHp).toBe(s.yourHp - blow)

    const braced = resolveTurn(s, 'brace')
    expect(braced.yourHp).toBe(s.yourHp - blow / 2)
  })

  it('every surviving arm advances one band closer each turn', () => {
    const s = createFight(withWeapon('jawbreakerMace'))
    const next = resolveTurn(s, 'brace')
    for (const t of next.tentacles) {
      const prev = s.tentacles.find((p) => p.id === t.id)!
      expect(t.dist).toBe(Math.max(1, prev.dist - 1))
    }
  })

  it('is fully immutable and a no-op (same reference) once the fight is over', () => {
    const s = createFight(withWeapon('ironSword'))
    const next = resolveTurn(s, 'strike')
    expect(next).not.toBe(s)
    expect(s.tentacles.every((t) => t.hp === TENTACLE_HP)).toBe(true) // original untouched

    const won = playOut(createFight(withWeapon('jawbreakerMace')), (st) =>
      strikeTarget(st) ? 'strike' : 'brace',
    )
    if (fightOutcome(won) !== null) expect(resolveTurn(won, 'strike')).toBe(won)
  })

  it('scores the outcome: arms cleared wins, HP gone or the clock run out loses', () => {
    const base = createFight(withWeapon('ironSword'))
    expect(fightOutcome({ ...base, tentacles: [] })).toBe('won')
    expect(fightOutcome({ ...base, yourHp: 0 })).toBe('lost') // dragged under
    expect(fightOutcome({ ...base, turn: MAX_TURNS })).toBe('lost') // the gas etched through
    expect(fightOutcome(base)).toBeNull() // still fighting
    // the killing stroke beats simultaneous death: arms cleared wins even at 0 HP
    expect(fightOutcome({ ...base, tentacles: [], yourHp: 0 })).toBe('won')
  })

  it('bracing forever is a loss — the arms close and wear you down', () => {
    const s = playOut(createFight(withWeapon('ironSword')), () => 'brace')
    expect(fightOutcome(s)).toBe('lost')
  })
})

// The balance contract (grid-searched, asserted against the real engine). The fight must reward the forge
// ladder: bare-handed you cannot win; the mace's naive all-strike LOSES (you must learn to brace); and the
// bow safe-wins by intercepting on a tight clock. Tuning lives in content/planet/krakenFight.
describe('the sour kraken — the balance contract', () => {
  it('cannot be won bare-handed (come armed)', () => {
    expect(bestFinalHp(createFight(withWeapon(null)))).toBe(-Infinity)
  })

  it('punishes naive all-strike with the mace, but the mace can win with bracing', () => {
    const start = createFight(withWeapon('jawbreakerMace'))
    expect(fightOutcome(playOut(start, alwaysStrike))).toBe('lost') // mash-strike loses
    expect(bestFinalHp(start)).toBeGreaterThan(0) // but a braced line wins
  })

  it('lets each forged weapon win with skilled play, bow untouched (pure interception)', () => {
    for (const id of ['woodenSword', 'ironSword', 'candyCaneBow', 'licoriceWhip', 'jawbreakerMace']) {
      expect(bestFinalHp(createFight(withWeapon(id)))).toBeGreaterThan(0)
    }
    // the bow parries every arm: it ends at full HP (its identity — safe, slow, ranged)
    expect(bestFinalHp(createFight(withWeapon('candyCaneBow')))).toBe(KRAKEN_PLAYER_HP)
  })
})
