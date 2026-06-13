import { buildHotspotMap, actionAt, cellKey } from '@/render/hotspotMap'

describe('hotspotMap', () => {
  it('keys a cell as "col,row"', () => {
    expect(cellKey(3, 7)).toBe('3,7')
  })

  it('expands a rectangle into every covered cell', () => {
    const map = buildHotspotMap([{ x: 1, y: 1, width: 2, height: 2, action: 'go' }])
    expect(actionAt(map, 1, 1)).toBe('go')
    expect(actionAt(map, 2, 2)).toBe('go')
    expect(actionAt(map, 0, 0)).toBeUndefined()
    expect(actionAt(map, 3, 1)).toBeUndefined()
  })

  it('lets a later hotspot win on overlap (last drawn on top)', () => {
    const map = buildHotspotMap([
      { x: 0, y: 0, width: 2, height: 1, action: 'under' },
      { x: 1, y: 0, width: 1, height: 1, action: 'over' },
    ])
    expect(actionAt(map, 0, 0)).toBe('under')
    expect(actionAt(map, 1, 0)).toBe('over')
  })

  it('skips zero/negative-sized hotspots', () => {
    const map = buildHotspotMap([
      { x: 0, y: 0, width: 0, height: 1, action: 'none' },
      { x: 0, y: 0, width: 1, height: 0, action: 'none' },
    ])
    expect(map.size).toBe(0)
  })
})
