import { createDefaultSave } from '@/engine/state/defaultSave'
import { createResource } from '@/engine/types/Resource'
import {
  descentPortAvailable,
  photosphereDescentStarted,
  descentCuePlayed,
  shouldPlayDescentCue,
  markDescentCuePlayed,
} from '@/engine/content/photosphere'
import { act3GateCleared } from '@/engine/content/actGate'
import {
  PHOTOSPHERE_DESCENT_STARTED_FLAG,
  DESCENT_CUE_PLAYED_FLAG,
} from '@/content/flags'
import { GALLEON_HULL_KEY, GALLEON_HULL_GATE_TIER } from '@/content/ship/galleonUpgrade'
import { PEPPERMINT_GATE_AMOUNT } from '@/content/planet/mintPlanet'
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
