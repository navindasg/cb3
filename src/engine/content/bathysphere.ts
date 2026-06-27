import type { GameState } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'
import { setFlag } from '@/engine/state/reducers'
import { BATHYSPHERE_PRICE, BATHYSPHERE_ITEM_ID } from '@/content/sun/bathysphere'

// The peppermint bathysphere (Act 3 — Increment 6, the stage-5 reward, DESIGN §5/§190/§196). Pure &
// immutable, the one-off-craft idiom of the forge capstone / galleonUpgrade's tier consume / mintPlanet's
// freeFrostWyrm: spend every price line into a LOCAL paid (NEVER a partial spend), then set the build flag
// AND bank the owned keepsake item in the SAME returned state. A no-op returns the SAME reference (the
// {ok,state,reason?} idiom) before the descent port is open, when any line is unaffordable, or once it is
// already built — so it cannot be re-crafted (the flag blocks it) and there is nothing to farm.
//
// The engine reads no content FLAG value: it re-declares the descent-port flag (dysonStage5Done) and the
// build flag (bathysphereBuilt) as string literals in lock-step with content/flags' DYSON_STAGE_DONE_FLAGS[4]
// and BATHYSPHERE_BUILT_FLAG (the moonStrata idiom, ADR §3). It MAY import the content CONFIG cost lines +
// the item id (data, not logic — like dysonScaffold reading DYSON_STAGES). Building it is what makes
// act3GateCleared true (engine/content/actGate reads the same build flag in lock-step) — the Act-4 hook.

/**
 * Kept in lock-step with content/flags.DYSON_STAGE_DONE_FLAGS[4] (content owns the named array; the engine
 * re-declares the literal rather than importing the content value — ADR §3, the moonStrata idiom). The
 * descent port opens with this stage raised.
 */
const DYSON_STAGE5_DONE_FLAG = 'dysonStage5Done'

/**
 * Kept in lock-step with content/flags.BATHYSPHERE_BUILT_FLAG (the moonStrata idiom). Set by buildBathysphere
 * in the same dispatch that spends the materials + banks the item; gates the one-off craft and feeds
 * act3GateCleared.
 */
const BATHYSPHERE_BUILT_FLAG = 'bathysphereBuilt'

/** Whether the descent port is open — gated on the fifth dyson strut (the descent port) raised. */
export function descentPortOpen(state: GameState): boolean {
  return state.flags[DYSON_STAGE5_DONE_FLAG] === true
}

/** Whether the peppermint bathysphere has already been built (the one-off craft has fired) — reads the flag. */
export function bathysphereBuilt(state: GameState): boolean {
  return state.flags[BATHYSPHERE_BUILT_FLAG] === true
}

/**
 * Whether the bathysphere can be built right now: the descent port is open, it is not already built, and
 * every cost line (peppermint plating + mint coolant + caramel hull-seal) is affordable. A pure predicate
 * the screen reads to enable/disable the build button (no spend).
 */
export function canBuildBathysphere(state: GameState): boolean {
  return (
    descentPortOpen(state) &&
    !bathysphereBuilt(state) &&
    BATHYSPHERE_PRICE.every((line) => state[line.resource].current >= line.amount)
  )
}

export interface BuildBathysphereResult {
  readonly ok: boolean
  readonly state: GameState
  readonly reason?: 'locked' | 'alreadyBuilt' | 'unaffordable'
}

/**
 * Build the peppermint bathysphere: pay every cost line, then set the build flag AND bank the owned item,
 * all in the SAME returned state. No-op (SAME reference, ok:false) before the descent port is open
 * (`locked`), once already built (`alreadyBuilt`), or when any line is unaffordable (spendResource returns
 * null rather than overdrafting, so nothing is touched — NEVER a partial spend). Immutable. A one-off craft:
 * the build flag blocks a re-build, so it cannot be farmed — and the flag, with dysonStage5Done, is what
 * makes act3GateCleared true (the Act-4 descent hook).
 */
export function buildBathysphere(state: GameState): BuildBathysphereResult {
  if (!descentPortOpen(state)) return { ok: false, state, reason: 'locked' }
  if (bathysphereBuilt(state)) return { ok: false, state, reason: 'alreadyBuilt' }

  let paid: GameState = state
  for (const line of BATHYSPHERE_PRICE) {
    const spent = spendResource(paid[line.resource], line.amount)
    if (!spent) return { ok: false, state, reason: 'unaffordable' }
    paid = { ...paid, [line.resource]: spent }
  }

  paid = { ...paid, ownedItems: { ...paid.ownedItems, [BATHYSPHERE_ITEM_ID]: true } }
  return { ok: true, state: setFlag(paid, BATHYSPHERE_BUILT_FLAG) }
}
