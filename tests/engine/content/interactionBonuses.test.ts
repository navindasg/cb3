import { createDefaultSave } from '@/engine/state/defaultSave'
import { createResource } from '@/engine/types/Resource'
import {
  plantMoonpop,
  moonpopsPlanted,
  MOONPOPS_PLANTED_FLAG,
  figureheadOwned,
  CANDY_BOX_FIGUREHEAD_FLAG,
} from '@/engine/content/interactionBonuses'
import type { GameState } from '@/engine/types/GameState'

const withLollipops = (n: number): GameState => ({ ...createDefaultSave(), lollipops: createResource(n) })

describe('plantMoonpop — spend exactly one lollipop, once', () => {
  it('plants when holding a lollipop: spends exactly one, sets the flag', () => {
    const result = plantMoonpop(withLollipops(3))
    expect(result.ok).toBe(true)
    expect(result.state.lollipops.current).toBe(2) // exactly one spent
    expect(result.state.flags[MOONPOPS_PLANTED_FLAG]).toBe(true)
    expect(moonpopsPlanted(result.state)).toBe(true)
  })

  it('plants with exactly one lollipop, leaving none', () => {
    const result = plantMoonpop(withLollipops(1))
    expect(result.ok).toBe(true)
    expect(result.state.lollipops.current).toBe(0)
    expect(moonpopsPlanted(result.state)).toBe(true)
  })

  it('fails (same ref) when holding no lollipop', () => {
    const broke = withLollipops(0)
    const result = plantMoonpop(broke)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('noLollipop')
    expect(result.state).toBe(broke)
  })

  it('is inert after the bloom: a second plant fails, spends nothing (same ref)', () => {
    const first = plantMoonpop(withLollipops(2))
    expect(first.ok).toBe(true)
    const second = plantMoonpop(first.state)
    expect(second.ok).toBe(false)
    expect(second.reason).toBe('alreadyPlanted')
    expect(second.state).toBe(first.state)
    expect(second.state.lollipops.current).toBe(1) // no second lollipop spent
  })
})

describe('moonpops ownership — a one-time cosmetic bloom flag', () => {
  it('is not planted before planting', () => {
    expect(moonpopsPlanted(createDefaultSave())).toBe(false)
  })

  it('is planted once bloomed, and stays planted (one-time, no re-bloom)', () => {
    const planted = plantMoonpop(withLollipops(5)).state
    expect(moonpopsPlanted(planted)).toBe(true)
    // Planting is one-time; a second attempt changes nothing.
    const again = plantMoonpop(planted)
    expect(moonpopsPlanted(again.state)).toBe(true)
  })
})

describe('figurehead ownership — an ownership-gated cosmetic flag', () => {
  it('is not owned by default', () => {
    expect(figureheadOwned(createDefaultSave())).toBe(false)
  })

  it('is owned once the flag is set', () => {
    const owned: GameState = { ...createDefaultSave(), flags: { [CANDY_BOX_FIGUREHEAD_FLAG]: true } }
    expect(figureheadOwned(owned)).toBe(true)
  })
})
