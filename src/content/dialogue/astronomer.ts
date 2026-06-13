import type { DialogueDef } from '@/engine/types/defs'

// The astronomer's dialogue. Before you own the telescope he pitches it (and the grimoire).
// After the telescope is bought he murmurs about the stars — never once mentioning that the
// corner counter is now ticking DOWN (the game never says it; the number is the only tell).

export const ASTRONOMER_DIALOGUE: DialogueDef = {
  speaker: 'astronomer',
  nameKey: 'speaker.astronomer',
  variants: [
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
