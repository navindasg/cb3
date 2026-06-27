import { createDefaultSave } from '@/engine/state/defaultSave'
import { act1GateCleared, act2GateCleared, act3GateCleared } from '@/engine/content/actGate'
import { createResource } from '@/engine/types/Resource'
import { CELESTIAL_NAVIGATION_FLAG, FISHBOWL_HELM_FORGED_FLAG } from '@/content/flags'
import { GALLEON_HULL_KEY, GALLEON_HULL_GATE_TIER } from '@/content/ship/galleonUpgrade'
import { PEPPERMINT_GATE_AMOUNT } from '@/content/planet/mintPlanet'
import type { GameState } from '@/engine/types/GameState'

const DYSON_STAGE5_DONE_FLAG = 'dysonStage5Done'
const BATHYSPHERE_BUILT_FLAG = 'bathysphereBuilt'

const withFlags = (flags: Record<string, boolean>): GameState => ({
  ...createDefaultSave(),
  flags: { ...flags },
})

describe('the Act-1 gate', () => {
  it('is not cleared with neither half done', () => {
    expect(act1GateCleared(createDefaultSave())).toBe(false)
  })

  it('is not cleared with only celestial navigation learned', () => {
    expect(act1GateCleared(withFlags({ [CELESTIAL_NAVIGATION_FLAG]: true }))).toBe(false)
  })

  it('is not cleared with only the fishbowl helm forged', () => {
    expect(act1GateCleared(withFlags({ [FISHBOWL_HELM_FORGED_FLAG]: true }))).toBe(false)
  })

  it('is cleared once both halves are done', () => {
    const s = withFlags({ [CELESTIAL_NAVIGATION_FLAG]: true, [FISHBOWL_HELM_FORGED_FLAG]: true })
    expect(act1GateCleared(s)).toBe(true)
  })

  it('treats non-true flag values as not done (strict)', () => {
    // A hand-edited / corrupt save with truthy-but-not-true values must not open the gate.
    const s = withFlags({ [CELESTIAL_NAVIGATION_FLAG]: true } as Record<string, boolean>)
    expect(act1GateCleared({ ...s, flags: { ...s.flags, [FISHBOWL_HELM_FORGED_FLAG]: 1 as unknown as boolean } })).toBe(false)
  })
})

// --- the Act-2 gate (hull t3 + 10k peppermint), parametric so Act-3 cannot regress it ----------------

/** A save with the hull tier and peppermint bank set to a chosen state. */
const act2State = (hullTier: number, peppermint: number): GameState => ({
  ...createDefaultSave(),
  numbers: { [GALLEON_HULL_KEY]: hullTier },
  peppermint: createResource(peppermint),
})

describe('the Act-2 gate', () => {
  it('is not cleared on a fresh save', () => {
    expect(act2GateCleared(createDefaultSave())).toBe(false)
  })

  it('is not cleared with the hull short of the gate tier (even with the peppermint banked)', () => {
    expect(act2GateCleared(act2State(GALLEON_HULL_GATE_TIER - 1, PEPPERMINT_GATE_AMOUNT))).toBe(false)
  })

  it('is not cleared with peppermint short of the threshold (even at hull tier)', () => {
    expect(act2GateCleared(act2State(GALLEON_HULL_GATE_TIER, PEPPERMINT_GATE_AMOUNT - 1))).toBe(false)
  })

  it('is cleared once both halves are met (hull at gate tier AND the peppermint bank)', () => {
    expect(act2GateCleared(act2State(GALLEON_HULL_GATE_TIER, PEPPERMINT_GATE_AMOUNT))).toBe(true)
  })
})

// --- the Act-3 gate (descent port raised + the bathysphere built), parametric over the matrix ---------

describe('the Act-3 gate', () => {
  // The full 2x2 matrix of (stage-5 raised?) x (bathysphere built?). Only both-true clears the gate.
  const cases: ReadonlyArray<{ stage5: boolean; built: boolean; cleared: boolean }> = [
    { stage5: false, built: false, cleared: false },
    { stage5: true, built: false, cleared: false },
    { stage5: false, built: true, cleared: false },
    { stage5: true, built: true, cleared: true },
  ]

  for (const { stage5, built, cleared } of cases) {
    it(`stage5=${stage5} built=${built} -> cleared=${cleared}`, () => {
      const flags: Record<string, boolean> = {}
      if (stage5) flags[DYSON_STAGE5_DONE_FLAG] = true
      if (built) flags[BATHYSPHERE_BUILT_FLAG] = true
      expect(act3GateCleared(withFlags(flags))).toBe(cleared)
    })
  }

  it('treats non-true build/stage flags as not done (strict)', () => {
    const s = withFlags({ [DYSON_STAGE5_DONE_FLAG]: true } as Record<string, boolean>)
    expect(
      act3GateCleared({ ...s, flags: { ...s.flags, [BATHYSPHERE_BUILT_FLAG]: 1 as unknown as boolean } }),
    ).toBe(false)
  })

  it('does not regress the Act-1 or Act-2 gates when the Act-3 flags are set', () => {
    // Setting the Act-3 flags on an otherwise-fresh save must not spuriously clear the earlier gates.
    const s = withFlags({ [DYSON_STAGE5_DONE_FLAG]: true, [BATHYSPHERE_BUILT_FLAG]: true })
    expect(act1GateCleared(s)).toBe(false)
    expect(act2GateCleared(s)).toBe(false)
    expect(act3GateCleared(s)).toBe(true)
  })
})
