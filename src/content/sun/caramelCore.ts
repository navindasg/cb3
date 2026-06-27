// The caramel core (Act 4 — quest 12, DESIGN §15/§196/§285). Pure flavor + tuning the reveal section
// (engine/content/caramelCore) reads. This is the emotional pivot of the whole game: the §15 larval-star
// spine, environmental all the way through, LOCKS into place. The core under the photosphere is not a
// furnace. It is an egg. Curled inside it, half-hatched and scared, is the solar dragon — and it is keeping
// the light on because that is what the egg does. CB1's dragon, CB2's dragon, the fossil in Grandma's mines,
// the frost wyrm in the ice, the warm hollow at the moon's centre — all of it, retroactively, was this.
//
// The reveal is SHOWN, never lectured: a short march of stages (molten caramel -> the last shell-layer ->
// the egg -> the dragon), each a pure transition the engine resolves, the truth carried by the art and the
// dragon's few SMALL words (§278) and the ambient callbacks, not a lore dump. The voice is melancholy
// turning to awe. No fight. No resource. No glyphs — pure ASCII, the glow is CSS (.glow-egg). §22-open.

import type { GameTextKey } from '@/content/i18n/schema'

/** The numbers-namespace key for the reveal's stage cursor (0 .. CORE_STAGES.length-1). Rides z.record. */
export const CORE_STAGE_KEY = 'caramelCoreStage'

/**
 * The reveal stages, in order. Index 0 is where you arrive (molten caramel); the LAST stage is the dragon,
 * the call that reaches it sets caramelCoreReached + solarDragonMet (commit-once). approachCore steps the
 * cursor one stage at a time and cannot skip (it advances by exactly one, gated on the prior).
 */
export type CoreStageId = 'molten' | 'shell' | 'egg' | 'dragon'
export const CORE_STAGES: readonly CoreStageId[] = ['molten', 'shell', 'egg', 'dragon']

/** The index of the final stage (the dragon) — reaching it is the commit-once beat. */
export const DRAGON_STAGE = CORE_STAGES.length - 1

// --- the ASCII art, one frame per stage (pure glyphs; the glow is the CSS .glow-egg class) -------------

/** Stage 0 — molten caramel. The bathysphere swaying in slow amber, the white thinning above. */
export const MOLTEN_ART = [
  '        ~ ~   ~ ~ ~   ~ ~',
  '     ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
  '   ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~ ~',
  '       ___',
  '      /   \\        the white thins,',
  '      \\   /        and below it: caramel,',
  '       \\_/         slow and dark and warm.',
].join('\n')

/** Stage 1 — the last shell-layer. Curved walls of cooled sugar, too smooth to be a furnace. */
export const SHELL_ART = [
  '      . - ~ ~ ~ - .',
  '   ,\'               \'.',
  '  /    a wall, curved   \\',
  ' |     and very smooth.   |',
  '  \\    too smooth for a  /',
  '   \'.    furnace.      ,\'',
  '      \' - . _ _ _ . - \'',
].join('\n')

/** Stage 2 — the egg. The whole core, seen for the first time as one held, curved, very old thing. */
export const EGG_ART = [
  '          _ . - ~ - . _',
  '       ,\'               \'.',
  '      /                   \\',
  '     |     it is an egg.    |',
  '     |                      |',
  '      \\                    /',
  '       \'.       _.       ,\'',
  '         \' - . _   _ . - \'',
].join('\n')

/** Stage 3 — the half-hatched solar dragon, curled in the shell, keeping the light on. */
export const DRAGON_ART = [
  '          _ . - ~ - . _',
  '       ,\'    /\\   /\\    \'.',
  '      /     (  o.o  )     \\',
  '     |       \\  ^  /       |',
  '     |    curled, small,   |',
  '      \\    half out of    /',
  '       \'.   the shell.  ,\'',
  '         \' - . _   _ . - \'',
].join('\n')

/** The art frame for a stage id. */
export const CORE_ART: Readonly<Record<CoreStageId, string>> = {
  molten: MOLTEN_ART,
  shell: SHELL_ART,
  egg: EGG_ART,
  dragon: DRAGON_ART,
}

// --- the prose for each stage (ambient, shown not stated; the §15 callbacks land here) ------------------

/**
 * The per-stage blurb. The dread of the molten descent gives way to the slow realisation across shell ->
 * egg -> dragon. The §15 callbacks (the fossil, the frost wyrm, the hollow moon core, CB1/CB2's dragons)
 * land as AMBIENT environmental text on the egg/dragon stages — recognition, never a lecture. The dragon's
 * own words are SMALL and live separately (DRAGON_WORDS); the prose only ever describes, it never explains.
 */
export const CORE_BLURB: Readonly<Record<CoreStageId, string>> = {
  molten:
    'The bathysphere settles into the caramel and stops. The white you fell through is somewhere above you now, a far ceiling. Down here it is dark, and slow, and warm — warm the way a thing is warm from the inside, not the way a fire is warm. There is no fire down here at all. You let the vessel drift closer.',
  shell:
    'The caramel curves away in front of you into a wall — a smooth one, pale and very hard, sweating slowly. You run the light along it. It is not the side of a furnace. Furnaces are not curved like this, and they are not smooth, and they do not flex, very slightly, when the heat behind them shifts. You have seen a curve like this before. You cannot, yet, think where.',
  egg:
    'You take the vessel up the curve and out, until the whole of it comes clear at once, and your hands go still on the controls. It is an egg. The core of the sun is an egg, held in the last of its shell, and the light of the star is only the warmth coming off it. You think of the fossil in the mines that twitched once. The wyrm in the ice that froze instead of hatching. The warm, empty hollow at the moon\'s dead centre, where something coiled and left. They were all this. They were all eggs.',
  dragon:
    'And then it moves. Curled against the inside of the shell, half out of it, no bigger than your house: a dragon, pale gold and translucent, its eyes too large and very afraid. It is keeping the light on. That is all it is doing — holding the warmth steady, the way the unhatched do, because that is what the egg is for and it does not yet know how to be anything else. It looks at the little cold vessel that came down out of its sky, and it is the one who is frightened.',
}

// --- the dragon's few small words (§278 — it speaks in single small words; surfaced via i18n) -----------

/** The dragon's lines, in order, revealed one per click on the dragon stage. SMALL words (§278). */
export const DRAGON_WORDS: readonly GameTextKey[] = [
  'dialogue.solarDragon.word1',
  'dialogue.solarDragon.word2',
  'dialogue.solarDragon.word3',
]

/** The dragon's speaker name key (unnamed, §22 — it is just "the dragon"). */
export const DRAGON_SPEAKER_KEY: GameTextKey = 'speaker.solarDragon'

// --- the screen's framing strings -----------------------------------------------------------------------

/** The reveal-section heading. */
export const CARAMEL_CORE_HEADING = 'the caramel core'

/** The "approach" button label — stepping one stage closer (the only verb in the scene). */
export const APPROACH_LABEL = 'go closer'

/**
 * The label on the final routing button (the dragon stage), onward to the star-eater's arrival. Terse: you
 * are not done here by choice; the sky has noticed you came down.
 */
export const LEAVE_CORE_LABEL = 'something is coming down the light after you'
