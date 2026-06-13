import type { CauldronEntry, RecipeDef } from '@/engine/types/defs'
import {
  matchesSpec,
  matchRecipe,
  action,
  contains,
  exactlyOne,
  inOrder,
  all,
  appendEntry,
} from '@/engine/cauldron/recipeMatcher'
import { SYRUP_OF_HEALTH, CAULDRON_RECIPES } from '@/content/recipes/cauldron'

const log = (...entries: CauldronEntry[]): readonly CauldronEntry[] => entries

describe('matchesSpec leaf action', () => {
  it('matches by action when no subject is given', () => {
    expect(matchesSpec(action('stir'), log({ action: 'stir' }))).toBe(true)
    expect(matchesSpec(action('heat'), log({ action: 'stir' }))).toBe(false)
  })

  it('matches by action AND subject when a subject is given', () => {
    expect(matchesSpec(action('add', 'candy'), log({ action: 'add', subject: 'candy' }))).toBe(true)
    expect(matchesSpec(action('add', 'candy'), log({ action: 'add', subject: 'lollipop' }))).toBe(
      false,
    )
  })
})

describe('contains / exactlyOne', () => {
  it('contains matches when at least one entry satisfies the child', () => {
    expect(contains(action('add', 'candy'))).toEqual({
      kind: 'contains',
      step: { kind: 'action', action: 'add', subject: 'candy' },
    })
    expect(
      matchesSpec(contains(action('add', 'candy')), log({ action: 'stir' }, { action: 'add', subject: 'candy' })),
    ).toBe(true)
  })

  it('exactlyOne requires precisely one matching entry', () => {
    const spec = exactlyOne(action('add', 'lollipop'))
    expect(matchesSpec(spec, log({ action: 'add', subject: 'lollipop' }))).toBe(true)
    expect(
      matchesSpec(spec, log({ action: 'add', subject: 'lollipop' }, { action: 'add', subject: 'lollipop' })),
    ).toBe(false) // two → not exactly one
    expect(matchesSpec(spec, log({ action: 'stir' }))).toBe(false) // zero → not exactly one
  })

  it('exactlyOne throws when wrapping a non-leaf spec', () => {
    const bad = { kind: 'exactlyOne', step: { kind: 'contains', step: action('stir') } } as const
    expect(() => matchesSpec(bad, log({ action: 'stir' }))).toThrow(/exactlyOne expects a leaf/)
  })
})

describe('inOrder', () => {
  it('matches a subsequence in relative order', () => {
    const spec = inOrder(action('add', 'candy'), action('heat'))
    expect(
      matchesSpec(spec, log({ action: 'add', subject: 'candy' }, { action: 'stir' }, { action: 'heat' })),
    ).toBe(true)
  })

  it('fails when the order is reversed', () => {
    const spec = inOrder(action('heat'), action('add', 'candy'))
    expect(
      matchesSpec(spec, log({ action: 'add', subject: 'candy' }, { action: 'heat' })),
    ).toBe(false)
  })

  it('fails when a step is missing', () => {
    const spec = inOrder(action('add', 'candy'), action('chill'))
    expect(matchesSpec(spec, log({ action: 'add', subject: 'candy' }))).toBe(false)
  })
})

describe('all (conjunction over the whole log)', () => {
  it('requires every child spec to hold over the whole log', () => {
    const spec = all(contains(action('stir')), exactlyOne(action('add', 'lollipop')))
    expect(matchesSpec(spec, log({ action: 'stir' }, { action: 'add', subject: 'lollipop' }))).toBe(
      true,
    )
    // two lollipops → exactlyOne fails, so the conjunction fails even though stir is present.
    expect(
      matchesSpec(
        spec,
        log({ action: 'stir' }, { action: 'add', subject: 'lollipop' }, { action: 'add', subject: 'lollipop' }),
      ),
    ).toBe(false)
  })

  it('builds the expected spec shape', () => {
    expect(all(action('stir'))).toEqual({ kind: 'all', specs: [{ kind: 'action', action: 'stir' }] })
  })
})

describe('syrup of health recipe (the Phase 1 first recipe)', () => {
  const correctLog = log(
    { action: 'add', subject: 'candy' },
    { action: 'stir' },
    { action: 'heat' },
    { action: 'add', subject: 'lollipop' },
  )

  it('matches its exact action log', () => {
    expect(matchesSpec(SYRUP_OF_HEALTH.matcher, correctLog)).toBe(true)
    expect(matchRecipe(CAULDRON_RECIPES, correctLog)?.id).toBe('syrupOfHealth')
  })

  it('does not match when a second lollipop is added (exactlyOne fails)', () => {
    const twoLollipops = log(
      { action: 'add', subject: 'candy' },
      { action: 'stir' },
      { action: 'heat' },
      { action: 'add', subject: 'lollipop' },
      { action: 'add', subject: 'lollipop' },
    )
    expect(matchesSpec(SYRUP_OF_HEALTH.matcher, twoLollipops)).toBe(false)
    expect(matchRecipe(CAULDRON_RECIPES, twoLollipops)).toBeNull()
  })

  it('does not match when the steps are out of order', () => {
    const wrongOrder = log(
      { action: 'heat' },
      { action: 'add', subject: 'candy' },
      { action: 'stir' },
      { action: 'add', subject: 'lollipop' },
    )
    expect(matchesSpec(SYRUP_OF_HEALTH.matcher, wrongOrder)).toBe(false)
  })

  it('returns null for an empty/garbage log', () => {
    expect(matchRecipe(CAULDRON_RECIPES, log())).toBeNull()
    expect(matchRecipe(CAULDRON_RECIPES, log({ action: 'nonsense' }))).toBeNull()
  })
})

describe('appendEntry', () => {
  it('appends immutably and caps at the last N entries', () => {
    const start = log({ action: 'a' })
    const next = appendEntry(start, { action: 'b' })
    expect(start).toHaveLength(1) // original untouched
    expect(next).toHaveLength(2)
  })

  it('drops the oldest entries past the cap', () => {
    let acc: readonly CauldronEntry[] = []
    for (let i = 0; i < 20; i++) acc = appendEntry(acc, { action: `s${i}` }, 5)
    expect(acc).toHaveLength(5)
    expect(acc[0]?.action).toBe('s15')
    expect(acc[4]?.action).toBe('s19')
  })
})

describe('matchRecipe registry ordering', () => {
  it('returns the first matching recipe in registry order', () => {
    const a: RecipeDef = { id: 'a', displayKey: 'x', output: 'candies', matcher: action('stir') }
    const b: RecipeDef = { id: 'b', displayKey: 'y', output: 'candies', matcher: action('stir') }
    expect(matchRecipe([a, b], log({ action: 'stir' }))?.id).toBe('a')
  })
})
