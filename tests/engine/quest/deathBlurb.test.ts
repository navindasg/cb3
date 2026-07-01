import { deathBlurb } from '@/engine/quest/deathBlurb'
import type { DeathMessage } from '@/engine/types/defs'

const TABLE: readonly DeathMessage[] = [
  { source: 'candyBat', message: 'death.candyBat' },
  { source: 'kraken', message: 'death.kraken' },
  { source: 'generic', message: 'death.generic' },
]

describe('deathBlurb (§19 shared picker)', () => {
  it('returns the exact-source line when present', () => {
    expect(deathBlurb('kraken', TABLE)).toBe('death.kraken')
    expect(deathBlurb('candyBat', TABLE)).toBe('death.candyBat')
  })

  it('falls back to the generic line for an unknown source', () => {
    expect(deathBlurb('somethingNew', TABLE)).toBe('death.generic')
  })

  it('falls back to the generic line for undefined (unattributed) source', () => {
    expect(deathBlurb(undefined, TABLE)).toBe('death.generic')
  })

  it('returns the generic line for the literal "generic" source', () => {
    expect(deathBlurb('generic', TABLE)).toBe('death.generic')
  })

  it('returns "" when there is no match and no generic fallback (never throws)', () => {
    const noGeneric: readonly DeathMessage[] = [{ source: 'candyBat', message: 'death.candyBat' }]
    expect(deathBlurb('kraken', noGeneric)).toBe('')
    expect(deathBlurb(undefined, noGeneric)).toBe('')
  })

  it('is pure — the same inputs give the same output and the table is untouched', () => {
    const before = JSON.stringify(TABLE)
    const a = deathBlurb('kraken', TABLE)
    const b = deathBlurb('kraken', TABLE)
    expect(a).toBe(b)
    expect(JSON.stringify(TABLE)).toBe(before)
  })

  it('prefers the first exact match (source ordering is stable)', () => {
    const dup: readonly DeathMessage[] = [
      { source: 'kraken', message: 'death.kraken' },
      { source: 'kraken', message: 'death.generic' },
      { source: 'generic', message: 'death.generic' },
    ]
    expect(deathBlurb('kraken', dup)).toBe('death.kraken')
  })
})
