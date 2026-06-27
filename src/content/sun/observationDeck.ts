// The observation deck on the dyson scaffold (Act 3 — Increment 5, the stage-4 reward, DESIGN §15/§189).
// Pure config the deck engine (engine/content/observationDeck) and the scaffold screen read. Once the
// observation gantry is raised (dysonStage4Done) the scaffold opens a deck with a long telescope trained
// out past the sun. This is THE emotional core of the act, and the one place the game stops withholding.
//
// For ~18 hours the corner star counter has fallen and nobody has said why. The astronomer — comic relief
// since Act 0, every theory wrong, every theory confident — has insisted the stars are eternal. Here, on the
// deck, the player WATCHES one go out in real time (engine/content/observationDeck.witnessStarDie removes
// EXACTLY one star, once), the astronomer goes quiet, and the FIRST star-eater silhouette resolves in the
// glass: very far, very small, and — across the rest of the act, as the counter visibly accelerates —
// getting closer. The §15 larval-star spine is SHOWN (the dying star + the eater's shape), and stated in
// exactly one line, the astronomer's, which is the single place the whole game says it aloud.
//
// All glyphs are pure printable ASCII (NEVER the unicode star/sun — the reviewers reject it; the glow is the
// CSS .glow-sun class on the <pre>). All §22-open tuning. No logic here — the engine derives, the screen draws.

// --- the star-counter acceleration (a content CONFIG number the engine imports) -----------------------

/**
 * How much each completed dyson stage steepens the star counter's descent. The engine
 * (engine/content/starCounter.starDescentMultiplier) reads completed dysonStageN_Done flags and forms the
 * multiplier 1 + STAGE_ACCEL * stagesDone — so at stage 0 the rate is exactly the old MS_PER_STAR cadence
 * (back-compat: a save with no scaffold flags falls at the base rate), and by the late stages the number
 * the player ignored all game is visibly racing. Imported as content CONFIG, ADR §3-allowed exactly like
 * PEPPERMINT_GATE_AMOUNT. Tuned so the descent roughly DOUBLES across the five stages (×0.25 per stage →
 * up to ×2.25 at stage 5) — dread made mechanical, never a cliff. §22-open.
 */
export const STAGE_ACCEL = 0.25

// --- the scripted star-death frames (drawn once, the first time, on the deck) -------------------------
// A tiny pure-ASCII vignette: a single far star, seen through the glass, that flickers and then is simply
// gone — not a nova, not a fade, a swallow. Shown in sequence by the screen's one-shot the first time the
// player opens the deck (witnessStarDie). Each frame is one short fixed-width line; the screen prints them
// stacked so the eye reads top→bottom as time. Pure printable ASCII; no animation engine, just the stack.

/** The far star, before. A clean point of light in the dark of the glass. */
export const STAR_DEATH_FRAMES: readonly string[] = [
  '        .   *   .        ', //   it burns, small and steady
  '        .   *   .        ',
  '        .   +   .        ', //   it gutters
  '        .   .   .        ', //   it thins
  '        .       .        ', //   it is going
  '        .       .        ', //   it is gone
] as const

// --- the star-eater silhouette (very far, getting closer across the act) ------------------------------
// The shape the dying star leaves behind in the glass — a darkness with an outline, larger and nearer the
// further the act runs (the screen picks a stage by the dyson progress). NOT named, NOT explained anywhere
// but the astronomer's one line. It is the §15 truth, shown: the thing that hatched from the moon's hollow
// core (§15.2), grown, out among the stars, eating them. Three sizes — first sighting (a fleck), the act's
// middle (a mouth), and the descent (close enough to have edges). Pure printable ASCII.

/** First sighting — a fleck against the dark, almost nothing. Far. */
export const EATER_FAR: readonly string[] = [
  '                         ',
  '            .            ',
  '           (o)           ',
  '            \'            ',
  '                         ',
] as const

/** Middle of the act — a shape now, with a mouth. Closer. */
export const EATER_NEAR: readonly string[] = [
  '          _____          ',
  '        ,/     \\.        ',
  '       (   o    )        ',
  '        \\  vvv  /        ',
  '         `-----`         ',
] as const

/** The descent — close enough to have edges, and to fill the glass. It is not in a hurry. */
export const EATER_CLOSE: readonly string[] = [
  '     __,-~~~~~-,__       ',
  '   ,/   .     o   \\.     ',
  '  (    vvvvvvvvv    )    ',
  '   \\,   ^^^^^^^   ,/     ',
  '     `~-,_____,-~`       ',
] as const

// --- which silhouette resolves, by how far the cage has come ------------------------------------------

/** The dyson-stage thresholds at which the eater grows nearer in the glass. At stage 4 (the deck just
 * opened) it is a fleck; by stage 5 (the descent) it has a mouth and edges. The screen reads currentStage
 * against these. §22-open. */
export const EATER_NEAR_AT_STAGE = 5
export const EATER_CLOSE_AT_STAGE = 5
