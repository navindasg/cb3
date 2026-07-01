// The star-eater (Act 4 — quest 13, the finale, DESIGN §198/§286/§3). Pure flavor + tuning the three-phase
// orchestrator (engine/content/starEater) and the new core-defense sim (engine/content/coreDefense) read.
//
// It has been coming the whole game; the sun is the last bright thing in this region. The final battle is
// fought in THREE phases that REUSE the three fight engines the game already built, so the player uses
// everything the game gave them (§198): (1) the BROADSIDE — the galleon at maxed hull/cannon/sail, reusing
// the shipDuel sim against a fresh escalated eater foe (NOT Sourbeard's numbers); (2) ON FOOT, on the
// creature itself, reusing the boarding melee against a higher eater HP so it reads as the climax, not a
// Sourbeard rerun; (3) the CORE — defending the egg over a fixed clock, a krakenFight-style telegraph-and-
// block variant. A phase win advances the cursor; any loss forfeits (transient, the shipDuel idiom).
//
// THE MID-FIGHT REVEAL (§3/§286): at the phase-2 -> phase-3 boundary the eater's HUD flickers in with its
// candy counter — "You have 8,101 stars." It eats stars the way you eat candies. It is you, at scale, never
// having stopped. The game makes that comparison EXACTLY once, here. The figure is content DATA; the string
// is surfaced through i18n; the one-shot presentation flag is engine state (eaterCounterShown), never a gate.
//
// DELIBERATE MODEL CHOICE: all three phases are DISCRETE, deterministic (no RNG, no rAF), TRANSIENT — the
// same family as every Act-2/3 fight. Grid-searched (the engine test) so naive play LOSES each phase and the
// FULL KIT (maxed ship tiers + a forged blade with clean reads) is REQUIRED to clear all three. Pure ASCII;
// the glow is CSS (.glow-sun on the silhouette, .glow-egg on the egg). Beating phase 3 sets starEaterDefeated
// (commit-once) and opens the choice (the next slice). §22-open tuning.

import type { GameTextKey } from '@/content/i18n/schema'

// --- PHASE 1: the broadside (reuses the shipDuel sim against a fresh eater foe) ------------------------

/**
 * The star-eater's "ship" HP for the broadside phase — far above the Black Lollipop's escalated rematches,
 * so a base/low-tier galleon cannot out-trade it inside the boarding clock: only the MAXED hull/cannon/sail
 * survive long enough and hit hard enough. Grid-searched (the engine test) so low tiers LOSE, maxed wins.
 */
export const EATER_SHIP_HP = 200

/**
 * The star-eater's broadside damage for phase 1 — heavy enough that a thin hull (low tier) is sunk before
 * it can grind the eater down, but a jawbreaker-plated hull with solar evasion can eat the trades it needs.
 */
export const EATER_SHIP_SHOT = 30

// --- PHASE 2: on foot, on the creature (reuses the boarding melee against a higher eater HP) -----------

/**
 * Your HP for the on-foot phase — a TIGHT pool (tighter than Sourbeard's 16), so eating the dangerous feint
 * is nearly fatal and a fast/heavy blade cannot simply out-trade the bout: it must read the feints or die to
 * the accumulated cuts before the higher-HP eater drops. Reads no armour, just the hand weapon. Grid-searched
 * (the engine test) so all-lunge LOSES for EVERY forged blade — the mace and the whip included (review).
 */
export const EATER_ONFOOT_PLAYER_HP = 12

/**
 * The star-eater's HP on foot — ABOVE Sourbeard's deck HP (64) so this reads as the climax, not a rerun, and
 * high enough that even the heaviest blade's all-lunge line must survive past the DANGEROUS feint (cut idx 5)
 * and dies to it. Grid-searched (the engine test) so bare hands + the bow + naive guard-by-the-tell + all-
 * lunge ALL LOSE for every forged blade, and a forged blade with clean reads wins inside the finale clock.
 */
export const EATER_ONFOOT_HP = 81

/**
 * The on-foot phase's OWN clock (longer than Sourbeard's MAX_TURNS=16) — the finale reuses the boarding sim
 * but on its own timer, so the higher eater HP wall is clearable by a slow forged blade with perfect reads
 * while the all-lunge line still dies to the dangerous feint. The boarding sim takes this as an override; the
 * live Sourbeard fight keeps its own 16-turn clock (this constant never touches it). Grid-searched (review).
 */
export const EATER_ONFOOT_MAX_TURNS = 22

// --- PHASE 3: the core defense (the new krakenFight-style telegraph-and-block sim) ----------------------

/**
 * The egg's hit points — what you are defending. The eater claws at it every turn from a telegraphed line;
 * a claw that lands chips the egg. Lose the egg (HP <= 0) and the phase is lost. Tuned (grid-searched) so
 * naive all-strike lets too many claws through and the egg dies; you must GUARD the telegraphed claws.
 */
export const EGG_HP = 60

/** Your HP for the core defense — a flat pool; the eater also rakes YOU when you fail to guard a claw. Tight
 * enough that an all-striker (who never guards, so the claw rakes you every turn) bleeds out before the eater
 * drops — even the heaviest blade (review: all-strike must lose for the mace and whip too, not just the weak
 * blades), while a clean reader is barely grazed. */
export const CORE_PLAYER_HP = 20

/**
 * The star-eater's HP for the core phase — what you whittle down by GUARDING (a blocked claw lets you chip
 * it) and STRIKING. Grid-searched (the engine test) so a forged blade clears it inside the clock with clean
 * reads, but naive all-strike (which never guards) loses the egg or bleeds you out first — for EVERY forged
 * blade, the mace and whip included (review), not merely the weakest two.
 */
export const CORE_EATER_HP = 66

/** A weapon whose cooldown is under this (ms) strikes/ripostes TWICE a turn — the whip's niche, as everywhere. */
export const CORE_FAST_COOLDOWN_MS = 400

/**
 * The damage a GUARDED claw lets you riposte = this factor x weapon.damage x strikes (you block the egg AND
 * bite the eater). A STRIKE deals STRIKE_FACTOR x damage x strikes but the claw rakes the egg unguarded.
 */
export const GUARD_RIPOSTE_FACTOR = 1
export const STRIKE_FACTOR = 2

/** What a claw does when it LANDS on the egg (you struck instead of guarding, or mis-read the feint). */
export const CLAW_EGG_DAMAGE = 9

/** What a claw also rakes off YOU when it lands (the eater is fast — failing to guard costs you too). Raised
 * (review) so the all-striker — who eats a claw EVERY turn — is bled out before a heavy/fast blade can race
 * the eater down: this is the lever that makes naive all-strike lose for the mace and the whip, not just the
 * weak blades. A clean reader almost never eats one, so it barely matters to the intended line. */
export const CLAW_PLAYER_DAMAGE = 7

/**
 * The eater's claw pattern for the core phase — a telegraphed high/low line per turn, mostly honest with two
 * feints (a cheap one and the DANGEROUS one that punishes guarding by the tell). The player GUARDS the line
 * the claw will ACTUALLY take; a STRIKE always lets the claw land. Loops if the phase runs long. The same
 * read-the-feint shape as the boarding melee, on a different stat axis (defending the egg, not your HP).
 */
export type ClawLine = 'high' | 'low'
export interface Claw {
  /** The line the eater SHOWS (the telegraph the screen draws). */
  readonly tell: ClawLine
  /** Where the claw ACTUALLY rakes (a FEINT when tell != line). */
  readonly line: ClawLine
}
export const CLAW_PATTERN: readonly Claw[] = [
  { tell: 'high', line: 'high' },
  { tell: 'low', line: 'low' },
  { tell: 'high', line: 'low' }, // a feint
  { tell: 'low', line: 'low' },
  { tell: 'high', line: 'high' },
  { tell: 'low', line: 'high' }, // the DANGEROUS feint — shows low, rakes high
  { tell: 'high', line: 'high' },
  { tell: 'low', line: 'low' },
]

/** The clock: the eater overwhelms the egg if you have not driven it off within this many turns. Long enough
 * (review) that a slow forged blade with perfect reads can whittle the raised eater HP down in time, while the
 * naive all-strike line still loses you/the egg first. */
export const CORE_MAX_TURNS = 20

// --- the mid-fight reveal (§3/§286 — the eater speaks in UI; made exactly once) ------------------------

/**
 * The star-eater's candy counter, surfaced once at the phase-2 -> phase-3 boundary. It is content DATA, not
 * a resource: the eater eats stars the way you eat candies. Exactly one more than the player's opening
 * 8,100-star sky read in DESIGN — the comparison made once. The string itself lives in i18n.
 */
export const EATER_STAR_COUNT = 8101

/** The i18n key for the §286 reveal line ("You have 8,101 stars."). The eater speaks in UI. */
export const EATER_COUNTER_KEY: GameTextKey = 'ui.eaterCounter'

// --- the screen's framing strings + the ASCII (pure glyphs; the glow is CSS) ----------------------------

/** The finale heading. */
export const STAR_EATER_HEADING = 'the star-eater'

/** The opening blurb — it has arrived, down the light, the way it was always going to. */
export const STAR_EATER_INTRO_BLURB =
  'It comes down the light after you, the way it has been coming the whole time, only now it is close enough to have a shape. It is bigger than the sun it is eating. It has no face you can find, only the long dark of a thing that has never once been full. Bring the galleon about. You have everything the road gave you. Use all of it.'

/** Phase 1 framing — the broadside, your fleet and army deployed alongside (flavor). */
export const PHASE_BROADSIDE_BLURB =
  'The candied galleon comes about with your work-crews on the yards and the gummy army packing the rail. Maxed hull, maxed guns, the solar sails drawing the last of the light. Trade broadsides with the thing and do not let it close enough to take you whole.'

/** Phase 2 framing — on foot, on the creature itself. */
export const PHASE_ONFOOT_BLURB =
  'The galleon grinds against its flank and holds. You go over the rail and onto the star-eater itself, the deck of it cold and slick and breathing, and there is nothing to fight it with now but the blade in your hand. Read it. Cut it. Do not stop.'

/** Phase 3 framing — back at the core, defending the egg, the eater clawing past you to reach it. */
export const PHASE_CORE_BLURB =
  'It knows what is in the core now, and it wants it. You put yourself between the egg and the long dark and you hold there while it rakes at the shell over your shoulder. GUARD the line it takes and you turn the claw and bite it back; let one through and the egg pays for it. Drive it off before it gets past you.'

/** Shown when the whole fight is won (phase 3 cleared) — the eater driven off, the egg intact. */
export const STAR_EATER_WON_BLURB =
  'The last of it pulls back off the egg and hangs there, and for a moment neither of you moves. It is not dead. A thing that only eats does not die; it goes still, and looks at you, and waits. The egg is warm and whole behind you. The light holds. It is your move now.'

/**
 * Shown when a phase is forfeit (a loss anywhere) — back to the start of the fight (transient, the duel idiom).
 * The redundant opening ("The cold long dark of it closes over the light and there is a silence with no bottom")
 * is intentionally trimmed here: the death epitaph rendered directly above already carries it (mirrors the
 * kraken-lost trim, which avoids reading the same phrase twice in a row).
 */
export const STAR_EATER_LOST_BLURB =
  'It gets through, and then you are back at the rail with the galleon coming about, because this is not a thing you are allowed to lose. Come at it again, with everything.'

/** The retry label after a forfeit. */
export const STAR_EATER_RETRY_LABEL = 'come about and face it again'

/** The label routing onward off the win — to the choice (the next slice). */
export const STAR_EATER_TO_CHOICE_LABEL = 'it is your move now'

/**
 * The star-eater silhouette — a long dark shape against the dying light, pure ASCII. It is deliberately
 * vast and vague (no face); the glow is .glow-sun on the light behind it.
 */
export const STAR_EATER_ART = [
  '          .  *      .        *    .',
  '     *   ___________________________   .',
  '       /                           \\__',
  '   .--<                               >--.',
  '       \\___________________________/',
  '        *        the long dark        *',
  '     .        *          .       *      .',
].join('\n')

/** The egg under threat in phase 3 — the thing you defend (glow .glow-egg). Pure ASCII. */
export const CORE_EGG_ART = [
  '          _ . - ~ - . _',
  '       ,\'               \'.',
  '      /                   \\',
  '     |     the egg.        |',
  '     |     keep it.        |',
  '      \\                   /',
  '       \'.     _ . _     ,\'',
  '         \' - . _   _ . - \'',
].join('\n')
