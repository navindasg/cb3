import {
  MIN_SPEED,
  MAX_SPEED,
  clampSpeed,
  parseSpeedParam,
  scaledStep,
} from '@/engine/loop/timeScale'

describe('clampSpeed', () => {
  it('keeps an in-range integer untouched', () => {
    expect(clampSpeed(100)).toBe(100)
  })

  it('rounds fractional speeds to the nearest integer', () => {
    expect(clampSpeed(9.6)).toBe(10)
    expect(clampSpeed(2.2)).toBe(2)
  })

  it('floors below the minimum (never slows the sim down)', () => {
    expect(clampSpeed(0)).toBe(MIN_SPEED)
    expect(clampSpeed(-50)).toBe(MIN_SPEED)
  })

  it('caps at the maximum', () => {
    expect(clampSpeed(5000)).toBe(MAX_SPEED)
  })

  it('falls back to the minimum for non-finite input', () => {
    expect(clampSpeed(Number.NaN)).toBe(MIN_SPEED)
    expect(clampSpeed(Number.POSITIVE_INFINITY)).toBe(MIN_SPEED)
  })
})

describe('parseSpeedParam', () => {
  it('reads ?speed=N and clamps it', () => {
    expect(parseSpeedParam('?speed=100')).toBe(100)
    expect(parseSpeedParam('?speed=99999')).toBe(MAX_SPEED)
    expect(parseSpeedParam('?speed=0')).toBe(MIN_SPEED)
  })

  it('defaults to the minimum when absent or unparseable', () => {
    expect(parseSpeedParam('')).toBe(MIN_SPEED)
    expect(parseSpeedParam('?other=1')).toBe(MIN_SPEED)
    expect(parseSpeedParam('?speed=abc')).toBe(MIN_SPEED)
  })

  it('tolerates a leading-? or bare query string', () => {
    expect(parseSpeedParam('speed=10')).toBe(10)
  })
})

describe('scaledStep', () => {
  it('advances stepMs * speed of sim time per real step', () => {
    expect(scaledStep(100, 1)).toBe(100)
    expect(scaledStep(100, 10)).toBe(1000)
    expect(scaledStep(100, 1000)).toBe(100_000)
  })

  it('clamps the speed before scaling', () => {
    expect(scaledStep(100, 0)).toBe(100) // floored to MIN_SPEED
    expect(scaledStep(100, 99999)).toBe(100 * MAX_SPEED)
  })
})
