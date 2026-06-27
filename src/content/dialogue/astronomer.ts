import type { DialogueDef } from '@/engine/types/defs'

// The astronomer's dialogue. Before you own the telescope he pitches it (and the grimoire).
// After the telescope is bought he murmurs about the stars — never once mentioning that the
// corner counter is now ticking DOWN (the game never says it; the number is the only tell).
//
// Act 3 (the observation deck, DESIGN §15/§189): once the observation gantry is raised (dysonStage4Done) he
// is changed for good. The grim variant is HIGHEST priority so it pre-empts every cheerful line — the man
// who has been comic relief for ~18 hours, every theory confident and wrong, finally says the one true
// thing, flatly: "They are not burning out. They are being eaten." It is the single place the whole game
// states the §15 larval-star truth aloud; everywhere else it is shown, never said.

export const ASTRONOMER_DIALOGUE: DialogueDef = {
  speaker: 'astronomer',
  nameKey: 'speaker.astronomer',
  variants: [
    {
      // After the observation gantry is up he has watched what the player has watched. He does not theorise
      // any more. Highest priority — it pre-empts the seed theories and the star murmur both, for good.
      id: 'starEaterGrief',
      lines: ['dialogue.astronomer.grim1', 'dialogue.astronomer.grim2', 'dialogue.astronomer.grim3'],
      requiresFlag: 'dysonStage4Done',
    },
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
