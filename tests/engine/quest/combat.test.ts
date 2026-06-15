import { Vec2 } from '@/engine/quest/Vec2'
import { Entity, type Weapon } from '@/engine/quest/Entity'
import {
  areHostile,
  centreDistance,
  nearestHostile,
  nearestHostileDistance,
  resolveCombat,
} from '@/engine/quest/combat'
import type { Team } from '@/engine/types/quest'

const SPOON: Weapon = { id: 'spoon', damage: 1, range: 2, cooldownMs: 500 }
const BITE: Weapon = { id: 'bite', damage: 3, range: 2, cooldownMs: 500 }

function ent(
  team: Team,
  x: number,
  hp: number,
  opts: { weapons?: readonly Weapon[]; tags?: readonly string[]; id?: string } = {},
): Entity {
  return new Entity({
    id: opts.id ?? `${team}@${x}`,
    team,
    pos: new Vec2(x, 0),
    width: 1,
    height: 1,
    hp,
    maxHp: hp,
    weapons: opts.weapons ?? [],
    tags: opts.tags ?? [],
  })
}

describe('areHostile', () => {
  it('pairs player with enemy and not with neutral or same-team', () => {
    const p = ent('player', 0, 10)
    const e = ent('enemy', 1, 2)
    const n = ent('neutral', 1, 1)
    expect(areHostile(p, e)).toBe(true)
    expect(areHostile(e, p)).toBe(true)
    expect(areHostile(p, n)).toBe(false)
    expect(areHostile(e, ent('enemy', 2, 2))).toBe(false)
  })
})

describe('distance + targeting', () => {
  it('measures centre-to-centre distance', () => {
    expect(centreDistance(ent('player', 0, 10), ent('enemy', 1, 2))).toBeCloseTo(1)
  })

  it('nearestHostile picks the closest in-range living hostile, ignoring neutral and dead', () => {
    const p = ent('player', 0, 10)
    const near = ent('enemy', 2, 2, { id: 'near' })
    const far = ent('enemy', 5, 2, { id: 'far' })
    const dead = ent('enemy', 1, 0, { id: 'dead' })
    const neutral = ent('neutral', 1, 1, { id: 'rock' })
    expect(nearestHostile(p, [p, near, far, dead, neutral], 3)?.id).toBe('near')
    expect(nearestHostile(p, [p, far], 3)).toBeNull() // far is out of range
    expect(nearestHostileDistance(p, [p, near, far])).toBeCloseTo(2) // near is 2 cells away

  })
})

describe('resolveCombat', () => {
  it('lands hits both ways and re-arms cooldowns', () => {
    const p = ent('player', 0, 10, { weapons: [SPOON], id: 'p' })
    const e = ent('enemy', 1, 2, { weapons: [BITE], tags: ['gummySlime'], id: 'e' })
    const { entities, deathSource } = resolveCombat([p, e], 0)
    const np = entities.find((x) => x.id === 'p')!
    const ne = entities.find((x) => x.id === 'e')!
    expect(ne.hp).toBe(1) // spoon did 1
    expect(np.hp).toBe(7) // bite did 3
    expect(np.attackReadyAt).toBe(500)
    expect(ne.attackReadyAt).toBe(500)
    expect(deathSource).toBeUndefined()
  })

  it('reports the killer source when the player takes a lethal blow', () => {
    const p = ent('player', 0, 2, { weapons: [SPOON], id: 'p' })
    const e = ent('enemy', 1, 9, { weapons: [BITE], tags: ['gummySlime'], id: 'e' })
    const { deathSource, entities } = resolveCombat([p, e], 0)
    expect(entities.find((x) => x.id === 'p')!.isDead).toBe(true)
    expect(deathSource).toBe('gummySlime')
  })

  it('does nothing (same reference) when nothing is in range', () => {
    const p = ent('player', 0, 10, { weapons: [SPOON] })
    const e = ent('enemy', 20, 2, { weapons: [BITE] })
    const list = [p, e]
    expect(resolveCombat(list, 0)).toEqual({ entities: list })
    expect(resolveCombat(list, 0).entities).toBe(list)
  })

  it('respects the cooldown: an entity that just attacked cannot attack again until ready', () => {
    const p = ent('player', 0, 10, { weapons: [SPOON], id: 'p' })
    const e = ent('enemy', 1, 9, { weapons: [BITE], id: 'e' })
    const first = resolveCombat([p, e], 0).entities
    // 100ms later both are still cooling (ready at 500) → no further damage.
    const second = resolveCombat(first, 100)
    expect(second.entities).toBe(first)
  })

  it('lets an unarmed entity be hit without retaliating', () => {
    const p = ent('player', 0, 10, { weapons: [SPOON], id: 'p' })
    const rock = ent('enemy', 1, 5, { id: 'rock' }) // enemy team but no weapon
    const { entities } = resolveCombat([p, rock], 0)
    expect(entities.find((x) => x.id === 'rock')!.hp).toBe(4)
    expect(entities.find((x) => x.id === 'p')!.hp).toBe(10) // unharmed
  })
})
