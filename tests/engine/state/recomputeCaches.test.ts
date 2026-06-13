import { recomputeCaches, derivedMaxHp, BASE_MAX_HP, MAX_HP_KEY } from '@/engine/state/recomputeCaches'
import { createDefaultSave } from '@/engine/state/defaultSave'

describe('derivedMaxHp', () => {
  it('is the base when nothing has been eaten', () => {
    expect(derivedMaxHp(0)).toBe(BASE_MAX_HP)
  })

  it('grows by one per eaten threshold (monotonic, integer)', () => {
    // 50 candies eaten = +1 hp (one threshold step).
    expect(derivedMaxHp(50)).toBe(BASE_MAX_HP + 1)
    expect(derivedMaxHp(500)).toBe(BASE_MAX_HP + 10)
  })

  it('never returns a fraction', () => {
    const hp = derivedMaxHp(37)
    expect(Number.isInteger(hp)).toBe(true)
  })
})

describe('recomputeCaches', () => {
  it('stamps the derived maxHp cache into numbers', () => {
    const state = recomputeCaches(createDefaultSave())
    expect(state.numbers[MAX_HP_KEY]).toBe(BASE_MAX_HP)
  })

  it('clamps an over-full playerHpCurrent down to the fresh maxHp', () => {
    const stale = { ...createDefaultSave(), playerHpCurrent: 9999 }
    const fixed = recomputeCaches(stale)
    expect(fixed.playerHpCurrent).toBe(derivedMaxHp(stale.lifetimeCandiesEaten))
  })

  it('leaves a valid playerHpCurrent untouched', () => {
    const ok = { ...createDefaultSave(), playerHpCurrent: 4 }
    const fixed = recomputeCaches(ok)
    expect(fixed.playerHpCurrent).toBe(4)
  })

  it('recomputes maxHp from lifetimeCandiesEaten (the never-stored derived value)', () => {
    const eaten = { ...createDefaultSave(), lifetimeCandiesEaten: 500, playerHpCurrent: 5 }
    const fixed = recomputeCaches(eaten)
    expect(fixed.numbers[MAX_HP_KEY]).toBe(BASE_MAX_HP + 10)
  })

  it('does not mutate the input state', () => {
    const before = { ...createDefaultSave(), playerHpCurrent: 9999 }
    const snapshotHp = before.playerHpCurrent
    recomputeCaches(before)
    expect(before.playerHpCurrent).toBe(snapshotHp)
    expect(before.numbers[MAX_HP_KEY]).toBeUndefined()
  })

  it('clamps a negative playerHpCurrent up to zero', () => {
    const broken = { ...createDefaultSave(), playerHpCurrent: -5 }
    expect(recomputeCaches(broken).playerHpCurrent).toBe(0)
  })
})
