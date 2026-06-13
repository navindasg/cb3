import { createDefaultSave } from '@/engine/state/defaultSave'
import { RESOURCE_KEYS } from '@/engine/types/GameState'

describe('createDefaultSave', () => {
  it('opens with one candy', () => {
    expect(createDefaultSave().candies.current).toBe(1)
  })

  it('seeds the star counter at the perfect number 8128', () => {
    expect(createDefaultSave().starsRemaining).toBe(8128)
  })

  it('starts with zero candies eaten and thrown', () => {
    const s = createDefaultSave()
    expect(s.lifetimeCandiesEaten).toBe(0)
    expect(s.lifetimeCandiesThrown).toBe(0)
  })

  it('includes every declared resource', () => {
    const s = createDefaultSave()
    for (const key of RESOURCE_KEYS) {
      expect(typeof s[key].current).toBe('number')
    }
  })

  it('returns an independent object each call (no shared references)', () => {
    const a = createDefaultSave()
    const b = createDefaultSave()
    expect(a).not.toBe(b)
    expect(a.candies).not.toBe(b.candies)
    a.flags['marker'] = true
    expect(b.flags['marker']).toBeUndefined()
  })
})
