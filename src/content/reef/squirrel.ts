// The space squirrel at the rock candy reef (Act 2 — DESIGN §178/§339). It floats here in an
// acorn-shaped capsule, unimpressed it took you this long, and poses riddles: five plain ones and a
// meta-riddle that reaches back through the first two games. Answer them and it parts with the acorn
// of knowledge. Pure data the engine (engine/content/squirrel) reads. Riddles are MULTIPLE-CHOICE and
// answerable from their own wording — no outside knowledge required, the meta-riddle included (it is a
// wink, not a quiz). A wrong answer just earns a slow blink and a retry (no soft-lock). The squirrel's
// reward is chocolate (§88 "squirrel rewards") on each riddle; the acorn of knowledge on the last.

/** numbers-namespace key for how many riddles have been answered (0..SQUIRREL_RIDDLES.length). */
export const SQUIRREL_RIDDLE_KEY = 'squirrelRiddle'

export interface RiddleOption {
  readonly id: string
  readonly text: string
}

export interface Riddle {
  readonly id: string
  readonly prompt: string
  readonly options: readonly RiddleOption[]
  readonly answerId: string
  /** Chocolate the squirrel flicks you for getting this one right (§88). */
  readonly chocolateReward: number
}

/** Five plain riddles, then the meta-riddle (the candy box itself, the Schrodinger heirloom §237 — a
 * homage answerable straight from its wording). §22-open tuning on the chocolate ladder. */
export const SQUIRREL_RIDDLES: readonly Riddle[] = [
  {
    id: 'hole',
    prompt: 'The more you take from me, the bigger I grow. What am I?',
    options: [
      { id: 'a', text: 'a jawbreaker' },
      { id: 'b', text: 'a hole' },
      { id: 'c', text: 'a debt' },
    ],
    answerId: 'b',
    chocolateReward: 1,
  },
  {
    id: 'jawbreaker',
    prompt: 'I wear bands but make no music, I am round but never roll true, and I am hardest at my heart. What am I?',
    options: [
      { id: 'a', text: 'a jawbreaker' },
      { id: 'b', text: 'a drum' },
      { id: 'c', text: 'a planet' },
    ],
    answerId: 'a',
    chocolateReward: 1,
  },
  {
    id: 'wind',
    prompt: 'I rise without lungs and fall without weight; I carry ships but cannot swim. What am I?',
    options: [
      { id: 'a', text: 'the tide' },
      { id: 'b', text: 'a whale' },
      { id: 'c', text: 'the wind' },
    ],
    answerId: 'c',
    chocolateReward: 2,
  },
  {
    id: 'coming',
    prompt: 'I am always coming and I never arrive. The whole sky is afraid of me. What am I?',
    options: [
      { id: 'a', text: 'tomorrow' },
      { id: 'b', text: 'a comet' },
      { id: 'c', text: 'the tide' },
    ],
    answerId: 'a',
    chocolateReward: 2,
  },
  {
    id: 'drift',
    prompt: 'Feed me and I move; starve me and I drift forever. You met me an hour ago. What am I?',
    options: [
      { id: 'a', text: 'a cloud sheep' },
      { id: 'b', text: 'your pod, out here in the dark' },
      { id: 'c', text: 'a fire' },
    ],
    answerId: 'b',
    chocolateReward: 3,
  },
  {
    id: 'meta',
    prompt:
      'In my first life I asked you about a body of water, and you never did answer. So, simpler: I am a box you have carried the whole way, that doubles its sweetness only while it is shut, and that you have never once dared open. What am I?',
    options: [
      { id: 'a', text: 'the moon' },
      { id: 'b', text: 'the candy box' },
      { id: 'c', text: 'your own heart' },
    ],
    answerId: 'b',
    chocolateReward: 5,
  },
]
