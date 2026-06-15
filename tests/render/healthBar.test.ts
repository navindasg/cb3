import { signal } from '@/engine/signals/signal'
import {
  healthRatio,
  healthColor,
  createHealthBar,
  HEALTH_GREEN,
  HEALTH_ORANGE,
  HEALTH_RED,
} from '@/render/healthBar'

describe('healthRatio', () => {
  it('clamps to [0,1] and handles a non-positive max', () => {
    expect(healthRatio(5, 10)).toBe(0.5)
    expect(healthRatio(20, 10)).toBe(1)
    expect(healthRatio(-3, 10)).toBe(0)
    expect(healthRatio(5, 0)).toBe(0)
  })
})

describe('healthColor', () => {
  it('is green by default, orange under half, red under a fifth', () => {
    expect(healthColor(1)).toBe(HEALTH_GREEN)
    expect(healthColor(0.5)).toBe(HEALTH_GREEN)
    expect(healthColor(0.49)).toBe(HEALTH_ORANGE)
    expect(healthColor(0.2)).toBe(HEALTH_ORANGE)
    expect(healthColor(0.19)).toBe(HEALTH_RED)
    expect(healthColor(0)).toBe(HEALTH_RED)
  })
})

describe('createHealthBar', () => {
  it('reactively renders the fill width, colour, and current/max text', () => {
    const root = document.createElement('div')
    const hp = signal(10)
    const maxHp = signal(10)
    const bar = createHealthBar(root, { hp, maxHp })
    const fill = root.querySelector('.health-bar-fill') as HTMLElement
    const text = root.querySelector('.health-bar-text') as HTMLElement
    expect(fill.style.width).toBe('100%') // jsdom normalises 100.0% -> 100%
    expect(text.textContent).toBe('10 / 10')

    hp.set(2) // 0.2 ratio -> orange edge
    expect(fill.style.width).toBe('20%')
    expect(text.textContent).toBe('2 / 10')

    hp.set(1) // 0.1 -> red
    expect(fill.style.background).toBe('rgb(230, 15, 0)') // #e60f00
    bar.dispose()
  })

  it('hides until its visible signal turns true', () => {
    const root = document.createElement('div')
    const visible = signal(false)
    const bar = createHealthBar(root, { hp: signal(5), maxHp: signal(10), visible })
    expect((root.querySelector('.health-bar') as HTMLElement).style.display).toBe('none')
    visible.set(true)
    expect((root.querySelector('.health-bar') as HTMLElement).style.display).toBe('')
    bar.dispose()
  })

  it('dispose detaches the element', () => {
    const root = document.createElement('div')
    const bar = createHealthBar(root, { hp: signal(5), maxHp: signal(10) })
    bar.dispose()
    expect(root.querySelector('.health-bar')).toBeNull()
  })
})
