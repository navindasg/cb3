import {
  descentPortOpen,
  bathysphereBuilt,
  canBuildBathysphere,
  buildBathysphere,
} from '@/engine/content/bathysphere'
import {
  BATHYSPHERE_PRICE,
  BATHYSPHERE_ITEM_ID,
  BATHYSPHERE_PEPPERMINT_COST,
  BATHYSPHERE_MINT_COST,
  BATHYSPHERE_CARAMEL_COST,
} from '@/content/sun/bathysphere'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { createResource } from '@/engine/types/Resource'
import type { GameState } from '@/engine/types/GameState'

const DYSON_STAGE5_DONE_FLAG = 'dysonStage5Done'
const BATHYSPHERE_BUILT_FLAG = 'bathysphereBuilt'

/** A save with the descent port open (stage 5 raised) and deep peppermint/mint/caramel stocks. */
const atDescentPort = (over: Partial<GameState> = {}): GameState => ({
  ...createDefaultSave(),
  flags: { [DYSON_STAGE5_DONE_FLAG]: true },
  peppermint: createResource(BATHYSPHERE_PEPPERMINT_COST * 2),
  mint: createResource(BATHYSPHERE_MINT_COST * 2),
  caramel: createResource(BATHYSPHERE_CARAMEL_COST * 2),
  ...over,
})

describe('the peppermint bathysphere — the descent port gate', () => {
  it('the descent port is shut before stage 5 is raised', () => {
    expect(descentPortOpen(createDefaultSave())).toBe(false)
  })

  it('the descent port opens once dysonStage5Done is set', () => {
    expect(descentPortOpen({ ...createDefaultSave(), flags: { [DYSON_STAGE5_DONE_FLAG]: true } })).toBe(true)
  })

  it('treats a non-true stage-5 flag as shut (strict)', () => {
    const s = { ...createDefaultSave(), flags: { [DYSON_STAGE5_DONE_FLAG]: 1 as unknown as boolean } }
    expect(descentPortOpen(s)).toBe(false)
  })
})

describe('the peppermint bathysphere — canBuildBathysphere', () => {
  it('is true when the port is open, not yet built, and all three lines are affordable', () => {
    expect(canBuildBathysphere(atDescentPort())).toBe(true)
  })

  it('is false before the descent port is open even with the materials banked', () => {
    const s = atDescentPort({ flags: {} })
    expect(descentPortOpen(s)).toBe(false)
    expect(canBuildBathysphere(s)).toBe(false)
  })

  it('is false once already built (no second build)', () => {
    const s = atDescentPort({
      flags: { [DYSON_STAGE5_DONE_FLAG]: true, [BATHYSPHERE_BUILT_FLAG]: true },
    })
    expect(canBuildBathysphere(s)).toBe(false)
  })

  it('is false when ANY one cost line is short (no partial credit)', () => {
    expect(canBuildBathysphere(atDescentPort({ peppermint: createResource(BATHYSPHERE_PEPPERMINT_COST - 1) }))).toBe(false)
    expect(canBuildBathysphere(atDescentPort({ mint: createResource(BATHYSPHERE_MINT_COST - 1) }))).toBe(false)
    expect(canBuildBathysphere(atDescentPort({ caramel: createResource(BATHYSPHERE_CARAMEL_COST - 1) }))).toBe(false)
  })
})

describe('the peppermint bathysphere — buildBathysphere', () => {
  it('spends peppermint + mint + caramel EXACTLY, sets the flag, and banks the owned item', () => {
    const before = atDescentPort()
    const result = buildBathysphere(before)
    expect(result.ok).toBe(true)
    expect(result.state.peppermint.current).toBe(before.peppermint.current - BATHYSPHERE_PEPPERMINT_COST)
    expect(result.state.mint.current).toBe(before.mint.current - BATHYSPHERE_MINT_COST)
    expect(result.state.caramel.current).toBe(before.caramel.current - BATHYSPHERE_CARAMEL_COST)
    expect(result.state.flags[BATHYSPHERE_BUILT_FLAG]).toBe(true)
    expect(result.state.ownedItems[BATHYSPHERE_ITEM_ID]).toBe(true)
    expect(bathysphereBuilt(result.state)).toBe(true)
  })

  it('does not mutate the input state (immutability)', () => {
    const before = atDescentPort()
    const pepBefore = before.peppermint.current
    const mintBefore = before.mint.current
    const caramelBefore = before.caramel.current
    buildBathysphere(before)
    expect(before.peppermint.current).toBe(pepBefore)
    expect(before.mint.current).toBe(mintBefore)
    expect(before.caramel.current).toBe(caramelBefore)
    expect(before.flags[BATHYSPHERE_BUILT_FLAG]).toBeUndefined()
    expect(before.ownedItems[BATHYSPHERE_ITEM_ID]).toBeUndefined()
  })

  it('returns the SAME reference + locked before the descent port is open (no spend)', () => {
    const before = atDescentPort({ flags: {} })
    const result = buildBathysphere(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('locked')
    expect(result.state).toBe(before)
  })

  it('returns the SAME reference + alreadyBuilt on a second build (one-off craft, farm-proof)', () => {
    const built = buildBathysphere(atDescentPort()).state
    const again = buildBathysphere(built)
    expect(again.ok).toBe(false)
    expect(again.reason).toBe('alreadyBuilt')
    expect(again.state).toBe(built)
    // the resources are not debited a second time
    expect(again.state.peppermint.current).toBe(built.peppermint.current)
    expect(again.state.mint.current).toBe(built.mint.current)
    expect(again.state.caramel.current).toBe(built.caramel.current)
  })

  it('returns the SAME reference + unaffordable when a line is short, touching nothing (no partial spend)', () => {
    // peppermint plenty, caramel short — the peppermint must NOT be debited.
    const before = atDescentPort({ caramel: createResource(BATHYSPHERE_CARAMEL_COST - 1) })
    const pepBefore = before.peppermint.current
    const mintBefore = before.mint.current
    const result = buildBathysphere(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
    expect(result.state.peppermint.current).toBe(pepBefore)
    expect(result.state.mint.current).toBe(mintBefore)
  })
})

describe('the bathysphere price config — soft-lock guard', () => {
  it('draws ONLY peppermint, mint, and caramel — every one an existing resource with a live source by Act 3', () => {
    // peppermint: the mint planet's condensers + the gummy mint-burrowers; mint: the frost wyrm's breath;
    // caramel: the Inc-0 cauldron boil + the Inc-2 solar-caramel collector. NONE is sourceless at Act 3.
    const allowed = new Set(['peppermint', 'mint', 'caramel'])
    for (const line of BATHYSPHERE_PRICE) {
      expect(allowed.has(line.resource)).toBe(true)
      expect(line.amount).toBeGreaterThan(0)
    }
  })

  it('exposes one line per material (plating, coolant, hull-seal) at the named costs', () => {
    const pep = BATHYSPHERE_PRICE.find((l) => l.resource === 'peppermint')!
    const mint = BATHYSPHERE_PRICE.find((l) => l.resource === 'mint')!
    const caramel = BATHYSPHERE_PRICE.find((l) => l.resource === 'caramel')!
    expect(pep.amount).toBe(BATHYSPHERE_PEPPERMINT_COST)
    expect(mint.amount).toBe(BATHYSPHERE_MINT_COST)
    expect(caramel.amount).toBe(BATHYSPHERE_CARAMEL_COST)
  })
})
