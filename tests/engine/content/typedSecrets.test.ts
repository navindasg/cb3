import {
  normalizeBuffer,
  matchTypedWord,
  matchKonami,
  MAX_BUFFER,
} from '@/engine/content/typedSecrets'
import { TYPED_WORDS, KONAMI_SEQUENCE } from '@/content/typedSecrets'

describe('normalizeBuffer', () => {
  it('lowercases, collapses whitespace runs and trims the leading edge', () => {
    expect(normalizeBuffer('  Candy   BOX ')).toBe('candy box ')
    expect(normalizeBuffer('STARLIGHT')).toBe('starlight')
  })
})

describe('matchTypedWord — suffix matching against the registered words', () => {
  it('fires when the word is the whole buffer', () => {
    expect(matchTypedWord('starlight', TYPED_WORDS)).toBe('starlight')
    expect(matchTypedWord('eclipse', TYPED_WORDS)).toBe('eclipse')
    expect(matchTypedWord('aniwey', TYPED_WORDS)).toBe('aniwey')
  })

  it('fires when the word is a trailing run after junk on a boundary', () => {
    // Typing anywhere on the page: garbage then the word (word at buffer end).
    expect(matchTypedWord('qwertystarlight', TYPED_WORDS)).toBe('starlight')
    expect(matchTypedWord('the word is candy box', TYPED_WORDS)).toBe('candy box')
  })

  it('matches the multi-word "candy box" (space included)', () => {
    expect(matchTypedWord('candy box', TYPED_WORDS)).toBe('candy box')
  })

  it('does NOT fire "candy box" from "box" alone, nor from mid-word', () => {
    expect(matchTypedWord('box', TYPED_WORDS)).toBeNull()
    // 'candy' typed but not yet 'box' — the multi-word secret must wait for the whole phrase.
    expect(matchTypedWord('candy', TYPED_WORDS)).toBeNull()
  })

  it('fires on a pure suffix even glued to preceding junk (the invisible box, CB2-faithful)', () => {
    // 'xaniwey' — 'aniwey' is a suffix, so it fires the moment the last letter lands, anywhere.
    expect(matchTypedWord('xaniwey', TYPED_WORDS)).toBe('aniwey')
  })

  it('does NOT fire once you keep typing past the word (no longer a suffix)', () => {
    // 'aniweyx' — the word is no longer the trailing run, so no fire.
    expect(matchTypedWord('aniweyx', TYPED_WORDS)).toBeNull()
  })

  it('returns null for an empty or unrelated buffer', () => {
    expect(matchTypedWord('', TYPED_WORDS)).toBeNull()
    expect(matchTypedWord('hello there', TYPED_WORDS)).toBeNull()
  })

  it('every registered word individually matches itself', () => {
    for (const word of TYPED_WORDS) {
      expect(matchTypedWord(word, TYPED_WORDS)).toBe(word)
    }
  })

  it('MAX_BUFFER is long enough to hold the longest registered word', () => {
    const longest = TYPED_WORDS.reduce((m, w) => Math.max(m, w.length), 0)
    expect(MAX_BUFFER).toBeGreaterThanOrEqual(longest)
  })
})

describe('matchKonami — arrow/letter sequence suffix', () => {
  it('fires on the exact sequence', () => {
    expect(matchKonami([...KONAMI_SEQUENCE], KONAMI_SEQUENCE)).toBe(true)
  })

  it('fires when the sequence is the tail after fat-fingering first', () => {
    expect(matchKonami(['left', 'a', ...KONAMI_SEQUENCE], KONAMI_SEQUENCE)).toBe(true)
  })

  it('does not fire on a partial or wrong sequence', () => {
    expect(matchKonami(['up', 'up', 'down'], KONAMI_SEQUENCE)).toBe(false)
    const wrong = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'a', 'b'] // b/a swapped
    expect(matchKonami(wrong, KONAMI_SEQUENCE)).toBe(false)
  })

  it('does not fire when fewer tokens than the sequence are present', () => {
    expect(matchKonami(['up'], KONAMI_SEQUENCE)).toBe(false)
    expect(matchKonami([], KONAMI_SEQUENCE)).toBe(false)
  })
})
