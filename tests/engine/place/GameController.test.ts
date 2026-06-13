import { createGameController } from '@/engine/place/GameController'
import type { Place } from '@/engine/place/Place'

function fakePlace(id: string, log: string[]): Place {
  return {
    id,
    mount() {
      log.push(`mount:${id}`)
      return () => log.push(`dispose:${id}`)
    },
  }
}

describe('GameController', () => {
  it('mounts the place set as current', () => {
    const log: string[] = []
    const c = createGameController()
    const a = fakePlace('a', log)
    c.setPlace(a)
    expect(c.current()).toBe(a)
    expect(log).toEqual(['mount:a'])
  })

  it('disposes the outgoing place before mounting the next (no leak)', () => {
    const log: string[] = []
    const c = createGameController()
    c.setPlace(fakePlace('a', log))
    c.setPlace(fakePlace('b', log))
    expect(log).toEqual(['mount:a', 'dispose:a', 'mount:b'])
  })

  it('returns to the saved map place', () => {
    const log: string[] = []
    const c = createGameController()
    const map = fakePlace('map', log)
    c.enterMap(map)
    c.setPlace(fakePlace('quest', log))
    expect(c.returnToMap()).toBe(true)
    expect(c.current()).toBe(map)
    expect(log).toEqual(['mount:map', 'dispose:map', 'mount:quest', 'dispose:quest', 'mount:map'])
  })

  it('returnToMap is false when no map was entered', () => {
    const c = createGameController()
    expect(c.returnToMap()).toBe(false)
  })
})
