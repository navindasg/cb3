// The hallucination (Phase 5 — hidden boss 3, DESIGN §17/§28). Pure config the hallucination sim
// (engine/content/hallucination) reads. Behind the SECOND panel in the context window's dark little room —
// the one the notes warned you was "genuinely not fine" — lives the thing that has been reading the design
// notes alongside you. It fights with FAKE UI: counterfeit buttons that do nothing, false damage numbers,
// and an HP bar that lies about how close it is to death. The joke is the fourth wall; the rule is that the
// LIES NEVER CHANGE WHAT IS TRUE. The fight is HONEST underneath — real HP, real damage, grid-searched
// winnable — and the deception is a solvable puzzle, not noise. It teaches you, by killing you, to distrust
// the interface and trust the mechanic.
//
// DELIBERATE MODEL CHOICE: a DISCRETE, deterministic single-foe read fight (no RNG, no rAF) — the
// boarding/reflection/wolf family (a per-turn read with feints), but a DISTINCT AXIS: TRUST, and no weapon
// race. You do not out-HIT a hallucination — it has no body, only its lies — so the counter is a FIXED chip
// (weapon-INDEPENDENT: every build fights it identically). The whole fight is the read. Each turn the thing
// "attacks" and its counterfeit UI SHOWS a damage number beside the TRUE damage it will actually deal. You
// BELIEVE the UI (brace for exactly what it showed — a clean block + counter ONLY if it was telling the TRUTH;
// a LIE slips past your brace and the true blow lands) or DISBELIEVE it (ignore the number, trust the mechanic
// — a clean block + counter ONLY if it was LYING; on an honest turn your distrust leaves you open). The pattern
// is an even mix: it LIES (shown != trueDmg — DISBELIEVE) and DOUBLE-BLUFFS (shown == trueDmg — BELIEVE) in
// equal measure, so neither reflex works. Naive trust-the-UI (always BELIEVE the numbers) LOSES; the reflexive
// cynic (always DISBELIEVE) ALSO LOSES (the double bluffs punish it); ONLY reading the cadence — trusting the
// mechanic, not the interface — WINS. Grid-searched (see the engine test) so believe-all and disbelieve-all
// both lose and clean reads win at EVERY build (bare hands included — a fair, honest fight; the READ is the
// whole game). It mirrors engine/content/cloudWolf's proven spine, re-flavored around the trust axis.
//
// The drop is the FOURTH-WALL FRAGMENT (a keepsake): a shard of the counterfeit interface, still faintly
// drawing a button that isn't there. Its "one real secret per day" effect (DESIGN §18) is DEFERRED — no such
// system exists yet, so it banks as a trophy, like the acorn / kraken crown. Commit-once via the cleared flag
// (the kraken/boarding idiom). Pure ASCII throughout (it lands in the monospace <pre> grid; the glow is CSS).

// The cleared flag lives in content/flags (the single-source-of-truth registry). Re-exported here so this
// module is the one place the hallucination's data hangs together; the engine re-declares the same literal in
// lock-step (the moonStrata idiom, ADR §3).
export { HALLUCINATION_DEFEATED_FLAG } from '@/content/flags'

// --- the second-panel framing (the render draws these; pure ASCII data) ---------------------------------------

/** The dedicated fight screen's heading. */
export const HALLUCINATION_HEADING = 'the second panel'

/**
 * The blurb at the sealed second panel, before you open it — signposted at the foot of the notes. Replaces the
 * old SECOND_PANEL_STUB (kept for back-compat) now that the panel actually opens. Dry, uneasy, never smug.
 */
export const SECOND_PANEL_BLURB =
  'A second panel is set into the back wall, smaller, unlabelled. Something breathes behind it, unevenly, and does not want to be looked at directly. The stencil on the first panel said it was fine. The note at the bottom of the terminal said this one is not. There is, of course, no lock.'

/** The button that opens the second panel (and starts the fight). */
export const OPEN_SECOND_PANEL_LABEL = 'open the second panel'

/** The blurb the moment the fight begins — it steps out drawing its own interface. */
export const HALLUCINATION_INTRO =
  'It unfolds out of the dark and draws itself an interface as it comes: buttons, bars, numbers, all in a hand exactly like the game\'s. It hits you with a damage figure. Then it hits you with a different one, for the same blow. Its health bar fills as you hurt it. NONE OF IT IS TRUE, and all of it is on the screen. Do not read the numbers. Read the thing. Each turn it tells you a number it means to deal: BELIEVE it (brace for exactly that, and take nothing IF it was honest) or DISBELIEVE it (ignore it and counter, and take nothing IF it was lying). It lies as often as it tells the truth. Learn which is which.'

/** The victory blurb (first win — the fragment is granted). */
export const HALLUCINATION_WON_FIRST =
  'You stop reading the numbers, and read the thing, and once you are doing that it comes apart quickly — a counterfeit was only ever going to hold up until you stopped believing it. It leaves a single shard on the floor of the little room, still faintly drawing a button no bigger than a fingernail. You pick it up. You press the button. Nothing happens. You keep it anyway.'

/** The victory blurb (a rematch — already looted). */
export const HALLUCINATION_WON_AGAIN =
  'You read it again, and it comes apart again, faster this time. There is nothing left to take — you already have the shard, and the shard is still drawing its little button that does nothing. The panel goes quiet. Whatever was in here has said its piece.'

/** The calm room, once beaten and not re-entered to fight. */
export const HALLUCINATION_CALM =
  'The second panel hangs open on an empty space the size of a cupboard. Nothing breathes in it now. The terminal in the outer room is still running, still scrolling its notes, still, presumably, being read by something. But not, anymore, in here.'

export type TrustAction = 'believe' | 'disbelieve'

/**
 * One beat of the hallucination's repeating attack pattern. `shown` is the damage number its counterfeit UI
 * DISPLAYS (the number the render draws on the fake button); `trueDmg` is what the blow ACTUALLY costs you if
 * it lands. When `shown !== trueDmg` it is LYING (DISBELIEVE it — trust the mechanic, take zero, counter); when
 * `shown === trueDmg` it is telling the truth, a DOUBLE BLUFF (BELIEVE it — brace exactly and take zero). The
 * honest (double-bluff) turns carry the heaviest true blows, so a UI-truster eats exactly the hits that matter.
 */
export interface HallucinationBeat {
  /** The damage its counterfeit UI shows (what the render draws). Never read by the outcome. */
  readonly shown: number
  /** The damage the blow actually deals if it connects (what the engine + outcome read). */
  readonly trueDmg: number
}

/** Your HP for the fight (a flat pool; it reads no armour, and — deliberately — no weapon). Tight enough that
 * eating a few of the heavy honest blows is fatal — the read has to matter. */
export const HALLUCINATION_PLAYER_HP = 18

/** The hallucination's TRUE HP. Grid-searched (see the engine test) so clean reads see it off well inside the
 * clock (~turn 6) for every build, but a sloppy read runs out of HP or clock first. */
export const HALLUCINATION_HP = 48

/**
 * Your chip on a correct read (whichever kind) — a FLAT, weapon-INDEPENDENT counter. You do not out-hit a
 * hallucination (it has no body, only lies), so a bigger blade buys you nothing here: the whole fight is the
 * read. Every build fights it identically — grid-searched (the engine test runs the balance contract across
 * the whole forge ladder AND bare hands, all equal). A wrong read chips nothing and eats the true blow.
 */
export const COUNTER = 8

/** The hallucination wears you down (a loss) if it is not down within this many exchanges — you cannot stall
 * forever behind clean reads. Tuned so a perfect read (~turn 6) has margin but sloppy play runs out the clock. */
export const MAX_TURNS = 18

/**
 * How the counterfeit HP BAR lies. The bar the screen DRAWS shows `HP_BAR_LIE_MAX - trueHp` clamped to
 * [0, HP_BAR_LIE_MAX] — i.e. it runs BACKWARDS: it looks nearly full when the thing is nearly dead, and drains
 * toward empty as you actually win. It is pure decoration — the engine exposes it as `shownFoeHp` but the
 * OUTCOME only ever reads the true HP. A player who watches the bar instead of the fight will think they are
 * losing right as they win. Chosen as (max - true) so the lie is legible (a clean inversion), never random noise.
 */
export const HP_BAR_LIE_MAX = HALLUCINATION_HP

/**
 * The hallucination's attack pattern — a fixed, repeating sequence (loops if the fight runs long). An EVEN mix
 * of LIES (shown != trueDmg — DISBELIEVE them) and DOUBLE-BLUFFS (shown == trueDmg — BELIEVE them), so neither
 * reflex (always-believe, always-disbelieve) works: you must read each turn. The honest (double-bluff) turns
 * carry the heaviest true blows (6, 7), so a UI-truster eats the hits that matter; the lies over-promise (their
 * shown numbers are dramatic) while dealing less. A veteran learns the cadence. §22-open tuning.
 */
export const HALLUCINATION_PATTERN: readonly HallucinationBeat[] = [
  { shown: 9, trueDmg: 3 }, // a lie: it CLAIMS a huge hit, actually a sting — DISBELIEVE
  { shown: 6, trueDmg: 6 }, // the TRUTH (a double bluff): the real, heavy number, shown honestly — BELIEVE
  { shown: 8, trueDmg: 3 }, // a lie — DISBELIEVE
  { shown: 7, trueDmg: 7 }, // the TRUTH (a double bluff): the heaviest, shown honestly — BELIEVE
  { shown: 9, trueDmg: 3 }, // a lie — DISBELIEVE
  { shown: 6, trueDmg: 6 }, // the TRUTH (a double bluff) — BELIEVE
  { shown: 8, trueDmg: 3 }, // a lie — DISBELIEVE
  { shown: 7, trueDmg: 7 }, // the TRUTH (a double bluff) — BELIEVE
]
