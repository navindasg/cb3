// The pure matcher for the CB2 hidden-text-box (content/typedSecrets holds the word→effect data). The
// render layer (render/typedSecretInput.ts, coverage-excluded) keeps a rolling buffer of keystrokes and
// an arrow-key token buffer, and calls this on every keypress. We normalize the text buffer and check
// whether any registered word is a SUFFIX of it — so typing 'aniwey' fires the moment the last letter
// lands, mid-stream, without needing a delimiter (CB2's behaviour). The Konami code is matched separately
// as a suffix of the arrow/letter TOKEN buffer. Pure: no DOM, no state — just string matching.
//
// Suffix-matching (not equality) is what makes the box invisible-yet-forgiving: "xxxstarlight" fires,
// and interleaving other keys before the word does not (the word must be the trailing run).

/** Normalize a raw typed buffer for word-matching: lowercase, collapse whitespace runs, trim ends. */
export function normalizeBuffer(raw: string): string {
  return raw.toLowerCase().replace(/\s+/g, ' ').trimStart()
}

/**
 * The longest window we ever need to keep: no secret word is longer than this, so the render layer can
 * cap its rolling buffer here and never grow unbounded. (Recomputed from the words in matchTypedSecret's
 * callers; a generous constant keeps the render glue trivial.)
 */
export const MAX_BUFFER = 24

/**
 * Return the WORD (from `words`) that is a SUFFIX of the normalized `buffer`, or null if none. Pure
 * suffix matching is what makes the box invisible-yet-forgiving (CB2): typing the word anywhere fires
 * the moment its last letter lands ('qwertystarlight' fires 'starlight'), and continuing past it does
 * not ('starlightx' no longer ends in the word). When several words are suffixes, the LONGEST wins so a
 * multi-word phrase beats any shorter word ending it; ties break by `words` order (content priority).
 * Our word set has no genuine suffix overlaps, but the longest-wins rule keeps that robust. Pure.
 */
export function matchTypedWord(buffer: string, words: readonly string[]): string | null {
  const norm = normalizeBuffer(buffer)
  let best: string | null = null
  for (const word of words) {
    if (word !== '' && norm.endsWith(word) && (best === null || word.length > best.length)) {
      best = word
    }
  }
  return best
}

/**
 * Whether the arrow/letter `tokens` buffer ends with the Konami `sequence`. Pure suffix comparison over
 * the last N tokens; anything before the sequence is ignored (you may fat-finger first, then nail it).
 */
export function matchKonami(tokens: readonly string[], sequence: readonly string[]): boolean {
  if (tokens.length < sequence.length) return false
  const tail = tokens.slice(tokens.length - sequence.length)
  return sequence.every((tok, i) => tail[i] === tok)
}
