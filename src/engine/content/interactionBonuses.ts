import type { GameState } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'
import { setFlag } from '@/engine/state/reducers'

// The tiny stat payoffs for Batch-A interaction secrets (Phase 5, DESIGN §18) — kept pure and tested,
// away from the coverage-excluded screens. Two are cosmetic-first curiosities with a small numeric
// nudge attached:
//   • the CANDY BOX FIGUREHEAD (name the galleon 'Candy Box' → the secret aniwey-smiley figurehead) grants
//     a small flat LUCK bonus while owned;
//   • MOONPOPS (plant a single lollipop on the moon) grants a small flat MAGIC bonus while planted, and a
//     glow in the render layer.
// There is no global luck/magic aggregate in the game yet (like the tricorn/parrot's deferred +crew
// morale, §272, or the kraken crown's deferred enchants, §235): these are the FIRST such flat bonuses,
// exposed here as pure, honest, tested numbers ready for the stat system that will consume them. The
// VALUE is real and asserted; the aggregate consumer is signposted-deferred, never faked.

/** content/flags: the flag set when the galleon is named 'Candy Box' and the figurehead is revealed. The
 * FIGUREHEAD item's own saveFlag marks ownership; the engine re-declares the string in lock-step (ADR §3). */
export const CANDY_BOX_FIGUREHEAD_FLAG = 'candyBoxFigureheadOwned'

/** content/flags: the flag set when a single lollipop has been planted on the moon (moonpops bloom). */
export const MOONPOPS_PLANTED_FLAG = 'moonpopsPlanted'

/** The small flat luck bonus the aniwey-smiley figurehead grants while owned (0 otherwise). */
export const FIGUREHEAD_LUCK_BONUS = 1

/** The small flat magic bonus a planted moonpop grants while it blooms (0 otherwise). */
export const MOONPOP_MAGIC_BONUS = 1

/** Whether the secret aniwey-smiley figurehead has been revealed (the galleon was named 'Candy Box'). */
export function figureheadOwned(state: GameState): boolean {
  return state.flags[CANDY_BOX_FIGUREHEAD_FLAG] === true
}

/** The flat luck bonus from the figurehead: FIGUREHEAD_LUCK_BONUS while owned, else 0. */
export function figureheadLuckBonus(state: GameState): number {
  return figureheadOwned(state) ? FIGUREHEAD_LUCK_BONUS : 0
}

/** Whether moonpops have been planted (a lollipop went into the moon and bloomed). */
export function moonpopsPlanted(state: GameState): boolean {
  return state.flags[MOONPOPS_PLANTED_FLAG] === true
}

/** The flat magic bonus from moonpops: MOONPOP_MAGIC_BONUS while planted, else 0. */
export function moonpopMagicBonus(state: GameState): number {
  return moonpopsPlanted(state) ? MOONPOP_MAGIC_BONUS : 0
}

export interface PlantMoonpopResult {
  readonly ok: boolean
  readonly state: GameState
  readonly reason?: 'alreadyPlanted' | 'noLollipop'
}

/**
 * Plant a single lollipop on the moon: spend EXACTLY 1 lollipop and set the moonpops flag (a flat magic
 * bonus + a render-layer glow). A one-time bloom — fails (SAME ref) if moonpops are already planted or the
 * player holds no lollipop. Immutable; the flat bonus never compounds, so there is nothing to farm.
 */
export function plantMoonpop(state: GameState): PlantMoonpopResult {
  if (moonpopsPlanted(state)) return { ok: false, state, reason: 'alreadyPlanted' }
  const lollipops = spendResource(state.lollipops, 1)
  if (!lollipops) return { ok: false, state, reason: 'noLollipop' }
  const spent: GameState = { ...state, lollipops }
  return { ok: true, state: setFlag(spent, MOONPOPS_PLANTED_FLAG, true) }
}
