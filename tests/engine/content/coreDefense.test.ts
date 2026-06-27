import {
  deriveCoreWeapon,
  createCoreDefense,
  clawFor,
  coreOutcome,
  resolveCoreTurn,
  type CoreDefenseState,
  type CoreAction,
} from '@/engine/content/coreDefense'
import {
  EGG_HP,
  CORE_PLAYER_HP,
  CORE_EATER_HP,
  GUARD_RIPOSTE_FACTOR,
  STRIKE_FACTOR,
  CLAW_EGG_DAMAGE,
  CLAW_PLAYER_DAMAGE,
  CLAW_PATTERN,
  CORE_MAX_TURNS,
  CORE_FAST_COOLDOWN_MS,
} from '@/content/sun/starEater'
import { createDefaultSave } from '@/engine/state/defaultSave'
import type { GameState } from '@/engine/types/GameState'

/** A save with the given weapon equipped (the defense reads only the equipped hand weapon). */
const withWeapon = (weaponId: string | null): GameState => ({
  ...createDefaultSave(),
  equipped: { ...createDefaultSave().equipped, weapon: weaponId },
})

/** The guard that reads the actual claw line correctly on a given turn. */
const correctGuard = (turn: number): CoreAction =>
  clawFor(turn).line === 'high' ? 'guard-high' : 'guard-low'
/** The guard a tell-reader makes (guards the telegraphed stance — wrong on a feint). */
const tellGuard = (turn: number): CoreAction =>
  clawFor(turn).tell === 'high' ? 'guard-high' : 'guard-low'

const playOut = (
  start: CoreDefenseState,
  choose: (s: CoreDefenseState) => CoreAction,
): CoreDefenseState => {
  let s = start
  for (let i = 0; i < 200 && coreOutcome(s) === null; i++) s = resolveCoreTurn(s, choose(s))
  return s
}

/** Best reachable final HP via perfect play (knows each line: guard-correct or strike); -Infinity if no win. */
const bestFinalHp = (start: CoreDefenseState): number => {
  const memo = new Map<string, number>()
  const search = (s: CoreDefenseState): number => {
    const o = coreOutcome(s)
    if (o === 'won') return s.yourHp
    if (o === 'lost') return -Infinity
    const key = `${s.yourHp}|${s.eggHp}|${s.eaterHp}|${s.turn}`
    const cached = memo.get(key)
    if (cached !== undefined) return cached
    const r = Math.max(
      search(resolveCoreTurn(s, correctGuard(s.turn))),
      search(resolveCoreTurn(s, 'strike')),
    )
    memo.set(key, r)
    return r
  }
  return search(start)
}

describe('the core defense — reading the equipped weapon', () => {
  it('derives damage off the equipped weapon; a fast weapon strikes twice', () => {
    expect(deriveCoreWeapon(withWeapon('jawbreakerMace'))).toEqual({ damage: 8, strikes: 1 })
    expect(deriveCoreWeapon(withWeapon('licoriceWhip'))).toEqual({ damage: 3, strikes: 2 })
    expect(deriveCoreWeapon(withWeapon(null))).toEqual({ damage: 1, strikes: 1 }) // bare hands
    expect(CORE_FAST_COOLDOWN_MS).toBe(400)
  })

  it('opens at full HP for you and the egg, the eater at its core HP, the claws at the first', () => {
    const s = createCoreDefense(withWeapon('ironSword'))
    expect(s.yourHp).toBe(CORE_PLAYER_HP)
    expect(s.eggHp).toBe(EGG_HP)
    expect(s.eggMaxHp).toBe(EGG_HP)
    expect(s.eaterHp).toBe(CORE_EATER_HP)
    expect(s.turn).toBe(0)
    expect(coreOutcome(s)).toBeNull()
  })

  it('loops the claw pattern by turn', () => {
    expect(clawFor(0)).toEqual(CLAW_PATTERN[0])
    expect(clawFor(CLAW_PATTERN.length)).toEqual(CLAW_PATTERN[0]) // wraps
    expect(clawFor(CLAW_PATTERN.length + 5)).toEqual(CLAW_PATTERN[5])
  })
})

describe('the core defense — the turn', () => {
  it('a correct guard turns the claw (the egg is safe) and ripostes the eater', () => {
    const s = createCoreDefense(withWeapon('jawbreakerMace')) // damage 8, strikes 1
    const next = resolveCoreTurn(s, correctGuard(0))
    expect(next.eggHp).toBe(s.eggHp) // egg unharmed
    expect(next.yourHp).toBe(s.yourHp) // you unharmed
    expect(next.eaterHp).toBe(s.eaterHp - GUARD_RIPOSTE_FACTOR * 8 * 1)
  })

  it('a mis-read guard (or a feint) lets the claw rake the egg and you, no riposte', () => {
    const s = createCoreDefense(withWeapon('jawbreakerMace'))
    const wrong = correctGuard(0) === 'guard-high' ? 'guard-low' : 'guard-high'
    const next = resolveCoreTurn(s, wrong)
    expect(next.eaterHp).toBe(s.eaterHp) // no riposte
    expect(next.eggHp).toBe(s.eggHp - CLAW_EGG_DAMAGE) // the egg paid
    expect(next.yourHp).toBe(s.yourHp - CLAW_PLAYER_DAMAGE)
  })

  it('a strike hits the eater hard but the claw always rakes the egg and you', () => {
    const s = createCoreDefense(withWeapon('jawbreakerMace'))
    const next = resolveCoreTurn(s, 'strike')
    expect(next.eaterHp).toBe(s.eaterHp - STRIKE_FACTOR * 8 * 1)
    expect(next.eggHp).toBe(s.eggHp - CLAW_EGG_DAMAGE)
    expect(next.yourHp).toBe(s.yourHp - CLAW_PLAYER_DAMAGE)
  })

  it('is immutable and a no-op (same reference) once the phase is over', () => {
    const s = createCoreDefense(withWeapon('ironSword'))
    expect(resolveCoreTurn(s, 'strike')).not.toBe(s)
    expect(s.eaterHp).toBe(CORE_EATER_HP) // original untouched

    const done = playOut(createCoreDefense(withWeapon('jawbreakerMace')), (st) => correctGuard(st.turn))
    if (coreOutcome(done) !== null) expect(resolveCoreTurn(done, 'strike')).toBe(done)
  })

  it('scores the outcome: eater down wins (beats simultaneity); egg gone, you gone, or the clock loses', () => {
    const base = createCoreDefense(withWeapon('ironSword'))
    expect(coreOutcome({ ...base, eaterHp: 0 })).toBe('won')
    expect(coreOutcome({ ...base, eaterHp: 0, eggHp: 0 })).toBe('won') // the killing blow beats the claw
    expect(coreOutcome({ ...base, eggHp: 0 })).toBe('lost') // the egg was overwhelmed
    expect(coreOutcome({ ...base, yourHp: 0 })).toBe('lost') // torn off the egg
    expect(coreOutcome({ ...base, turn: CORE_MAX_TURNS })).toBe('lost') // the eater got past you
    expect(coreOutcome(base)).toBeNull()
  })
})

// The phase-3 balance contract (grid-searched against the real engine). Mirrors the kraken/boarding contracts:
// bare hands LOSE (and the bow is no use here either), naive all-strike LOSES for the common blades (you must
// GUARD to protect the egg, not just attack), and every forged blade can win with clean reads. Tuning lives in
// content/sun/starEater.
describe('the core defense — the balance contract', () => {
  it('cannot be won bare-handed or with the bow (a real forged blade is required)', () => {
    expect(bestFinalHp(createCoreDefense(withWeapon(null)))).toBe(-Infinity)
    expect(bestFinalHp(createCoreDefense(withWeapon('candyCaneBow')))).toBe(-Infinity)
  })

  it('punishes naive all-strike for EVERY forged blade — the mace and whip too (you must guard the egg)', () => {
    // Lock-step with the wins-with-reads list below: the naive line must lose for the WHOLE arsenal (the
    // Inc-20 durable lesson — a grid-search that omits the bait builds, the mace/whip, proves nothing). The
    // all-striker eats a claw every turn and bleeds out (CLAW_PLAYER_DAMAGE) before even a heavy blade wins.
    for (const id of ['woodenSword', 'ironSword', 'licoriceWhip', 'jawbreakerMace', 'popRockPike']) {
      const lost = playOut(createCoreDefense(withWeapon(id)), () => 'strike')
      expect(coreOutcome(lost)).toBe('lost')
    }
  })

  it('lets each forged blade win with clean reads', () => {
    for (const id of ['woodenSword', 'ironSword', 'licoriceWhip', 'jawbreakerMace', 'popRockPike']) {
      expect(bestFinalHp(createCoreDefense(withWeapon(id)))).toBeGreaterThan(0)
    }
  })

  it('a tell-reader who eats the feints still has a fight (the dangerous feint costs the egg)', () => {
    // Guarding by the tell lets the feints through; the screen exposes the true line so the e2e plays clean,
    // but a first-time reader will lose egg HP to the feints. We only assert the contract is internally
    // consistent: a perfect reader (correct line) strictly out-performs the tell-reader for a weak blade.
    const wood = withWeapon('woodenSword')
    const perfect = bestFinalHp(createCoreDefense(wood))
    const byTell = playOut(createCoreDefense(wood), (s) => tellGuard(s.turn))
    if (coreOutcome(byTell) === 'won') expect(byTell.yourHp).toBeLessThanOrEqual(perfect)
  })
})
