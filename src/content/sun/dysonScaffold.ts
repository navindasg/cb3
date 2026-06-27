import type { PriceLine } from '@/engine/types/defs'

// The dyson scaffold over the sun (Act 3 — the 5-stage build machine, DESIGN §186/§188). Pure data the
// engine (engine/content/dysonScaffold) reads. The sun is a colossal silent star; the scaffold is a thin
// lonely strut against it that grows, stage by sequential stage, into a cage. Each stage is funded with
// resources and, once raised, redraws the sun with one more ring of scaffold (the star visibly beginning
// to be caged). This is the §186 "idle wall, with dread": stage 1's ~1e9 price is a deliberate wall, and
// the reward — the first strut on the star — is the only payoff this slice.
//
// Stages whose reward slices have not yet landed stay `deferred:true` (shown locked so the wall ahead is
// legible). As of Increment 4, stages 1 (the solar collectors), 2 (the gummy work-crews) and 3 (the star
// sea) are all buildable; stages 4-5 (the observation deck / the descent port) remain deferred until their
// slices land. Their escalating prices (~x10/stage to ~1e12, folding in caramel/stardust in their own
// slices) are real. The numbers key holding the highest completed stage is `dysonStage` (default 0).
// §22-open tuning. Whoever runs the scaffold is terse and tired; the shipwright's bravado is gone.

/** numbers-namespace key holding the highest dyson stage completed (default 0 — nothing raised). */
export const DYSON_STAGE_KEY = 'dysonStage'

/** The total number of dyson scaffold stages — the whole §188 build. */
export const DYSON_STAGE_COUNT = 5

/** One stage of the dyson scaffold. Funded with `price` (every line paid), it sets `doneFlag` and bumps
 * the stage ledger to `stage`. `deferred` stages are shown but unbuyable until their reward slice supplies
 * the rest of their economy (the `note` says which). `art` is the scaffold overlay drawn once raised. */
export interface DysonStage {
  readonly stage: number
  readonly name: string
  /** Cost to raise this stage (every line must be paid; no partial spend). */
  readonly price: readonly PriceLine[]
  /** Content-owned save flag set when this stage is raised (lock-stepped in content/flags). */
  readonly doneFlag: string
  /** Shown but not yet buildable (its reward economy lands in a later slice); `note` says why. */
  readonly deferred?: boolean
  readonly note?: string
}

// --- the pure-ASCII sun + the scaffold rings ---------------------------------------------------------
// The base star is built from '(' ')' '|' '=' '#' '.' '*' only (NEVER the unicode sun glyph — it breaks the
// monospace grid and the reviewers reject it). The amber glow is CSS (render/glowOverlay's .glow-sun class
// on the <pre>), not characters. Each raised stage drops one more ring/strut overlay around the disc; the
// engine's sunArt assembles the base plus every completed stage's overlay, line by line at fixed width.

/** The sun's bare disc — a vast, silent star, before any scaffold. Pure ASCII; fixed-width rows. */
export const SUN_ART_BASE: readonly string[] = [
  '            . . . . .            ',
  '        . * * * * * * * .        ',
  '      . * * * * * * * * * .      ',
  '    . * * * * * * * * * * * .    ',
  '    * * * * * * * * * * * * *    ',
  '   * * * * * * * * * * * * * *   ',
  '    * * * * * * * * * * * * *    ',
  '    . * * * * * * * * * * * .    ',
  '      . * * * * * * * * * .      ',
  '        . * * * * * * * .        ',
  '            . . . . .            ',
] as const

/**
 * The scaffold overlay raised at each stage, indexed 1..5. A stage's overlay is a sparse grid of struts
 * laid OVER the sun's rows (a non-space char in the overlay replaces the sun char at that cell). Stage by
 * stage the cage closes: stage 1 lays the first two struts down the sides; later stages (deferred until
 * their slices) ring it round. All pure glyphs: '(' ')' '|' '=' '#'. Index 0 is unused (no stage 0).
 */
export const SCAFFOLD_OVERLAY: readonly (readonly string[])[] = [
  [], // index 0 — no stage
  // stage 1 — the first lonely strut: two vertical members lashed down the star's flanks.
  [
    '                                 ',
    '                                 ',
    '   |                         |   ',
    '   |                         |   ',
    '   |                         |   ',
    '   |                         |   ',
    '   |                         |   ',
    '   |                         |   ',
    '   |                         |   ',
    '                                 ',
    '                                 ',
  ],
  // stage 2 — a ring closes top and bottom (the gummy work-crews, §261).
  [
    '       (=================)       ',
    '                                 ',
    '   |                         |   ',
    '   |                         |   ',
    '   |                         |   ',
    '   |                         |   ',
    '   |                         |   ',
    '   |                         |   ',
    '   |                         |   ',
    '                                 ',
    '       (=================)       ',
  ],
  // stage 3 — outer cross-bracing (the star sea / solar sails).
  [
    '                                 ',
    '        (               )        ',
    '   |     (             )     |   ',
    '   | =                     = |   ',
    '   |                         |   ',
    '   |                         |   ',
    '   |                         |   ',
    '   | =                     = |   ',
    '   |     (             )     |   ',
    '        (               )        ',
    '                                 ',
  ],
  // stage 4 — the observation gantry (deferred; the observation deck, §189).
  [
    '                                 ',
    '                                 ',
    '   |    #               #    |   ',
    '   |                         |   ',
    '   #                         #   ',
    '   #                         #   ',
    '   #                         #   ',
    '   |                         |   ',
    '   |    #               #    |   ',
    '                                 ',
    '                                 ',
  ],
  // stage 5 — the descent port, the cage all but closed (deferred; the bathysphere / the Act-3 gate).
  [
    '            #########            ',
    '       (## =========== ##)       ',
    '   |  #                   #  |   ',
    '   | =                     = |   ',
    '   #                         #   ',
    '   #                         #   ',
    '   #                         #   ',
    '   | =                     = |   ',
    '   |  #                   #  |   ',
    '       (## =========== ##)       ',
    '            #########            ',
  ],
] as const

// --- the five stages -----------------------------------------------------------------------------------
// Stage 1 is candy-DOMINANT (~1e9 candies + a rock-candy strut count): affordable from Act-2 income, and
// drawing NO caramel/stardust, so it can never soft-lock before those faucets exist. Stages 2-5 escalate
// ~x10/stage toward ~1e12 and fold caramel/stardust into their own slices; they are deferred:true here so
// they are shown locked (the wall ahead) but unbuyable until their reward economy lands.

export const DYSON_STAGES: readonly DysonStage[] = [
  {
    stage: 1,
    name: 'the first strut',
    price: [
      { resource: 'candies', amount: 1_000_000_000 },
      { resource: 'rockCandy', amount: 50_000 },
    ],
    doneFlag: 'dysonStage1Done',
  },
  {
    stage: 2,
    name: 'the lower ring',
    price: [
      { resource: 'candies', amount: 10_000_000_000 },
      { resource: 'rockCandy', amount: 200_000 },
      // caramel now has live faucets (Inc-0 cauldron boil floor + Inc-2 solar-caramel collector), so the
      // lower ring is the first strut to be sealed with it — the §111 caramel-industry step folded in.
      { resource: 'caramel', amount: 250 },
    ],
    doneFlag: 'dysonStage2Done',
    // Increment 3 — un-deferred: the gummy work-crews (this stage's reward) have landed, so the lower ring
    // is buildable. The candy economy is ~x100 from the stage-1 collectors, and caramel flows from Inc-0/2.
  },
  {
    stage: 3,
    name: 'the outer bracing',
    price: [
      { resource: 'candies', amount: 100_000_000_000 },
      { resource: 'rockCandy', amount: 800_000 },
    ],
    doneFlag: 'dysonStage3Done',
    // Increment 4 — un-deferred: the star sea (this stage's reward) has landed, so the outer bracing is
    // buildable. Raising it opens the star sea (the first passive stardust faucet) and flips the galleon's
    // long-deferred solar sails to buildable. The candy economy is ~x100 from the stage-1 collectors.
  },
  {
    stage: 4,
    name: 'the observation gantry',
    price: [
      { resource: 'candies', amount: 500_000_000_000 },
      { resource: 'rockCandy', amount: 3_000_000 },
    ],
    doneFlag: 'dysonStage4Done',
    deferred: true,
    note: 'needs the observation deck',
  },
  {
    stage: 5,
    name: 'the descent port',
    price: [
      { resource: 'candies', amount: 1_000_000_000_000 },
      { resource: 'rockCandy', amount: 10_000_000 },
    ],
    doneFlag: 'dysonStage5Done',
    deferred: true,
    // the §184-style Act-3 gate lands with this final build-out slice.
    note: 'needs the descent port build-out',
  },
]
