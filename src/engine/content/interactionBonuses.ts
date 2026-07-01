import type { GameState } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'
import { setFlag } from '@/engine/state/reducers'

// The two cosmetic-first Batch-A interaction secrets (Phase 5, DESIGN §18) — kept pure and tested, away
// from the coverage-excluded screens. Both are pure CB2-tradition flavor: a curiosity that rewards looking,
// never a stat. There is no luck/magic axis in the game, and a secret should not promise a bonus it cannot
// pay — so these grant only what they visibly grant:
//   • the CANDY BOX FIGUREHEAD (name the galleon 'Candy Box' → the secret aniwey-smiley figurehead) draws
//     the carved smiley on her bow (a render-layer homage);
//   • MOONPOPS (plant a single lollipop on the moon) blooms a soft, glowing garden (a render-layer glow).
// Each is a one-time ownership flag; the render layer reads the flag to draw the payoff. No numeric bonus is
// exposed — if a luck/magic stat system ever lands, these flags are the honest hook it would read (like the
// tricorn/parrot's deferred +crew morale, §272, or the kraken crown's deferred enchants, §235).

/** content/flags: the flag set when the galleon is named 'Candy Box' and the figurehead is revealed. The
 * FIGUREHEAD item's own saveFlag marks ownership; the engine re-declares the string in lock-step (ADR §3). */
export const CANDY_BOX_FIGUREHEAD_FLAG = 'candyBoxFigureheadOwned'

/** content/flags: the flag set when a single lollipop has been planted on the moon (moonpops bloom). */
export const MOONPOPS_PLANTED_FLAG = 'moonpopsPlanted'

/** Whether the secret aniwey-smiley figurehead has been revealed (the galleon was named 'Candy Box'). */
export function figureheadOwned(state: GameState): boolean {
  return state.flags[CANDY_BOX_FIGUREHEAD_FLAG] === true
}

/** Whether moonpops have been planted (a lollipop went into the moon and bloomed). */
export function moonpopsPlanted(state: GameState): boolean {
  return state.flags[MOONPOPS_PLANTED_FLAG] === true
}

export interface PlantMoonpopResult {
  readonly ok: boolean
  readonly state: GameState
  readonly reason?: 'alreadyPlanted' | 'noLollipop'
}

/**
 * Plant a single lollipop on the moon: spend EXACTLY 1 lollipop and set the moonpops flag (a render-layer
 * glow — pure flavor, no stat). A one-time bloom — fails (SAME ref) if moonpops are already planted or the
 * player holds no lollipop. Immutable; there is nothing to farm.
 */
export function plantMoonpop(state: GameState): PlantMoonpopResult {
  if (moonpopsPlanted(state)) return { ok: false, state, reason: 'alreadyPlanted' }
  const lollipops = spendResource(state.lollipops, 1)
  if (!lollipops) return { ok: false, state, reason: 'noLollipop' }
  const spent: GameState = { ...state, lollipops }
  return { ok: true, state: setFlag(spent, MOONPOPS_PLANTED_FLAG, true) }
}
