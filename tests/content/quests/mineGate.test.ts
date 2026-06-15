import { Scene } from '@/engine/quest/Scene'
import type { Weapon } from '@/engine/quest/Entity'
import { HorizontalDriver } from '@/engine/quest/physics/HorizontalDriver'
import { nearestHostileDistance } from '@/engine/quest/combat'
import { createEntityFactory } from '@/engine/content/entityFactory'
import { TEMPLATE_MAP, MINE_SENTINEL } from '@/content/quests/entityTemplates'
import { MINE_GATE } from '@/content/quests/mineGate'
import { playerQuestWeapons, BARE_HANDS } from '@/content/items/playerLoadout'
import { WOODEN_SPOON, CANDY_CANE_BOW } from '@/content/items/items'
import { createDefaultSave } from '@/engine/state/defaultSave'
import type { GameState } from '@/engine/types/GameState'

// The mine gate is the "go buy a weapon" wall (design: a fight to access the mines, beatable with
// an upgrade). It is tuned around REACH: the rock-candy sentinel out-reaches grandma's spoon, so a
// spoon/bare-hands player must stand inside its swing and loses the HP trade, while the candy-cane
// BOW (range 5) kills it from outside its reach (2.8) and takes no damage. These tests lock that.

const factory = createEntityFactory(TEMPLATE_MAP)
const equip = (weaponId: string): GameState => {
  const s = createDefaultSave()
  return { ...s, equipped: { ...s.equipped, weapon: weaponId } }
}

/**
 * Drive the gate with the host's exact auto-march logic (advance; hold to fight what is in reach),
 * and model the host's ONE-LIFE eject: the first death ends the run (questScreens death:'eject'),
 * so a player who dies is `won:false, died:true` — i.e. ejected before reaching the goal.
 */
function runGate(weapons: readonly Weapon[], playerMaxHp: number): { won: boolean; died: boolean } {
  let scene = Scene.start({
    def: { ...MINE_GATE, playerMaxHp },
    driver: new HorizontalDriver({ gravityY: 30, moveSpeed: 7, jumpVelocity: 14 }),
    entityFactory: factory,
    playerWeapons: weapons,
  })
  let died = false
  let guard = 0
  while (scene.phase === 'active' && guard++ < 3000) {
    const player = scene.player
    const reach = player ? player.weapons.reduce((m, w) => Math.max(m, w.range), 0) : 0
    const dist = player ? nearestHostileDistance(player, scene.entities) : Infinity
    const moveX = dist <= reach ? 0 : 1
    scene = scene.step({ playerInput: { moveX, moveY: 0, jump: false } }, 100)
    if (scene.lastDeath) {
      died = true
      break // the host ejects on the first death; stop here too
    }
  }
  return { won: scene.phase === 'won', died }
}

describe('the mine gate is a reach-tuned upgrade wall', () => {
  it('the sentinel out-reaches grandma‘s spoon (the whole point of the gate)', () => {
    expect(MINE_SENTINEL.attack!.range).toBeGreaterThan(WOODEN_SPOON.weapon!.range)
  })

  it('a well-fed spoon player is ejected at the gate (dies before reaching the goal)', () => {
    const result = runGate(playerQuestWeapons(equip('woodenSpoon')), 25)
    expect(result.died).toBe(true)
    expect(result.won).toBe(false)
  })

  it('bare hands are ejected at the gate too', () => {
    const result = runGate([BARE_HANDS], 25)
    expect(result.died).toBe(true)
    expect(result.won).toBe(false)
  })

  it('the candy-cane bow clears the gate without taking a single hit', () => {
    const result = runGate(playerQuestWeapons(equip('candyCaneBow')), 25)
    expect(result.won).toBe(true)
    expect(result.died).toBe(false)
  })

  it('exposes the bow as a genuinely longer reach than the sentinel', () => {
    expect(CANDY_CANE_BOW.weapon!.range).toBeGreaterThan(MINE_SENTINEL.attack!.range)
  })
})
