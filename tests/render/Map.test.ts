import type { StratumDef } from '@/engine/types/defs'
import type { GameState } from '@/engine/types/GameState'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { createMapRenderer } from '@/render/Map'

const METRICS = { cellW: 8, cellH: 16 }

const ground: StratumDef = {
  id: 'ground',
  anchor: 'groundLevel',
  heightRows: 2,
  ascii: ['====', 'home'],
  zones: [{ id: 'house', displayKey: 'z.house', label: 'H', x: 0, rowOffset: 1, action: 'goHouse' }],
}

const sky: StratumDef = {
  id: 'sky',
  anchor: 'skyLevel',
  heightRows: 2,
  ascii: ['~~~~', '~~~~'],
  unlockFlag: 'beanstalkReachedClouds',
  zones: [{ id: 'cloud', displayKey: 'z.cloud', label: 'C', x: 2, rowOffset: 0, action: 'goCloud' }],
}

function state(flags: Record<string, boolean> = {}, numbers: Record<string, number> = {}): GameState {
  return { ...createDefaultSave(), flags, numbers }
}

function stubRect(pre: HTMLElement, top = 0): void {
  pre.getBoundingClientRect = () =>
    ({ left: 0, top, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {} }) as DOMRect
}

describe('Map renderer', () => {
  it('renders only revealed strata into the surface', () => {
    const root = document.createElement('div')
    const r = createMapRenderer(root, { strata: [ground, sky], metrics: METRICS, viewportRows: 10 })
    r.render(state())
    const pre = root.querySelector('pre') as HTMLElement
    // Sky is locked: its '~~~~' backdrop must not appear.
    expect(pre.innerHTML).not.toContain('~')
    // The 'H' label is not in the 'home' art, so it is stamped and wrapped as a styled,
    // clickable map-zone hotspot over the backdrop.
    expect(pre.innerHTML).toContain('data-action="goHouse"')
    expect(pre.innerHTML).toContain('class="map-zone"')
    expect(pre.innerHTML).toContain('ome')
    r.unmount()
  })

  it('grows the page upward when the higher stratum unlocks', () => {
    const root = document.createElement('div')
    const r = createMapRenderer(root, { strata: [ground, sky], metrics: METRICS, viewportRows: 10 })
    r.render(state({ beanstalkReachedClouds: true }))
    const pre = root.querySelector('pre') as HTMLElement
    expect(pre.innerHTML).toContain('~')
    expect(pre.innerHTML).toContain('data-action="goHouse"')
    r.unmount()
  })

  it('restores scrollY from state.numbers and applies a translateY transform', () => {
    const root = document.createElement('div')
    const r = createMapRenderer(root, { strata: [ground, sky], metrics: METRICS, viewportRows: 1 })
    r.render(state({ beanstalkReachedClouds: true }, { scrollY: 2 }))
    const pre = root.querySelector('pre') as HTMLElement
    expect(r.scrollY()).toBe(2)
    expect(pre.style.transform).toBe('translateY(-32px)') // 2 rows * 16px
    r.unmount()
  })

  it('persists scrollY through the injected callback on scrollTo', () => {
    const root = document.createElement('div')
    let persisted = -1
    const r = createMapRenderer(root, {
      strata: [ground, sky],
      metrics: METRICS,
      viewportRows: 1,
      persistScrollY: (y) => {
        persisted = y
      },
    })
    r.render(state({ beanstalkReachedClouds: true }))
    r.scrollTo(1)
    expect(persisted).toBe(1)
    expect(r.scrollY()).toBe(1)
    r.unmount()
  })

  it('dispatches a zone action on click (delegated, hit-tested)', () => {
    const root = document.createElement('div')
    const actions: string[] = []
    const r = createMapRenderer(root, {
      strata: [ground],
      metrics: METRICS,
      viewportRows: 10,
      onZone: (a) => actions.push(a),
    })
    r.render(state())
    const pre = root.querySelector('pre') as HTMLElement
    stubRect(pre)
    // House label 'H' is at map cell (0,1): clientX [0,8), clientY [16,32).
    pre.dispatchEvent(new MouseEvent('click', { clientX: 2, clientY: 18, bubbles: true }))
    expect(actions).toEqual(['goHouse'])
    r.unmount()
  })

  it('routes a zone click correctly when the map is restored scrolled', () => {
    const root = document.createElement('div')
    const actions: string[] = []
    const r = createMapRenderer(root, {
      strata: [ground, sky],
      metrics: METRICS,
      viewportRows: 2,
      onZone: (a) => actions.push(a),
    })
    // Both strata revealed: sky (rows 0-1) stacks above ground (rows 2-3). Restored
    // scroll of 2 rows means the <pre> is translated up by 32px, which a real browser
    // reflects in rect.top (= -scroll*cellH). The house zone sits at absolute map row 3.
    r.render(state({ beanstalkReachedClouds: true }, { scrollY: 2 }))
    const pre = root.querySelector('pre') as HTMLElement
    expect(r.scrollY()).toBe(2)
    stubRect(pre, -2 * METRICS.cellH) // translateY reflected: top = -32
    // House label 'H' is at absolute map cell (0,3): with top=-32, clientY [16,32)
    // hit-tests to row 3 directly — no scroll must be re-added.
    pre.dispatchEvent(new MouseEvent('click', { clientX: 2, clientY: 18, bubbles: true }))
    expect(actions).toEqual(['goHouse'])
    r.unmount()
  })

  it('sets content-visibility:auto and an intrinsic-size hint for virtualization', () => {
    const root = document.createElement('div')
    const r = createMapRenderer(root, { strata: [ground, sky], metrics: METRICS, viewportRows: 10 })
    r.render(state({ beanstalkReachedClouds: true }))
    const pre = root.querySelector('pre') as HTMLElement
    expect(pre.style.contentVisibility).toBe('auto')
    expect(pre.style.containIntrinsicSize).toBe('64px') // 4 rows * 16px
    r.unmount()
  })

  it('exposes a map aria-label when a location describer is supplied', () => {
    const root = document.createElement('div')
    const r = createMapRenderer(root, {
      strata: [ground],
      metrics: METRICS,
      viewportRows: 10,
      describeLocation: () => 'The field. Player at home.',
    })
    r.render(state())
    const pre = root.querySelector('pre') as HTMLElement
    expect(pre.getAttribute('role')).toBe('img')
    expect(pre.getAttribute('aria-label')).toBe('The field. Player at home.')
    r.unmount()
  })
})
