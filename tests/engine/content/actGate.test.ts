import { createDefaultSave } from '@/engine/state/defaultSave'
import { act1GateCleared } from '@/engine/content/actGate'
import { CELESTIAL_NAVIGATION_FLAG, FISHBOWL_HELM_FORGED_FLAG } from '@/content/flags'
import type { GameState } from '@/engine/types/GameState'

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
