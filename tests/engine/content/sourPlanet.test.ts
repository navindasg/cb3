import {
  flavorFusionLearned,
  learnFusion,
  canTradeSour,
  tradeSour,
  observeSourDwell,
  sourMarinated,
  sourDwellMs,
  SOUR_MARINATE_FLAG,
  SOUR_DWELL_ANCHOR_KEY,
  SOUR_RESIST_KEY,
  SOUR_MARINATE_MS,
  SOUR_MARINATE_RESIST,
} from '@/engine/content/sourPlanet'
import { SOUR_TRADE_CANDY_COST, SOUR_TRADE_BATCH } from '@/content/planet/sourPlanet'
import { FLAVOR_FUSION_FLAG } from '@/content/flags'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { createResource } from '@/engine/types/Resource'
import type { GameState } from '@/engine/types/GameState'

const withCandies = (n: number): GameState => ({ ...createDefaultSave(), candies: createResource(n) })

/** A bare (unarmoured) save parked at a given accumulated game time. */
const atTime = (ms: number): GameState => ({ ...createDefaultSave(), accumulatedGameTimeMs: ms })

/** Wear armour: mark the armour slot occupied (any id will do — only null/non-null matters). */
const armoured = (s: GameState): GameState => ({ ...s, equipped: { ...s.equipped, armour: 'someArmour' } })

describe('the sour planet — learning flavor fusion', () => {
  it('starts unlearned and is learned once the elder teaches you', () => {
    const s = createDefaultSave()
    expect(flavorFusionLearned(s)).toBe(false)
    const result = learnFusion(s)
    expect(result.ok).toBe(true)
    expect(result.state.flags[FLAVOR_FUSION_FLAG]).toBe(true)
    expect(flavorFusionLearned(result.state)).toBe(true)
  })

  it('is a no-op (same reference) once already learned', () => {
    const learned = learnFusion(createDefaultSave()).state
    const again = learnFusion(learned)
    expect(again.ok).toBe(false)
    expect(again.state).toBe(learned)
  })
})

describe('the sour planet — trading for sour essence', () => {
  it('trades a candy batch for sour essence', () => {
    const s = withCandies(SOUR_TRADE_CANDY_COST * 2)
    expect(canTradeSour(s)).toBe(true)
    const result = tradeSour(s)
    expect(result.ok).toBe(true)
    expect(result.state.candies.current).toBe(SOUR_TRADE_CANDY_COST)
    expect(result.state.sour.current).toBe(SOUR_TRADE_BATCH)
  })

  it('refuses (same reference) when candies are short', () => {
    const s = withCandies(SOUR_TRADE_CANDY_COST - 1)
    expect(canTradeSour(s)).toBe(false)
    const result = tradeSour(s)
    expect(result.ok).toBe(false)
    expect(result.state).toBe(s)
  })
})

describe('the sour planet — the sour-rain marinate (§18)', () => {
  it('starts unmarinated with no dwell', () => {
    const s = createDefaultSave()
    expect(sourMarinated(s)).toBe(false)
    expect(sourDwellMs(s)).toBe(0)
  })

  it('the first bare observation anchors the dwell at the current accumulated game time', () => {
    const s = atTime(5_000)
    const result = observeSourDwell(s)
    expect(result.marinated).toBe(false)
    expect(result.state.numbers[SOUR_DWELL_ANCHOR_KEY]).toBe(5_000)
    // With the anchor just set at 'now', the dwell so far is zero.
    expect(sourDwellMs(result.state)).toBe(0)
  })

  it('accumulates dwell as accumulated game time advances (offline-safe, not wall clock)', () => {
    const anchored = observeSourDwell(atTime(1_000)).state
    // 30s later (in ACCUMULATED game time — this advances through background/catch-up).
    const later: GameState = { ...anchored, accumulatedGameTimeMs: 31_000 }
    expect(sourDwellMs(later)).toBe(30_000)
    // Not yet a full minute → no marinate, and the anchor is untouched (SAME reference).
    const still = observeSourDwell(later)
    expect(still.marinated).toBe(false)
    expect(still.state).toBe(later)
  })

  it('fires the marinate at EXACTLY 60s of unbroken bare dwell, once, granting +1 sour resist', () => {
    const anchored = observeSourDwell(atTime(0)).state
    // One tick short of a minute: nothing yet.
    const almost: GameState = { ...anchored, accumulatedGameTimeMs: SOUR_MARINATE_MS - 1 }
    expect(observeSourDwell(almost).marinated).toBe(false)
    // Exactly a minute: the marinate fires.
    const ripe: GameState = { ...anchored, accumulatedGameTimeMs: SOUR_MARINATE_MS }
    const result = observeSourDwell(ripe)
    expect(result.marinated).toBe(true)
    expect(result.state.flags[SOUR_MARINATE_FLAG]).toBe(true)
    expect(sourMarinated(result.state)).toBe(true)
    expect(result.state.numbers[SOUR_RESIST_KEY]).toBe(SOUR_MARINATE_RESIST)
    expect(SOUR_MARINATE_MS).toBe(60_000)
  })

  it('is farm-proof: a second observation after marinating is a no-op (SAME ref, resist not stacked)', () => {
    const anchored = observeSourDwell(atTime(0)).state
    const ripe: GameState = { ...anchored, accumulatedGameTimeMs: SOUR_MARINATE_MS }
    const marinated = observeSourDwell(ripe).state
    // Push time way forward and observe again — no double resist, no re-fire (SAME reference back).
    const later: GameState = { ...marinated, accumulatedGameTimeMs: SOUR_MARINATE_MS * 10 }
    const again = observeSourDwell(later)
    expect(again.marinated).toBe(false)
    expect(again.state).toBe(later)
    expect(again.state.numbers[SOUR_RESIST_KEY]).toBe(SOUR_MARINATE_RESIST) // still exactly +1
  })

  it('equipping armour breaks the dwell: the anchor is cleared (you flinched)', () => {
    const anchored = observeSourDwell(atTime(1_000)).state
    expect(anchored.numbers[SOUR_DWELL_ANCHOR_KEY]).toBe(1_000)
    const inArmour = armoured({ ...anchored, accumulatedGameTimeMs: 30_000 })
    const result = observeSourDwell(inArmour)
    expect(result.marinated).toBe(false)
    expect(result.state.numbers[SOUR_DWELL_ANCHOR_KEY]).toBeLessThan(0) // reset — start over bare
    expect(sourDwellMs(result.state)).toBe(0)
  })

  it('a bare dwell anchored at accumulated-time ZERO is a REAL anchor (0 is not a "cleared" sentinel)', () => {
    const anchored = observeSourDwell(atTime(0)).state
    expect(anchored.numbers[SOUR_DWELL_ANCHOR_KEY]).toBe(0)
    // A second observation at t=0 must NOT re-anchor / treat 0 as "not dwelling" — SAME reference.
    const again = observeSourDwell(anchored)
    expect(again.state).toBe(anchored)
  })

  it('re-anchors fresh after armour was worn: the clock restarts (no credit for time in armour)', () => {
    // Anchor bare at t=0, then wear armour at t=30s (clears the anchor), then go bare again at t=40s.
    const anchored = observeSourDwell(atTime(0)).state
    const cleared = observeSourDwell(armoured({ ...anchored, accumulatedGameTimeMs: 30_000 })).state
    const bareAgain = observeSourDwell({ ...cleared, equipped: createDefaultSave().equipped, accumulatedGameTimeMs: 40_000 })
    // The fresh anchor is stamped at t=40s — the earlier 30s of bare dwell is forfeit.
    expect(bareAgain.state.numbers[SOUR_DWELL_ANCHOR_KEY]).toBe(40_000)
    // A full minute later (t=100s) it finally marinates — 60s from the FRESH anchor, not from t=0.
    const ripe = observeSourDwell({ ...bareAgain.state, accumulatedGameTimeMs: 100_000 })
    expect(ripe.marinated).toBe(true)
  })

  it('sourDwellMs reads 0 while armoured, regardless of any stale anchor', () => {
    const anchored = observeSourDwell(atTime(1_000)).state
    const inArmour = armoured({ ...anchored, accumulatedGameTimeMs: 50_000 })
    expect(sourDwellMs(inArmour)).toBe(0)
  })

  it('does not mutate the input state', () => {
    const before = atTime(2_000)
    observeSourDwell(before)
    expect(before.numbers[SOUR_DWELL_ANCHOR_KEY]).toBeUndefined()
  })
})
