import type { GameState } from '@/engine/types/GameState'
import type { SpellDef } from '@/engine/types/defs'
import type { Ability } from '@/engine/quest/Entity'

// Grimoires register castable spells (the beginner's grimoire is Phase 1's first). A spell is
// available in a quest's loadout only when the grimoire that grants it is owned. This module
// derives the owned-spell loadout and maps it to the Scene's Ability shape (id + cooldownMs)
// so a Scene can be started with playerAbilities. Pure; imports only types + the Ability type.

/** The SpellDefs the player can currently cast (their grimoire flag is owned). */
export function ownedSpells(spells: readonly SpellDef[], state: GameState): readonly SpellDef[] {
  return spells.filter((s) => state.flags[s.grimoireFlag] === true)
}

/** Whether a specific spell is owned (its grimoire flag is set). */
export function hasSpell(spells: readonly SpellDef[], spellId: string, state: GameState): boolean {
  const spell = spells.find((s) => s.id === spellId)
  return spell !== undefined && state.flags[spell.grimoireFlag] === true
}

/** The owned spells mapped to Scene abilities (id + live cooldownMs). */
export function spellAbilities(spells: readonly SpellDef[], state: GameState): readonly Ability[] {
  return ownedSpells(spells, state).map((s) => ({ id: s.id, cooldownMs: s.cooldownMs }))
}
