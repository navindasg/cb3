import {
  STAGE_ACCEL,
  STAR_DEATH_FRAMES,
  EATER_FAR,
  EATER_CLOSE,
  EATER_CLOSE_AT_STAGE,
} from '@/content/sun/observationDeck'

/** Every glyph must be printable ASCII or a newline (the no-emoji / monospace-grid rule). */
function assertPureAscii(rows: readonly string[]): void {
  for (const row of rows) {
    for (const ch of row) {
      const code = ch.codePointAt(0)!
      expect(ch === '\n' || (code >= 0x20 && code <= 0x7e), `non-ASCII glyph: ${JSON.stringify(ch)}`).toBe(
        true,
      )
    }
  }
}

describe('the observation deck content — STAGE_ACCEL tuning', () => {
  it('is a positive number that steepens but does not cliff the descent', () => {
    expect(STAGE_ACCEL).toBeGreaterThan(0)
    // Five stages -> 1 + STAGE_ACCEL*5; the brief tunes it so the descent roughly doubles across the act,
    // never an order-of-magnitude jump. Guard the spirit: ≤ a tripling at the top.
    expect(1 + STAGE_ACCEL * 5).toBeLessThanOrEqual(3)
    expect(1 + STAGE_ACCEL * 5).toBeGreaterThan(1.5)
  })
})

describe('the observation deck content — pure-ASCII frames (no emoji / unicode)', () => {
  it('the star-death frames are pure printable ASCII', () => {
    expect(STAR_DEATH_FRAMES.length).toBeGreaterThan(0)
    assertPureAscii(STAR_DEATH_FRAMES)
  })

  it('every eater silhouette is pure printable ASCII', () => {
    assertPureAscii(EATER_FAR)
    assertPureAscii(EATER_CLOSE)
  })

  it('each silhouette set keeps a single fixed row width (never raggeds the grid)', () => {
    for (const art of [STAR_DEATH_FRAMES, EATER_FAR, EATER_CLOSE]) {
      const width = art[0]!.length
      for (const row of art) expect(row.length).toBe(width)
    }
  })

  it('the star death reads as a fade-to-gone (first frame lit, last frame empty of the star)', () => {
    expect(STAR_DEATH_FRAMES[0]).toContain('*') // it burns
    expect(STAR_DEATH_FRAMES.at(-1)).not.toContain('*') // it is gone
  })
})

describe('the observation deck content — eater-distance stage threshold', () => {
  it('the silhouette closes within the deck span (it opens at stage 4, the cage closes at stage 5)', () => {
    // The deck spans exactly two scaffold stages: a fleck at 4, the descent at 5. The close threshold must
    // sit inside that span (4..5) so the silhouette is far when the deck opens and near once the cage closes.
    expect(EATER_CLOSE_AT_STAGE).toBeGreaterThan(4) // still a fleck on the deck's first stage
    expect(EATER_CLOSE_AT_STAGE).toBeLessThanOrEqual(5) // within the 5-stage scaffold
  })
})
