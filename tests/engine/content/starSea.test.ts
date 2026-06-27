import {
  starSeaOpen,
  trawlerCount,
  stardustRate,
  canBuildTrawler,
  buildTrawler,
} from '@/engine/content/starSea'
import {
  STAR_TRAWLER_KEY,
  STAR_TRAWLER_CANDY_COST,
  STAR_TRAWLER_CARAMEL_COST,
  STARDUST_PER_TRAWLER_PER_SEC,
} from '@/content/sun/starSea'
import { DYSON_STAGE_DONE_FLAGS } from '@/content/flags'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { createResource } from '@/engine/types/Resource'
import type { GameState } from '@/engine/types/GameState'

const STAGE3 = DYSON_STAGE_DONE_FLAGS[2]

/** A save with stage 3 raised + resources/counts to spend on the star sea. */
const open = (over: { candies?: number; caramel?: number; trawlers?: number } = {}): GameState => {
  const s = createDefaultSave()
  return {
    ...s,
    flags: { ...s.flags, [STAGE3]: true },
    numbers: { ...s.numbers, [STAR_TRAWLER_KEY]: over.trawlers ?? 0 },
    candies: createResource(over.candies ?? 1_000_000_000),
    caramel: createResource(over.caramel ?? 100_000),
  }
}

describe('the star sea — the stage-3 gate', () => {
  it('the sea is shut until the outer bracing (third dyson strut) is raised', () => {
    expect(starSeaOpen(createDefaultSave())).toBe(false)
    expect(starSeaOpen(open())).toBe(true)
  })

  it('gates on the EXACT content-owned stage-3 flag literal (lock-step)', () => {
    // If the engine's re-declared literal drifts from content/flags, this fails — guarding the moonStrata
    // idiom. The flag set on the save (the content constant) must be the one the engine reads.
    const s = { ...createDefaultSave(), flags: { [DYSON_STAGE_DONE_FLAGS[2]]: true } }
    expect(starSeaOpen(s)).toBe(true)
    // and an EARLIER stage does NOT open the sea (it really is stage 3, not 1 or 2)
    const stage1Only = { ...createDefaultSave(), flags: { [DYSON_STAGE_DONE_FLAGS[0]]: true } }
    expect(starSeaOpen(stage1Only)).toBe(false)
  })
})

describe('star-trawlers — the first passive stardust faucet', () => {
  it('cannot launch a trawler before stage 3 (SAME reference, locked)', () => {
    const before = { ...createDefaultSave(), candies: createResource(1e9), caramel: createResource(1e5) }
    const result = buildTrawler(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('locked')
    expect(result.state).toBe(before)
  })

  it('launches a trawler: spends exactly candies + caramel and ++count', () => {
    const before = open({ candies: 1_000_000_000, caramel: 100_000 })
    const result = buildTrawler(before)
    expect(result.ok).toBe(true)
    expect(trawlerCount(result.state)).toBe(1)
    expect(result.state.candies.current).toBe(1_000_000_000 - STAR_TRAWLER_CANDY_COST)
    expect(result.state.caramel.current).toBe(100_000 - STAR_TRAWLER_CARAMEL_COST)
  })

  it('refuses when candies are short (SAME reference, no caramel spent)', () => {
    const before = open({ candies: STAR_TRAWLER_CANDY_COST - 1, caramel: 100_000 })
    const result = buildTrawler(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
    expect(before.caramel.current).toBe(100_000) // nothing touched — no partial spend
  })

  it('refuses when caramel is short (SAME reference, no candies spent)', () => {
    const before = open({ candies: 1_000_000_000, caramel: STAR_TRAWLER_CARAMEL_COST - 1 })
    const result = buildTrawler(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
    expect(before.candies.current).toBe(1_000_000_000) // candies untouched (caramel checked second)
  })

  it('never overdrafts at exactly the cost', () => {
    const before = open({ candies: STAR_TRAWLER_CANDY_COST, caramel: STAR_TRAWLER_CARAMEL_COST })
    const result = buildTrawler(before)
    expect(result.ok).toBe(true)
    expect(result.state.candies.current).toBe(0)
    expect(result.state.caramel.current).toBe(0)
    expect(trawlerCount(result.state)).toBe(1)
  })

  it('the count only ever rises (launching again ++ from the prior count)', () => {
    const before = open({ trawlers: 12, candies: 1e9, caramel: 1e5 })
    const result = buildTrawler(before)
    expect(trawlerCount(result.state)).toBe(13)
  })

  it('canBuildTrawler mirrors the stage-3 gate + both costs', () => {
    expect(canBuildTrawler(open())).toBe(true)
    expect(canBuildTrawler(createDefaultSave())).toBe(false) // stage 3 not raised
    expect(canBuildTrawler(open({ candies: STAR_TRAWLER_CANDY_COST - 1 }))).toBe(false)
    expect(canBuildTrawler(open({ caramel: STAR_TRAWLER_CARAMEL_COST - 1 }))).toBe(false)
  })

  it('stardustRate scales with the count (0 at 0, 0 pre-stage-3)', () => {
    expect(stardustRate(open({ trawlers: 0 }))).toBe(0)
    expect(stardustRate(open({ trawlers: 6 }))).toBeCloseTo(6 * STARDUST_PER_TRAWLER_PER_SEC)
    // honest even if a stray count slips into save data before the gate
    const stray = { ...createDefaultSave(), numbers: { [STAR_TRAWLER_KEY]: 9 } }
    expect(stardustRate(stray)).toBe(0)
  })

  it('trawlerCount defaults to 0 when the count key is absent entirely (the ?? 0 default)', () => {
    // a save fresh past stage 3 has the flag but no count key — the nullish default must hold the count at 0.
    const s = createDefaultSave()
    const fresh = { ...s, flags: { ...s.flags, [STAGE3]: true } }
    expect(fresh.numbers[STAR_TRAWLER_KEY]).toBeUndefined()
    expect(trawlerCount(fresh)).toBe(0)
    expect(stardustRate(fresh)).toBe(0)
  })

  it('does not mutate the input state (immutability)', () => {
    const before = open({ candies: 1e9, caramel: 1e5 })
    const candiesRef = before.candies
    const caramelRef = before.caramel
    buildTrawler(before)
    expect(before.candies).toBe(candiesRef)
    expect(before.caramel).toBe(caramelRef)
    expect(trawlerCount(before)).toBe(0)
  })
})
