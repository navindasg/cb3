import {
  deriveMetrics,
  hasFontLoadingApi,
  loadFont,
  FONT_STACK,
  FONT_FAMILY,
  LINE_HEIGHT,
} from '@/render/font'

describe('font metrics', () => {
  it('derives cellW from the measured 1ch and cellH from fontSize × line-height', () => {
    const m = deriveMetrics(9.6, 16)
    expect(m.cellW).toBe(9.6)
    expect(m.cellH).toBeCloseTo(16 * LINE_HEIGHT)
  })

  it('rejects non-positive measurements', () => {
    expect(() => deriveMetrics(0, 16)).toThrow()
    expect(() => deriveMetrics(9.6, 0)).toThrow()
  })

  it('ships a JetBrains-Mono-first fallback stack ending in monospace', () => {
    expect(FONT_STACK).toContain(FONT_FAMILY)
    expect(FONT_STACK.trim().endsWith('monospace')).toBe(true)
  })
})

describe('hasFontLoadingApi', () => {
  it('is false when document.fonts is absent (jsdom)', () => {
    expect(hasFontLoadingApi({} as unknown as Document)).toBe(false)
  })

  it('is true when a fonts object is present', () => {
    const fakeDoc = { fonts: {} } as unknown as Document
    expect(hasFontLoadingApi(fakeDoc)).toBe(true)
  })
})

describe('loadFont', () => {
  it('falls back gracefully when the Font Loading API is missing', async () => {
    const result = await loadFont({} as unknown as Document)
    expect(result.loaded).toBe(false)
  })

  it('reports loaded when the binary resolves and checks true', async () => {
    const fakeDoc = {
      fonts: {
        load: () => Promise.resolve([]),
        check: () => true,
      },
    } as unknown as Document
    const result = await loadFont(fakeDoc, 16)
    expect(result.loaded).toBe(true)
  })

  it('falls back when the load rejects (absent/blocked binary)', async () => {
    const fakeDoc = {
      fonts: {
        load: () => Promise.reject(new Error('no binary')),
        check: () => false,
      },
    } as unknown as Document
    const result = await loadFont(fakeDoc)
    expect(result.loaded).toBe(false)
  })
})
