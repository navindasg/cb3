import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  currentAsteroid,
  asteroidProgress,
  reefHarvested,
  canBreak,
  breakAsteroid,
} from '@/engine/content/reef'
import { ASTEROID_FIELD, REEF_ASTEROID_KEY, REEF_HITS_KEY } from '@/content/reef/asteroids'
import type { GameState } from '@/engine/types/GameState'

/** Break the current asteroid fully, returning the resulting state. */
const breakOne = (start: GameState, asteroid = currentAsteroid(start, ASTEROID_FIELD)!): GameState => {
  let s = start
  for (let i = 0; i < asteroid.hitsToBreak; i++) s = breakAsteroid(s, ASTEROID_FIELD).state
  return s
}

describe('the rock candy reef — breaking the field', () => {
  it('starts on the first asteroid, nothing struck, not harvested', () => {
    const s = createDefaultSave()
    expect(currentAsteroid(s, ASTEROID_FIELD)).toEqual(ASTEROID_FIELD[0])
    expect(asteroidProgress(s)).toBe(0)
    expect(reefHarvested(s, ASTEROID_FIELD)).toBe(false)
    expect(canBreak(s, ASTEROID_FIELD)).toBe(true)
  })

  it('a hit frees rock candy and chips the asteroid (without breaking it yet)', () => {
    const first = ASTEROID_FIELD[0]! // hitsToBreak >= 2
    const result = breakAsteroid(createDefaultSave(), ASTEROID_FIELD)
    expect(result.ok).toBe(true)
    expect(result.broke).toBe(false)
    expect(result.gained).toBe(first.yieldPerHit)
    expect(result.state.rockCandy.current).toBe(first.yieldPerHit)
    expect(asteroidProgress(result.state)).toBe(1)
  })

  it('the breaking hit drifts the next asteroid in and resets the hit count', () => {
    const first = ASTEROID_FIELD[0]!
    let s = createDefaultSave()
    for (let i = 0; i < first.hitsToBreak - 1; i++) s = breakAsteroid(s, ASTEROID_FIELD).state
    const breaking = breakAsteroid(s, ASTEROID_FIELD)
    expect(breaking.broke).toBe(true)
    expect(breaking.gained).toBe(first.yieldPerHit) // the breaking hit still pays out
    expect(currentAsteroid(breaking.state, ASTEROID_FIELD)).toEqual(ASTEROID_FIELD[1])
    expect(asteroidProgress(breaking.state)).toBe(0)
  })

  it('banks the full field yield and harvests the reef once every asteroid is broken', () => {
    let s = createDefaultSave()
    let expected = 0
    for (const asteroid of ASTEROID_FIELD) {
      expect(reefHarvested(s, ASTEROID_FIELD)).toBe(false)
      expected += asteroid.hitsToBreak * asteroid.yieldPerHit
      s = breakOne(s, asteroid)
    }
    expect(reefHarvested(s, ASTEROID_FIELD)).toBe(true)
    expect(canBreak(s, ASTEROID_FIELD)).toBe(false)
    expect(s.rockCandy.current).toBe(expected)
  })

  it('is a no-op (same reference) once the reef is harvested', () => {
    let s = createDefaultSave()
    for (const asteroid of ASTEROID_FIELD) s = breakOne(s, asteroid)
    const result = breakAsteroid(s, ASTEROID_FIELD)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('harvested')
    expect(result.state).toBe(s)
    expect(result.gained).toBe(0)
  })

  it('does not mutate the input state', () => {
    const before = createDefaultSave()
    breakAsteroid(before, ASTEROID_FIELD)
    expect(before.rockCandy.current).toBe(0)
    expect(before.numbers[REEF_ASTEROID_KEY]).toBeUndefined()
    expect(before.numbers[REEF_HITS_KEY]).toBeUndefined()
  })
})
