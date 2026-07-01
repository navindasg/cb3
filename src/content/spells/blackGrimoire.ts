import type { SpellDef } from '@/engine/types/defs'

// The black licorice grimoire's spells (Phase 5 — the void whale's hermit, hidden boss 4, DESIGN §17/§18).
// A slim book of dark, dry magic bound in licorice, kept by the hermit in the whale's belly. Each spell is
// gated by the grimoire's saveFlag — owning the book puts these into a quest's castable loadout
// (engine/content/spells maps them to Scene abilities, the same rails as the beginner's grimoire). Data only.
//
// Three spells, gated by the grimoire's owned flag (engine/content/spells.ownedSpells reports them once the
// book is bought). ECLIPSE is the load-bearing one: it is not a combat spell but a WORLD one — casting it
// pauses the star counter for a window (engine/content/starCounter's eclipse branch, via voidWhale.castGrimoire-
// Eclipse), the one thing that can hold back the sky's descent, even a little. It ties to the typed 'eclipse'
// secret (which goes inert once this grimoire is owned — you know now where eclipses come from). Its combat
// stats are inert (damage 0, a long cooldown); the world effect is dispatched by the screen, not the Scene.
//
// VOID STEP and MELT are ordinary castable DATA (a blink, a corrosive bolt), authored here and reported by
// ownedSpells so the grimoire's loadout is honest, but their wiring into the real-time quest Scene loadout is
// DEFERRED (§22): the quest-combat balance is tuned around the beginner grimoire's two spells, and dropping a
// fresh damage spell into it un-audited would break that tuning (the pop-rock-pike / mantle-sword precedent).
// They bank as a known-but-unwired loadout for now; the eclipse world-effect is the shipped magic.

/** VOID STEP — a short blink through the dark between two places. A cheap, quick castable. */
export const VOID_STEP: SpellDef = {
  id: 'voidStep',
  displayKey: 'spell.voidStep.name',
  cooldownMs: 2000,
  damage: 0,
  manaCost: 2,
  grimoireFlag: 'blackLicoriceGrimoireOwned',
}

/** MELT — a slow, corrosive bolt of black licorice that dissolves what it touches. Heavy, slow. */
export const MELT: SpellDef = {
  id: 'melt',
  displayKey: 'spell.melt.name',
  cooldownMs: 1500,
  damage: 6,
  manaCost: 4,
  grimoireFlag: 'blackLicoriceGrimoireOwned',
}

/**
 * ECLIPSE — the world spell. Not a combat cast: it draws a shadow across the sky and the star counter STOPS
 * falling for a window (engine/content/starCounter reads the eclipse anchor). Its Scene stats are inert
 * (damage 0, a long cooldown so it never spams as a combat move); the world pause is dispatched by the
 * grimoire screen. The one thing in the game that can hold the dark back — for a while.
 */
export const ECLIPSE: SpellDef = {
  id: 'eclipse',
  displayKey: 'spell.eclipse.name',
  cooldownMs: 60000,
  damage: 0,
  manaCost: 10,
  grimoireFlag: 'blackLicoriceGrimoireOwned',
}

export const BLACK_GRIMOIRE_SPELLS: readonly SpellDef[] = [VOID_STEP, MELT, ECLIPSE]
