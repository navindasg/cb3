// The cloud wolf (Phase 5 — hidden boss 1, DESIGN §17). Pure config the cloud-wolf sim
// (engine/content/cloudWolf) reads. A quiet dread hidden in a chore: shear the SAME cloud sheep seven times
// and it stops being a sheep. It was never a sheep. What unfolds out of the wool is a wolf the colour of a
// thunderhead, and it has been waiting to be found.
//
// DELIBERATE MODEL CHOICE: a DISCRETE, deterministic single-foe "read the pounce" duel (no RNG, no rAF) — the
// boarding-melee family (guard/lunge), pared to one creature and re-flavored. The wolf TELEGRAPHS its next
// move by its crouch: a LUNGE (it leaves the ground — meet it and it impales itself on your guard) or a SNAP
// (it feints low and bites — reading the crouch as a lunge and swinging early leaves you open). Each turn you
// STRIKE (commit to an attack: big damage, but its move always lands) or COUNTER a read (brace for the move
// you think is coming — if you read it right you turn the wolf and cut deep; if you mis-read, it hits and you
// do not cut). Naive all-strike trades blows and the wolf's teeth are faster; you must counter its heavy
// lunges and only strike into the light snaps. Win before it wears you down (MAX_TURNS). Grid-searched (see the
// engine test) so bare hands LOSE, all-strike LOSES for the common blades (the read is required), and a forged
// blade with clean reads wins. This is Act-1-gated content (the paddock), so it is tuned around the early
// forge ladder (spoon / wooden sword / iron sword / candy-cane bow) — the bow is no use in a snarling clinch.
//
// The drop is the WOLF-WOOL CLOAK (armour): worn, the storm front's charge can't find you — a LATE reward
// that retroactively trivializes an early climb (the curiosity payoff, never a gate; the storm was always
// beatable without it). Commit-once via the cleared flag (the kraken/boarding idiom).

export type WolfMove = 'lunge' | 'snap'

/**
 * One beat of the wolf's repeating pattern. `crouch` is the tell it SHOWS (the telegraph the screen draws);
 * `move` is what it ACTUALLY does (a FEINT when crouch != move); `bite` is what it costs you if it connects.
 * The lunges bite hard — those are the ones to COUNTER; the snaps are light and safe to STRIKE into.
 */
export interface WolfBeat {
  readonly crouch: WolfMove
  readonly move: WolfMove
  readonly bite: number
}

/** numbers-namespace keys tracking the shear STREAK on ONE sheep (which sheep, and how many times running).
 * Shearing the same sheep bumps the count; shearing a DIFFERENT one resets the streak (index, 1). At
 * SHEAR_TO_REVEAL the wolf is revealed. Two plain numbers — no schema bump (they ride the numbers z.record). */
export const WOLF_SHEAR_STREAK_INDEX_KEY = 'wolfShearStreakIndex'
export const WOLF_SHEAR_STREAK_COUNT_KEY = 'wolfShearStreakCount'

/** Shears of the SAME sheep that reveal the wolf. Seven — "it was never a sheep." */
export const SHEAR_TO_REVEAL = 7

/** Your HP for the clinch (a flat pool; this fight reads no armour, just the hand weapon). Tight enough that
 * eating the heavy lunge twice is nearly fatal — the read has to matter. */
export const WOLF_PLAYER_HP = 16

/** The wolf's HP. Grid-searched (see the engine test) so a forged blade with clean reads sees it off inside
 * the clock, but naive all-strike trades too badly and dies — for the common forged blades (wooden + iron
 * sword). Bare hands, grandma's spoon, and the bow (no use in a snarling clinch) cannot win at all: come armed
 * with a real blade. Only a fast whip or the heavy mace can brute past the read (a strong weapon feels strong).
 * Tuned around the early forge ladder, since the paddock is Act-1 content. */
export const WOLF_HP = 64

/** Your counter / strike damage = this factor x weapon.damage x strikes. A STRIKE hits far harder than a
 * blocked COUNTER, but a strike means you do not read — its move always lands. */
export const COUNTER_FACTOR = 1
export const STRIKE_FACTOR = 2

/** A weapon whose cooldown is under this (ms) strikes TWICE — the whip's niche, same as the other fights. */
export const FAST_COOLDOWN_MS = 400

/** The wolf wears you down (a loss) if it is not down within this many exchanges — you cannot turtle behind
 * counters forever. Tuned so all-counter chip is just too slow. */
export const MAX_TURNS = 16

/**
 * The wolf's pattern — a fixed, repeating sequence (loops if the clinch runs long). Mostly honest, with two
 * feints: a light one (idx 2, crouches to lunge / only snaps — cheap to be fooled) and the DANGEROUS one (idx
 * 5, crouches to snap / actually lunges — punishes reading the crouch by its face). A first-timer reads the
 * crouch and gets caught by the feints; a veteran learns the cadence. The lunges (4) are the ones to counter;
 * the snaps (2) are safe to strike into. §22-open tuning.
 */
export const WOLF_PATTERN: readonly WolfBeat[] = [
  { crouch: 'lunge', move: 'lunge', bite: 3 },
  { crouch: 'snap', move: 'snap', bite: 2 },
  { crouch: 'lunge', move: 'snap', bite: 2 }, // a light feint — cheap to be fooled by
  { crouch: 'snap', move: 'snap', bite: 2 },
  { crouch: 'lunge', move: 'lunge', bite: 3 },
  { crouch: 'snap', move: 'lunge', bite: 7 }, // the DANGEROUS feint — crouches to snap, then leaps for the throat
  { crouch: 'lunge', move: 'lunge', bite: 3 },
  { crouch: 'snap', move: 'snap', bite: 2 },
]
