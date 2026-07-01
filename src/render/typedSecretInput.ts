import type { GameState } from '@/engine/types/GameState'
import { fireAny, type SecretInteraction } from '@/engine/content/secrets'
import { matchTypedWord, matchKonami, MAX_BUFFER } from '@/engine/content/typedSecrets'
import {
  TYPED_SECRETS,
  TYPED_WORDS,
  KONAMI_TOKEN,
  KONAMI_SEQUENCE,
  ANIWEY_SECRET,
} from '@/content/typedSecrets'
import { ITEM_MAP } from '@/content/items/items'
import { isTypingTarget } from '@/render/hotkeys'

// The CB2 hidden-text-box, re-introduced as a coverage-excluded render keystroke buffer (the DECISION —
// word→effect — is pure content/engine data; this is only the DOM capture). It mirrors render/hotkeys.ts:
// one document keydown listener, honoring the noHotkeys / :focus guard so it never fires while the player
// is typing in a field (e.g. naming the galleon). It keeps a rolling TEXT buffer for word-matching and a
// separate arrow/letter TOKEN buffer for the Konami code, calls the PURE matcher on every keypress, and
// on a hit feeds a { kind:'type', word } interaction to the SAME fireAny runner. All game rules live in
// the tested engine + content; this file is glue (appended to vite.config's coverage-exclude array).

/** The rendered dependencies this layer needs from the host (bootstrap supplies them). */
export interface TypedSecretDeps {
  /** Apply a pure state transition (bootstrap's session.dispatch). */
  readonly dispatch: (fn: (s: GameState) => GameState) => void
  /** Read the current state (bootstrap's session.getState). */
  readonly getState: () => GameState
  /** Show a deadpan reveal line (bootstrap's notify — toast + event log). */
  readonly notify: (text: string) => void
  /** Resolve an i18n key to its string (bootstrap's tk). */
  readonly resolve: (key: string) => string
  /** Reveal the session-only 'aniwey' ASCII heart in the corner (never persisted). */
  readonly onHeartRevealed: () => void
}

export interface TypedSecretLayer {
  /** Inject a typed word directly (test hook — drives the runner without raw DOM). Returns whether it fired. */
  type(word: string): boolean
  /** Detach the document listener. */
  dispose(): void
}

/** Normalize a KeyboardEvent into a matcher token: arrows → up/down/left/right, single chars → lowercased. */
export function keyToken(key: string): string {
  switch (key) {
    case 'ArrowUp':
      return 'up'
    case 'ArrowDown':
      return 'down'
    case 'ArrowLeft':
      return 'left'
    case 'ArrowRight':
      return 'right'
    default:
      return key.length === 1 ? key.toLowerCase() : ''
  }
}

/**
 * Attach the hidden-text-box listener. Fires typed secrets through the shared secret runner; the aniwey
 * heart is a SESSION-only flourish held here (never persisted). Mirrors createHotkeyLayer's lifecycle.
 */
export function createTypedSecretInput(doc: Document, deps: TypedSecretDeps): TypedSecretLayer {
  let textBuffer = ''
  let keyTokens: string[] = []

  const fire = (word: string): boolean => {
    const interaction: SecretInteraction = { kind: 'type', word }
    const before = deps.getState()
    const result = fireAny(before, TYPED_SECRETS, interaction, ITEM_MAP)
    if (!result.fired) return false
    // The aniwey heart is session-only: reveal it here, and do NOT persist its flag into the save.
    if (ANIWEY_SECRET.trigger.kind === 'type' && word === ANIWEY_SECRET.trigger.word) {
      deps.onHeartRevealed()
    } else if (result.state !== before) {
      deps.dispatch(() => result.state)
    }
    if (result.revealKey) deps.notify(deps.resolve(result.revealKey))
    return true
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (isTypingTarget(doc.activeElement)) return

    const token = keyToken(event.key)
    if (token === '') return

    // Text buffer: append the single character (arrows contribute nothing to word-matching), cap length.
    if (event.key.length === 1) {
      textBuffer = (textBuffer + event.key).slice(-MAX_BUFFER)
      const word = matchTypedWord(textBuffer, TYPED_WORDS)
      if (word) {
        fire(word)
        textBuffer = '' // consume so the same word does not re-fire on the next keystroke
      }
    }

    // Token buffer: arrows + letters both count toward Konami; keep only the tail we could need.
    keyTokens = [...keyTokens, token].slice(-KONAMI_SEQUENCE.length)
    if (matchKonami(keyTokens, KONAMI_SEQUENCE)) {
      fire(KONAMI_TOKEN)
      keyTokens = []
    }
  }

  doc.addEventListener('keydown', onKeyDown)

  return {
    type: (word) => fire(word),
    dispose() {
      doc.removeEventListener('keydown', onKeyDown)
    },
  }
}
