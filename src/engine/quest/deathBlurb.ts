import type { DeathMessage } from '@/engine/types/defs'

// A shared, pure death-line picker (§19). Mirrors Scene.pickDeath exactly, extracted so the
// TRANSIENT Act 2-4 turn-based fight screens (kraken, boarding, broadside, descent, star-eater,
// reef drift-strand, sour rain/fall, mint labyrinth, toll giant, ...) can show the same bespoke
// deadpan epitaph the on-foot quests do, instead of hard-coding inline strings. Layering (ADR §3):
// this is pure engine logic over DeathMessage data; content owns the message table (deathMessages.ts).
//
// The message returned is an i18n KEY (the DeathMessage.message field) — the render layer resolves it
// with t(); exactly like Scene's lastDeath.message, which questScreens passes to ctx.log().

/**
 * Pick the death-flavor i18n key for `source`, falling back to the 'generic' entry, then to ''.
 * Exact-source-else-generic, immutable (reads the table, allocates nothing new).
 */
export function deathBlurb(
  source: string | undefined,
  messages: readonly DeathMessage[],
): string {
  const src = source ?? 'generic'
  const exact = messages.find((m) => m.source === src)
  const chosen = exact ?? messages.find((m) => m.source === 'generic')
  return chosen?.message ?? ''
}
