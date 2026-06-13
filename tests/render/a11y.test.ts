import {
  markDecorative,
  markMeaningful,
  describeLocation,
  prefersReducedMotion,
  applyReducedMotion,
} from '@/render/a11y'

function el(): HTMLElement {
  return document.createElement('div')
}

describe('aria helpers', () => {
  it('marks decorative art as aria-hidden', () => {
    const e = el()
    markDecorative(e)
    expect(e.getAttribute('aria-hidden')).toBe('true')
  })

  it('marks a meaningful scene as role=img with a label, clearing aria-hidden', () => {
    const e = el()
    markDecorative(e)
    markMeaningful(e, 'The village')
    expect(e.getAttribute('role')).toBe('img')
    expect(e.getAttribute('aria-label')).toBe('The village')
    expect(e.hasAttribute('aria-hidden')).toBe(false)
  })
})

describe('describeLocation', () => {
  it('appends a player-location clause when present', () => {
    expect(describeLocation('The village', 'at the blacksmith')).toBe(
      'The village. Player at the blacksmith.',
    )
  })

  it('omits the clause when no location is given', () => {
    expect(describeLocation('The map')).toBe('The map')
    expect(describeLocation('The map', '  ')).toBe('The map')
  })
})

describe('prefersReducedMotion', () => {
  it('is false when matchMedia is unavailable (jsdom default)', () => {
    expect(prefersReducedMotion({} as unknown as Window)).toBe(false)
  })

  it('reflects the media query result', () => {
    const win = { matchMedia: (q: string) => ({ matches: q.includes('reduce') }) }
    expect(prefersReducedMotion(win as unknown as Window)).toBe(true)
  })

  it('is false when matchMedia throws', () => {
    const win = {
      matchMedia: () => {
        throw new Error('boom')
      },
    }
    expect(prefersReducedMotion(win as unknown as Window)).toBe(false)
  })
})

describe('applyReducedMotion', () => {
  it('toggles the reduce-motion class from the preference', () => {
    const root = el()
    const reducedWin = { matchMedia: () => ({ matches: true }) } as unknown as Window
    expect(applyReducedMotion(root, reducedWin)).toBe(true)
    expect(root.classList.contains('reduce-motion')).toBe(true)

    const normalWin = { matchMedia: () => ({ matches: false }) } as unknown as Window
    expect(applyReducedMotion(root, normalWin)).toBe(false)
    expect(root.classList.contains('reduce-motion')).toBe(false)
  })
})
