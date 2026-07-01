import { t } from '@/content/i18n/en'
import type { GameTextKey } from '@/content/i18n/schema'
import { deathBlurb } from '@/engine/quest/deathBlurb'
import { ALL_DEATH_MESSAGES } from '@/content/deathMessages'

// Thin render-layer convenience: resolve a source's §19 death line (exact-else-generic, pure
// engine picker over the content registry) to display text. The transient Act 2-4 fight screens
// call this for their loss epitaph so every loss shows its bespoke deadpan line, from ONE registry.
// Coverage-excluded glue over tested parts (deathBlurb + the i18n table); nothing to unit-test here.

/** The resolved §19 epitaph text for a death/loss `source` (falls back to the generic line). */
export function deathEpitaph(source: string): string {
  return t(deathBlurb(source, ALL_DEATH_MESSAGES) as GameTextKey)
}
