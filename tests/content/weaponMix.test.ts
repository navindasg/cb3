import { Vec2 } from '@/engine/quest/Vec2'
import { Entity, type Weapon } from '@/engine/quest/Entity'
import { resolveCombat } from '@/engine/quest/combat'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { playerQuestWeapons } from '@/content/items/playerLoadout'
import { FORGE_ENTRIES } from '@/content/shops/forge'
import { ITEM_MAP } from '@/content/items/items'
import type { GameState } from '@/engine/types/GameState'

// The Act 0 forge is, by design directive, a VARIED arsenal — "not solely swords; a bow to get
// used to ranged before space." These tests lock that intent: the forge sells distinct archetypes
// including a long-range bow, and the bow's reach genuinely changes combat (combat.ts honours range).

const equip = (weaponId: string): GameState => {
  const s = createDefaultSave()
  return { ...s, equipped: { ...s.equipped, weapon: weaponId } }
}

function player(weapons: readonly Weapon[]): Entity {
  return new Entity({
    id: 'p', team: 'player', pos: new Vec2(0, 0), width: 1, height: 1, hp: 10, maxHp: 10, weapons, tags: [],
  })
}
function enemyAt(x: number): Entity {
  return new Entity({
    id: 'e', team: 'enemy', pos: new Vec2(x, 0), width: 1, height: 1, hp: 9, maxHp: 9, weapons: [], tags: ['gummySlime'],
  })
}

describe('the forge is a varied, non-sword-only arsenal', () => {
  it('sells distinct weapon archetypes including a ranged bow', () => {
    const ids = FORGE_ENTRIES.map((e) => e.itemId)
    expect(ids).toContain('candyCaneBow') // the mandated ranged option
    // Not a sword ladder: at least one offering is not a "...Sword".
    expect(ids.some((id) => !id.toLowerCase().includes('sword'))).toBe(true)
  })

  it('the bow maps to a genuinely long-range quest weapon', () => {
    const [bow] = playerQuestWeapons(equip('candyCaneBow'))
    expect(bow?.id).toBe('candyCaneBow')
    expect(bow?.range).toBeGreaterThanOrEqual(5)
    // Each forge weapon item carries combat stats (no equippable dud).
    for (const { itemId } of FORGE_ENTRIES) {
      expect(ITEM_MAP.get(itemId)?.weapon, itemId).toBeDefined()
    }
  })

  it('the bow hits a foe four cells away that an iron sword cannot reach', () => {
    const target = 4 // cells from the player
    const bowWeapons = playerQuestWeapons(equip('candyCaneBow')) // range 5
    const swordWeapons = playerQuestWeapons(equip('ironSword')) // range 2

    const bowHit = resolveCombat([player(bowWeapons), enemyAt(target)], 0)
    const swordHit = resolveCombat([player(swordWeapons), enemyAt(target)], 0)

    expect(bowHit.entities.find((e) => e.id === 'e')!.hp).toBeLessThan(9) // bow connected
    expect(swordHit.entities.find((e) => e.id === 'e')!.hp).toBe(9) // sword whiffed — out of reach
  })
})
