import { en } from '@/content/i18n/en'
import { selectVariant } from '@/engine/content/dialogue'
import { ASTRONOMER_DIALOGUE } from '@/content/dialogue/astronomer'
import { BEANSTALK_CLIMB } from '@/content/quests/beanstalkClimb'
import { CLOUD_STRATUM, SKY_STRATUM } from '@/content/strata'
import { SEED_EVENT_FLAG } from '@/engine/content/seedEvent'
import { createDefaultSave } from '@/engine/state/defaultSave'
import type { GameState } from '@/engine/types/GameState'

const KEYS = new Set(Object.keys(en))
const has = (key: string): boolean => KEYS.has(key)

describe('astronomer offers his (wrong) theories after the seed event', () => {
  it('still murmurs about stars before the seed event', () => {
    const owned: GameState = { ...createDefaultSave(), flags: { telescopeOwned: true } }
    expect(selectVariant(ASTRONOMER_DIALOGUE, owned)?.id).toBe('postTelescope')
  })

  it('pre-empts the star murmur with seed theories once the event has fired', () => {
    const afterSeed: GameState = {
      ...createDefaultSave(),
      flags: { telescopeOwned: true, [SEED_EVENT_FLAG]: true },
    }
    expect(selectVariant(ASTRONOMER_DIALOGUE, afterSeed)?.id).toBe('seedTheories')
  })
})

describe('Block G i18n key completeness', () => {
  it('every astronomer seed-theory line resolves', () => {
    const seed = ASTRONOMER_DIALOGUE.variants.find((v) => v.id === 'seedTheories')!
    for (const line of seed.lines) expect(has(line), line).toBe(true)
  })

  it('every beanstalk-climb death message resolves', () => {
    for (const d of BEANSTALK_CLIMB.deathMessages) expect(has(d.message), d.message).toBe(true)
  })

  it('every cloud/sky zone display key resolves', () => {
    for (const zone of [...CLOUD_STRATUM.zones, ...SKY_STRATUM.zones]) {
      expect(has(zone.displayKey), zone.displayKey).toBe(true)
    }
  })

  it('the beanstalk flavor keys all resolve', () => {
    for (const key of [
      'beanstalk.seedLands',
      'beanstalk.seedAppears',
      'beanstalk.feedProgress',
      'beanstalk.reachedClouds',
      'beanstalk.elevatorReady',
    ]) {
      expect(has(key), key).toBe(true)
    }
  })
})
