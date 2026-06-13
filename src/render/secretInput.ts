// The typed-secret box (ADR §7.6). The CB series hides secrets behind typed words; this is a
// real, visible, focusable <input> rather than a key sniffer, so it summons the on-screen
// keyboard on mobile and is reachable by keyboard/AT users. Pure DOM glue: it owns no game
// rules — a trimmed non-empty submission is handed to onSubmit, which the host matches against
// the SecretDef registry. autocomplete/autocorrect/spellcheck are off so the field never
// "helps" with a secret word.

export interface SecretInputOptions {
  /** Called with the trimmed value when the player submits (Enter on a non-empty entry). */
  readonly onSubmit: (value: string) => void
  /** Accessible label for the field. */
  readonly label?: string
  /** Placeholder shown in the empty field. */
  readonly placeholder?: string
}

export interface SecretInput {
  /** The live input element (for focus management by the host). */
  readonly input: HTMLInputElement
  dispose(): void
}

/** Mount a focusable typed-secret input inside `root`. Returns a handle with dispose(). */
export function createSecretInput(root: HTMLElement, options: SecretInputOptions): SecretInput {
  const doc = root.ownerDocument
  const input = doc.createElement('input')
  input.type = 'text'
  input.className = 'secret-input'
  input.setAttribute('aria-label', options.label ?? 'type a secret')
  input.setAttribute('autocomplete', 'off')
  input.setAttribute('autocapitalize', 'off')
  input.setAttribute('autocorrect', 'off')
  input.spellcheck = false
  if (options.placeholder) input.placeholder = options.placeholder

  const onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Enter') return
    const value = input.value.trim()
    if (value.length === 0) return
    options.onSubmit(value)
    input.value = ''
  }
  input.addEventListener('keydown', onKeyDown)
  root.appendChild(input)

  return {
    input,
    dispose() {
      input.removeEventListener('keydown', onKeyDown)
      input.remove()
    },
  }
}
