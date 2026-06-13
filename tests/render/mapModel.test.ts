import type { StratumDef } from '@/engine/types/defs'
import type { GameState } from '@/engine/types/GameState'
import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  resolveMap,
  visibleWindow,
  strataToRender,
  stratumInWindow,
  buildStratumBuffer,
  clampScrollY,
} from '@/render/mapModel'

const ground: StratumDef = {
  id: 'ground',
  anchor: 'groundLevel',
  heightRows: 3,
  ascii: ['====', 'home', '....'],
  zones: [{ id: 'house', displayKey: 'z.house', label: 'H', x: 0, rowOffset: 1, action: 'goHouse' }],
}

const sky: StratumDef = {
  id: 'sky',
  anchor: 'skyLevel',
  heightRows: 2,
  ascii: ['~~~~', '~~~~'],
  unlockFlag: 'beanstalkReachedClouds',
  zones: [
    {
      id: 'cloud',
      displayKey: 'z.cloud',
      label: 'C',
      x: 2,
      rowOffset: 0,
      action: 'goCloud',
      unlockFlag: 'cloudFound',
    },
  ],
}

function state(flags: Record<string, boolean> = {}, numbers: Record<string, number> = {}): GameState {
  return { ...createDefaultSave(), flags, numbers }
}

describe('resolveMap', () => {
  it('places only revealed strata, highest anchor at the top (row 0)', () => {
    const resolved = resolveMap([ground, sky], state({ beanstalkReachedClouds: true }))
    expect(resolved.placed.map((p) => p.def.id)).toEqual(['sky', 'ground'])
    expect(resolved.placed[0]).toMatchObject({ topRow: 0 }) // sky on top
    expect(resolved.placed[1]).toMatchObject({ topRow: 2 }) // ground below sky's 2 rows
    expect(resolved.totalRows).toBe(5)
  })

  it('omits a stratum whose unlock flag is unset (page has not grown upward yet)', () => {
    const resolved = resolveMap([ground, sky], state())
    expect(resolved.placed.map((p) => p.def.id)).toEqual(['ground'])
    expect(resolved.totalRows).toBe(3)
  })

  it('grows the page upward when the higher stratum unlocks', () => {
    const before = resolveMap([ground, sky], state())
    const after = resolveMap([ground, sky], state({ beanstalkReachedClouds: true }))
    expect(after.totalRows).toBeGreaterThan(before.totalRows)
  })
})

describe('virtualization windowing', () => {
  it('includes a buffer above and below the viewport', () => {
    const w = visibleWindow(10, 4, 100, 2)
    expect(w.first).toBe(8) // 10 - 2 buffer
    expect(w.last).toBe(16) // 10 + 4 viewport + 2 buffer
  })

  it('clamps the window to the map bounds', () => {
    const w = visibleWindow(0, 4, 3, 2)
    expect(w.first).toBe(0)
    expect(w.last).toBe(2) // totalRows-1
  })

  it('only renders strata overlapping the window', () => {
    const resolved = resolveMap([ground, sky], state({ beanstalkReachedClouds: true }))
    // Window covering only the bottom (ground) rows.
    const bottom = { first: 3, last: 4 }
    const rendered = strataToRender(resolved, bottom).map((p) => p.def.id)
    expect(rendered).toEqual(['ground'])
  })

  it('stratumInWindow detects overlap correctly', () => {
    const placed = { def: ground, topRow: 2 } // rows 2..4
    expect(stratumInWindow(placed, { first: 0, last: 1 })).toBe(false)
    expect(stratumInWindow(placed, { first: 4, last: 9 })).toBe(true)
  })
})

describe('clampScrollY', () => {
  it('clamps to the scrollable range', () => {
    expect(clampScrollY(100, 10, 4)).toBe(6) // max = 10 - 4
    expect(clampScrollY(-5, 10, 4)).toBe(0)
    expect(clampScrollY(3, 10, 4)).toBe(3)
  })

  it('treats a non-finite scroll as 0', () => {
    expect(clampScrollY(Number.NaN, 10, 4)).toBe(0)
  })
})

describe('buildStratumBuffer', () => {
  it('draws the backdrop and revealed zone labels with hotspots', () => {
    const buf = buildStratumBuffer(ground, state(), 4)
    // The zone label 'H' is drawn at (0,1), overwriting 'home' -> 'Home'.
    expect(buf.rowAt(1)).toBe('Home')
    expect(buf.hotspots).toEqual([{ x: 0, y: 1, width: 1, height: 1, action: 'goHouse' }])
  })

  it('hides a zone whose unlock flag is unset', () => {
    const hidden = buildStratumBuffer(sky, state({ beanstalkReachedClouds: true }), 4)
    expect(hidden.hotspots).toHaveLength(0)
    const shown = buildStratumBuffer(
      sky,
      state({ beanstalkReachedClouds: true, cloudFound: true }),
      4,
    )
    expect(shown.hotspots).toEqual([{ x: 2, y: 0, width: 1, height: 1, action: 'goCloud' }])
  })
})
