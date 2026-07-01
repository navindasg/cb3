import { createDefaultSave } from '@/engine/state/defaultSave'
import { fireSecret, fireAny, triggerFires, normalizeName } from '@/engine/content/secrets'
import { ITEM_MAP } from '@/content/items/items'
import {
  SUN_POKER,
  CANDY_BOX_FIGUREHEAD_SECRET,
  BATCH_A_SECRETS,
  SUN_POKES_KEY,
  SUN_POKE_LIMIT,
} from '@/content/secrets'
import { CANDY_BOX_FIGUREHEAD } from '@/content/items/items'
import { GALLEON_NAME_KEY } from '@/content/ship/galleon'
import { setString } from '@/engine/state/reducers'
import type { GameState } from '@/engine/types/GameState'

describe('normalizeName — case/space folding for nameEquals', () => {
  it('lowercases, collapses whitespace runs and trims', () => {
    expect(normalizeName('Candy Box')).toBe('candy box')
    expect(normalizeName('  CANDY   BOX ')).toBe('candy box')
    expect(normalizeName('candy box')).toBe('candy box')
  })
})

describe('sun poker — countAtLeast fires at exactly the limit, once', () => {
  it('does NOT fire below the limit (nine pokes)', () => {
    const state = createDefaultSave()
    expect(
      fireSecret(state, SUN_POKER, { kind: 'count', counterKey: SUN_POKES_KEY, count: SUN_POKE_LIMIT - 1 }).fired,
    ).toBe(false)
  })

  it('fires at exactly the limit and sets the sun-poker status', () => {
    const result = fireSecret(createDefaultSave(), SUN_POKER, {
      kind: 'count',
      counterKey: SUN_POKES_KEY,
      count: SUN_POKE_LIMIT,
    })
    expect(result.fired).toBe(true)
    expect(result.state.flags['sunPokerFound']).toBe(true)
    expect(result.revealKey).toBe('secret.sunPoker.reveal')
  })

  it('fires when overshooting the limit (count above ten)', () => {
    expect(
      fireSecret(createDefaultSave(), SUN_POKER, { kind: 'count', counterKey: SUN_POKES_KEY, count: SUN_POKE_LIMIT + 5 }).fired,
    ).toBe(true)
  })

  it('is inert once already found (no double fire, same ref) — the hard stop', () => {
    const found: GameState = { ...createDefaultSave(), flags: { sunPokerFound: true } }
    const result = fireSecret(found, SUN_POKER, { kind: 'count', counterKey: SUN_POKES_KEY, count: 99 })
    expect(result.fired).toBe(false)
    expect(result.state).toBe(found)
  })

  it('does not fire on a different counter key', () => {
    expect(
      fireSecret(createDefaultSave(), SUN_POKER, { kind: 'count', counterKey: 'someOtherCounter', count: 100 }).fired,
    ).toBe(false)
  })

  it('does not cross-fire from a non-count interaction', () => {
    expect(fireSecret(createDefaultSave(), SUN_POKER, { kind: 'feed', resource: 'candies', count: 10 }).fired).toBe(
      false,
    )
  })
})

describe('candy box figurehead — nameEquals reads the stored galleon name', () => {
  const withName = (name: string): GameState => setString(createDefaultSave(), GALLEON_NAME_KEY, name)

  it("fires when the galleon is named exactly 'candy box'", () => {
    const result = fireSecret(withName('candy box'), CANDY_BOX_FIGUREHEAD_SECRET, {
      kind: 'name',
      stringKey: GALLEON_NAME_KEY,
    }, ITEM_MAP)
    expect(result.fired).toBe(true)
    expect(result.state.flags[CANDY_BOX_FIGUREHEAD.saveFlag]).toBe(true)
    expect(result.state.ownedItems[CANDY_BOX_FIGUREHEAD.id]).toBe(true)
    expect(result.revealKey).toBe('secret.figurehead.reveal')
  })

  it('fires regardless of case and extra spacing (normalization)', () => {
    for (const name of ['Candy Box', 'CANDY BOX', ' candy  box ', 'candy Box']) {
      const result = fireSecret(withName(name), CANDY_BOX_FIGUREHEAD_SECRET, {
        kind: 'name',
        stringKey: GALLEON_NAME_KEY,
      })
      expect(result.fired).toBe(true)
    }
  })

  it('does NOT fire for any other name', () => {
    for (const name of ['The Sweet Tooth', 'candybox', 'box', 'candy', '']) {
      const result = fireSecret(withName(name), CANDY_BOX_FIGUREHEAD_SECRET, {
        kind: 'name',
        stringKey: GALLEON_NAME_KEY,
      })
      expect(result.fired).toBe(false)
    }
  })

  it('cannot be spoofed: the interaction names the key, the value is read from state', () => {
    // The galleon is NOT named candy box; a 'name' interaction on the key cannot make it fire.
    const result = fireSecret(withName('some other ship'), CANDY_BOX_FIGUREHEAD_SECRET, {
      kind: 'name',
      stringKey: GALLEON_NAME_KEY,
    })
    expect(result.fired).toBe(false)
  })

  it('is inert once already owned (no double grant, same ref)', () => {
    const owned: GameState = {
      ...setString(createDefaultSave(), GALLEON_NAME_KEY, 'candy box'),
      flags: { [CANDY_BOX_FIGUREHEAD.saveFlag]: true },
    }
    const result = fireSecret(owned, CANDY_BOX_FIGUREHEAD_SECRET, { kind: 'name', stringKey: GALLEON_NAME_KEY }, ITEM_MAP)
    expect(result.fired).toBe(false)
    expect(result.state).toBe(owned)
  })

  it('triggerFires reflects the match against state without mutating', () => {
    const state = withName('candy box')
    expect(triggerFires(CANDY_BOX_FIGUREHEAD_SECRET, { kind: 'name', stringKey: GALLEON_NAME_KEY }, state)).toBe(true)
  })
})

describe('fireAny over the batch-A table', () => {
  it('routes the sun-poke count to the sun poker', () => {
    const result = fireAny(createDefaultSave(), BATCH_A_SECRETS, {
      kind: 'count',
      counterKey: SUN_POKES_KEY,
      count: SUN_POKE_LIMIT,
    })
    expect(result.fired).toBe(true)
    expect(result.state.flags['sunPokerFound']).toBe(true)
  })

  it('routes the galleon name to the figurehead', () => {
    const named = setString(createDefaultSave(), GALLEON_NAME_KEY, 'Candy Box')
    const result = fireAny(named, BATCH_A_SECRETS, { kind: 'name', stringKey: GALLEON_NAME_KEY }, ITEM_MAP)
    expect(result.fired).toBe(true)
    expect(result.state.ownedItems[CANDY_BOX_FIGUREHEAD.id]).toBe(true)
  })

  it('returns a no-op miss (same ref) when nothing fires', () => {
    const state = createDefaultSave()
    const result = fireAny(state, BATCH_A_SECRETS, { kind: 'count', counterKey: SUN_POKES_KEY, count: 1 })
    expect(result.fired).toBe(false)
    expect(result.state).toBe(state)
  })
})
