import {
  formatCount,
  formatCompact,
  formatAdaptive,
  groupWithSpaces,
  candyCountSentence,
} from '@/engine/number/format'

describe('formatCount', () => {
  it('groups with commas (pinned en-US)', () => {
    expect(formatCount(1_000_000_000)).toBe('1,000,000,000')
    expect(formatCount(1234)).toBe('1,234')
    expect(formatCount(0)).toBe('0')
  })

  it('floors fractional accrual to whole candies', () => {
    expect(formatCount(3.99)).toBe('3')
  })
})

describe('formatCompact', () => {
  it('uses K/M/B/T tiers', () => {
    expect(formatCompact(1500)).toBe('1.5K')
    expect(formatCompact(2_000_000)).toBe('2M')
    expect(formatCompact(3_400_000_000)).toBe('3.4B')
    expect(formatCompact(7_000_000_000_000)).toBe('7T')
  })

  it('passes small numbers through untiered', () => {
    expect(formatCompact(42)).toBe('42')
  })

  it('handles negatives', () => {
    expect(formatCompact(-1500)).toBe('-1.5K')
  })
})

describe('formatAdaptive', () => {
  it('keeps the full number when it fits', () => {
    expect(formatAdaptive(1234, 16)).toBe('1,234')
  })

  it('falls back to compact when too wide', () => {
    expect(formatAdaptive(3_400_000_000, 6)).toBe('3.4B')
  })
})

describe('groupWithSpaces', () => {
  it('groups thousands with spaces (CB2 style)', () => {
    expect(groupWithSpaces(1_000_000)).toBe('1 000 000')
    expect(groupWithSpaces(1234)).toBe('1 234')
    expect(groupWithSpaces(42)).toBe('42')
    expect(groupWithSpaces(-1500)).toBe('-1 500')
  })
})

describe('candyCountSentence', () => {
  it('uses the singular for exactly one candy and no trailing period', () => {
    expect(candyCountSentence(1)).toBe('You have 1 candy')
  })

  it('space-groups the plural', () => {
    expect(candyCountSentence(0)).toBe('You have 0 candies')
    expect(candyCountSentence(1500)).toBe('You have 1 500 candies')
  })

  it('floors fractional accrual', () => {
    expect(candyCountSentence(7.9)).toBe('You have 7 candies')
  })

  it('keeps the CB2 easter eggs (1337 -> leet, 42 -> a little flourish)', () => {
    expect(candyCountSentence(1337)).toBe('You have leet candies')
    expect(candyCountSentence(42)).toBe('You have 42 candies \\o/')
  })

  it('handles the impossible negative case', () => {
    expect(candyCountSentence(-1)).toBe('What, negative candies?!')
  })
})
