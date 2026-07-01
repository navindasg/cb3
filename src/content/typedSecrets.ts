import type { ItemDef, SecretDef } from '@/engine/types/defs'

// The CB2 hidden-text-box, re-introduced as data. CB2 let you type invisible words anywhere on the
// page for tiny rewards; we keep the DECISION (word → effect) here as pure content, and the keystroke
// capture as coverage-excluded render glue (render/typedSecretInput.ts). The pure matcher
// (engine/content/typedSecrets) normalizes a rolling buffer and suffix/window-matches these words,
// then feeds a { kind:'type', word } interaction to the SAME secret runner (fireAny) — one engine.
//
// Five words, each a tiny curiosity reward that NEVER blocks progress (§18 density, CB2-faithful):
//   • 'starlight' → the scholar's pamphlet (a lore keepsake, §284)         — persisted, fire-once
//   • 'candy box' → the deadpan "You have 1 candy." toast (the CB1 opener) — cosmetic, re-triggerable
//   • 'aniwey'    → a small ASCII heart in the corner (the author's name)   — session-only, not saved
//   • 'eclipse'   → the astronomer's dry "where did you hear that?"         — inert once the grimoire is owned
//   • the Konami code → the goldfish in the fishbowl helm (§171/§317)       — persisted, fire-once (effect deferred)

/** The special "word" the matcher resolves by an arrow-key sequence rather than typed text. */
export const KONAMI_TOKEN = 'konami'

/** The Konami arrow/letter sequence, as normalized key tokens (matched as a suffix of the key buffer). */
export const KONAMI_SEQUENCE: readonly string[] = [
  'up',
  'up',
  'down',
  'down',
  'left',
  'right',
  'left',
  'right',
  'b',
  'a',
]

/** The scholar's pamphlet — a lore keepsake granted by typing 'starlight' (DESIGN §284). Not equippable. */
export const SCHOLARS_PAMPHLET: ItemDef = {
  id: 'scholarsPamphlet',
  displayKey: 'item.scholarsPamphlet.name',
  descKey: 'item.scholarsPamphlet.desc',
  ascii: '=p',
  saveFlag: 'scholarsPamphletOwned',
}

/** 'starlight' → the scholar's pamphlet. Persisted, fires once (its setsFlag latch). */
export const STARLIGHT_SECRET: SecretDef = {
  id: 'typedStarlight',
  trigger: { kind: 'type', word: 'starlight' },
  setsFlag: 'starlightTyped',
  revealKey: 'secret.starlight.reveal',
  grantsItemId: SCHOLARS_PAMPHLET.id,
}

/** 'candy box' → the "You have 1 candy." toast. Cosmetic: no flag, fires every time, grants nothing. */
export const CANDY_BOX_SECRET: SecretDef = {
  id: 'typedCandyBox',
  trigger: { kind: 'type', word: 'candy box' },
  setsFlag: 'candyBoxTyped', // unused for a cosmetic secret, but the shape requires it
  revealKey: 'secret.candyBox.reveal',
  cosmetic: true,
}

/** 'aniwey' → a session-only ASCII heart in the corner (the author's name; not persisted). Fires once. */
export const ANIWEY_SECRET: SecretDef = {
  id: 'typedAniwey',
  trigger: { kind: 'type', word: 'aniwey' },
  setsFlag: 'aniweyHeart',
  revealKey: 'secret.aniwey.reveal',
  sessionOnly: true,
}

/** The flag the black licorice grimoire sets when owned (the void-whale hermit's shop grant — content/flags
 * owns the same literal as the single source of truth). Re-declared here in lock-step so eclipse's inert-when
 * gate reads it directly; once you hold the book (having reached the whale) eclipse goes quiet — you know now
 * where eclipses come from. Before that, eclipse always speaks. */
export const BLACK_LICORICE_GRIMOIRE_OWNED_FLAG = 'blackLicoriceGrimoireOwned'

/** 'eclipse' → the astronomer's dry disquiet. Inert once the black licorice grimoire is owned (you know then). */
export const ECLIPSE_SECRET: SecretDef = {
  id: 'typedEclipse',
  trigger: { kind: 'type', word: 'eclipse' },
  setsFlag: 'eclipseTyped',
  revealKey: 'secret.eclipse.reveal',
  inertWhenFlag: BLACK_LICORICE_GRIMOIRE_OWNED_FLAG,
}

/** The Konami code → the goldfish in the fishbowl helm (the §171/§317 morale hook; the EFFECT is deferred).
 * Persisted, fires once via its setsFlag. Matched by the arrow-sequence path, not typed text. */
export const KONAMI_SECRET: SecretDef = {
  id: 'typedKonami',
  trigger: { kind: 'type', word: KONAMI_TOKEN },
  setsFlag: 'goldfishInHelm',
  revealKey: 'secret.konami.reveal',
}

/** Every typed secret, in match-priority order (longest/most-specific words are unambiguous suffixes). */
export const TYPED_SECRETS: readonly SecretDef[] = [
  STARLIGHT_SECRET,
  CANDY_BOX_SECRET,
  ANIWEY_SECRET,
  ECLIPSE_SECRET,
  KONAMI_SECRET,
]

/** The typed WORDS (excluding the Konami token) the matcher suffix-matches against the text buffer. */
export const TYPED_WORDS: readonly string[] = TYPED_SECRETS.map((s) =>
  s.trigger.kind === 'type' ? s.trigger.word : '',
).filter((w) => w !== '' && w !== KONAMI_TOKEN)
