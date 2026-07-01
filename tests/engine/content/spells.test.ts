import { createDefaultSave } from '@/engine/state/defaultSave'
import { ownedSpells, hasSpell, spellAbilities } from '@/engine/content/spells'
import { GRIMOIRE_SPELLS } from '@/content/spells/grimoire'
import { BLACK_GRIMOIRE_SPELLS } from '@/content/spells/blackGrimoire'
import { BLACK_LICORICE_GRIMOIRE_OWNED_FLAG } from '@/content/flags'
import type { GameState } from '@/engine/types/GameState'

const withGrimoire: GameState = { ...createDefaultSave(), flags: { beginnerGrimoireOwned: true } }

describe('grimoire spell loadout', () => {
  it('grants no spells without the grimoire', () => {
    expect(ownedSpells(GRIMOIRE_SPELLS, createDefaultSave())).toEqual([])
    expect(hasSpell(GRIMOIRE_SPELLS, 'sugarBolt', createDefaultSave())).toBe(false)
  })

  it('grants the grimoire spells once it is owned', () => {
    expect(ownedSpells(GRIMOIRE_SPELLS, withGrimoire).map((s) => s.id)).toEqual([
      'sugarBolt',
      'sweetWard',
    ])
    expect(hasSpell(GRIMOIRE_SPELLS, 'sugarBolt', withGrimoire)).toBe(true)
  })

  it('maps owned spells to Scene abilities (id + cooldownMs)', () => {
    const abilities = spellAbilities(GRIMOIRE_SPELLS, withGrimoire)
    expect(abilities).toEqual([
      { id: 'sugarBolt', cooldownMs: 800 },
      { id: 'sweetWard', cooldownMs: 5000 },
    ])
  })

  it('hasSpell is false for an unknown spell id', () => {
    expect(hasSpell(GRIMOIRE_SPELLS, 'meteor', withGrimoire)).toBe(false)
  })
})

describe('the black licorice grimoire spell loadout (the void whale hermit)', () => {
  const withBlack: GameState = {
    ...createDefaultSave(),
    flags: { [BLACK_LICORICE_GRIMOIRE_OWNED_FLAG]: true },
  }

  it('grants no black-grimoire spells until the book is owned', () => {
    expect(ownedSpells(BLACK_GRIMOIRE_SPELLS, createDefaultSave())).toEqual([])
  })

  it('reports void step, melt, and eclipse once the book is owned', () => {
    expect(ownedSpells(BLACK_GRIMOIRE_SPELLS, withBlack).map((s) => s.id)).toEqual([
      'voidStep',
      'melt',
      'eclipse',
    ])
    expect(hasSpell(BLACK_GRIMOIRE_SPELLS, 'eclipse', withBlack)).toBe(true)
  })

  it("eclipse's combat stats are inert (damage 0) — it is a world spell, not a combat move", () => {
    const eclipse = BLACK_GRIMOIRE_SPELLS.find((s) => s.id === 'eclipse')!
    expect(eclipse.damage).toBe(0)
  })
})
