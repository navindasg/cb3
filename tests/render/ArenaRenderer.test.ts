import {
  composeArena,
  hpBar,
  createArenaRenderer,
  type ArenaModel,
} from '@/render/ArenaRenderer'

const METRICS = { cellW: 8, cellH: 16 }

function stubRect(pre: HTMLElement, top = 0, left = 0): void {
  pre.getBoundingClientRect = () =>
    ({ left, top, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} }) as DOMRect
}

describe('hpBar', () => {
  it('fills proportional segments', () => {
    expect(hpBar(5, 5, 5)).toBe('#####')
    expect(hpBar(0, 5, 5)).toBe('-----')
    expect(hpBar(3, 5, 5)).toBe('###--') // round(3/5*5)=3
    expect(hpBar(1, 4, 4)).toBe('#---')
  })

  it('clamps out-of-range hp and guards maxHp 0', () => {
    expect(hpBar(99, 5, 5)).toBe('#####')
    expect(hpBar(-3, 5, 5)).toBe('-----')
    expect(hpBar(1, 0, 5)).toBe('-----') // maxHp 0 -> no fill
  })
})

describe('composeArena', () => {
  it('composites entity glyphs at their cells', () => {
    const model: ArenaModel = {
      width: 10,
      height: 4,
      entities: [
        { glyph: '@', x: 2, y: 3, hp: 10, maxHp: 10 },
        { glyph: 'b', x: 5, y: 3, hp: 1, maxHp: 1 },
      ],
    }
    const buffer = composeArena(model)
    expect(buffer.charAt(2, 3)).toBe('@')
    expect(buffer.charAt(5, 3)).toBe('b')
  })

  it('draws an HP bar one row above a damaged entity, not above a full-hp one', () => {
    const model: ArenaModel = {
      width: 12,
      height: 4,
      entities: [
        { glyph: '@', x: 0, y: 2, hp: 3, maxHp: 10 }, // damaged
        { glyph: 'F', x: 6, y: 2, hp: 10, maxHp: 10 }, // full
      ],
    }
    const buffer = composeArena(model, 5)
    // round(3/10*5) = 2 filled segments above the damaged entity.
    expect(buffer.rowAt(1)?.slice(0, 5)).toBe('##---')
    // No bar above the full-hp entity at column 6.
    expect(buffer.charAt(6, 1)).toBe(' ')
  })

  it('does not draw an HP bar when the entity is on the top row (no room)', () => {
    const model: ArenaModel = {
      width: 6,
      height: 3,
      entities: [{ glyph: '@', x: 0, y: 0, hp: 1, maxHp: 10 }],
    }
    const buffer = composeArena(model)
    expect(buffer.charAt(0, 0)).toBe('@') // glyph still drawn, no crash
  })

  it('adds a coloured style region when an entity declares a colour', () => {
    const model: ArenaModel = {
      width: 6,
      height: 2,
      entities: [{ glyph: '@', x: 1, y: 1, hp: 5, maxHp: 5, color: '#ff0000' }],
    }
    const buffer = composeArena(model)
    expect(buffer.styles).toContainEqual({ x: 1, y: 1, length: 1, color: '#ff0000' })
  })

  it('draws the background world UNDER the entities (entities win the shared cell)', () => {
    const model: ArenaModel = {
      width: 6,
      height: 3,
      background: ['######', '  ||  ', '######'],
      entities: [{ glyph: '@', x: 2, y: 1, hp: 5, maxHp: 5 }],
    }
    const buffer = composeArena(model)
    expect(buffer.rowAt(0)).toBe('######') // backdrop row drawn
    expect(buffer.charAt(2, 1)).toBe('@') // entity overwrites the backdrop cell it shares
    expect(buffer.charAt(3, 1)).toBe('|') // the rest of the backdrop row survives
  })

  it('composites an exit affordance with a clickable hotspot', () => {
    const model: ArenaModel = {
      width: 12,
      height: 4,
      entities: [],
      exit: { x: 8, y: 0, label: 'exit', action: 'leaveQuest' },
    }
    const buffer = composeArena(model)
    expect(buffer.rowAt(0)?.slice(8, 12)).toBe('exit')
    expect(buffer.hotspots).toContainEqual({
      x: 8,
      y: 0,
      width: 4,
      height: 1,
      action: 'leaveQuest',
    })
  })
})

describe('createArenaRenderer', () => {
  it('renders entities into a <pre> and exposes the composited buffer', () => {
    const root = document.createElement('div')
    const r = createArenaRenderer(root, { metrics: METRICS })
    r.render({
      width: 10,
      height: 3,
      entities: [{ glyph: '@', x: 0, y: 2, hp: 5, maxHp: 5 }],
    })
    const pre = root.querySelector('pre') as HTMLElement
    expect(pre.textContent).toContain('@')
    expect(r.lastBuffer()?.charAt(0, 2)).toBe('@')
    r.unmount()
  })

  it('dispatches the exit action on a click in the exit hotspot (delegated, hit-tested)', () => {
    const root = document.createElement('div')
    const actions: string[] = []
    const r = createArenaRenderer(root, { metrics: METRICS, onExit: (a) => actions.push(a) })
    r.render({
      width: 12,
      height: 3,
      entities: [],
      exit: { x: 1, y: 0, label: 'X', action: 'leaveQuest' },
    })
    const pre = root.querySelector('pre') as HTMLElement
    stubRect(pre)
    // Exit 'X' is at cell (1,0): clientX [8,16), clientY [0,16).
    pre.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 4, bubbles: true }))
    expect(actions).toEqual(['leaveQuest'])
    r.unmount()
  })

  it('does not dispatch when clicking outside any hotspot', () => {
    const root = document.createElement('div')
    const actions: string[] = []
    const r = createArenaRenderer(root, { metrics: METRICS, onExit: (a) => actions.push(a) })
    r.render({ width: 12, height: 3, entities: [], exit: { x: 1, y: 0, label: 'X', action: 'leaveQuest' } })
    const pre = root.querySelector('pre') as HTMLElement
    stubRect(pre)
    pre.dispatchEvent(new MouseEvent('click', { clientX: 80, clientY: 4, bubbles: true })) // cell (10,0)
    expect(actions).toEqual([])
    r.unmount()
  })

  it('installs exactly one click listener that survives re-renders (no accumulation)', () => {
    const root = document.createElement('div')
    let count = 0
    const r = createArenaRenderer(root, { metrics: METRICS, onExit: () => count++ })
    const model: ArenaModel = {
      width: 12,
      height: 3,
      entities: [],
      exit: { x: 1, y: 0, label: 'X', action: 'leaveQuest' },
    }
    r.render(model)
    r.render(model) // re-render must not add a second listener
    r.render(model)
    const pre = root.querySelector('pre') as HTMLElement
    stubRect(pre)
    pre.dispatchEvent(new MouseEvent('click', { clientX: 10, clientY: 4, bubbles: true }))
    expect(count).toBe(1) // one handler -> one dispatch
    r.unmount()
  })

  it('unmount removes the <pre> and clears the buffer', () => {
    const root = document.createElement('div')
    const r = createArenaRenderer(root, { metrics: METRICS })
    r.render({ width: 4, height: 2, entities: [] })
    r.unmount()
    expect(root.querySelector('pre')).toBeNull()
    expect(r.lastBuffer()).toBeNull()
  })
})
