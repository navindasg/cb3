// The boarding melee (Act 2 — quest 8's climax, DESIGN §127/§179). Pure config the boarding sim
// (engine/content/boardingDuel) reads. Beating Captain Sourbeard's BROADSIDE three times no longer just
// sends him running: on the third he grapples across and the fight DROPS TO ON-FOOT COMBAT on your deck —
// the one beat §127 calls out ("boarding actions drop into on-foot combat"). Man to man, it reads your
// EQUIPPED HAND WEAPON: damage scales both your riposte and your lunge, and a fast weapon (the whip)
// strikes twice. Reach does NOT matter here (unlike the kraken) — this fight rewards a heavy or quick
// blade, so the archetype that shines is different again.
//
// DELIBERATE MODEL CHOICE: a DISCRETE, deterministic GUARD/LUNGE fencing duel (no RNG, no rAF) — a third
// distinct axis after the broadside (range) and the kraken (reach): the READ. Sourbeard's stance TELEGRAPHS
// his next cut (high or low); usually the tell is true, but on a fixed cadence he FEINTS (tells one line,
// cuts the other). Each turn you GUARD a line (block it + riposte for chip if you read it right; eat the cut
// if you mis-read) or LUNGE (big damage, but you are committed — the cut always lands). Naive all-lunge eats
// every cut and dies; you must guard the heavy cuts and lunge only into the light ones. Win before his crew
// overruns you (MAX_TURNS). Grid-searched (see the engine test) so bare hands lose, all-lunge loses, and a
// forged blade with clean reads wins. Beating him here RETIRES the rival for good (the §17 consequence) and
// drops his tricorn + the gummy parrot (both +crew morale once that system exists — held as keepsakes now).

export type CutLine = 'high' | 'low'

/** One of Sourbeard's cuts in his repeating bout pattern. `tell` is the stance he SHOWS (the telegraph the
 * screen draws); `line` is where the blade ACTUALLY lands (a FEINT when tell != line); `dmg` is what it
 * costs you if it connects. The high cuts bite harder — those are the ones to guard, not lunge into. */
export interface Cut {
  readonly tell: CutLine
  readonly line: CutLine
  readonly dmg: number
}

/** numbers-namespace key: how many of Sourbeard's BROADSIDE encounters you have won. Shared with the duel
 * (content/ship/shipDuel.SOURBEARD_DEFEATS_KEY); the boarding only opens at the third. Re-exported here for
 * the screen's phase logic. */
export { SOURBEARD_DEFEATS_KEY } from '@/content/ship/shipDuel'

/** Your HP for the on-foot bout (a flat pool; this fight reads no hull/armour, just the hand weapon).
 * Deliberately tight, so eating the dangerous feint twice is nearly fatal — the read has to matter. */
export const BOARDING_PLAYER_HP = 16

/** Sourbeard's HP on the deck. Grid-searched so a forged blade with clean reads sees him off inside the
 * crew timer, but pure aggression (all-lunge) eats too many cuts first and dies — for everything up to the
 * iron sword; only a maxed blade can brute through (a maxed weapon should feel strong). */
export const SOURBEARD_MELEE_HP = 64

/** Your riposte / lunge damage = this factor x weapon.damage x strikes. A LUNGE hits far harder than a
 * blocked RIPOSTE, but a lunge means you do not guard — the cut always lands. */
export const RIPOSTE_FACTOR = 1
export const LUNGE_FACTOR = 2

/** A weapon whose cooldown is under this (ms) strikes TWICE — the whip's niche, same as the kraken fight. */
export const FAST_COOLDOWN_MS = 400

/** His crew swarms you (a loss) if Sourbeard is not down within this many exchanges — you cannot turtle
 * forever behind your guard. Tuned so all-guard chip is just too slow. */
export const MAX_TURNS = 16

/**
 * Sourbeard's bout — a fixed, repeating cut pattern (loops if the fight runs long). Mostly honest, with two
 * feints: a light one (idx 2, shows high / cuts low — costs little to be fooled) and the DANGEROUS one (idx
 * 5, shows low / cuts high — punishes guarding by the tell). A first-time fighter reads the stance and gets
 * caught by the feints; a veteran learns the cadence. The high cuts (4) are the ones to guard; the light
 * cuts (2) are safe to lunge into. §22-open tuning.
 */
export const CUT_PATTERN: readonly Cut[] = [
  { tell: 'high', line: 'high', dmg: 3 },
  { tell: 'low', line: 'low', dmg: 2 },
  { tell: 'high', line: 'low', dmg: 2 }, // a light feint — cheap to be fooled by
  { tell: 'low', line: 'low', dmg: 2 },
  { tell: 'high', line: 'high', dmg: 3 },
  { tell: 'low', line: 'high', dmg: 7 }, // the DANGEROUS feint — shows low, cuts high, hits like a mast
  { tell: 'high', line: 'high', dmg: 3 },
  { tell: 'low', line: 'low', dmg: 2 },
]
