import type { SpellDef } from '@/engine/types/defs'

// The beginner's grimoire spells (Phase 1). Each is gated by the grimoire's saveFlag — owning
// the book puts these into a quest's castable loadout (engine/content/spells maps them to
// Scene abilities). Data only.

export const SUGAR_BOLT: SpellDef = {
  id: 'sugarBolt',
  displayKey: 'spell.sugarBolt.name',
  cooldownMs: 800,
  damage: 2,
  manaCost: 1,
  grimoireFlag: 'beginnerGrimoireOwned',
}

export const SWEET_WARD: SpellDef = {
  id: 'sweetWard',
  displayKey: 'spell.sweetWard.name',
  cooldownMs: 5000,
  damage: 0,
  manaCost: 3,
  grimoireFlag: 'beginnerGrimoireOwned',
}

export const GRIMOIRE_SPELLS: readonly SpellDef[] = [SUGAR_BOLT, SWEET_WARD]
