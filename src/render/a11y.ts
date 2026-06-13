// Accessibility helpers for the ASCII layer (ADR §7.6). Decorative art is hidden from
// the a11y tree; meaningful scenes/maps expose a role=img with a text description of
// what the player is looking at (e.g. their location). A prefers-reduced-motion gate
// lets every animated glow opt out. All DOM access is guarded so these are safe to call
// from logic paths and in jsdom (where matchMedia is absent).

/** Mark an element as decorative: removed from the accessibility tree entirely. */
export function markDecorative(el: HTMLElement): void {
  el.setAttribute('aria-hidden', 'true')
}

/**
 * Mark an element as a meaningful image with a text alternative — used for the map and
 * for quest scenes so a screen reader announces the scene + the player's location.
 */
export function markMeaningful(el: HTMLElement, label: string): void {
  el.setAttribute('role', 'img')
  el.setAttribute('aria-label', label)
  el.removeAttribute('aria-hidden')
}

/**
 * Compose the map's aria-label from a scene name and a player-location description, e.g.
 * describeLocation('The village', 'at the blacksmith') -> "The village. Player at the blacksmith."
 * The location clause is optional (omitted on scenes with no positioned player).
 */
export function describeLocation(sceneName: string, playerLocation?: string): string {
  const base = sceneName.trim()
  if (!playerLocation || playerLocation.trim().length === 0) return base
  return `${base}. Player ${playerLocation.trim()}.`
}

/**
 * True when the user has asked to reduce motion. Returns false when matchMedia is
 * unavailable (jsdom, very old engines) — the safe default is "motion allowed", since
 * the static glow (a CSS class) is always present regardless and only the pulse is gated.
 */
export function prefersReducedMotion(win: Window = window): boolean {
  const mm = (win as Window & { matchMedia?: (q: string) => MediaQueryList }).matchMedia
  if (typeof mm !== 'function') return false
  try {
    return mm.call(win, '(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

/**
 * Apply the reduced-motion preference to a glow-overlay root: when motion is reduced we
 * add `reduce-motion` (CSS sets animation:none) so the pulse stops; the static glow class
 * on the text itself is untouched, keeping the colour. Returns whether motion was reduced.
 */
export function applyReducedMotion(root: HTMLElement, win: Window = window): boolean {
  const reduced = prefersReducedMotion(win)
  root.classList.toggle('reduce-motion', reduced)
  return reduced
}
