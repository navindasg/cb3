import { createDefaultSave } from '@/engine/state/defaultSave'
import { createResource } from '@/engine/types/Resource'
import {
  descentPortAvailable,
  photosphereDescentStarted,
  descentCuePlayed,
  shouldPlayDescentCue,
  markDescentCuePlayed,
  canDescend,
  photosphereCleared,
  startDescent,
  createDescent,
  rungHazard,
  descentOutcome,
  reachedCore,
  resolveRung,
  completePhotosphere,
  type PhotosphereState,
  type DescentAction,
} from '@/engine/content/photosphere'
import { act3GateCleared } from '@/engine/content/actGate'
import {
  PHOTOSPHERE_DESCENT_STARTED_FLAG,
  DESCENT_CUE_PLAYED_FLAG,
  PHOTOSPHERE_CLEARED_FLAG,
} from '@/content/flags'
import { GALLEON_HULL_KEY, GALLEON_HULL_GATE_TIER } from '@/content/ship/galleonUpgrade'
import { PEPPERMINT_GATE_AMOUNT } from '@/content/planet/mintPlanet'
import {
  MIN_COOLANT,
  MIN_PLATING,
  RUNG_COUNT,
  RUNG_HAZARDS,
  DESCENT_COST,
} from '@/content/sun/photosphere'
import type { GameState } from '@/engine/types/GameState'

// The photosphere descent — the ONE-CUE half (Act 4 — quest 11, DESIGN §194). We unit-test ONLY the pure
// engine predicate + the fire-once latch; the Web Audio synthesis (render/descentAudio) is coverage-excluded
// browser glue and is never executed here. We also assert that importing the engine module touches no
// AudioContext (it never imports the render glue), so the module loads clean in jsdom.

const withFlags = (flags: Record<string, boolean>): GameState => ({
  ...createDefaultSave(),
  flags: { ...flags },
})

const DYSON_STAGE5_DONE_FLAG = 'dysonStage5Done'
const BATHYSPHERE_BUILT_FLAG = 'bathysphereBuilt'

describe('descentPortAvailable (the reach gate)', () => {
  it('mirrors act3GateCleared exactly (false on a fresh save)', () => {
    const fresh = createDefaultSave()
    expect(descentPortAvailable(fresh)).toBe(false)
    expect(descentPortAvailable(fresh)).toBe(act3GateCleared(fresh))
  })

  it('is false with only the descent port raised (the bathysphere not yet built)', () => {
    const s = withFlags({ [DYSON_STAGE5_DONE_FLAG]: true })
    expect(descentPortAvailable(s)).toBe(false)
    expect(descentPortAvailable(s)).toBe(act3GateCleared(s))
  })

  it('is false with only the bathysphere built (the descent port not raised)', () => {
    const s = withFlags({ [BATHYSPHERE_BUILT_FLAG]: true })
    expect(descentPortAvailable(s)).toBe(false)
    expect(descentPortAvailable(s)).toBe(act3GateCleared(s))
  })

  it('is true once the Act-3 gate is cleared (both halves)', () => {
    const s = withFlags({ [DYSON_STAGE5_DONE_FLAG]: true, [BATHYSPHERE_BUILT_FLAG]: true })
    expect(descentPortAvailable(s)).toBe(true)
    expect(descentPortAvailable(s)).toBe(act3GateCleared(s))
  })

  it('does not depend on resources or the descent flags (it is purely the Act-3 gate)', () => {
    // A fully-gated save with the descent started must still report availability only via the act gate.
    const cleared = withFlags({ [DYSON_STAGE5_DONE_FLAG]: true, [BATHYSPHERE_BUILT_FLAG]: true })
    const withResources: GameState = {
      ...cleared,
      numbers: { [GALLEON_HULL_KEY]: GALLEON_HULL_GATE_TIER },
      peppermint: createResource(PEPPERMINT_GATE_AMOUNT),
    }
    expect(descentPortAvailable(withResources)).toBe(true)
  })
})

describe('photosphereDescentStarted (the started half)', () => {
  it('is false on a fresh save', () => {
    expect(photosphereDescentStarted(createDefaultSave())).toBe(false)
  })

  it('is true once the start flag is set', () => {
    expect(photosphereDescentStarted(withFlags({ [PHOTOSPHERE_DESCENT_STARTED_FLAG]: true }))).toBe(true)
  })

  it('treats a truthy-but-not-true flag as not started (strict)', () => {
    const s = withFlags({})
    const corrupt = { ...s, flags: { ...s.flags, [PHOTOSPHERE_DESCENT_STARTED_FLAG]: 1 as unknown as boolean } }
    expect(photosphereDescentStarted(corrupt)).toBe(false)
  })
})

describe('descentCuePlayed (the latch half)', () => {
  it('is false on a fresh save', () => {
    expect(descentCuePlayed(createDefaultSave())).toBe(false)
  })

  it('is true once the latch flag is set', () => {
    expect(descentCuePlayed(withFlags({ [DESCENT_CUE_PLAYED_FLAG]: true }))).toBe(true)
  })

  it('treats a truthy-but-not-true flag as not played (strict)', () => {
    const s = withFlags({})
    const corrupt = { ...s, flags: { ...s.flags, [DESCENT_CUE_PLAYED_FLAG]: 1 as unknown as boolean } }
    expect(descentCuePlayed(corrupt)).toBe(false)
  })
})

describe('shouldPlayDescentCue (the one audio decision)', () => {
  it('is false on a fresh save (the descent has not started)', () => {
    expect(shouldPlayDescentCue(createDefaultSave())).toBe(false)
  })

  it('is false when the descent has not started, even if the latch is somehow set', () => {
    expect(shouldPlayDescentCue(withFlags({ [DESCENT_CUE_PLAYED_FLAG]: true }))).toBe(false)
  })

  it('is TRUE exactly when the descent has started and the cue has not yet played', () => {
    expect(shouldPlayDescentCue(withFlags({ [PHOTOSPHERE_DESCENT_STARTED_FLAG]: true }))).toBe(true)
  })

  it('is false once the cue has played (started AND played)', () => {
    const s = withFlags({
      [PHOTOSPHERE_DESCENT_STARTED_FLAG]: true,
      [DESCENT_CUE_PLAYED_FLAG]: true,
    })
    expect(shouldPlayDescentCue(s)).toBe(false)
  })

  it('the full lifecycle: false -> true on start -> false forever after the latch is set (farm-proof)', () => {
    const before = createDefaultSave()
    expect(shouldPlayDescentCue(before)).toBe(false)

    const started = withFlags({ [PHOTOSPHERE_DESCENT_STARTED_FLAG]: true })
    expect(shouldPlayDescentCue(started)).toBe(true)

    const played = markDescentCuePlayed(started)
    expect(shouldPlayDescentCue(played)).toBe(false)

    // It can never re-arm: marking again is a no-op and the cue stays silent.
    expect(shouldPlayDescentCue(markDescentCuePlayed(played))).toBe(false)
  })
})

describe('markDescentCuePlayed (the fire-once latch)', () => {
  it('sets the descent-cue-played flag', () => {
    const s = withFlags({ [PHOTOSPHERE_DESCENT_STARTED_FLAG]: true })
    const after = markDescentCuePlayed(s)
    expect(after.flags[DESCENT_CUE_PLAYED_FLAG]).toBe(true)
    expect(descentCuePlayed(after)).toBe(true)
  })

  it('does not touch the started flag (it only sets the latch)', () => {
    const s = withFlags({ [PHOTOSPHERE_DESCENT_STARTED_FLAG]: true })
    const after = markDescentCuePlayed(s)
    expect(after.flags[PHOTOSPHERE_DESCENT_STARTED_FLAG]).toBe(true)
  })

  it('returns the SAME reference when the latch is already set (idempotent, no-op)', () => {
    const s = withFlags({ [DESCENT_CUE_PLAYED_FLAG]: true })
    expect(markDescentCuePlayed(s)).toBe(s)
  })

  it('returns the SAME reference on a repeat call (the latch makes a second mark a no-op)', () => {
    const started = withFlags({ [PHOTOSPHERE_DESCENT_STARTED_FLAG]: true })
    const once = markDescentCuePlayed(started)
    expect(markDescentCuePlayed(once)).toBe(once)
  })

  it('is immutable — the input state is not mutated', () => {
    const s = withFlags({ [PHOTOSPHERE_DESCENT_STARTED_FLAG]: true })
    markDescentCuePlayed(s)
    expect(s.flags[DESCENT_CUE_PLAYED_FLAG]).toBeUndefined()
  })
})

describe('test-safety: the engine module touches no AudioContext at import', () => {
  it('loaded the predicate module without constructing Web Audio (no AudioContext was referenced)', () => {
    // The engine module imports only types + the actGate predicate; the Web Audio glue lives in the
    // coverage-excluded render module and is never imported here. If importing this test file had touched
    // an AudioContext, jsdom would have thrown at load — reaching this assertion proves it did not.
    expect(typeof shouldPlayDescentCue).toBe('function')
    expect(typeof markDescentCuePlayed).toBe('function')
  })
})

// --- the descent gate, the spend-on-start, and the sim ----------------------

const DYSON_STAGE5_DONE = 'dysonStage5Done'
const BATHYSPHERE_BUILT = 'bathysphereBuilt'

/** An Act-3-cleared save (the reach gate met) with the given coolant + plating banked. */
const gatedWith = (mint: number, peppermint: number): GameState => ({
  ...createDefaultSave(),
  flags: { [DYSON_STAGE5_DONE]: true, [BATHYSPHERE_BUILT]: true },
  mint: createResource(mint),
  peppermint: createResource(peppermint),
})

describe('canDescend (the descent gate)', () => {
  it('is false on a fresh save (the Act-3 gate is not cleared)', () => {
    expect(canDescend(createDefaultSave())).toBe(false)
  })

  it('is false when the Act-3 gate is cleared but no coolant/plating is banked', () => {
    const s = withFlags({ [DYSON_STAGE5_DONE]: true, [BATHYSPHERE_BUILT]: true })
    expect(act3GateCleared(s)).toBe(true)
    expect(canDescend(s)).toBe(false)
  })

  it('is false without enough coolant (mint), even with plenty of plating', () => {
    expect(canDescend(gatedWith(MIN_COOLANT - 1, MIN_PLATING))).toBe(false)
  })

  it('is false without enough plating (peppermint), even with plenty of coolant', () => {
    expect(canDescend(gatedWith(MIN_COOLANT, MIN_PLATING - 1))).toBe(false)
  })

  it('is true once the Act-3 gate is cleared AND both batches are banked', () => {
    expect(canDescend(gatedWith(MIN_COOLANT, MIN_PLATING))).toBe(true)
  })

  it('is false once already cleared (no re-descent for value — farm-proof)', () => {
    const cleared: GameState = {
      ...gatedWith(MIN_COOLANT, MIN_PLATING),
      flags: { [DYSON_STAGE5_DONE]: true, [BATHYSPHERE_BUILT]: true, [PHOTOSPHERE_CLEARED_FLAG]: true },
    }
    expect(canDescend(cleared)).toBe(false)
  })

  it('gates only on EXISTING resources — both descent cost lines are mint/peppermint (never unobtainable)', () => {
    for (const line of DESCENT_COST) {
      expect(['mint', 'peppermint']).toContain(line.resource)
    }
  })
})

describe('startDescent (the atomic spend + the started flag)', () => {
  it('spends BOTH batches and sets the started flag, all in one returned state', () => {
    const s = gatedWith(MIN_COOLANT + 50, MIN_PLATING + 50)
    const res = startDescent(s)
    expect(res.ok).toBe(true)
    expect(res.state.mint.current).toBe(50)
    expect(res.state.peppermint.current).toBe(50)
    expect(photosphereDescentStarted(res.state)).toBe(true)
  })

  it('makes the cue fire-able: shouldPlayDescentCue is true the instant the descent starts', () => {
    const before = gatedWith(MIN_COOLANT, MIN_PLATING)
    expect(shouldPlayDescentCue(before)).toBe(false)
    const res = startDescent(before)
    expect(shouldPlayDescentCue(res.state)).toBe(true)
    // ...and false forever once the cue is marked played (the render glue's same-path dispatch).
    expect(shouldPlayDescentCue(markDescentCuePlayed(res.state))).toBe(false)
  })

  it('is a SAME-ref no-op before the Act-3 gate (locked) — nothing spent', () => {
    const s: GameState = { ...createDefaultSave(), mint: createResource(9999), peppermint: createResource(9999) }
    const res = startDescent(s)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('locked')
    expect(res.state).toBe(s)
  })

  it('is a SAME-ref no-op when either batch is short (unaffordable) — NEVER a partial spend', () => {
    const shortCoolant = startDescent(gatedWith(MIN_COOLANT - 1, MIN_PLATING))
    expect(shortCoolant.ok).toBe(false)
    expect(shortCoolant.reason).toBe('unaffordable')

    // plating short: coolant must NOT have been spent (no partial) — the SAME ref comes back.
    const before = gatedWith(MIN_COOLANT, MIN_PLATING - 1)
    const shortPlating = startDescent(before)
    expect(shortPlating.ok).toBe(false)
    expect(shortPlating.reason).toBe('unaffordable')
    expect(shortPlating.state).toBe(before)
    expect(shortPlating.state.mint.current).toBe(MIN_COOLANT)
  })

  it('is a SAME-ref no-op once already cleared (alreadyCleared)', () => {
    const cleared: GameState = {
      ...gatedWith(MIN_COOLANT, MIN_PLATING),
      flags: { [DYSON_STAGE5_DONE]: true, [BATHYSPHERE_BUILT]: true, [PHOTOSPHERE_CLEARED_FLAG]: true },
    }
    const res = startDescent(cleared)
    expect(res.ok).toBe(false)
    expect(res.reason).toBe('alreadyCleared')
    expect(res.state).toBe(cleared)
  })

  it('is immutable — the input state is not mutated', () => {
    const s = gatedWith(MIN_COOLANT, MIN_PLATING)
    startDescent(s)
    expect(s.mint.current).toBe(MIN_COOLANT)
    expect(s.peppermint.current).toBe(MIN_PLATING)
    expect(photosphereDescentStarted(s)).toBe(false)
  })
})

describe('the descent sim (transient — the kraken/reef idiom)', () => {
  it('opens fully charged at the top rung, with the core not yet reached', () => {
    const d = createDescent()
    expect(d.rung).toBe(0)
    expect(d.coolant).toBe(MIN_COOLANT)
    expect(d.plating).toBe(MIN_PLATING)
    expect(descentOutcome(d)).toBeNull()
    expect(reachedCore(d)).toBe(false)
  })

  it('telegraphs the current rung hazard, null past the last rung', () => {
    const d = createDescent()
    expect(rungHazard(d)).toBe(RUNG_HAZARDS[0])
    expect(rungHazard({ ...d, rung: RUNG_COUNT })).toBeNull()
  })

  it('drops one rung per resolved action and is immutable', () => {
    const d = createDescent()
    const next = resolveRung(d, 'brace')
    expect(next).not.toBe(d)
    expect(next.rung).toBe(1)
    expect(d.rung).toBe(0) // original untouched
  })

  it('a no-op (SAME reference) once the descent is over', () => {
    const won: PhotosphereState = { rung: RUNG_COUNT, coolant: 10, plating: 10 }
    expect(resolveRung(won, 'vent')).toBe(won)
    const lost: PhotosphereState = { rung: 3, coolant: 0, plating: 10 }
    expect(resolveRung(lost, 'brace')).toBe(lost)
  })

  it('scores the outcome: reaching the core wins (even on the last reserves), a dry gauge loses', () => {
    expect(descentOutcome({ rung: RUNG_COUNT, coolant: 1, plating: 1 })).toBe('reachedCore')
    expect(descentOutcome({ rung: RUNG_COUNT, coolant: 0, plating: 0 })).toBe('reachedCore') // got down
    expect(descentOutcome({ rung: 4, coolant: 0, plating: 50 })).toBe('lost') // coolant out
    expect(descentOutcome({ rung: 4, coolant: 50, plating: 0 })).toBe('lost') // plating out
    expect(descentOutcome({ rung: 4, coolant: 50, plating: 50 })).toBeNull() // still falling
  })

  it('a clean read (vent flares, brace storms) reaches the core from a full batch', () => {
    let d = createDescent()
    for (let i = 0; i < 100 && descentOutcome(d) === null; i++) {
      const h = rungHazard(d)
      d = resolveRung(d, h === 'flare' ? 'vent' : 'brace')
    }
    expect(descentOutcome(d)).toBe('reachedCore')
    // ...and it is a TIGHT survival — both gauges near the floor (the narrated dread is real).
    expect(d.coolant).toBeLessThan(MIN_COOLANT * 0.3)
    expect(d.plating).toBeLessThan(MIN_PLATING * 0.4)
  })
})

// The balance contract (grid-searched against the real sim). The §194 gauntlet must reward the resources
// you ground out across Act 2/3: a full coolant+plating batch survives with a clean read, naive all-vent
// and all-brace BOTH run a gauge dry before the core, and a meaningfully thin entry is unsolvable even with
// perfect play — so BOTH mint coolant and peppermint plating are a binding constraint, not flavor. Tuning
// lives in content/sun/photosphere.
describe('the photosphere descent — the balance contract', () => {
  /** Play a descent from a seeded state with a fixed strategy. */
  const playOut = (start: PhotosphereState, choose: (s: PhotosphereState) => DescentAction): PhotosphereState => {
    let s = start
    for (let i = 0; i < 200 && descentOutcome(s) === null; i++) s = resolveRung(s, choose(s))
    return s
  }
  /** Whether a winning line exists from a seeded state (exhaustive memoized search over vent/brace). */
  const solvable = (start: PhotosphereState): boolean => {
    const memo = new Map<string, boolean>()
    const search = (s: PhotosphereState): boolean => {
      const o = descentOutcome(s)
      if (o === 'reachedCore') return true
      if (o === 'lost') return false
      const key = `${s.rung}|${s.coolant}|${s.plating}`
      const cached = memo.get(key)
      if (cached !== undefined) return cached
      const r = search(resolveRung(s, 'vent')) || search(resolveRung(s, 'brace'))
      memo.set(key, r)
      return r
    }
    return search(start)
  }
  const cleanRead = (s: PhotosphereState): DescentAction => (rungHazard(s) === 'flare' ? 'vent' : 'brace')
  const seed = (coolant: number, plating: number): PhotosphereState => ({ rung: 0, coolant, plating })

  it('a full batch is solvable, and the clean read is a winning line', () => {
    expect(solvable(createDescent())).toBe(true)
    expect(descentOutcome(playOut(createDescent(), cleanRead))).toBe('reachedCore')
  })

  it('naive all-vent LOSES (it does nothing for storms and bleeds the hull on every flare)', () => {
    expect(descentOutcome(playOut(createDescent(), () => 'vent'))).toBe('lost')
  })

  it('naive all-brace LOSES (a braced flare cooks the hull — the wrong read kills you)', () => {
    expect(descentOutcome(playOut(createDescent(), () => 'brace'))).toBe('lost')
  })

  it('a half-coolant entry is unsolvable even with perfect play (coolant is a binding constraint)', () => {
    expect(solvable(seed(Math.floor(MIN_COOLANT / 2), MIN_PLATING))).toBe(false)
  })

  it('a half-plating entry is unsolvable even with perfect play (plating is a binding constraint)', () => {
    expect(solvable(seed(MIN_COOLANT, Math.floor(MIN_PLATING / 2)))).toBe(false)
  })

  it('a half-of-both entry is unsolvable (a thin vessel cannot ride the star down)', () => {
    expect(solvable(seed(Math.floor(MIN_COOLANT / 2), Math.floor(MIN_PLATING / 2)))).toBe(false)
  })
})

describe('completePhotosphere (the commit-once cleared flag)', () => {
  it('sets the cleared flag', () => {
    const after = completePhotosphere(createDefaultSave())
    expect(after.flags[PHOTOSPHERE_CLEARED_FLAG]).toBe(true)
    expect(photosphereCleared(after)).toBe(true)
  })

  it('returns the SAME reference when already cleared (idempotent, no-op — farm-proof)', () => {
    const cleared = completePhotosphere(createDefaultSave())
    expect(completePhotosphere(cleared)).toBe(cleared)
  })

  it('is immutable — the input state is not mutated', () => {
    const s = createDefaultSave()
    completePhotosphere(s)
    expect(s.flags[PHOTOSPHERE_CLEARED_FLAG]).toBeUndefined()
  })

  it('blocks re-descent: canDescend is false after clearing, even with batches re-banked', () => {
    const cleared: GameState = {
      ...completePhotosphere(gatedWith(MIN_COOLANT, MIN_PLATING)),
    }
    expect(photosphereCleared(cleared)).toBe(true)
    expect(canDescend(cleared)).toBe(false)
  })
})
