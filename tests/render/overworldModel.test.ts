import type { OverworldDef } from '@/engine/types/overworld'
import type { GameState } from '@/engine/types/GameState'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { revealedRegions, revealedBounds, composeOverworld } from '@/render/overworldModel'
import { ACT0_OVERWORLD } from '@/content/overworld'

const WORLD: OverworldDef = {
  worldWidth: 40,
  worldHeight: 20,
  regions: [
    { id: 'a', x: 2, y: 10, label: 'alpha', action: 'enter:a', art: ['alpha here'] },
    {
      id: 'b',
      x: 20,
      y: 4,
      revealFlag: 'bSeen',
      label: 'beta',
      action: 'enter:b',
      art: ['beta', '||'],
    },
  ],
}

function state(flags: Record<string, boolean> = {}): GameState {
  return { ...createDefaultSave(), flags }
}

describe('overworld model', () => {
  it('reveals only flag-satisfied regions', () => {
    expect(revealedRegions(WORLD, state()).map((r) => r.id)).toEqual(['a'])
    expect(revealedRegions(WORLD, state({ bSeen: true })).map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('computes the bounding box of the revealed regions only', () => {
    // Only 'a' (x2,y10, art width 10 → x12, height1 → y11).
    expect(revealedBounds(revealedRegions(WORLD, state()))).toEqual({
      minX: 2,
      minY: 10,
      width: 10,
      height: 1,
    })
    // Both: minX2,minY4; maxX = max(2+10, 20+4)=24; maxY = max(10+1, 4+2)=11 → width 22, height 7.
    const both = revealedBounds(revealedRegions(WORLD, state({ bSeen: true })))
    expect(both).toEqual({ minX: 2, minY: 4, width: 22, height: 7 })
  })

  it('returns a zero box when nothing is revealed', () => {
    const empty: OverworldDef = { worldWidth: 10, worldHeight: 10, regions: [] }
    expect(revealedBounds(revealedRegions(empty, state()))).toEqual({
      minX: 0,
      minY: 0,
      width: 0,
      height: 0,
    })
  })

  it('crops the composed buffer to the revealed box and places a hotspot over the label', () => {
    const { buffer, bounds } = composeOverworld(WORLD, state())
    expect(bounds).toEqual({ minX: 2, minY: 10, width: 10, height: 1 })
    // Region 'a' sits at buffer (0,0) after cropping by the bounds origin.
    expect(buffer.rowAt(0)).toContain('alpha here')
    expect(buffer.hotspots).toContainEqual({ x: 0, y: 0, width: 5, height: 1, action: 'enter:a' })
    expect(buffer.styles).toContainEqual({ x: 0, y: 0, length: 5, className: 'map-zone' })
  })

  it('offsets a revealed region into the cropped buffer by the bounds origin', () => {
    const { buffer, bounds } = composeOverworld(WORLD, state({ bSeen: true }))
    expect(bounds.minX).toBe(2)
    expect(bounds.minY).toBe(4)
    // 'beta' label is at art (0,0) of region b (world 20,4) → cropped (18,0).
    expect(buffer.hotspots).toContainEqual({ x: 18, y: 0, width: 4, height: 1, action: 'enter:b' })
    // 'alpha' region (world 2,10) → cropped (0,6).
    expect(buffer.charAt(0, 6)).toBe('a')
  })
})

describe('the Act-0 overworld composite — the sun marker is never overdrawn', () => {
  // Regression for the Act-3 sun collision: with the whole dense top band revealed (sky, storm
  // front, jawbreaker moon) the marquee 'the sun' label must still read — a later region in the
  // compose order must not paint over its label cells. (Spaces are transparent, later wins.)
  function allRevealed(): GameState {
    const flags: Record<string, boolean> = {}
    for (const region of ACT0_OVERWORLD.regions) {
      if (region.revealFlag) flags[region.revealFlag] = true
    }
    return { ...createDefaultSave(), flags }
  }

  it("renders 'the sun' label intact in the full composite and keeps its clickable hotspot", () => {
    const sun = ACT0_OVERWORLD.regions.find((r) => r.id === 'sun')
    expect(sun).toBeDefined()
    if (!sun) return
    const { buffer, bounds } = composeOverworld(ACT0_OVERWORLD, allRevealed())

    // Find the sun's label within its own art, map to cropped buffer coords, read it back whole.
    const labelRow = sun.art.findIndex((row) => row.includes(sun.label))
    expect(labelRow).toBeGreaterThanOrEqual(0)
    const labelCol = sun.art[labelRow]!.indexOf(sun.label)
    const cropX = sun.x - bounds.minX + labelCol
    const cropY = sun.y - bounds.minY + labelRow
    const got = Array.from({ length: sun.label.length }, (_, i) => buffer.charAt(cropX + i, cropY)).join('')
    expect(got).toBe(sun.label)

    // The hotspot over the sun's label survives compositing (still clickable).
    expect(buffer.hotspots).toContainEqual({
      x: cropX,
      y: cropY,
      width: sun.label.length,
      height: 1,
      action: sun.action,
    })
  })
})
