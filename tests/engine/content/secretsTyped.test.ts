import { createDefaultSave } from '@/engine/state/defaultSave'
import { fireSecret, fireAny } from '@/engine/content/secrets'
import { ITEM_MAP } from '@/content/items/items'
import {
  TYPED_SECRETS,
  STARLIGHT_SECRET,
  CANDY_BOX_SECRET,
  ANIWEY_SECRET,
  ECLIPSE_SECRET,
  KONAMI_SECRET,
  SCHOLARS_PAMPHLET,
  BLACK_LICORICE_GRIMOIRE_OWNED_FLAG,
  KONAMI_TOKEN,
} from '@/content/typedSecrets'
import type { GameState } from '@/engine/types/GameState'

describe("'starlight' → the scholar's pamphlet", () => {
  it('fires, grants the pamphlet (flag + ownedItems) and sets its once-latch', () => {
    const result = fireSecret(createDefaultSave(), STARLIGHT_SECRET, { kind: 'type', word: 'starlight' }, ITEM_MAP)
    expect(result.fired).toBe(true)
    expect(result.state.flags['starlightTyped']).toBe(true)
    expect(result.state.flags[SCHOLARS_PAMPHLET.saveFlag]).toBe(true)
    expect(result.state.ownedItems[SCHOLARS_PAMPHLET.id]).toBe(true)
    expect(result.revealKey).toBe('secret.starlight.reveal')
  })

  it('is inert once already fired (no double grant, same ref)', () => {
    const owned: GameState = { ...createDefaultSave(), flags: { starlightTyped: true } }
    const result = fireSecret(owned, STARLIGHT_SECRET, { kind: 'type', word: 'starlight' }, ITEM_MAP)
    expect(result.fired).toBe(false)
    expect(result.state).toBe(owned)
  })

  it('does not fire on a different typed word', () => {
    expect(fireSecret(createDefaultSave(), STARLIGHT_SECRET, { kind: 'type', word: 'eclipse' }).fired).toBe(false)
  })

  it('fires without the items map (sets the flag, grants no item — defensive)', () => {
    const result = fireSecret(createDefaultSave(), STARLIGHT_SECRET, { kind: 'type', word: 'starlight' })
    expect(result.fired).toBe(true)
    expect(result.state.flags['starlightTyped']).toBe(true)
    expect(result.state.ownedItems[SCHOLARS_PAMPHLET.id]).toBeUndefined()
  })
})

describe("'candy box' → the cosmetic toast (no flag, fires every time)", () => {
  it('fires and returns the reveal without touching state', () => {
    const state = createDefaultSave()
    const result = fireSecret(state, CANDY_BOX_SECRET, { kind: 'type', word: 'candy box' })
    expect(result.fired).toBe(true)
    expect(result.revealKey).toBe('secret.candyBox.reveal')
    expect(result.state).toBe(state) // cosmetic: SAME reference, nothing set
    expect(result.state.flags['candyBoxTyped']).toBeUndefined()
  })

  it('fires again even after a prior fire (re-triggerable, never latched)', () => {
    const once = fireSecret(createDefaultSave(), CANDY_BOX_SECRET, { kind: 'type', word: 'candy box' })
    const twice = fireSecret(once.state, CANDY_BOX_SECRET, { kind: 'type', word: 'candy box' })
    expect(twice.fired).toBe(true)
  })
})

describe("'aniwey' → the session heart (fires once via its flag)", () => {
  it('fires and sets its flag, with a reveal', () => {
    const result = fireSecret(createDefaultSave(), ANIWEY_SECRET, { kind: 'type', word: 'aniwey' })
    expect(result.fired).toBe(true)
    expect(result.state.flags['aniweyHeart']).toBe(true)
    expect(result.revealKey).toBe('secret.aniwey.reveal')
  })

  it('is marked session-only (the render layer keeps its flag out of the save)', () => {
    expect(ANIWEY_SECRET.sessionOnly).toBe(true)
  })
})

describe("'eclipse' → the astronomer's line, inert once the grimoire is owned", () => {
  it('fires (and sets its flag) before the black licorice grimoire is owned', () => {
    const result = fireSecret(createDefaultSave(), ECLIPSE_SECRET, { kind: 'type', word: 'eclipse' })
    expect(result.fired).toBe(true)
    expect(result.state.flags['eclipseTyped']).toBe(true)
    expect(result.revealKey).toBe('secret.eclipse.reveal')
  })

  it('is inert (no fire, same ref) once the grimoire is owned', () => {
    const withGrimoire: GameState = {
      ...createDefaultSave(),
      flags: { [BLACK_LICORICE_GRIMOIRE_OWNED_FLAG]: true },
    }
    const result = fireSecret(withGrimoire, ECLIPSE_SECRET, { kind: 'type', word: 'eclipse' })
    expect(result.fired).toBe(false)
    expect(result.state).toBe(withGrimoire)
  })
})

describe("Konami → the goldfish in the fishbowl helm (fires once)", () => {
  it('fires and sets the goldfish flag', () => {
    const result = fireSecret(createDefaultSave(), KONAMI_SECRET, { kind: 'type', word: KONAMI_TOKEN })
    expect(result.fired).toBe(true)
    expect(result.state.flags['goldfishInHelm']).toBe(true)
    expect(result.revealKey).toBe('secret.konami.reveal')
  })

  it('is inert once the goldfish is already in the helm', () => {
    const owned: GameState = { ...createDefaultSave(), flags: { goldfishInHelm: true } }
    expect(fireSecret(owned, KONAMI_SECRET, { kind: 'type', word: KONAMI_TOKEN }).fired).toBe(false)
  })
})

describe('fireAny over the typed-secret table', () => {
  it('routes each typed word to its own secret', () => {
    const starlight = fireAny(createDefaultSave(), TYPED_SECRETS, { kind: 'type', word: 'starlight' }, ITEM_MAP)
    expect(starlight.fired).toBe(true)
    expect(starlight.state.flags['starlightTyped']).toBe(true)

    const konami = fireAny(createDefaultSave(), TYPED_SECRETS, { kind: 'type', word: KONAMI_TOKEN })
    expect(konami.fired).toBe(true)
    expect(konami.state.flags['goldfishInHelm']).toBe(true)
  })

  it('returns a no-op miss (same ref) on an unrelated typed word', () => {
    const state = createDefaultSave()
    const result = fireAny(state, TYPED_SECRETS, { kind: 'type', word: 'nope' })
    expect(result.fired).toBe(false)
    expect(result.state).toBe(state)
  })

  it('does not cross-fire: a feed interaction never triggers a typed secret', () => {
    const state = createDefaultSave()
    const result = fireAny(state, TYPED_SECRETS, { kind: 'feed', resource: 'candies', count: 1 })
    expect(result.fired).toBe(false)
    expect(result.state).toBe(state)
  })
})
