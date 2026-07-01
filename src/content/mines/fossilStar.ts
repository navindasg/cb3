// The fossil-star superboss + the mines bookend (Phase 5 — ending 4, DESIGN §309/§16.4). Pure flavor +
// tuning the fossil-star engine (engine/content/fossilStar) reads. This is the poignant secret epilogue: the
// sugar-mines fossil the whole game opened on — the dead star you fed a single candy in Act 0 — relit at
// last, post-game, with 1000 stardust. The +1 tick is a GIFT (the only up-tick besides ending 1's relight),
// and the game's last image is the first dungeon's ceiling, glowing. Quiet, earned, series-tradition.
//
// The optional newborn-star fight is a lean STRIKE/STEADY range dance over the equipped hand weapon (the
// coreDefense/boarding stat model). It NEVER gates the tick — the ignited flag already carries the +1 — so
// it is pure flavor, a last dance, never a wall. Grid-searched (the engine test) so bare-hands all-strike
// LOSES inside the clock while a forged blade with a measured mix wins. Stepping back is always allowed.
// Pure ASCII; the glow is CSS (.glow-sun on the relit fossil, .glow-mines on the glowing ceiling). §22-open tuning.

import type { GameTextKey } from '@/content/i18n/schema'

// --- the ignite cost (the v8 stardust faucet — comet catches + the star-sea trawlers) ------------------

/**
 * The stardust the fossil accepts to relight — 1000, a hoard you only reach late (the comet catch grants a
 * handful per pass, the star-sea trawlers trickle it). Stardust is v8 with a LIVE faucet, so this is never a
 * dead gate; and it is post-game only, so it never blocks the main spine. engine/content/fossilStar reads
 * this; it is content CONFIG (data), imported the same way actGate imports PEPPERMINT_GATE_AMOUNT (ADR §3).
 */
export const FOSSIL_STAR_COST = 1000

// --- the optional newborn-star fight (a short transient STRIKE/STEADY dance) ----------------------------

/**
 * The newborn star's HP — what you whittle down in the dance. Tuned (grid-searched) so bare hands cannot drop
 * it under ANY line before the tight clock or your own HP runs out (bare-hands best play tops out below this),
 * while EVERY forged blade — the humble spoon included — with a measured mix of open swings and held ground
 * fells it in time. It is not a wall (the tick is already yours); it is a last, honest dance.
 */
export const NEWBORN_HP = 20

/**
 * Your HP for the dance — a tight pool, so an all-striker (who eats the flare every exchange) bleeds out
 * before a slow bare hand can grind the star down, while a forged blade that mixes in STEADY holds on.
 */
export const NEWBORN_PLAYER_HP = 20

/** The newborn's flare — what it rakes off you on any exchange you STRIKE (an open swing lets it land). A
 * STEADY exchange shields against it entirely. Tuned so all-strike bleeds the tight pool out on bare hands. */
export const NEWBORN_SHOT = 5

/** A weapon whose cooldown is under this (ms) strikes TWICE an exchange — the whip's niche, as everywhere. */
export const NEWBORN_FAST_COOLDOWN_MS = 400

/** A STRIKE deals this factor x weapon.damage x strikes (a big open swing) — but eats the flare. */
export const NEWBORN_STRIKE_FACTOR = 2

/** A STEADY exchange deals this factor x weapon.damage x strikes (a measured bite) — and shields the flare. */
export const NEWBORN_STEADY_FACTOR = 1

/**
 * The dance's clock: the newborn flares out (you held it long enough — a WIN by the star-down check, or a
 * timeout LOSS if you never dropped it) within this many exchanges. Long enough that a forged blade with a
 * measured mix fells the star's HP in time, tight enough that a slow bare hand cannot. Grid-searched (review).
 */
export const NEWBORN_MAX_TURNS = 14

// --- the fossil chamber's post-game framing (the ignite gate + the choice) ------------------------------

/** The post-game fossil-chamber heading extension shown once an ending is chosen (the fossil, warmer now). */
export const FOSSIL_STAR_HEADING = 'the fossil stirs'

/**
 * The post-game blurb — the fossil the game opened on was a dead star the whole time, and now, with the game
 * behind you and a hoard of stardust in hand, you could relight it. Understated wonder, not a grind.
 */
export const FOSSIL_STAR_BLURB =
  'You have seen the whole sky now, and the thing at the top of it. And here, at the bottom of the first dungeon you ever climbed down, is the fossil you fed a single candy the day you began. It was never a fossil. It was a star that went out a very long time ago, and lay down here in the dark to be forgotten. You have a hoard of stardust in your pockets now. You could give it back what it lost.'

/** The ignite-button label (spend the stardust; relight the fossil). */
export const FOSSIL_STAR_IGNITE_LABEL = 'give it back the light'

/** The note under a DISABLED ignite button — you have not gathered enough stardust yet. */
export const FOSSIL_STAR_SHORT_NOTE =
  'You do not have enough stardust, yet. Catch more comets; trawl the star-sea. It has waited this long.'

/** Logged/shown the moment the fossil ignites — the dead star takes the light back. */
export const FOSSIL_STAR_IGNITE_BLURB =
  'You pour the stardust into the fossil, all thousand grains of it, and for a moment nothing happens, the way nothing happened the day you fed it one candy. Then, deep inside the old dark rock, something remembers how. A light comes up in it — small, and then not small — and the chamber goes warm and gold, and far above you, all the way up the beanstalk, a new star is trying to be born.'

/** The post-ignite choice framing — the newborn wants out; do you hold it a moment, or let it go? */
export const FOSSIL_STAR_CHOICE_BLURB =
  'The newborn star strains against the rock, wild and bright and not at all sure of itself. You could stand between it and the shaft a while — dance with the thing you woke, hold it here in the dark where it began, just to feel it. Or you could step back, and let it go, and let it burn its way up through the beanstalk to where the other stars are, and take its place among them. It reaches the same sky either way.'

/** The "fight the newborn" button label. */
export const FOSSIL_STAR_FIGHT_LABEL = 'hold it a while'

/** The "step back and let it go" button label. */
export const FOSSIL_STAR_STEP_BACK_LABEL = 'let it go'

// --- the newborn-star fight's framing (a last dance) ----------------------------------------------------

/** The fight heading. */
export const NEWBORN_HEADING = 'the newborn star'

/** The fight's opening framing — a last dance, not a wall. */
export const NEWBORN_INTRO_BLURB =
  'It comes up out of the fossil half-formed and blazing, and it does not know its own strength. STRIKE it with everything and it flares back and burns you; STEADY, and you shield the flare but bite it smaller. Hold it here a while. Then let it go up.'

/** Shown when you hold the newborn long enough (the dance is won) — you let it go, up the shaft. */
export const NEWBORN_WON_BLURB =
  'You hold it, and hold it, until it steadies — until it is not a wild thing anymore but a small warm sun that knows what it is. Then you step back and open your hands, and it goes up the shaft, up the beanstalk, up past the garden and the clouds and the moon, and it finds the first cold place where a star used to be, and it stays.'

/** Shown when the newborn flares out from under you (a loss — but the tick is already yours, so it's a costless dance). */
export const NEWBORN_LOST_BLURB =
  'It slips your grip and flares up the shaft before you are ready, wild and untidy and gone — but it is gone UP, which is all that ever mattered. Somewhere far above, a cold place gets warm again. You could have held it longer. It does not seem to mind.'

/** The retry label after a loss (the dance is free — the star is already up either way). */
export const NEWBORN_RETRY_LABEL = 'the fossil is quiet again'

/** The label routing onward from the fight/step-back to the bookend. */
export const NEWBORN_TO_BOOKEND_LABEL = 'look up'

// --- a fossil-star death line (§19 — attaches to the death registry in P5-01) --------------------------

/** The i18n key for the newborn-star loss line (a soft, costless "loss" — the star still went up). */
export const FOSSIL_STAR_DEATH_KEY: GameTextKey = 'death.fossilStar'

// --- the bookend: the first dungeon's ceiling, glowing (the game's last image) --------------------------

/**
 * The final blurb — you climb back up, and the light has gone all the way up the beanstalk ahead of you, and
 * the very first thing you ever saw in this game — the low rough ceiling of the sugar mines — is glowing now,
 * warm and gold, the way it never was on the way down. The whole thing began and ended here. The bookend.
 */
export const MINES_BOOKEND_BLURB =
  'You climb back up the way you came, and the light climbs with you — up the shaft, up the beanstalk, up into the sky you spent so long watching go out. And when you reach the top of the mines, the very first place you ever stood, you stop, and you look up. The low rough ceiling of the sugar mines — the first thing you ever saw down here, cold and grey and forgettable — is glowing. Warm, and gold, and quiet. It has been here the whole time. So have you.'

/**
 * The glowing-ceiling ASCII — the low rough ceiling of the sugar mines, lit warm from the new star far above.
 * Rendered with the .glow-sun ink (the warm gold), a deliberate echo of the fossil-chamber's cold opening art.
 * Pure ASCII; the dots are rock-candy studding the rock, catching the light.
 */
export const MINES_BOOKEND_ART = [
  '  _/\\_.-`""`-._/\\_.-`""`-._/\\_.-`""`-._/\\_',
  ' /  .   *   .    .   *    .    .   *   .  \\',
  '|  *   the mines ceiling, glowing.   *    |',
  ' \\  .    *    .   .    *   .    .   *   . /',
  '  `-._/\\_.-`""`-._/\\_.-`""`-._/\\_.-`""`-`',
].join('\n')

/** The heading for the bookend frame. */
export const MINES_BOOKEND_HEADING = 'where it began'

/** The label leaving the bookend back to the map — the quiet end of the epilogue. */
export const MINES_BOOKEND_DONE_LABEL = 'back up into the light'
