import { createDefaultSave } from '@/engine/state/defaultSave'
import { resolveMap, buildStratumBuffer } from '@/render/mapModel'
import { ACT0_STRATA, FIELD_STRATUM, VILLAGE_STRATUM, MINES_STRATUM } from '@/content/strata'
import type { GameState } from '@/engine/types/GameState'

describe('Act 0 map registry', () => {
  it('reveals only the field at the start (village/mines/observatory gated)', () => {
    const resolved = resolveMap(ACT0_STRATA, createDefaultSave())
    const ids = resolved.placed.map((p) => p.def.id)
    expect(ids).toEqual(['field'])
  })

  it('reveals the village when villageUnlocked is set, stacked above the field', () => {
    const state: GameState = { ...createDefaultSave(), flags: { villageUnlocked: true } }
    const resolved = resolveMap(ACT0_STRATA, state)
    const ids = resolved.placed.map((p) => p.def.id)
    // village (higher anchor) renders ABOVE the field → earlier (smaller topRow).
    expect(ids).toEqual(['village', 'field'])
    const village = resolved.placed.find((p) => p.def.id === 'village')!
    const field = resolved.placed.find((p) => p.def.id === 'field')!
    expect(village.topRow).toBeLessThan(field.topRow)
  })

  it('the page grows as more strata unlock (totalRows increases)', () => {
    const ground = resolveMap(ACT0_STRATA, createDefaultSave()).totalRows
    const withMines: GameState = { ...createDefaultSave(), flags: { minesRevealed: true } }
    const grown = resolveMap(ACT0_STRATA, withMines).totalRows
    expect(grown).toBe(ground + MINES_STRATUM.heightRows)
  })

  it('a gated zone hotspot only appears once its zone flag is set', () => {
    // The fossil-chamber zone in the mines is gated behind rockCandyUnlocked.
    const minesNoFossil = buildStratumBuffer(MINES_STRATUM, { ...createDefaultSave(), flags: { minesRevealed: true } }, resolveMap(ACT0_STRATA, createDefaultSave()).width)
    expect(minesNoFossil.hotspots.some((h) => h.action === 'interact:fossil')).toBe(false)

    const withFossil: GameState = { ...createDefaultSave(), flags: { minesRevealed: true, rockCandyUnlocked: true } }
    const minesWithFossil = buildStratumBuffer(MINES_STRATUM, withFossil, resolveMap(ACT0_STRATA, withFossil).width)
    expect(minesWithFossil.hotspots.some((h) => h.action === 'interact:fossil')).toBe(true)
  })

  it('the field stratum composites zone hotspots (house/field/mine entrance)', () => {
    const width = resolveMap(ACT0_STRATA, createDefaultSave()).width
    const buffer = buildStratumBuffer(FIELD_STRATUM, createDefaultSave(), width)
    const actions = buffer.hotspots.map((h) => h.action)
    expect(actions).toContain('enter:house')
    expect(actions).toContain('quest:sugarMines')
  })

  it('every zone action and label is non-empty', () => {
    for (const stratum of ACT0_STRATA) {
      for (const zone of stratum.zones) {
        expect(zone.action.length).toBeGreaterThan(0)
        expect(zone.label.length).toBeGreaterThan(0)
      }
    }
  })

  it('the village contains the shop, forge, tavern, houses and well zones', () => {
    const ids = VILLAGE_STRATUM.zones.map((z) => z.id)
    expect(ids).toEqual(expect.arrayContaining(['shop', 'forge', 'tavern', 'houses', 'well']))
  })
})
