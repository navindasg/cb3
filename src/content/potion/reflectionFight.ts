// Your reflection (Phase 5 — hidden boss 2, the X-potion homage, DESIGN §17/§18). Pure config the reflection
// sim (engine/content/reflectionFight) reads. Drink the mirror potion (brewed cold at the cauldron from a
// sugar-glass shard, one chocolate, and exactly one candy) and the thing that steps out of the pot is you —
// your face, your blade, your reach, your whole build. It fights EXACTLY how you fight: it reads the same
// equipped hand weapon you do (damage + double-strike), and every gummy in your army stands behind it as it
// stands behind you (bonus HP for both). A perfect mirror.
//
// DELIBERATE MODEL CHOICE: a DISCRETE, deterministic GUARD/LUNGE fencing duel (no RNG, no rAF) — the boarding /
// cloud-wolf family, but SYMMETRIC BY CONSTRUCTION. Both sides open at the same HP and hit for the same numbers,
// so a bigger blade can never win by being bigger — it only makes the mirror bigger too. What breaks the tie is
// the READ: the reflection strikes along a fixed telegraphed line (with feints — it lies with its body, the way
// you would), and each turn you GUARD the line you read (block it clean + riposte for chip) or LUNGE (commit for
// big damage, but the mirror's cut always lands). Naive all-LUNGE just trades blow for blow with something that
// hits exactly as hard as you and never flinches — and in a dead-even trade the mirror comes out ahead (it wins
// the simultaneity: it does not blink), so greed loses. You have to out-read it: guard the heavy cuts, and only
// lunge into the light feints. Grid-searched (see the engine test) so all-LUNGE LOSES for every build, a maxed
// build makes a maxed mirror (still winnable, never trivial), and clean reads win. Win before it wears you out
// (MAX_TURNS); lose and you just wake at the cauldron, potion spent.
//
// The drop is the PARADOX PIN (a keepsake that changes an equip RULE — with it pinned you may wear two hats at
// once; the game does not otherwise let you). Commit-once via the cleared flag (the kraken/boarding idiom); the
// potion consumes its ingredients on the brew, so a lost fight costs you the draught, not the pin.

export type ReflectionLine = 'high' | 'low'

/**
 * One cut in the reflection's repeating pattern. `tell` is the line it SHOWS (the telegraph the screen draws);
 * `line` is where the blade ACTUALLY lands (a FEINT when tell != line); `dmg` is the BASE cost if it connects
 * (before the mirror's weapon scaling — see the engine). The high cuts bite harder — those are the ones to
 * guard, not lunge into. Mostly honest, with two feints (a light one and the dangerous one), like the boarding
 * bout — a first-time fighter reads the tell and gets caught; a veteran learns the cadence.
 */
export interface ReflectionCut {
  readonly tell: ReflectionLine
  readonly line: ReflectionLine
  /** BASE damage; the engine scales it by the mirror's own weapon so the fight stays symmetric. */
  readonly dmg: number
}

/**
 * Your base HP for the duel (a flat pool; the fight reads no hull/armour, just the hand weapon + your gummy
 * army). Kept modest so eating the dangerous feint a couple of times is nearly fatal — the read has to matter.
 * Both you AND the mirror open at this pool plus the gummy bonus, so the two are identical by construction.
 */
export const REFLECTION_BASE_HP = 20

/**
 * Every gummy in your army (worm + sour-fused + mint-fused) adds this much HP to BOTH sides — it stands behind
 * you AND behind the mirror. Symmetric, so growing an army raises the whole fight's HP without ever tilting it.
 * Small per head, so a big army lengthens the bout (more turns to grind an even pool down) rather than deciding it.
 */
export const HP_PER_GUMMY = 2

/**
 * Your riposte / lunge damage = this factor x weapon.damage x strikes. A LUNGE hits far harder than a blocked
 * RIPOSTE, but a lunge means you do not guard — the mirror's cut always lands. The mirror ripostes + lunges by
 * the SAME factors off the SAME weapon, so aggression is a perfectly even trade (which the mirror wins on the
 * simultaneity tiebreak — see the engine's foe-first ordering). Read, and you take zero while it bleeds.
 */
export const RIPOSTE_FACTOR = 1
export const LUNGE_FACTOR = 2

/** The reflection's cut damage = this factor x its weapon.damage x strikes, PLUS the cut's base dmg. Scaling the
 * bite by the mirror's own blade is what keeps a heavier weapon from making the fight easier: a bigger you means
 * a bigger cut coming back. Tuned (with the pattern + HP) so all-lunge loses and clean reads win. */
export const CUT_WEAPON_FACTOR = 1

/** A weapon whose cooldown is under this (ms) strikes TWICE — the whip's niche, same as the sibling fights. Both
 * sides read it off the same equipped weapon, so a fast blade doubles the mirror's swings too. */
export const FAST_COOLDOWN_MS = 400

/** The mirror wears you out (a loss) if it is not down within this many exchanges — you cannot out-turtle
 * yourself. Tuned so all-guard chip is just too slow to grind an even, army-swollen pool inside the clock. */
export const MAX_TURNS = 22

/**
 * The reflection's bout — a fixed, repeating cut pattern (loops if the duel runs long). Mostly honest, with two
 * feints: a light one (idx 2, shows high / cuts low — cheap to be fooled) and the DANGEROUS one (idx 5, shows
 * low / cuts high — punishes guarding by the tell). The high cuts (base 3) are the ones to guard; the light cuts
 * (base 1) are safe to lunge into. It fights how you fight, so it fights dirty exactly as often as you would.
 * §22-open tuning.
 */
export const CUT_PATTERN: readonly ReflectionCut[] = [
  { tell: 'high', line: 'high', dmg: 1 },
  { tell: 'high', line: 'low', dmg: 6 }, // an EARLY dangerous feint — a tell-reader eats it before a fast blade can win
  { tell: 'low', line: 'low', dmg: 1 },
  { tell: 'low', line: 'high', dmg: 6 }, // the other dangerous feint — shows low, cuts high
  { tell: 'high', line: 'high', dmg: 1 },
  { tell: 'high', line: 'low', dmg: 2 }, // a lighter feint — still stings the tell-reader
  { tell: 'low', line: 'low', dmg: 1 },
  { tell: 'low', line: 'high', dmg: 2 }, // another lighter feint
]
