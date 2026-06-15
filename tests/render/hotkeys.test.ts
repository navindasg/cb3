import {
  acceleratorKey,
  underlinedLabel,
  isTypingTarget,
  createHotkeyLayer,
} from '@/render/hotkeys'

describe('acceleratorKey', () => {
  it('lower-cases the character at the underlined index', () => {
    expect(acceleratorKey('Eat candies', 0)).toBe('e')
    expect(acceleratorKey('the Map', 4)).toBe('m')
  })

  it('returns "" when there is no accelerator', () => {
    expect(acceleratorKey('eat', -1)).toBe('')
    expect(acceleratorKey('eat', 9)).toBe('')
  })
})

describe('underlinedLabel', () => {
  it('splits the label around the accelerator letter', () => {
    expect(underlinedLabel('eat candies', 0)).toEqual({ before: '', letter: 'e', after: 'at candies' })
    expect(underlinedLabel('the map', 4)).toEqual({ before: 'the ', letter: 'm', after: 'ap' })
  })

  it('returns the whole label as before when there is no accelerator', () => {
    expect(underlinedLabel('back', -1)).toEqual({ before: 'back', letter: '', after: '' })
  })
})

describe('isTypingTarget', () => {
  it('treats inputs/textareas/selects and .noHotkeys elements as typing targets', () => {
    const input = document.createElement('input')
    expect(isTypingTarget(input)).toBe(true)
    const div = document.createElement('div')
    expect(isTypingTarget(div)).toBe(false)
    div.classList.add('noHotkeys')
    expect(isTypingTarget(div)).toBe(true)
    expect(isTypingTarget(null)).toBe(false)
  })
})

describe('createHotkeyLayer', () => {
  function press(key: string): void {
    document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  }

  afterEach(() => {
    document.body.replaceChildren()
  })

  it('fires the bound callback for a matching key (case-insensitive)', () => {
    const layer = createHotkeyLayer(document)
    let fired = 0
    layer.bind('e', () => (fired += 1))
    press('e')
    press('E')
    expect(fired).toBe(2)
    layer.dispose()
  })

  it('does not fire while a typing target is focused', () => {
    const layer = createHotkeyLayer(document)
    let fired = 0
    layer.bind('e', () => (fired += 1))
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()
    press('e')
    expect(fired).toBe(0)
    layer.dispose()
  })

  it('clearBindings drops every binding (screen switch)', () => {
    const layer = createHotkeyLayer(document)
    let fired = 0
    layer.bind('e', () => (fired += 1))
    layer.clearBindings()
    press('e')
    expect(fired).toBe(0)
    layer.dispose()
  })

  it('ignores modified keypresses and dispose detaches the listener', () => {
    const layer = createHotkeyLayer(document)
    let fired = 0
    layer.bind('e', () => (fired += 1))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', ctrlKey: true }))
    expect(fired).toBe(0)
    layer.dispose()
    press('e')
    expect(fired).toBe(0)
  })
})
