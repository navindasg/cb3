import { signal } from '@/engine/signals/signal'
import { createStatusBar } from '@/render/StatusBar'

describe('StatusBar', () => {
  it('renders each readout as an independent region with a tabular-nums value', () => {
    const root = document.createElement('div')
    const candy = signal(1)
    const hp = signal(10)
    const bar = createStatusBar(root, [
      { id: 'candy', label: 'candies: ', source: candy },
      { id: 'hp', label: 'hp: ', source: hp },
    ])
    const regions = root.querySelectorAll('.status-region')
    expect(regions.length).toBe(2)
    const candyValue = root.querySelector('[data-region="candy"] .status-value') as HTMLElement
    expect(candyValue.textContent).toBe('1')
    expect(candyValue.style.fontVariantNumeric).toContain('tabular-nums')
    bar.dispose()
  })

  it('re-renders ONLY the changed region (fine-grained signal binding)', () => {
    const root = document.createElement('div')
    const candy = signal(1)
    const hp = signal(10)
    const bar = createStatusBar(root, [
      { id: 'candy', label: 'candies: ', source: candy },
      { id: 'hp', label: 'hp: ', source: hp },
    ])
    // Initial render counts each region once.
    expect(bar.renderCounts()).toEqual({ candy: 1, hp: 1 })

    candy.set(2) // only the candy region depends on `candy`
    expect(bar.renderCounts()).toEqual({ candy: 2, hp: 1 })

    const candyValue = root.querySelector('[data-region="candy"] .status-value')
    expect(candyValue?.textContent).toBe('2')
    bar.dispose()
  })

  it('formats values with comma grouping by default', () => {
    const root = document.createElement('div')
    const candy = signal(1_000_000)
    createStatusBar(root, [{ id: 'candy', label: '', source: candy }])
    const value = root.querySelector('.status-value')
    expect(value?.textContent).toBe('1,000,000')
  })

  it('uses a custom formatter when supplied', () => {
    const root = document.createElement('div')
    const mana = signal(5)
    createStatusBar(root, [
      { id: 'mana', label: 'mana: ', source: mana, format: (v) => `${v}/10` },
    ])
    expect(root.querySelector('.status-value')?.textContent).toBe('5/10')
  })

  it('renders "current / max" when a max signal is supplied, reacting to either', () => {
    const root = document.createElement('div')
    const hp = signal(7)
    const maxHp = signal(10)
    const bar = createStatusBar(root, [
      { id: 'hp', label: 'hp: ', source: hp, max: maxHp, format: (c, m) => `${c} / ${m}` },
    ])
    const value = root.querySelector('[data-region="hp"] .status-value')
    expect(value?.textContent).toBe('7 / 10')
    maxHp.set(11) // the max signal is a dependency too
    expect(value?.textContent).toBe('7 / 11')
    bar.dispose()
  })

  it('hides a region until its visible signal turns true (progressive unlock gate)', () => {
    const root = document.createElement('div')
    const candy = signal(1)
    const visible = signal(false)
    const bar = createStatusBar(root, [{ id: 'candy', label: '', source: candy, visible }])
    const region = root.querySelector('[data-region="candy"]') as HTMLElement
    expect(region.style.display).toBe('none')
    visible.set(true)
    expect(region.style.display).toBe('')
    bar.dispose()
  })

  it('dispose stops further region updates (no leak)', () => {
    const root = document.createElement('div')
    const candy = signal(1)
    const bar = createStatusBar(root, [{ id: 'candy', label: '', source: candy }])
    bar.dispose()
    candy.set(99) // effect is detached -> no further re-render
    expect(bar.renderCounts()).toEqual({ candy: 1 })
  })
})
