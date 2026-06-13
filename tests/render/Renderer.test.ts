import { hitTest } from '@/render/Renderer'

describe('hitTest', () => {
  it('maps a pixel position to integer cell coords with floor', () => {
    // origin at (10, 20), cell 8x16. A click at (27, 53):
    // col = floor((27-10)/8) = floor(2.125) = 2; row = floor((53-20)/16)=floor(2.06)=2
    expect(hitTest({ clientX: 27, clientY: 53, left: 10, top: 20, cellW: 8, cellH: 16 })).toEqual({
      col: 2,
      row: 2,
    })
  })

  it('snaps to cell 0,0 at the exact origin', () => {
    expect(hitTest({ clientX: 10, clientY: 20, left: 10, top: 20, cellW: 8, cellH: 16 })).toEqual({
      col: 0,
      row: 0,
    })
  })

  it('returns null left of or above the grid', () => {
    expect(hitTest({ clientX: 5, clientY: 30, left: 10, top: 20, cellW: 8, cellH: 16 })).toBeNull()
    expect(hitTest({ clientX: 30, clientY: 5, left: 10, top: 20, cellW: 8, cellH: 16 })).toBeNull()
  })

  it('returns null for non-positive cell metrics', () => {
    expect(hitTest({ clientX: 0, clientY: 0, left: 0, top: 0, cellW: 0, cellH: 16 })).toBeNull()
    expect(hitTest({ clientX: 0, clientY: 0, left: 0, top: 0, cellW: 8, cellH: -1 })).toBeNull()
  })
})
