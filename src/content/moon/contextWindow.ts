// The context window (§28) — a maintenance hatch on the moon's far side labeled "do not open (it's
// fine)". Inside: a terminal that scrolls THIS game's own design notes and "system prompt" — the
// developer's-computer homage from Candy Box 2, updated for how THIS game was actually made. Pure
// data the engine (engine/content/contextWindow) reads: the notes text, the hatch's framing strings,
// and the terminal's viewport height. No logic here; the scroll machine + the hatch flag live in the
// engine, the DOM in a coverage-excluded screen.
//
// Voice: self-aware, dry, honest — but NOT smug. It is the real story of how the thing was built, told
// plainly, in-fiction as a terminal you found behind a panel that said not to open it. Pure ASCII
// throughout (it lands in a monospace <pre> grid; the glow is CSS). It is a curiosity — it houses the
// hallucination (§17, a later slice), and it never blocks progress.

// The hatch reveal flag lives in content/flags (the single-source-of-truth registry). It is re-exported
// here so this module is the one place the moon-hatch's data hangs together; the engine re-declares the
// same literal in lock-step (the moonStrata idiom, ADR §3).
export { CONTEXT_HATCH_OPENED_FLAG } from '@/content/flags'

/** How many note lines the terminal shows at once (the scroll viewport height). */
export const VIEWPORT_LINES = 14

/** The hatch section's heading on the moon screen. */
export const HATCH_HEADING = 'the maintenance hatch'

/**
 * The stencilled label on the hatch. The whole joke: a panel that insists, a little too much, that it
 * is fine. (You are, of course, going to open it.)
 */
export const HATCH_LABEL = 'DO NOT OPEN (IT\'S FINE)'

/**
 * The hatch's ASCII stencil box — the first thing you see at the hatch, drawn in the monospace <pre>
 * grid. Derived from HATCH_LABEL so the border and the label row can NEVER drift out of alignment (the
 * grid is sacred — see the terminal's own housekeeping notes). One space of padding either side of the
 * label; the border matches the inner width exactly. Pure ASCII data; the render layer just prints it.
 */
export const HATCH_STENCIL: readonly string[] = (() => {
  const inner = ` ${HATCH_LABEL} `
  const bar = `+${'-'.repeat(inner.length)}+`
  return [bar, `|${inner}|`, bar]
})()

/** The closed-hatch blurb (before you open it). */
export const HATCH_CLOSED_BLURB =
  'Bolted to the moon\'s far side, half-buried in grey dust, is a service panel that does not belong to anything. A stencil across it reads: DO NOT OPEN (IT\'S FINE). There is no lock. There is nothing behind it that could possibly be your business.'

/** The opened-hatch blurb (once you have opened it — the terminal is inside). */
export const HATCH_OPENED_BLURB =
  'The panel swings open on a small dark space and a terminal you did not build, running since before you got here. A cursor blinks at you, patiently, as though it had been expecting the interruption. It is showing notes. They appear to be about you.'

/** The button that opens the hatch (the first time). */
export const OPEN_HATCH_LABEL = 'open it (it\'s fine)'

/** The button that steps into the terminal (once the hatch is open). */
export const ENTER_TERMINAL_LABEL = 'read the terminal'

/** The dedicated terminal screen's heading. */
export const TERMINAL_HEADING = 'the context window'

/**
 * The notes themselves — a terminal scroll of THIS game's design notes and "system prompt", in-voice.
 * Pure ASCII, one string per line, so the engine's scroll machine windows them into VIEWPORT_LINES at a
 * time. Blank strings are intentional spacers. It is honest about how the game was made (a lone build in
 * a text editor, an homage to two games by one person) and self-aware that YOU are reading it inside the
 * game it describes — dry, never smug. It signposts, but does not open, the hallucination it houses (§17).
 */
export const CONTEXT_WINDOW_LINES: readonly string[] = [
  '  candy box 3 :: context window',
  '  ---------------------------------------------',
  '  > cat design-notes.txt',
  '',
  '  # what this is',
  '',
  '  An honorary third candy box. The first two were',
  '  made by one person, aniwey, mostly alone, in a',
  '  browser, out of plain text and stubbornness. This',
  '  one is made the same way: monospace glyphs, a',
  '  handful of small files, no engine but the one you',
  '  are reading these notes inside of.',
  '',
  '  # the system prompt',
  '',
  '  You are a candy box. You contain candy. The candy',
  '  goes up over time. Sometimes the player eats it,',
  '  which is a mistake, and sometimes the player throws',
  '  it, which is also a mistake, and sometimes the',
  '  player saves it for a sword, which is the whole',
  '  point but nobody tells them that.',
  '',
  '  Be dry. Be a little sad. Never explain the ending.',
  '  Never use a bright colour where a dim one will do.',
  '  Never use a glyph the terminal cannot draw.',
  '',
  '  # the numbers',
  '',
  '  Everything is a resource in a ledger and a producer',
  '  that fills it. The whole game is one loop wearing a',
  '  hundred hats: a forest, a moon, a reef, a sun. The',
  '  counter in the corner is not a resource. It only',
  '  goes down. Try not to think about the counter.',
  '',
  '  # the star',
  '',
  '  There is a dragon at the bottom of all of it. There',
  '  always was, in every candy box. The fossil twitched.',
  '  The wyrm froze instead of hatching. The hollow at',
  '  the moon\'s centre was warm because something had',
  '  just left it. None of that was decoration.',
  '',
  '  Do not write the reveal down in words. Let the art',
  '  do it. If a player has to be told, it did not land.',
  '',
  '  # housekeeping',
  '',
  '  - no unicode. no emoji. the grid is sacred.',
  '  - never mutate the state. make a new one.',
  '  - a secret must reward curiosity, never gate it.',
  '  - if a boss can be cheesed, the cheese is a feature',
  '    right up until the tests catch it.',
  '',
  '  # note to self',
  '',
  '  There is something living in here with the notes.',
  '  It reads them too. It has started leaving the panel',
  '  open. When it talks to you it will lie about its own',
  '  health, and draw buttons that do nothing, and tell',
  '  you numbers that are not the numbers. None of the',
  '  lies will change what is true. The fight is fair.',
  '  It just does not look it.',
  '',
  '  (do not open the second panel yet. that one is',
  '  genuinely not fine. -- the dev)',
  '',
  '  > _',
]

/**
 * A stub the terminal shows in place of the hallucination's entry, until that boss ships (§17, the next
 * slice). Signposts the second panel without opening it — soft-lock-free, a curiosity only.
 */
export const SECOND_PANEL_STUB =
  'A second panel is set into the back wall, smaller, unlabelled. Something breathes behind it, unevenly, and does not want to be looked at directly. It is not fine. It is also, for now, sealed — you cannot get it open. Whatever leaves the notes open is not ready to meet you yet.'
