// Pure entity-template DATA for Act 0 quests. The Scene needs an EntityFactory(order)->Entity;
// content supplies it (Block E note). To keep content importing only TYPES, the constructive
// factory lives in the engine (engine/content/entityFactory) and is parameterized by these
// plain template records. A template maps a spawn-order entityId to the stats/glyph used to
// build the Entity and to render it in the arena.

import type { Team } from '@/engine/types/quest'

/** Combat stats an entity attacks with (the engine builds a Weapon from these). */
export interface AttackStats {
  /** Flat damage per hit. */
  readonly damage: number
  /** Reach in cells (centre-to-centre). */
  readonly range: number
  /** Minimum ms between attacks. */
  readonly cooldownMs: number
}

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
  /** Optional attack stats; when present the factory arms the entity with a matching weapon. */
  readonly attack?: AttackStats
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

// --- the forest (Quest 1, HorizontalDriver) ---
// Gummy critters block the path east. A gummy slime is the common foe; a gummy bear is the
// tougher, slower one that hits harder. Both carry attack stats so they fight back; the grandma's
// wooden spoon (range 2) out-reaches their bite (range ~1.4), so a careful player can chip them.

export const GUMMY_SLIME: EntityTemplate = {
  id: 'gummySlime',
  team: 'enemy',
  width: 1,
  height: 1,
  hp: 3,
  glyph: 'g',
  color: '#6c6',
  tags: ['gummySlime'],
  attack: { damage: 1, range: 1.4, cooldownMs: 800 },
}

export const GUMMY_BEAR: EntityTemplate = {
  id: 'gummyBear',
  team: 'enemy',
  width: 2,
  height: 2,
  hp: 7,
  glyph: 'B',
  color: '#c84',
  tags: ['gummyBear'],
  attack: { damage: 2, range: 1.6, cooldownMs: 1100 },
}

// --- the mine gate (the access fight, HorizontalDriver) ---
// A crystallised rock-candy sentinel walls off the sugar mines. It is the deliberate "go buy a
// real weapon" gate: lots of HP, and — crucially — a reach (2.8) LONGER than grandma's spoon
// (range 2), so a spoon/bare-hands player must stand inside its swing and loses the trade, while
// a candy-cane BOW (range 5) or a licorice WHIP (range 3) out-ranges it and kills it untouched.
// The host ejects you to the village on death, so this is a genuine gate, not a respawn grind.

export const MINE_SENTINEL: EntityTemplate = {
  id: 'mineSentinel',
  team: 'enemy',
  width: 2,
  height: 2,
  hp: 40,
  glyph: 'M',
  color: '#9cf',
  tags: ['mineSentinel', 'rockCandy'],
  attack: { damage: 3, range: 2.8, cooldownMs: 600 },
}

// --- the mountain (the climb to the observatory, HorizontalDriver) ---
// Rock imps skitter down the scree and nip at you; a gummy bear (reused from the forest) lurks
// near the summit. Both are armed, so — unlike the mines loot-run — the mountain is a real fight,
// which your forge weapon makes comfortable.

export const ROCK_IMP: EntityTemplate = {
  id: 'rockImp',
  team: 'enemy',
  width: 1,
  height: 1,
  hp: 5,
  glyph: 'i',
  color: '#caa',
  tags: ['rockImp'],
  attack: { damage: 2, range: 1.6, cooldownMs: 800 },
}

export const ACT0_TEMPLATES: readonly EntityTemplate[] = [
  CANDY_BAT,
  SUGAR_GOLEM,
  GUMMY_WORM,
  ROCK_CANDY_VEIN,
  FOSSIL,
  GUMMY_APHID,
  CLOUD_RAT,
  GUMMY_SLIME,
  GUMMY_BEAR,
  MINE_SENTINEL,
  ROCK_IMP,
]

/** Template registry keyed by id, for the engine entity factory. */
export const TEMPLATE_MAP: ReadonlyMap<string, EntityTemplate> = new Map(
  ACT0_TEMPLATES.map((t) => [t.id, t]),
)
