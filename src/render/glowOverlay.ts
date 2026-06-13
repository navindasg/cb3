import type { GlowSpec } from '@/render/CellBuffer'
import { cellKey } from '@/render/hotspotMap'

// The pulsing-glow overlay is a separate layer from the text (ADR §7.2): an absolutely
// positioned set of spans whose OPACITY animates (never the text-shadow values), gated
// behind prefers-reduced-motion. We reconcile it by diffing the previous glow set against
// the next one so only changed cells touch the DOM — no full rebuild per frame. The diff
// itself is pure (no DOM) so it is unit-testable; DomRenderer applies the result.

/** A glow keyed by its cell, so the overlay can be reconciled cell-by-cell. */
export type GlowMap = ReadonlyMap<string, GlowSpec>

export function buildGlowMap(glows: readonly GlowSpec[]): GlowMap {
  const map = new Map<string, GlowSpec>()
  for (const g of glows) map.set(cellKey(g.x, g.y), g)
  return map
}

export interface GlowDiff {
  /** Cells present in next but not prev (or whose className changed): create/replace. */
  readonly added: readonly GlowSpec[]
  /** Cell keys present in prev but not next: remove. */
  readonly removed: readonly string[]
}

/**
 * Diff two glow maps into the spans to add and the cell keys to remove. A cell whose
 * className changed counts as both removed (old) and added (new) so the overlay span is
 * replaced. Pure — the caller mutates the DOM from this plan.
 */
export function diffGlow(prev: GlowMap, next: GlowMap): GlowDiff {
  const added: GlowSpec[] = []
  const removed: string[] = []

  for (const [key, spec] of next) {
    const before = prev.get(key)
    if (!before || before.className !== spec.className) added.push(spec)
  }
  for (const [key, spec] of prev) {
    const after = next.get(key)
    if (!after || after.className !== spec.className) removed.push(key)
  }

  return { added, removed }
}
