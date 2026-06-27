import {
  DESCENT_PORT_BLURB,
  DESCENT_BUTTON_LABEL,
  DESCENT_NOT_READY_NOTE,
  DESCENT_PORT_SHUT_BLURB,
} from '@/content/sun/descentPort'
import {
  DESCENT_MOTIF,
  DESCENT_LOOP_SECONDS,
  DESCENT_ENVELOPE,
  DESCENT_MASTER_GAIN,
} from '@/content/sun/descentAudio'

// The descent-port + descent-cue CONTENT (Act 4 — quest 11, DESIGN §194). Plain flavor/motif data the
// (coverage-excluded) finale screen + render audio glue read. We guard the data's SHAPE here (in voice, no
// emoji, a well-formed motif) so the asset-free cue stays sane even though the glue is never unit-run.

/** Prose blurbs may use the em dash (the project's voice), but must carry no emoji / pictographic glyph
 * that would break the monospace grid. (The strict printable-ASCII rule is reserved for grid ART.) */
function assertNoEmoji(text: string): void {
  // Match emoji / pictographs / dingbats / variation selectors — the glyphs that wreck the grid.
  const emojiLike = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u
  expect(emojiLike.test(text), `emoji-like glyph in: ${JSON.stringify(text)}`).toBe(false)
}

describe('the descent-port content — the blurbs (in voice, no emoji)', () => {
  const allText = [DESCENT_PORT_BLURB, DESCENT_BUTTON_LABEL, DESCENT_NOT_READY_NOTE, DESCENT_PORT_SHUT_BLURB]

  it('every string is non-empty', () => {
    for (const text of allText) expect(text.length).toBeGreaterThan(0)
  })

  it('every string carries no emoji / pictographic glyph (the monospace-grid rule)', () => {
    for (const text of allText) assertNoEmoji(text)
  })

  it('the descent button names the act of descending (lower / bathysphere / photosphere)', () => {
    const label = DESCENT_BUTTON_LABEL.toLowerCase()
    expect(label.includes('lower') || label.includes('descent') || label.includes('down')).toBe(true)
    expect(label.includes('photosphere') || label.includes('bathysphere')).toBe(true)
  })
})

describe('the descent-cue motif — a well-formed, short, looping chiptune', () => {
  it('loops on a short, positive length', () => {
    expect(DESCENT_LOOP_SECONDS).toBeGreaterThan(0)
    expect(DESCENT_LOOP_SECONDS).toBeLessThanOrEqual(12) // short by design — sound IS the event, not a track.
  })

  it('plays through a low master gain (the one sound in the game is grave, not loud)', () => {
    expect(DESCENT_MASTER_GAIN).toBeGreaterThan(0)
    expect(DESCENT_MASTER_GAIN).toBeLessThanOrEqual(0.5)
  })

  it('has a sane ADSR envelope (non-negative times, sustain in 0..1)', () => {
    const { attack, decay, sustain, release } = DESCENT_ENVELOPE
    expect(attack).toBeGreaterThanOrEqual(0)
    expect(decay).toBeGreaterThanOrEqual(0)
    expect(release).toBeGreaterThanOrEqual(0)
    expect(sustain).toBeGreaterThanOrEqual(0)
    expect(sustain).toBeLessThanOrEqual(1)
  })

  it('is a chiptune of at least one voice, each a recognized wave type', () => {
    expect(DESCENT_MOTIF.length).toBeGreaterThan(0)
    const waves: ReadonlySet<OscillatorType> = new Set(['square', 'triangle', 'sawtooth', 'sine'])
    for (const voice of DESCENT_MOTIF) {
      expect(waves.has(voice.wave)).toBe(true)
      expect(voice.notes.length).toBeGreaterThan(0)
    }
  })

  it('every note is positive, audible, and stays within one loop (no schedule runs past the loop)', () => {
    for (const voice of DESCENT_MOTIF) {
      for (const note of voice.notes) {
        expect(note.at).toBeGreaterThanOrEqual(0)
        expect(note.dur).toBeGreaterThan(0)
        expect(note.freq).toBeGreaterThan(0)
        expect(note.gain).toBeGreaterThan(0)
        expect(note.gain).toBeLessThanOrEqual(1)
        // The note must start within the loop window so the arpeggio reads as one repeating figure.
        expect(note.at).toBeLessThan(DESCENT_LOOP_SECONDS)
      }
    }
  })

  it('uses a square drone voice and a triangle arpeggio voice (the intended chiptune texture)', () => {
    const waves = DESCENT_MOTIF.map((v) => v.wave)
    expect(waves).toContain('square')
    expect(waves).toContain('triangle')
  })
})
