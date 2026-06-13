import { buildGlowMap, diffGlow } from '@/render/glowOverlay'

describe('glowOverlay', () => {
  it('builds a cell-keyed map', () => {
    const map = buildGlowMap([{ x: 1, y: 2, className: 'glow-sun' }])
    expect(map.get('1,2')?.className).toBe('glow-sun')
  })

  it('reports an added glow when one appears', () => {
    const prev = buildGlowMap([])
    const next = buildGlowMap([{ x: 0, y: 0, className: 'glow-moonpop' }])
    const diff = diffGlow(prev, next)
    expect(diff.added).toEqual([{ x: 0, y: 0, className: 'glow-moonpop' }])
    expect(diff.removed).toEqual([])
  })

  it('reports a removed glow when one disappears', () => {
    const prev = buildGlowMap([{ x: 0, y: 0, className: 'glow-moonpop' }])
    const next = buildGlowMap([])
    const diff = diffGlow(prev, next)
    expect(diff.added).toEqual([])
    expect(diff.removed).toEqual(['0,0'])
  })

  it('treats a className change as a replace (removed + added)', () => {
    const prev = buildGlowMap([{ x: 2, y: 2, className: 'glow-sun' }])
    const next = buildGlowMap([{ x: 2, y: 2, className: 'glow-rockcandy' }])
    const diff = diffGlow(prev, next)
    expect(diff.added).toEqual([{ x: 2, y: 2, className: 'glow-rockcandy' }])
    expect(diff.removed).toEqual(['2,2'])
  })

  it('is a no-op when the glow set is unchanged', () => {
    const prev = buildGlowMap([{ x: 1, y: 1, className: 'glow-sun' }])
    const next = buildGlowMap([{ x: 1, y: 1, className: 'glow-sun' }])
    const diff = diffGlow(prev, next)
    expect(diff.added).toEqual([])
    expect(diff.removed).toEqual([])
  })
})
