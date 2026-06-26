import {
  createLabyrinth,
  labyrinthSolved,
  takePassage,
  coldestPassage,
  frostWyrmFreed,
  freeFrostWyrm,
  condenserCount,
  peppermintRate,
  canBuildCondenser,
  buildCondenser,
  canHarvestMint,
  harvestMint,
} from '@/engine/content/mintPlanet'
import { act2GateCleared } from '@/engine/content/actGate'
import {
  LABYRINTH_ROOMS,
  LABYRINTH_START,
  LABYRINTH_HEART,
  PEPPERMINT_CONDENSER_KEY,
  CONDENSER_ROCK_CANDY_COST,
  CONDENSER_CANDY_COST,
  PEPPERMINT_PER_CONDENSER_PER_SEC,
  PEPPERMINT_GATE_AMOUNT,
  MINT_HARVEST_CANDY_COST,
  MINT_HARVEST_BATCH,
} from '@/content/planet/mintPlanet'
import { FROST_WYRM_FREED_FLAG } from '@/content/flags'
import { GALLEON_HULL_KEY } from '@/content/ship/galleonUpgrade'
import { PEPPERMINT_PRODUCERS } from '@/content/producers/peppermint'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { createResource } from '@/engine/types/Resource'
import type { GameState } from '@/engine/types/GameState'

describe('the ice labyrinth — follow the cold', () => {
  it('begins at the mouth, unsolved', () => {
    const lab = createLabyrinth()
    expect(lab.room).toBe(LABYRINTH_START)
    expect(labyrinthSolved(lab)).toBe(false)
  })

  it('reaches the heart by taking the coldest passage in each room', () => {
    let lab = createLabyrinth()
    for (let i = 0; i < 10 && !labyrinthSolved(lab); i++) {
      lab = takePassage(lab, coldestPassage(lab.room))
    }
    expect(lab.room).toBe(LABYRINTH_HEART)
    expect(labyrinthSolved(lab)).toBe(true)
  })

  it('a warmer passage wanders you off the cold path (it does not advance toward the heart)', () => {
    // from the mouth, the warm passage leads into the hollow side-room — and the hollow only leads back
    // to the mouth, so a wrong turn costs you progress ("the labyrinth keeps you").
    const lab = createLabyrinth()
    const cold = coldestPassage(lab.room)
    const warm = cold === 0 ? 1 : 0 // a non-coldest passage
    const detour = takePassage(lab, warm)
    expect(detour.room).not.toBe(LABYRINTH_HEART)
    expect(labyrinthSolved(detour)).toBe(false)
    // the side-room's only way on is back toward the start, not deeper
    const back = takePassage(detour, coldestPassage(detour.room))
    expect(back.room).toBe(LABYRINTH_START)
  })

  it('is a no-op (same reference) at the heart or on a bad index', () => {
    const heart = { room: LABYRINTH_HEART }
    expect(takePassage(heart, 0)).toBe(heart)
    const lab = createLabyrinth()
    expect(takePassage(lab, 99)).toBe(lab)
  })

  it('every non-heart room has a uniquely coldest passage (the maze is always solvable)', () => {
    for (const room of LABYRINTH_ROOMS) {
      if (room.id === LABYRINTH_HEART) {
        expect(coldestPassage(room.id)).toBe(-1)
        continue
      }
      const idx = coldestPassage(room.id)
      const temps = room.passages.map((p) => p.temp)
      const coldest = Math.min(...temps)
      expect(room.passages[idx]!.temp).toBe(coldest)
      expect(temps.filter((t) => t === coldest)).toHaveLength(1) // no ambiguity
    }
  })
})

describe('the frost wyrm — a one-off freeing', () => {
  it('starts frozen and is freed once', () => {
    const s = createDefaultSave()
    expect(frostWyrmFreed(s)).toBe(false)
    const result = freeFrostWyrm(s)
    expect(result.ok).toBe(true)
    expect(result.state.flags[FROST_WYRM_FREED_FLAG]).toBe(true)
    expect(frostWyrmFreed(result.state)).toBe(true)
  })

  it('is a no-op (same reference) once freed', () => {
    const freed = freeFrostWyrm(createDefaultSave()).state
    const again = freeFrostWyrm(freed)
    expect(again.ok).toBe(false)
    expect(again.state).toBe(freed)
  })
})

/** A save with the wyrm freed + rock candy/candies to spend on condensers. */
const withWyrmFreed = (over: { rockCandy?: number; candies?: number; condensers?: number } = {}): GameState => {
  const s = createDefaultSave()
  return {
    ...s,
    flags: { ...s.flags, [FROST_WYRM_FREED_FLAG]: true },
    numbers: { ...s.numbers, [PEPPERMINT_CONDENSER_KEY]: over.condensers ?? 0 },
    rockCandy: createResource(over.rockCandy ?? 1000),
    candies: createResource(over.candies ?? 100_000),
  }
}

describe('the peppermint condensers — the act-gate grind', () => {
  it('cannot build a condenser before the wyrm is freed (same reference)', () => {
    const before = { ...createDefaultSave(), rockCandy: createResource(1000), candies: createResource(100_000) }
    const result = buildCondenser(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('locked')
    expect(result.state).toBe(before)
  })

  it('builds a condenser, spending rock candy + candies', () => {
    const before = withWyrmFreed({ rockCandy: 1000, candies: 100_000 })
    const result = buildCondenser(before)
    expect(result.ok).toBe(true)
    expect(condenserCount(result.state)).toBe(1)
    expect(result.state.rockCandy.current).toBe(1000 - CONDENSER_ROCK_CANDY_COST)
    expect(result.state.candies.current).toBe(100_000 - CONDENSER_CANDY_COST)
  })

  it('refuses when rock candy is short (same reference, no candies spent)', () => {
    const before = withWyrmFreed({ rockCandy: CONDENSER_ROCK_CANDY_COST - 1, candies: 100_000 })
    const result = buildCondenser(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
    expect(before.candies.current).toBe(100_000)
  })

  it('canBuildCondenser mirrors the wyrm gate + both costs', () => {
    expect(canBuildCondenser(withWyrmFreed())).toBe(true)
    expect(canBuildCondenser(createDefaultSave())).toBe(false) // wyrm not freed
    expect(canBuildCondenser(withWyrmFreed({ rockCandy: 0 }))).toBe(false)
    expect(canBuildCondenser(withWyrmFreed({ candies: 0 }))).toBe(false)
  })

  it('peppermint rate + producer scale with the condenser count', () => {
    expect(peppermintRate(withWyrmFreed({ condensers: 0 }))).toBe(0)
    expect(peppermintRate(withWyrmFreed({ condensers: 8 }))).toBeCloseTo(8 * PEPPERMINT_PER_CONDENSER_PER_SEC)
    const producer = PEPPERMINT_PRODUCERS.find((p) => p.id === 'peppermintCondensers')!
    expect(producer.resource).toBe('peppermint')
    expect(producer.getRate(withWyrmFreed({ condensers: 8 }))).toBeCloseTo(8 * PEPPERMINT_PER_CONDENSER_PER_SEC)
  })
})

describe('harvesting mint essence from the wyrm\'s breath', () => {
  it('cannot harvest before the wyrm is freed (same reference)', () => {
    const before = { ...createDefaultSave(), candies: createResource(100_000) }
    const result = harvestMint(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('locked')
    expect(result.state).toBe(before)
  })

  it('crystallizes a batch of mint, spending candies (a pure faucet — no peppermint touched)', () => {
    const before = withWyrmFreed({ candies: 100_000 })
    const result = harvestMint(before)
    expect(result.ok).toBe(true)
    expect(result.state.mint.current).toBe(MINT_HARVEST_BATCH)
    expect(result.state.candies.current).toBe(100_000 - MINT_HARVEST_CANDY_COST)
    expect(result.state.peppermint.current).toBe(before.peppermint.current) // never spends the gate resource
  })

  it('refuses when candies are short (same reference)', () => {
    const before = withWyrmFreed({ candies: MINT_HARVEST_CANDY_COST - 1 })
    const result = harvestMint(before)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(before)
  })

  it('canHarvestMint mirrors the wyrm gate + the candy cost', () => {
    expect(canHarvestMint(withWyrmFreed({ candies: 100_000 }))).toBe(true)
    expect(canHarvestMint(createDefaultSave())).toBe(false) // wyrm not freed
    expect(canHarvestMint(withWyrmFreed({ candies: 0 }))).toBe(false)
  })
})

describe('the §184 Act-2 gate', () => {
  const withHullAndMint = (hullTier: number, peppermint: number): GameState => ({
    ...createDefaultSave(),
    numbers: { [GALLEON_HULL_KEY]: hullTier },
    peppermint: createResource(peppermint),
  })

  it('needs BOTH a tier-3 hull and the full peppermint bank', () => {
    expect(act2GateCleared(withHullAndMint(3, PEPPERMINT_GATE_AMOUNT))).toBe(true)
    expect(act2GateCleared(withHullAndMint(2, PEPPERMINT_GATE_AMOUNT))).toBe(false) // hull short
    expect(act2GateCleared(withHullAndMint(3, PEPPERMINT_GATE_AMOUNT - 1))).toBe(false) // peppermint short
    expect(act2GateCleared(createDefaultSave())).toBe(false)
  })
})
