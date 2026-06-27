import type { GameState } from '@/engine/types/GameState'
import { spendResource } from '@/engine/types/Resource'
import { setNumber, setFlag } from '@/engine/state/reducers'
import { act2GateCleared } from '@/engine/content/actGate'
import {
  DYSON_STAGES,
  DYSON_STAGE_KEY,
  DYSON_STAGE_COUNT,
  SUN_ART_BASE,
  SCAFFOLD_OVERLAY,
  type DysonStage,
} from '@/content/sun/dysonScaffold'

// The dyson scaffold (Act 3 — the 5-stage build machine, DESIGN §186/§188). Pure & immutable, mirroring
// engine/content/galleonUpgrade's track machine but LINEAR: a single sequential ladder over the numbers
// key `dysonStage` (default 0 — nothing raised). Raising the next stage spends every price line into a
// LOCAL paid (NEVER a partial spend) then bumps the ledger + sets that stage's done-flag. A no-op returns
// the SAME reference (the {ok,state,reason?} idiom) on max-stage, a deferred stage, or any unaffordable
// line. Stages are strictly one-way: each done-flag blocks re-buy (the next stage gates on the previous),
// so this is NOT a farm — pure spend-and-set, like the galleon's tiers. Soft-lock-free: stage 1 draws
// only candies + rock candy, both abundant by Act 3.
//
// scaffoldReachable re-exports the EXISTING act-gate predicate (hull t3 + 10k peppermint) — no new reach
// gate. The engine reads no content FLAG value; it reads content CONFIG data (the stage list, the art) and
// reuses a sibling engine predicate (act2GateCleared) — both ADR §3-allowed (the actGate idiom).

/** Whether the dyson scaffold is reachable — gated on the Act-2 gate being cleared (hull t3 + 10k
 * peppermint). A pure re-export of the act-gate predicate; there is no separate reach flag (sunReached is
 * reveal-only, set by the screen on first arrival). */
export function scaffoldReachable(state: GameState): boolean {
  return act2GateCleared(state)
}

/** The highest dyson stage completed (defaults to 0 — nothing raised). Clamped to [0, count]. */
export function currentStage(state: GameState): number {
  const raw = Math.floor(state.numbers[DYSON_STAGE_KEY] ?? 0)
  return Math.max(0, Math.min(DYSON_STAGE_COUNT, raw))
}

/** Whether the whole scaffold has been raised (every stage complete). */
export function scaffoldComplete(state: GameState): boolean {
  return currentStage(state) >= DYSON_STAGE_COUNT
}

/** The next stage to raise (one past the current), or null at the top of the ladder. */
export function nextStage(state: GameState): DysonStage | null {
  return DYSON_STAGES.find((st) => st.stage === currentStage(state) + 1) ?? null
}

/** Whether the next stage exists, is buildable (not deferred), and every price line is affordable. The
 * previous-stage prerequisite is implicit: the next stage is always exactly currentStage + 1. */
export function canBuildStage(state: GameState): boolean {
  const stage = nextStage(state)
  return (
    stage !== null &&
    !stage.deferred &&
    stage.price.every((line) => state[line.resource].current >= line.amount)
  )
}

export interface BuildStageResult {
  readonly ok: boolean
  readonly state: GameState
  readonly reason?: 'maxStage' | 'deferred' | 'unaffordable'
}

/**
 * Raise the next stage: pay every price line, then bump the stage ledger and set the stage's done-flag.
 * No-op (SAME reference, ok:false) at the top of the ladder (maxStage), on a deferred stage, or when any
 * price line is unaffordable (spendResource returns null rather than overdrafting, so nothing is touched —
 * NEVER a partial spend). Immutable. Strictly one-way: the done-flag and the bumped ledger both block a
 * re-buy of this stage, so it cannot be farmed.
 */
export function buildStage(state: GameState): BuildStageResult {
  const stage = nextStage(state)
  if (!stage) return { ok: false, state, reason: 'maxStage' }
  if (stage.deferred) return { ok: false, state, reason: 'deferred' }

  let paid: GameState = state
  for (const line of stage.price) {
    const spent = spendResource(paid[line.resource], line.amount)
    if (!spent) return { ok: false, state, reason: 'unaffordable' }
    paid = { ...paid, [line.resource]: spent }
  }

  return { ok: true, state: setFlag(setNumber(paid, DYSON_STAGE_KEY, stage.stage), stage.doneFlag) }
}

/**
 * Assemble the sun's pure-ASCII art for a given stage: the bare disc with every COMPLETED stage's scaffold
 * overlay laid over it (a non-space overlay char replaces the disc char at that cell). Stage 0 is the bare
 * star. Pure — no DOM, no glow (the amber glow is CSS, render/glowOverlay's .glow-sun on the <pre>). The
 * result is fixed-width rows joined by newlines, always printable ASCII (guarded by a test against the
 * no-emoji rule).
 */
export function sunArt(stage: number): string {
  const done = Math.max(0, Math.min(DYSON_STAGE_COUNT, Math.floor(stage)))
  const rows = SUN_ART_BASE.map((row) => row.split(''))

  for (let s = 1; s <= done; s++) {
    const overlay = SCAFFOLD_OVERLAY[s] ?? []
    overlay.forEach((line, y) => {
      const target = rows[y]
      if (!target) return
      for (let x = 0; x < line.length && x < target.length; x++) {
        const ch = line[x]!
        if (ch !== ' ') target[x] = ch
      }
    })
  }

  return rows.map((r) => r.join('')).join('\n')
}
