import { createSecretInput } from '@/render/secretInput'

describe('createSecretInput', () => {
  it('creates a visible, focusable text input (mobile keyboard friendly)', () => {
    const root = document.createElement('div')
    createSecretInput(root, { onSubmit: () => {} })
    const input = root.querySelector('input') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.type).toBe('text')
    // not hidden / not disabled => focusable
    expect(input.disabled).toBe(false)
    expect(input.getAttribute('aria-hidden')).not.toBe('true')
  })

  it('has an accessible label', () => {
    const root = document.createElement('div')
    createSecretInput(root, { onSubmit: () => {}, label: 'type a secret word' })
    const input = root.querySelector('input') as HTMLInputElement
    expect(input.getAttribute('aria-label')).toBe('type a secret word')
  })

  it('does not autocomplete/autocorrect/spellcheck the secret', () => {
    const root = document.createElement('div')
    createSecretInput(root, { onSubmit: () => {} })
    const input = root.querySelector('input') as HTMLInputElement
    expect(input.getAttribute('autocomplete')).toBe('off')
    expect(input.spellcheck).toBe(false)
  })

  it('submits the typed value on Enter and clears the field', () => {
    const root = document.createElement('div')
    const submitted: string[] = []
    createSecretInput(root, { onSubmit: (v) => submitted.push(v) })
    const input = root.querySelector('input') as HTMLInputElement
    input.value = '  rocky  '
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(submitted).toEqual(['rocky']) // trimmed
    expect(input.value).toBe('')
  })

  it('does not submit an empty/whitespace-only entry', () => {
    const root = document.createElement('div')
    const submitted: string[] = []
    createSecretInput(root, { onSubmit: (v) => submitted.push(v) })
    const input = root.querySelector('input') as HTMLInputElement
    input.value = '   '
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(submitted).toEqual([])
  })

  it('ignores non-Enter keys', () => {
    const root = document.createElement('div')
    const submitted: string[] = []
    createSecretInput(root, { onSubmit: (v) => submitted.push(v) })
    const input = root.querySelector('input') as HTMLInputElement
    input.value = 'abc'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' }))
    expect(submitted).toEqual([])
  })

  it('dispose removes the input and detaches the listener', () => {
    const root = document.createElement('div')
    const submitted: string[] = []
    const handle = createSecretInput(root, { onSubmit: (v) => submitted.push(v) })
    const input = root.querySelector('input') as HTMLInputElement
    handle.dispose()
    expect(root.querySelector('input')).toBeNull()
    input.value = 'x'
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(submitted).toEqual([])
  })
})
