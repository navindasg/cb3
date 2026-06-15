import { createEventLog, lineOpacity, DEFAULT_MAX_LINES } from '@/render/eventLog'

describe('lineOpacity', () => {
  it('is full for the newest line and dims with age, clamped at a floor', () => {
    expect(lineOpacity(0)).toBe(1)
    expect(lineOpacity(1)).toBeCloseTo(0.78)
    expect(lineOpacity(100)).toBe(0.18) // clamped
  })
})

describe('createEventLog', () => {
  it('appends lines newest-last and grades opacity by age', () => {
    const root = document.createElement('div')
    const log = createEventLog(root, { maxLines: 5 })
    log.push('one')
    log.push('two')
    log.push('three')
    const lines = log.el.querySelectorAll('.event-log-line')
    expect(lines.length).toBe(3)
    expect(lines[0]?.textContent).toBe('one')
    expect(lines[2]?.textContent).toBe('three')
    // Newest (last) is fully opaque; older lines are dimmer.
    expect((lines[2] as HTMLElement).style.opacity).toBe('1')
    expect(Number((lines[0] as HTMLElement).style.opacity)).toBeLessThan(1)
  })

  it('caps the column to maxLines, dropping the oldest', () => {
    const root = document.createElement('div')
    const log = createEventLog(root, { maxLines: 3 })
    for (const t of ['a', 'b', 'c', 'd', 'e']) log.push(t)
    const lines = log.el.querySelectorAll('.event-log-line')
    expect(lines.length).toBe(3)
    expect([...lines].map((l) => l.textContent)).toEqual(['c', 'd', 'e'])
  })

  it('defaults the cap and dispose removes the element', () => {
    const root = document.createElement('div')
    const log = createEventLog(root)
    for (let i = 0; i < DEFAULT_MAX_LINES + 3; i++) log.push(`line ${i}`)
    expect(log.el.querySelectorAll('.event-log-line').length).toBe(DEFAULT_MAX_LINES)
    log.dispose()
    expect(root.querySelector('.event-log')).toBeNull()
  })
})
