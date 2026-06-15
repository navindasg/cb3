// Keyboard accelerators (CB2's Hotkey + Keyboard.execute, re-introduced). CB2 underlined a
// letter in a button label and bound the matching key to the same action; a focus guard
// (Keyboard.getCanUseHotkeys → ":focus".hasClass("noHotkeys")) stopped accelerators from firing
// while the player was typing in a field. We keep that behaviour but fix two CB2 footguns:
//   • the key is DERIVED from the underlined letter (CB2 registered the <u> index and the Hotkey
//     letter separately, so they could silently disagree); and
//   • we match on event.key (layout-correct) rather than jQuery's event.which keycode.
// This module is pure DOM glue with NO game rules — callbacks are supplied by the host.

/**
 * The accelerator key for a label, derived from the underlined-letter index: the lower-cased
 * character at that index, or '' when there is no accelerator (index < 0 or out of range).
 */
export function acceleratorKey(label: string, underlineIndex: number): string {
  if (underlineIndex < 0 || underlineIndex >= label.length) return ''
  return label.charAt(underlineIndex).toLowerCase()
}

/** A label split around its accelerator letter, for rendering `<before>(letter)<after>`. */
export interface UnderlinedLabel {
  readonly before: string
  readonly letter: string
  readonly after: string
}

/** Split `label` around the underlined-letter index (letter is '' when there is no accelerator). */
export function underlinedLabel(label: string, underlineIndex: number): UnderlinedLabel {
  if (underlineIndex < 0 || underlineIndex >= label.length) {
    return { before: label, letter: '', after: '' }
  }
  return {
    before: label.slice(0, underlineIndex),
    letter: label.charAt(underlineIndex),
    after: label.slice(underlineIndex + 1),
  }
}

/** Whether accelerators must be suppressed because `el` is a typing target (CB2's noHotkeys guard). */
export function isTypingTarget(el: Element | null): boolean {
  if (!el) return false
  if (el.classList.contains('noHotkeys')) return true
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return (el as HTMLElement).isContentEditable === true
}

export interface HotkeyLayer {
  /** Bind `key` (single lower-cased character) to `callback` for the current screen. */
  bind(key: string, callback: () => void): void
  /** Drop every binding (called on screen switch, like CB2 resetting hotkeys on navigation). */
  clearBindings(): void
  /** Detach the document listener entirely. */
  dispose(): void
}

/**
 * Attach a single document-level keydown listener. Bindings are a flat key→callback map that
 * the host repopulates per screen via bind()/clearBindings(). A keypress fires its binding only
 * when the focused element is not a typing target; a fired accelerator consumes the event.
 */
export function createHotkeyLayer(doc: Document): HotkeyLayer {
  const bindings = new Map<string, () => void>()

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.metaKey || event.ctrlKey || event.altKey) return
    if (isTypingTarget(doc.activeElement)) return
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
    const callback = bindings.get(key)
    if (!callback) return
    event.preventDefault()
    callback()
  }

  doc.addEventListener('keydown', onKeyDown)

  return {
    bind(key, callback) {
      bindings.set(key.toLowerCase(), callback)
    },
    clearBindings() {
      bindings.clear()
    },
    dispose() {
      doc.removeEventListener('keydown', onKeyDown)
      bindings.clear()
    },
  }
}
