import { CellBuffer } from '@/render/CellBuffer'

describe('CellBuffer.create', () => {
  it('makes a blank grid of transparent chars', () => {
    const b = CellBuffer.create(3, 2)
    expect(b.width).toBe(3)
    expect(b.height).toBe(2)
    expect(b.toText()).toBe('   \n   ')
  })

  it('uses a custom transparent char', () => {
    const b = CellBuffer.create(2, 1, { transparentChar: '.' })
    expect(b.toText()).toBe('..')
    expect(b.transparentChar).toBe('.')
  })

  it('rejects negative or non-integer dimensions', () => {
    expect(() => CellBuffer.create(-1, 1)).toThrow()
    expect(() => CellBuffer.create(1.5, 1)).toThrow()
  })

  it('rejects a multi-char transparent char', () => {
    expect(() => CellBuffer.create(1, 1, { transparentChar: 'ab' })).toThrow()
  })
})

describe('CellBuffer.drawString', () => {
  it('writes text at a position, preserving width', () => {
    const b = CellBuffer.create(5, 1).drawString(1, 0, 'hi')
    expect(b.toText()).toBe(' hi  ')
    expect(b.rowAt(0)?.length).toBe(5)
  })

  it('clips text past the right edge', () => {
    const b = CellBuffer.create(4, 1).drawString(2, 0, 'abcd')
    expect(b.toText()).toBe('  ab')
  })

  it('clips text starting at a negative x', () => {
    const b = CellBuffer.create(4, 1).drawString(-2, 0, 'abcd')
    expect(b.toText()).toBe('cd  ')
  })

  it('drops a fully out-of-bounds row', () => {
    const b = CellBuffer.create(4, 1)
    expect(b.drawString(0, 5, 'x')).toBe(b) // same reference, no change
  })

  it('is immutable — the receiver is untouched', () => {
    const b = CellBuffer.create(3, 1)
    b.drawString(0, 0, 'xyz')
    expect(b.toText()).toBe('   ')
  })
})

describe('CellBuffer.drawArea', () => {
  it('composites a smaller buffer at an offset', () => {
    const base = CellBuffer.create(5, 3)
    const sprite = CellBuffer.create(2, 1).drawString(0, 0, '##')
    const out = base.drawArea(1, 1, sprite)
    expect(out.toText()).toBe('     \n ##  \n     ')
  })

  it('skips the transparent char so the lower layer shows through', () => {
    const base = CellBuffer.create(5, 1).drawString(0, 0, 'XXXXX')
    const sprite = CellBuffer.create(5, 1).drawString(0, 0, 'a a a') // spaces are alpha
    const out = base.drawArea(0, 0, sprite)
    expect(out.toText()).toBe('aXaXa')
  })

  it('offsets merged style regions and hotspots', () => {
    const sprite = CellBuffer.create(2, 1)
      .drawString(0, 0, 'ab')
      .withStyle({ x: 0, y: 0, length: 2, color: '#fff' })
      .withHotspot({ x: 0, y: 0, width: 2, height: 1, action: 'go' })
    const out = CellBuffer.create(5, 2).drawArea(2, 1, sprite)
    expect(out.styles[0]).toMatchObject({ x: 2, y: 1, length: 2, color: '#fff' })
    expect(out.hotspots[0]).toMatchObject({ x: 2, y: 1, width: 2, action: 'go' })
  })

  it('clips rows of the source that fall outside the destination', () => {
    const base = CellBuffer.create(3, 2)
    const tall = CellBuffer.create(3, 5).drawString(0, 4, 'zzz')
    const out = base.drawArea(0, 0, tall) // row 4 of source lands at dest row 4 (off-grid)
    expect(out.toText()).toBe('   \n   ')
  })
})

describe('CellBuffer sidecar lists', () => {
  it('charAt returns the transparent char out of bounds', () => {
    const b = CellBuffer.create(2, 2).drawString(0, 0, 'ab')
    expect(b.charAt(0, 0)).toBe('a')
    expect(b.charAt(9, 9)).toBe(' ')
    expect(b.charAt(-1, 0)).toBe(' ')
  })

  it('appends styles, hotspots and glows immutably', () => {
    const b = CellBuffer.create(3, 1)
    const styled = b.withStyle({ x: 0, y: 0, length: 1, color: '#abc' })
    const hot = styled.withHotspot({ x: 0, y: 0, width: 1, height: 1, action: 'a' })
    const glow = hot.withGlow({ x: 1, y: 0, className: 'glow-sun' })
    expect(b.styles).toHaveLength(0)
    expect(glow.styles).toHaveLength(1)
    expect(glow.hotspots).toHaveLength(1)
    expect(glow.glows).toEqual([{ x: 1, y: 0, className: 'glow-sun' }])
  })
})
