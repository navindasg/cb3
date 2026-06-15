import { Vec2 } from '@/engine/quest/Vec2'
import { Entity } from '@/engine/quest/Entity'
import type { SpawnOrder } from '@/engine/types/defs'
import type { EntityFactory } from '@/engine/quest/Scene'
import type { EntityTemplate } from '@/content/quests/entityTemplates'

// The engine-side EntityFactory builder (Block E note: content supplies the factory mapping a
// spawn order's entityId to a built Entity). It is parameterized by the content's pure
// EntityTemplate records, so content authors data and the engine does the construction — the
// strict type-only content boundary stays intact. Pure: each call builds a fresh Entity.

/** Build an EntityFactory from a template registry: order.entityId → a constructed Entity. */
export function createEntityFactory(
  templates: ReadonlyMap<string, EntityTemplate>,
): EntityFactory {
  return (order: SpawnOrder): Entity => {
    const template = templates.get(order.entityId)
    if (!template) {
      throw new Error(`createEntityFactory: no template for entityId '${order.entityId}'`)
    }
    const weapons = template.attack
      ? [
          {
            id: `${template.id}Attack`,
            damage: template.attack.damage,
            range: template.attack.range,
            cooldownMs: template.attack.cooldownMs,
          },
        ]
      : []
    return new Entity({
      id: `${order.entityId}@${order.x},${order.y}`,
      team: template.team,
      pos: new Vec2(order.x, order.y),
      width: template.width,
      height: template.height,
      hp: template.hp,
      maxHp: template.hp,
      tags: template.tags,
      weapons,
    })
  }
}
