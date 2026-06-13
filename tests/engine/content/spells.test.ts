import { createDefaultSave } from '@/engine/state/defaultSave'
import { ownedSpells, hasSpell, spellAbilities } from '@/engine/content/spells'
import { GRIMOIRE_SPELLS } from '@/content/spells/grimoire'
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
