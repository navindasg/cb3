import type { DialogueDef } from '@/engine/types/defs'

// Grandma's dialogue (CB2 homage). On the first visit she greets you and presses the wooden
// spoon into your hands (the intro variant sets metGrandma + grants the spoon via wiring).
// On later visits she frets about the heirloom sword over the mantle — the foreshadow — but
// will not let you take it yet. Data only; selection lives in engine/content/dialogue.

export const GRANDMA_DIALOGUE: DialogueDef = {
  speaker: 'grandma',
  nameKey: 'speaker.grandma',
  variants: [
    {
      id: 'intro',
      lines: ['dialogue.grandma.intro1', 'dialogue.grandma.intro2', 'dialogue.grandma.spoonGift'],
      hiddenWhenFlag: 'metGrandma',
      setsFlag: 'metGrandma',
    },
    {
      id: 'mantleForeshadow',
      lines: ['dialogue.grandma.mantle1', 'dialogue.grandma.mantle2'],
      requiresFlag: 'metGrandma',
    },
  ],
}

/** The wooden-spoon grant is wired to the intro variant being shown (sets spoonOwned). */
export const GRANDMA_INTRO_VARIANT_ID = 'intro'

// --- the old days (Phase 5 — the ×3 attic secret, §288) ------------------------------------------
// Ask Grandma about the old days and she deflects, gently, twice — then on the third ask she goes quiet
// for a moment and nods at the ladder to the attic. The lines escalate: brushed off, a little wistful,
// then the door opening. The render layer shows the line for the current ask-count (mailbox.oldDaysAsked)
// and, on the ask that crosses the threshold, the "she nods at the attic ladder" beat. She never says she
// was the hero — the letters' signature does that (§288). Content data only; indexed by count, not walked.

/** The line Grandma gives on the Nth "ask about the old days" (index N-1). The last opens the attic. */
export const GRANDMA_OLD_DAYS_LINES: readonly string[] = [
  'dialogue.grandma.oldDays1',
  'dialogue.grandma.oldDays2',
  'dialogue.grandma.oldDays3',
]

/** The line shown once the attic is unlocked and she has nothing left to say about it (post-threshold). */
export const GRANDMA_OLD_DAYS_DONE_LINE = 'dialogue.grandma.oldDaysDone'
