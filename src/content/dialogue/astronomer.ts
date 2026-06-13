import type { DialogueDef } from '@/engine/types/defs'

// The astronomer's dialogue. Before you own the telescope he pitches it (and the grimoire).
// After the telescope is bought he murmurs about the stars — never once mentioning that the
// corner counter is now ticking DOWN (the game never says it; the number is the only tell).

export const ASTRONOMER_DIALOGUE: DialogueDef = {
  speaker: 'astronomer',
  nameKey: 'speaker.astronomer',
  variants: [
    {
      // After the falling star drops the seed (G1) the astronomer offers his theories — all
      // wrong, all delivered with total confidence. Highest priority so it pre-empts the
      // star murmur once the seed event has fired.
      id: 'seedTheories',
      lines: ['dialogue.astronomer.seed1', 'dialogue.astronomer.seed2', 'dialogue.astronomer.seed3'],
      requiresFlag: 'seedEventFired',
    },
    {
      id: 'postTelescope',
      lines: ['dialogue.astronomer.stars1', 'dialogue.astronomer.stars2'],
      requiresFlag: 'telescopeOwned',
    },
    {
      id: 'pitch',
      lines: ['dialogue.astronomer.pitch1', 'dialogue.astronomer.pitch2'],
    },
  ],
}
