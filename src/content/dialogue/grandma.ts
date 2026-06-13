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
