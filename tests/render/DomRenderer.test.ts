import { DomRenderer } from '@/render/DomRenderer'
import { CellBuffer } from '@/render/CellBuffer'
import type { HotspotClickEvent } from '@/render/Renderer'

const METRICS = { cellW: 8, cellH: 16 }

function stubRect(pre: HTMLElement, left = 0, top = 0): void {
  // jsdom returns zeros; pin a known origin so hitTest math is exercised.
  pre.getBoundingClientRect = () =>
    ({ left, top, right: 0, bottom: 0, width: 0, height: 0, x: left, y: top, toJSON() {} }) as DOMRect
}

function click(el: HTMLElement, clientX: number, clientY: number): void {
  el.dispatchEvent(new MouseEvent('click', { clientX, clientY, bubbles: true }))
}

function move(el: HTMLElement, clientX: number, clientY: number): void {
  el.dispatchEvent(new MouseEvent('mousemove', { clientX, clientY, bubbles: true }))
}

describe('DomRenderer rendering', () => {
  it('paints the serialized buffer into a single <pre>', () => {
    const root = document.createElement('div')
    const r = new DomRenderer({ metrics: METRICS })
    r.mount(root)
    const buffer = CellBuffer.create(3, 1).drawString(0, 0, 'abc')
    r.render(null, buffer)
    const pre = root.querySelector('pre')
    expect(pre?.innerHTML).toBe('abc')
    r.unmount()
  })

  it('refuses a double mount', () => {
    const r = new DomRenderer({ metrics: METRICS })
    r.mount(document.createElement('div'))
    expect(() => r.mount(document.createElement('div'))).toThrow()
  })
})

describe('DomRenderer hit-testing dispatch', () => {
  it('fires onHotspot for a click on a hotspot cell', () => {
    const root = document.createElement('div')
    const events: HotspotClickEvent[] = []
    const r = new DomRenderer({ metrics: METRICS, onHotspot: (e) => events.push(e) })
    r.mount(root)
    const pre = root.querySelector('pre') as HTMLElement
    stubRect(pre)

    const buffer = CellBuffer.create(4, 1)
      .drawString(0, 0, 'menu')
      .withHotspot({ x: 1, y: 0, width: 2, height: 1, action: 'open' })
    r.render(null, buffer)

    // Cell (2,0): clientX in [16,24), clientY in [0,16).
    click(pre, 18, 4)
    expect(events).toEqual([{ action: 'open', col: 2, row: 0 }])

    // A click outside any hotspot does not fire.
    click(pre, 0, 4) // cell (0,0) — no hotspot there
    expect(events).toHaveLength(1)
    r.unmount()
  })

  it('does NOT accumulate listeners across re-renders', () => {
    const root = document.createElement('div')
    let count = 0
    const r = new DomRenderer({ metrics: METRICS, onHotspot: () => count++ })
    r.mount(root)
    const pre = root.querySelector('pre') as HTMLElement
    stubRect(pre)

    const buffer = CellBuffer.create(2, 1)
      .drawString(0, 0, 'ok')
      .withHotspot({ x: 0, y: 0, width: 2, height: 1, action: 'a' })
    // Render many times; if listeners accumulated, one click would fire N times.
    for (let i = 0; i < 5; i++) r.render(null, buffer)
    click(pre, 4, 4)
    expect(count).toBe(1)
    r.unmount()
  })

  it('uses the latest hotspot map after a re-render (no stale binding)', () => {
    const root = document.createElement('div')
    const seen: string[] = []
    const r = new DomRenderer({ metrics: METRICS, onHotspot: (e) => seen.push(e.action) })
    r.mount(root)
    const pre = root.querySelector('pre') as HTMLElement
    stubRect(pre)

    r.render(
      null,
      CellBuffer.create(2, 1).withHotspot({ x: 0, y: 0, width: 2, height: 1, action: 'first' }),
    )
    r.render(
      null,
      CellBuffer.create(2, 1).withHotspot({ x: 0, y: 0, width: 2, height: 1, action: 'second' }),
    )
    click(pre, 4, 4)
    expect(seen).toEqual(['second'])
    r.unmount()
  })

  it('dedupes hover to one event per changed cell', () => {
    const root = document.createElement('div')
    const hovers: (HotspotClickEvent | null)[] = []
    const r = new DomRenderer({ metrics: METRICS, onHover: (e) => hovers.push(e) })
    r.mount(root)
    const pre = root.querySelector('pre') as HTMLElement
    stubRect(pre)
    r.render(
      null,
      CellBuffer.create(3, 1).withHotspot({ x: 0, y: 0, width: 1, height: 1, action: 'h' }),
    )
    move(pre, 2, 2) // cell 0,0
    move(pre, 3, 3) // still cell 0,0 -> deduped
    move(pre, 10, 2) // cell 1,0 -> no hotspot -> null
    expect(hovers).toEqual([{ action: 'h', col: 0, row: 0 }, null])
    r.unmount()
  })
})

describe('DomRenderer glow overlay', () => {
  it('adds and removes glow spans as the glow set changes', () => {
    const root = document.createElement('div')
    const r = new DomRenderer({ metrics: METRICS })
    r.mount(root)
    const overlay = root.querySelector('.glow-overlay') as HTMLElement

    const withGlow = CellBuffer.create(3, 1).withGlow({ x: 1, y: 0, className: 'glow-sun' })
    r.render(null, withGlow)
    expect(overlay.querySelectorAll('span').length).toBe(1)
    const span = overlay.querySelector('span') as HTMLElement
    expect(span.className).toBe('glow-sun')
    expect(span.style.left).toBe('8px') // x=1 * cellW=8
    expect(span.getAttribute('data-cell')).toBe('1,0')

    // Remove the glow on the next render.
    r.render(withGlow, CellBuffer.create(3, 1))
    expect(overlay.querySelectorAll('span').length).toBe(0)
    r.unmount()
  })

  it('replaces a glow span when its className changes', () => {
    const root = document.createElement('div')
    const r = new DomRenderer({ metrics: METRICS })
    r.mount(root)
    const overlay = root.querySelector('.glow-overlay') as HTMLElement

    r.render(null, CellBuffer.create(2, 1).withGlow({ x: 0, y: 0, className: 'glow-sun' }))
    r.render(null, CellBuffer.create(2, 1).withGlow({ x: 0, y: 0, className: 'glow-rockcandy' }))
    const spans = overlay.querySelectorAll('span')
    expect(spans.length).toBe(1)
    expect(spans[0]?.className).toBe('glow-rockcandy')
    r.unmount()
  })
})

describe('DomRenderer metric measurement (no injected metrics)', () => {
  it('measures cellW/cellH from the <pre> rect and first-row length', () => {
    const root = document.createElement('div')
    const events: HotspotClickEvent[] = []
    const r = new DomRenderer({ onHotspot: (e) => events.push(e) }) // no metrics
    r.mount(root)
    const pre = root.querySelector('pre') as HTMLElement
    r.render(
      null,
      CellBuffer.create(4, 2)
        .drawString(0, 0, 'menu')
        .withHotspot({ x: 0, y: 0, width: 4, height: 1, action: 'open' }),
    )
    // Stub a positive rect: width 40 over 4 cols => cellW 10; height 32 over 2 rows.
    pre.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 40, bottom: 32, width: 40, height: 32, x: 0, y: 0, toJSON() {} }) as DOMRect
    // cellW measured = 40/4 = 10; cellH = rect.height (32) since cols path uses height||fallback.
    click(pre, 5, 5) // cell (0,0)
    expect(events).toEqual([{ action: 'open', col: 0, row: 0 }])
    r.unmount()
  })

  it('ignores pointer events when metrics cannot be measured (zero rect)', () => {
    const root = document.createElement('div')
    let fired = 0
    const r = new DomRenderer({ onHotspot: () => fired++ }) // no metrics; jsdom rect is zero
    r.mount(root)
    const pre = root.querySelector('pre') as HTMLElement
    r.render(
      null,
      CellBuffer.create(2, 1).withHotspot({ x: 0, y: 0, width: 2, height: 1, action: 'a' }),
    )
    click(pre, 0, 0)
    expect(fired).toBe(0) // no metrics -> handlePointer bails before dispatch
    r.unmount()
  })
})

describe('DomRenderer teardown', () => {
  it('removes the <pre> and overlay on unmount', () => {
    const root = document.createElement('div')
    const r = new DomRenderer({ metrics: METRICS })
    r.mount(root)
    expect(root.querySelector('pre')).not.toBeNull()
    r.unmount()
    expect(root.querySelector('pre')).toBeNull()
    expect(root.querySelector('.glow-overlay')).toBeNull()
  })

  it('throws if render is called before mount', () => {
    const r = new DomRenderer({ metrics: METRICS })
    expect(() => r.render(null, CellBuffer.create(1, 1))).toThrow()
  })
})
