import type { CauldronEntry, MatcherSpec, RecipeDef } from '@/engine/types/defs'

// The data-driven cauldron matcher (resolved decision 1; ADR §10 RecipeDef). CB2 matched
// the last-N action log with hand-rolled nested ifs, one per recipe. CB3 instead authors
// each recipe's matcher as a DECLARATIVE spec (a tree of combinators) which this engine
// interprets against the raw action log. Adding a recipe is appending a data record — no
// engine edit. Pure throughout: no state, no DOM.
//
// Combinators:
//   action(a, s?)   — a single log entry of action `a` (and subject `s` when given)
//   contains(step)  — at least one entry matches `step`
//   exactlyOne(step)— exactly one entry matches `step`
//   inOrder(steps)  — every step matches some entry, preserving relative order

/** A single log entry matches a leaf `action` spec (subject compared only when specified). */
function entryMatches(spec: Extract<MatcherSpec, { kind: 'action' }>, entry: CauldronEntry): boolean {
  if (spec.action !== entry.action) return false
  if (spec.subject === undefined) return true
  return spec.subject === entry.subject
}

/** How many log entries satisfy a leaf `action` spec. */
function countMatches(
  spec: Extract<MatcherSpec, { kind: 'action' }>,
  log: readonly CauldronEntry[],
): number {
  let n = 0
  for (const entry of log) if (entryMatches(spec, entry)) n++
  return n
}

/**
 * Whether `log` satisfies `spec`. Recursive over the combinator tree:
 *  - action: at least one matching entry exists (use exactlyOne for an exact count of 1).
 *  - contains: the wrapped spec matches.
 *  - exactlyOne: the wrapped (leaf) spec matches exactly one entry.
 *  - inOrder: each child matches at a strictly increasing log index (relative order kept).
 */
export function matchesSpec(spec: MatcherSpec, log: readonly CauldronEntry[]): boolean {
  switch (spec.kind) {
    case 'action':
      return log.some((entry) => entryMatches(spec, entry))
    case 'contains':
      return matchesSpec(spec.step, log)
    case 'exactlyOne': {
      if (spec.step.kind !== 'action') {
        // exactlyOne is defined over a single leaf action; nested combinators are unsupported.
        throw new Error('exactlyOne expects a leaf action spec')
      }
      return countMatches(spec.step, log) === 1
    }
    case 'all':
      // Conjunction over the WHOLE log — every child must hold (e.g. an inOrder sequence
      // AND an exactlyOne whole-log count constraint).
      return spec.specs.every((s) => matchesSpec(s, log))
    case 'inOrder':
      return matchesInOrder(spec.steps, log)
  }
}

/** Each step must match an entry at a strictly increasing index (subsequence, in order). */
function matchesInOrder(steps: readonly MatcherSpec[], log: readonly CauldronEntry[]): boolean {
  let cursor = 0
  for (const step of steps) {
    let found = -1
    for (let i = cursor; i < log.length; i++) {
      const slice = log.slice(i, i + 1)
      if (matchesSpec(step, slice)) {
        found = i
        break
      }
    }
    if (found < 0) return false
    cursor = found + 1
  }
  return true
}

/**
 * Find the first recipe (in registry order) whose matcher accepts `log`. Returns the
 * matched RecipeDef, or null when nothing brews. Pure — never mutates the log or recipes.
 */
export function matchRecipe(
  recipes: readonly RecipeDef[],
  log: readonly CauldronEntry[],
): RecipeDef | null {
  for (const recipe of recipes) {
    if (matchesSpec(recipe.matcher, log)) return recipe
  }
  return null
}

// --- Authoring combinators -------------------------------------------------
// Optional ergonomic builders for recipe authors (pure spec constructors). Content may use
// these or write the spec literal directly — both produce the same plain data.

export function action(name: string, subject?: string): MatcherSpec {
  return subject === undefined
    ? { kind: 'action', action: name }
    : { kind: 'action', action: name, subject }
}

export function contains(step: MatcherSpec): MatcherSpec {
  return { kind: 'contains', step }
}

export function exactlyOne(step: MatcherSpec): MatcherSpec {
  return { kind: 'exactlyOne', step }
}

export function inOrder(...steps: MatcherSpec[]): MatcherSpec {
  return { kind: 'inOrder', steps }
}

export function all(...specs: MatcherSpec[]): MatcherSpec {
  return { kind: 'all', specs }
}

/** Append `entry` to a raw action log, capping length to the last `max` entries. Immutable. */
export function appendEntry(
  log: readonly CauldronEntry[],
  entry: CauldronEntry,
  max = 16,
): readonly CauldronEntry[] {
  const next = [...log, entry]
  return next.length > max ? next.slice(next.length - max) : next
}
