import { createDefaultSave } from '@/engine/state/defaultSave'
import { playerQuestWeapons, BARE_HANDS } from '@/content/items/playerLoadout'
import type { GameState } from '@/engine/types/GameState'

function withWeapon(weapon: string | null): GameState {
  const s = createDefaultSave()
  return { ...s, equipped: { ...s.equipped, weapon } }
}

describe('playerQuestWeapons', () => {
  it('maps the equipped weapon item to a quest weapon with its stats', () => {
    const [w] = playerQuestWeapons(withWeapon('woodenSpoon'))
    expect(w?.id).toBe('woodenSpoon')
    expect(w?.damage).toBe(2)
    expect(w?.range).toBe(2)
    expect(w?.cooldownMs).toBe(500)
  })

  it('a sharper weapon carries its sharper stats', () => {
    const [w] = playerQuestWeapons(withWeapon('ironSword'))
    expect(w?.damage).toBe(5)
    expect(w?.cooldownMs).toBe(400)
  })

  it('falls back to bare hands when nothing is equipped', () => {
    expect(playerQuestWeapons(withWeapon(null))).toEqual([BARE_HANDS])
  })
})
