import { createDefaultSave } from '@/engine/state/defaultSave'
import { resolveMap, buildStratumBuffer } from '@/render/mapModel'
import {
  ACT0_STRATA,
  CLOUD_STRATUM,
  SKY_STRATUM,
  FIELD_STRATUM,
} from '@/content/strata'
import { feedBeanstalk, BEANSTALK_CLOUD_THRESHOLD } from '@/engine/content/beanstalk'
import { fireSeedEvent, SEED_EVENT_THRESHOLD } from '@/engine/content/seedEvent'
import type { GameState } from '@/engine/types/GameState'

/** A state where the beanstalk has reached the clouds (the reveal flag is set). */
function atClouds(over: Partial<GameState> = {}): GameState {
  const base = createDefaultSave()
  return { ...base, flags: { ...base.flags, beanstalkReachedClouds: true }, ...over }
}

describe('the beanstalk reveal extends the map upward (Block G)', () => {
  it('the cloud and sky strata are hidden until the beanstalk reaches the clouds', () => {
    const resolved = resolveMap(ACT0_STRATA, createDefaultSave())
    const ids = resolved.placed.map((p) => p.def.id)
    expect(ids).not.toContain('clouds')
    expect(ids).not.toContain('sky')
  })

  it('appends the cloud + sky strata once beanstalkReachedClouds is set', () => {
    const resolved = resolveMap(ACT0_STRATA, atClouds())
    const ids = resolved.placed.map((p) => p.def.id)
    expect(ids).toContain('clouds')
    expect(ids).toContain('sky')
  })

  it('the cloud stratum stacks ABOVE the field (the page grows upward)', () => {
    const resolved = resolveMap(ACT0_STRATA, atClouds())
    const clouds = resolved.placed.find((p) => p.def.id === 'clouds')!
    const field = resolved.placed.find((p) => p.def.id === 'field')!
    expect(clouds.topRow).toBeLessThan(field.topRow) // higher anchor → smaller topRow → higher on the page
  })

  it('the sky stratum stacks above the clouds', () => {
    const resolved = resolveMap(ACT0_STRATA, atClouds())
    const sky = resolved.placed.find((p) => p.def.id === 'sky')!
    const clouds = resolved.placed.find((p) => p.def.id === 'clouds')!
    expect(sky.topRow).toBeLessThan(clouds.topRow)
  })

  it('reveal grows totalRows by exactly the cloud + sky heights (idempotent extension)', () => {
    const before = resolveMap(ACT0_STRATA, createDefaultSave()).totalRows
    const after = resolveMap(ACT0_STRATA, atClouds()).totalRows
    expect(after).toBe(before + CLOUD_STRATUM.heightRows + SKY_STRATUM.heightRows)
    // Resolving again on the same flagged state is stable (idempotent reveal).
    const again = resolveMap(ACT0_STRATA, atClouds()).totalRows
    expect(again).toBe(after)
  })

  it('the climb-quest hotspot lives in the cloud stratum', () => {
    const width = resolveMap(ACT0_STRATA, atClouds()).width
    const buffer = buildStratumBuffer(CLOUD_STRATUM, atClouds(), width)
    expect(buffer.hotspots.some((h) => h.action === 'quest:beanstalkClimb')).toBe(true)
  })

  it('the elevator zone in the sky appears only once the climb is completed', () => {
    const width = resolveMap(ACT0_STRATA, atClouds()).width
    const noElevator = buildStratumBuffer(SKY_STRATUM, atClouds(), width)
    expect(noElevator.hotspots.some((h) => h.action === 'travel:beanstalkElevator')).toBe(false)

    const climbed = atClouds({ flags: { beanstalkReachedClouds: true, beanstalkElevator: true } })
    const withElevator = buildStratumBuffer(SKY_STRATUM, climbed, width)
    expect(withElevator.hotspots.some((h) => h.action === 'travel:beanstalkElevator')).toBe(true)
  })

  it('the seed-garden zone in the field appears only after the seed event', () => {
    const width = resolveMap(ACT0_STRATA, createDefaultSave()).width
    const noGarden = buildStratumBuffer(FIELD_STRATUM, createDefaultSave(), width)
    expect(noGarden.hotspots.some((h) => h.action === 'enter:beanstalkGarden')).toBe(false)

    // Arm + fire the seed event, then the garden zone reveals (seedPresent).
    const base = createDefaultSave()
    const armedState: GameState = {
      ...base,
      flags: { ...base.flags, telescopeOwned: true },
      candies: { current: 1, lifetimeAccumulated: SEED_EVENT_THRESHOLD, historicalMax: SEED_EVENT_THRESHOLD },
    }
    const afterSeed = fireSeedEvent(armedState).state
    const withGarden = buildStratumBuffer(FIELD_STRATUM, afterSeed, width)
    expect(withGarden.hotspots.some((h) => h.action === 'enter:beanstalkGarden')).toBe(true)
  })
})

describe('the full pivot flow (seed event → feed to clouds → map extends)', () => {
  it('feeding to the threshold sets the flag that the map reveal reads', () => {
    const base = createDefaultSave()
    const fed = feedBeanstalk(
      { ...base, candies: { current: BEANSTALK_CLOUD_THRESHOLD, lifetimeAccumulated: BEANSTALK_CLOUD_THRESHOLD, historicalMax: BEANSTALK_CLOUD_THRESHOLD } },
      BEANSTALK_CLOUD_THRESHOLD,
    ).state
    const resolved = resolveMap(ACT0_STRATA, fed)
    expect(resolved.placed.map((p) => p.def.id)).toContain('clouds')
  })
})
