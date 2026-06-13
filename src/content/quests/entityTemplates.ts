// Pure entity-template DATA for Act 0 quests. The Scene needs an EntityFactory(order)->Entity;
// content supplies it (Block E note). To keep content importing only TYPES, the constructive
// factory lives in the engine (engine/content/entityFactory) and is parameterized by these
// plain template records. A template maps a spawn-order entityId to the stats/glyph used to
// build the Entity and to render it in the arena.

import type { Team } from '@/engine/quest/Entity'

export interface EntityTemplate {
  /** The spawn-order entityId this template builds (e.g. 'candyBat'). */
  readonly id: string
  readonly team: Team
  readonly width: number
  readonly height: number
  readonly hp: number
  /** Glyph drawn in the arena. */
  readonly glyph: string
  /** Optional inline arena colour. */
  readonly color?: string
  /** Tags carried onto the Entity (used by combat/secret logic + arena colouring). */
  readonly tags: readonly string[]
}

// NOTE: Team is a type-only import; no engine logic is pulled into content.

export const CANDY_BAT: EntityTemplate = {
  id: 'candyBat',
  team: 'enemy',
  width: 1,
  height: 1,
  hp: 2,
  glyph: 'v',
  color: '#e58',
  tags: ['candyBat', 'flying'],
}

export const SUGAR_GOLEM: EntityTemplate = {
  id: 'sugarGolem',
  team: 'enemy',
  width: 2,
  height: 2,
  hp: 6,
  glyph: 'O',
  color: '#fff',
  tags: ['sugarGolem'],
}

export const GUMMY_WORM: EntityTemplate = {
  id: 'gummyWorm',
  team: 'enemy',
  width: 1,
  height: 1,
  hp: 1,
  glyph: '~',
  color: '#6c6',
  tags: ['gummyWorm'],
}

export const ROCK_CANDY_VEIN: EntityTemplate = {
  id: 'rockCandyVein',
  team: 'neutral',
  width: 1,
  height: 1,
  hp: 1,
  glyph: '*',
  color: '#9cf',
  tags: ['rockCandyVein', 'drop:rockCandy'],
}

export const FOSSIL: EntityTemplate = {
  id: 'fossil',
  team: 'neutral',
  width: 2,
  height: 1,
  hp: 9999,
  glyph: '<>',
  color: '#b95',
  tags: ['fossil'],
}

// --- the beanstalk climb (Quest 2, VerticalDriver) ---
// Gummy aphids cling to the stalk; cloud rats scurry along the cloud ledges near the top.

export const GUMMY_APHID: EntityTemplate = {
  id: 'gummyAphid',
  team: 'enemy',
  width: 1,
  height: 1,
  hp: 2,
  glyph: 'o',
  color: '#8d8',
  tags: ['gummyAphid'],
}

export const CLOUD_RAT: EntityTemplate = {
  id: 'cloudRat',
  team: 'enemy',
  width: 1,
  height: 1,
  hp: 3,
  glyph: 'r',
  color: '#ddd',
  tags: ['cloudRat'],
}

export const ACT0_TEMPLATES: readonly EntityTemplate[] = [
  CANDY_BAT,
  SUGAR_GOLEM,
  GUMMY_WORM,
  ROCK_CANDY_VEIN,
  FOSSIL,
  GUMMY_APHID,
  CLOUD_RAT,
]

/** Template registry keyed by id, for the engine entity factory. */
export const TEMPLATE_MAP: ReadonlyMap<string, EntityTemplate> = new Map(
  ACT0_TEMPLATES.map((t) => [t.id, t]),
)
