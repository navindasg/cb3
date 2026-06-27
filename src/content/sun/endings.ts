// The endings (Act 4 — the choice, DESIGN §16/§200-204). Pure flavor + tuning the choice screen + the two
// terminal-state engines (engine/content/endings, engine/content/starCounter) read. This is the series-
// tradition finite, poignant ending: you have driven the star-eater off, the egg is whole, the light holds —
// and now you choose what to do with the thing under the sun. The choice is terminal (commit-once); each
// option is its own quiet gut-punch. The voice is melancholy turning to awe; pure ASCII, the glow is CSS
// (.glow-sun). §22-open tuning.
//
//  - ending 1 (LET IT HATCH): the poignant default. You let the dragon out. The sun goes dark; the dragon
//    ascends BURNING, and one by one it relights the stars the dyson scaffold ate. The counter ticks UP for
//    the first time in eighteen hours — a kingdom lit by candlelight, the night sky slowly refilling (§200/§202).
//  - ending 2 (FEED THE SUN): the warm melancholy status quo. You leave the egg sealed and feed the sun your
//    whole candy hoard so the dragon can sleep sated; the star-eater settles in as its guardian, and the sky
//    FREEZES exactly where it is, forever (§201/§203). The literal-number sacrifice is the deadpan gut-punch.
//  - ending 3 (EAT IT): shown-but-deferred (the next slice — the §367 light-remix / inverted-opening NG+).
//
// Both ending-1 and ending-2 effects run through the EXISTING starsRemaining + starCounter machinery — no new
// resource, no schema bump (the choice rides the strings z.record, the branches ride the flags z.record).

/**
 * The §22-open lifetime-candies-eaten threshold above which ending 3 (EAT IT) is offered as a SELECTABLE
 * option. A deadpan gate: you cannot eat the box until you have eaten enough to think like the thing that
 * does. Placeholder tuning (§22-open) — high enough that it is a deliberate choice, not a default. engine/
 * content/endings.canEatIt reads this; it is content CONFIG (data, not logic), imported the same way actGate
 * imports PEPPERMINT_GATE_AMOUNT (ADR §3-allowed).
 */
export const EAT_IT_THRESHOLD = 100_000

// --- the choice screen's framing -----------------------------------------------------------------------

/** The choice-screen heading. */
export const CHOICE_HEADING = 'your move'

/**
 * The choice-screen blurb — the star-eater driven off and waiting, the egg whole behind you, and the three
 * things you could do about the dragon under the sun. The dread of the whole game resolving into a quiet,
 * finite decision.
 */
export const CHOICE_BLURB =
  'The star-eater hangs in the dark and waits. It is not dead. Behind you the egg is warm and whole, the half-hatched dragon curled inside it keeping the light on the only way it knows how. The sky is still going out, a star at a time, the way it has all along. It is your move now, and there are only three.'

/** The §15 silhouette shown above the choice — the egg held in the dying light (glow .glow-egg). Pure ASCII. */
export const CHOICE_ART = [
  '          _ . - ~ - . _',
  '       ,\'               \'.',
  '      /     the egg.       \\',
  '     |     the light.       |',
  '      \\    your move.      /',
  '       \'.     _ . _     ,\'',
  '         \' - . _   _ . - \'',
].join('\n')

// --- ending 1: LET IT HATCH (the labels + the terminal scene) ------------------------------------------

/** The ending-1 button label — you crack the shell the rest of the way and let it out. */
export const HATCH_LABEL = 'let it hatch'

/** The ending-1 button's one-line description (shown under the option). */
export const HATCH_DESC =
  'Open the shell. Let the dragon out. The sun will go dark — but a dragon that has hatched can fly, and a dragon that can fly can put the stars back.'

/** The ending-1 terminal heading. */
export const HATCH_HEADING = 'and then there was light'

/**
 * The ending-1 terminal blurb — the sun goes dark, the dragon ascends burning, and it begins relighting the
 * eaten stars. A kingdom by candlelight, watching the sky come back. The counter ticking UP is the mechanical
 * payoff; this is the prose around it.
 */
export const HATCH_BLURB =
  'You open the shell, and the light goes out. For a long moment the whole region is dark, and cold, and silent, and you stand in your candlelit kingdom and think you have made a terrible mistake. Then something climbs up out of the dead sun — small, and gold, and burning now, properly burning, the way it could never burn while it was still inside. It does not look back at you. It goes up into the dark, and it finds the first cold place where a star used to be, and it lights it. And then the next. Look up. The sky is coming back.'

/**
 * The ending-1 terminal ASCII — the dragon ascending, burning, relighting the dark above. The glow is
 * .glow-sun (warm gold turning to awe). Pure ASCII.
 */
export const HATCH_ART = [
  '   *   .      *   .    *      .    *   .',
  '      .    *      .       *    .      *',
  '         *        /\\        .     *',
  '      .      *   /  \\   *      .       *',
  '           .    ( <> )      .      *',
  '       *      .  \\  /    *      .    *',
  '          .       \\/        .      *',
  '     *      it goes up, and it burns.      *',
].join('\n')

// --- ending 2: FEED THE SUN (the labels + the terminal scene) ------------------------------------------

/** The ending-2 button label — leave the egg sealed, feed the sun the hoard, let it sleep. */
export const FEED_LABEL = 'feed the sun'

/** The ending-2 button's one-line description (shown under the option). */
export const FEED_DESC =
  'Leave the shell sealed. Pour every candy you have ever saved into the light so the dragon can sleep on, sated and unhatched, and the star-eater can keep the watch. The sky stays exactly as it is.'

/** The ending-2 terminal heading. */
export const FEED_HEADING = 'and it sleeps'

/**
 * The ending-2 terminal blurb — the whole candy hoard poured into the sun (the literal save number, gone), the
 * dragon sleeping sated, the star-eater settling in as guardian, the sky frozen forever. Warm melancholy: the
 * status quo, held by sacrifice. The candy-zero is the deadpan gut-punch (your save number is now 0).
 */
export const FEED_BLURB =
  'You do not open the shell. You pour everything you have into the light instead — every candy you ever saved, the whole of it, gone in one long bright minute — and the dragon, fed, settles deeper into its egg and sleeps. The star-eater does not leave. It coils itself around the dead-still sun like a thing that has finally found something it does not want to swallow, and it keeps the watch. The counter stops. It will not fall again. It will not rise. The light holds, exactly as it is, for as long as you are willing to keep it warm.'

/**
 * The ending-2 terminal ASCII — the sealed egg with the star-eater curled around it as guardian, the light
 * held steady. The glow is .glow-sun. Pure ASCII.
 */
export const FEED_ART = [
  '        . - ~ ~ ~ - .',
  '     ,\'    _ . - . _   \'.',
  '    /    ,\'       \'.    \\',
  '   |    /  sealed.  \\    |',
  '   |    \\  warm.    /    |',
  '    \\    \'. _ . _ ,\'    /',
  '     \'.    the watch  ,\'',
  '        \' - . _ _ . - \'',
].join('\n')

// --- ending 3: EAT IT (shown-but-deferred — the §367 light-remix NG+ is the next slice) -----------------

/** The ending-3 button label — eat the egg, the dragon, the light, all of it. */
export const EAT_LABEL = 'eat it'

/**
 * The ending-3 button's one-line description (shown under the option; only ENABLED once lifetimeCandiesEaten
 * passes EAT_IT_THRESHOLD). The §367 light-remix / inverted-opening NG+ dark save is the NEXT slice; this slice
 * shows the option (enabled or disabled) but the screen routes it to a "deferred" notice rather than the reset.
 */
export const EAT_DESC =
  'Do the one thing it does. Eat the egg, the dragon, the light, the whole warm impossible thing — and find out what is left of the world when you have. (This way is still being written.)'

/** The note shown when ending 3 is the still-deferred path (this slice). */
export const EAT_DEFERRED_NOTE =
  'That way is not open yet. The dark that comes after eating the last light is still being built.'

/** The note shown under a DISABLED ending-3 option — you have not eaten enough to think like the thing yet. */
export const EAT_LOCKED_NOTE =
  'You have not eaten enough, yet, to even consider it.'

// --- the choice/ending screen's misc labels -------------------------------------------------------------

/** The label returning from the choice to look at the aftermath again (no commitment). */
export const CHOICE_BACK_LABEL = 'not yet'
