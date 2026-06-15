import { ACT0_FEATURE_REQUESTS, MAP_UNLOCKED_FLAG } from '@/content/gui/featureRequests'
import { en } from '@/content/i18n/en'

const KEYS = new Set(Object.keys(en))

describe('ACT0 feature-request ladder', () => {
  it('lists the three Act 0 chrome unlocks, the map last (the capstone)', () => {
    expect(ACT0_FEATURE_REQUESTS.map((f) => f.flag)).toEqual([
      'statusBarUnlocked',
      'healthBarUnlocked',
      'mapUnlocked',
    ])
    expect(ACT0_FEATURE_REQUESTS.at(-1)?.flag).toBe(MAP_UNLOCKED_FLAG)
  })

  it('has positive prices and unique flags', () => {
    const flags = new Set(ACT0_FEATURE_REQUESTS.map((f) => f.flag))
    expect(flags.size).toBe(ACT0_FEATURE_REQUESTS.length)
    for (const f of ACT0_FEATURE_REQUESTS) expect(f.price).toBeGreaterThan(0)
  })

  it('the first request opens at thirty (CB2 status-bar threshold), totalling ~45 to the map', () => {
    expect(ACT0_FEATURE_REQUESTS[0]?.price).toBe(30)
    const total = ACT0_FEATURE_REQUESTS.reduce((sum, f) => sum + f.price, 0)
    expect(total).toBe(45)
  })

  it('every button + comment i18n key resolves', () => {
    for (const f of ACT0_FEATURE_REQUESTS) {
      expect(KEYS.has(f.buttonKey), f.buttonKey).toBe(true)
      expect(KEYS.has(f.commentKey), f.commentKey).toBe(true)
    }
  })
})
