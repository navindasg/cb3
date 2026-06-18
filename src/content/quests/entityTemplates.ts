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

// --- the storm front (Quest 3, VerticalDriver) ---
// Past the toll giant's bridge, the storm front is a vertical climb through a charged cloud bank.
// Storm sprites are fast, fragile motes of static that dart in and zap; the thunderhead djinn
// caps it — a boss with a lot of HP and a long, slow lightning reach. Both are armed, so the
// climb is a real fight, gated behind the fizzy lifting soda (the updrafts fling you off without
// it). The djinn out-ranges a melee weapon's reach but not the candy-cane bow, rewarding the
// ranged archetype again (continuity with the mine gate's lesson).

export const STORM_SPRITE: EntityTemplate = {
  id: 'stormSprite',
  team: 'enemy',
  width: 1,
  height: 1,
  hp: 3,
  glyph: 'z', // a crackle of static (pure ASCII — DESIGN §2a)
  color: '#ad6',
  tags: ['stormSprite', 'flying'],
  attack: { damage: 2, range: 1.6, cooldownMs: 600 },
}

export const THUNDERHEAD_DJINN: EntityTemplate = {
  id: 'thunderheadDjinn',
  team: 'enemy',
  width: 3,
  height: 2,
  hp: 60,
  glyph: '(~)', // a roiling thunderhead, three cells wide
  color: '#9bd',
  tags: ['thunderheadDjinn', 'boss', 'flying'],
  attack: { damage: 4, range: 2.6, cooldownMs: 700 },
}

// --- the moon worm (Quest 4, HorizontalDriver) ---
// A colossal gummy worm eating the jawbreaker moon from inside; you fight it in the bore-holes it
// leaves (DESIGN §8 Act 1). The mine-gate lesson a third time: its long maw (reach 2.7) out-pokes a
// melee swing (spoon/sword reach 2), so a short weapon stands inside its bite and loses the trade.
// Like the djinn, the candy-cane BOW (range 5) is the clean answer — it plinks from well outside the
// maw and is never touched; the licorice WHIP (3) nominally out-reaches the maw and wins the trade,
// but its short margin means it still gets bitten up close (a scrappier answer than the bow). A
// boss's worth of HP makes the reach matter. Three cells wide and two tall (djinn-class) so it fills
// the tunnel; glyph is pure ASCII (§2a).

export const MOON_WORM: EntityTemplate = {
  id: 'moonWorm',
  team: 'enemy',
  width: 3,
  height: 2,
  hp: 80,
  glyph: '~O~', // a bulbous gummy segment with tapering ends — a fat worm
  color: '#7c5',
  tags: ['moonWorm', 'boss'],
  attack: { damage: 5, range: 2.7, cooldownMs: 800 },
}

export const ACT1_TEMPLATES: readonly EntityTemplate[] = [STORM_SPRITE, THUNDERHEAD_DJINN, MOON_WORM]

/** Template registry keyed by id, for the engine entity factory. */
export const TEMPLATE_MAP: ReadonlyMap<string, EntityTemplate> = new Map(
  [...ACT0_TEMPLATES, ...ACT1_TEMPLATES].map((t) => [t.id, t]),
)
