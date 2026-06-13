import type { Scene } from '@/engine/quest/Scene'
import type { Entity } from '@/engine/quest/Entity'
import type { ArenaEntityView, ArenaModel } from '@/render/ArenaRenderer'
import type { EntityTemplate } from '@/content/quests/entityTemplates'

// Bridges a live Scene to the render layer's plain ArenaModel (Block E note: the quest place
// builds ArenaModel from Scene.entities — glyph/colour per entity tag — and render/ NEVER
// imports Scene). The mapping uses the content's EntityTemplate registry for glyph + colour;
// the player is drawn with a fixed glyph. Pure: produces a fresh view model.

const PLAYER_ID = '__player__'
const PLAYER_GLYPH = '@'
const PLAYER_COLOR = '#ffd'

/** Pick the glyph/colour for one entity from the template registry (player is special). */
function entityView(
  e: Entity,
  templates: ReadonlyMap<string, EntityTemplate>,
): ArenaEntityView {
  if (e.id === PLAYER_ID) {
    return { glyph: PLAYER_GLYPH, x: e.pos.x, y: e.pos.y, hp: e.hp, maxHp: e.maxHp, color: PLAYER_COLOR }
  }
  // The first tag that matches a template id picks the visual (templates are tag-named).
  const template = e.tags.map((tag) => templates.get(tag)).find((t) => t !== undefined)
  return {
    glyph: template?.glyph ?? '?',
    x: Math.round(e.pos.x),
    y: Math.round(e.pos.y),
    hp: e.hp,
    maxHp: e.maxHp,
    ...(template?.color !== undefined ? { color: template.color } : {}),
  }
}

export interface ArenaViewOptions {
  /** The exit affordance composited into the arena (a labelled hotspot). */
  readonly exit?: ArenaModel['exit']
}

/** Project a Scene into an ArenaModel using the content template registry for visuals. */
export function toArenaModel(
  scene: Scene,
  templates: ReadonlyMap<string, EntityTemplate>,
  options: ArenaViewOptions = {},
): ArenaModel {
  const entities = scene.entities.map((e) => entityView(e, templates))
  return {
    width: scene.def.width,
    height: scene.def.height,
    entities,
    ...(options.exit !== undefined ? { exit: options.exit } : {}),
  }
}
