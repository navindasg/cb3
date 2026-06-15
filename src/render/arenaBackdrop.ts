// Static ASCII backdrop for the beanstalk climb (Phase 1 polish). The quest engine only knows
// entities + scroll; the *world* (the stalk, the clouds at the top, the garden floor at the
// bottom, a mid-stalk leaf ledge) is pure presentation, so it lives here in the render layer and
// is composited UNDER the entities by ArenaRenderer.composeArena (background drawn first).
//
// CB2 idiom: frames and scenery are literal ASCII characters, not CSS chrome. The grid is the
// quest's own 16×48 (BEANSTALK_CLIMB.width × .height); the player climbs from the soil (bottom,
// large y) to the clouds (top, small y). The strip is deliberately narrow — it reads as a tall
// beanstalk shaft — and the arena panel's dark sky frames it (see styles.css .arena-surface).

const W = 16
const H = 48
const STALK_L = 7
const STALK_R = 8
const GROUND_TOP = 45 // rows 45..47 are the garden soil
const CLOUD_BOTTOM = 4 // rows 0..3 are the clouds (the goal)
const LEDGE_ROW = 24 // the mid-stalk leaf ledge (matches BEANSTALK_CLIMB safe zone y:24)

/** Overwrite a row's cells with `text` (clipped to the grid width). */
function stamp(grid: string[][], y: number, text: string): void {
  const row = grid[y]
  if (!row) return
  for (let x = 0; x < text.length && x < W; x++) {
    const ch = text[x]
    if (ch !== undefined) row[x] = ch
  }
}

/** Keep the stalk piercing whatever was just stamped over it on row `y`. */
function restalk(grid: string[][], y: number): void {
  const row = grid[y]
  if (!row) return
  row[STALK_L] = '|'
  row[STALK_R] = '|'
}

/** Build the 16×48 beanstalk world as exactly-`W`-wide rows. Pure. */
export function buildBeanstalkBackdrop(): readonly string[] {
  const grid: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => ' '))

  // The garden soil at the bottom (the climb's start / a safe zone).
  for (let y = GROUND_TOP; y < H; y++) stamp(grid, y, '#'.repeat(W))

  // The beanstalk itself, from just above the soil up into the clouds.
  for (let y = CLOUD_BOTTOM; y < GROUND_TOP; y++) restalk(grid, y)

  // Leaves on the stalk, alternating sides, for a sense of vertical travel.
  for (let y = CLOUD_BOTTOM + 2; y < GROUND_TOP - 1; y += 6) {
    const left = grid[y]
    const right = grid[y + 2]
    if (left) left[STALK_L - 1] = '\\'
    if (right) right[STALK_R + 1] = '/'
  }

  // The clouds at the very top — the destination — with the stalk poking through.
  stamp(grid, 0, '   the clouds   ')
  stamp(grid, 1, '  .--.   .--.   ')
  stamp(grid, 2, ' (    ) (    )  ')
  stamp(grid, 3, '  `--`   `--`   ')
  restalk(grid, 2)
  restalk(grid, 3)

  // A mid-stalk leaf ledge (a place to catch your breath — the second safe zone).
  stamp(grid, LEDGE_ROW, ' ~~~~~~~~~~~~~~ ')
  restalk(grid, LEDGE_ROW)

  // The garden floor, labelled, with grass over the soil. (No stalk re-stamp here — the centre
  // columns fall on the word "garden", and the stalk visibly roots into the soil just above.)
  stamp(grid, GROUND_TOP - 1, '   the garden   ')
  stamp(grid, GROUND_TOP, '.vvvvvvvvvvvvvv.')

  return grid.map((row) => row.join(''))
}

/** The beanstalk world, built once (it never changes during a climb). */
export const BEANSTALK_BACKDROP: readonly string[] = buildBeanstalkBackdrop()

// The forest arena backdrop (drawn UNDER the entities): a sparse treeline up top and a ground
// line along the bottom row, so the @ and the gummy critters walk a path rather than a void.
export const FOREST_BACKDROP: readonly string[] = [
  '     ^          ^             ^             ^           ^',
  '    /=\\        /=\\           /=\\           /=\\         /=\\',
  '     |          |             |             |           |',
  '',
  '',
  '',
  '',
  '~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~',
]

// The sugar-mines arena backdrop (the gate fight + the descent): a stalactite ceiling, sparse
// rock-candy glitter, and a rocky floor. Decorative only; the live veins/sentinel draw over it.
export const MINES_BACKDROP: readonly string[] = [
  'vvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvvv',
  '',
  '      *                  *                    *                  *              ',
  '',
  '',
  '              *                  *                       *                      ',
  '',
  '##############################################################################',
]

// The gummy-worm cellar arena backdrop (the CB2 rat-cellar homage): a low timber-joist ceiling, a
// wall shelf (where the lollipop sits), and an earthen floor. Sized to the cellar's own 24×6 grid
// rather than a slice of the mines art. Decorative only; the worms draw over it.
export const CELLAR_BACKDROP: readonly string[] = [
  '========================',
  '                        ',
  '  [==] [==] [==]    o    ',
  '                        ',
  '                        ',
  '........................',
]

// The mountain arena backdrop (the climb to the observatory): a rising ridgeline against the sky
// and a scree path along the bottom. Decorative only; the imps + the gummy bear draw over it.
export const MOUNTAIN_BACKDROP: readonly string[] = [
  '                                                  .  *        .                 ',
  '                                        /\\      .        .          *           ',
  '                          /\\          /    \\         *                          ',
  '            /\\          /    \\      /        \\                                   ',
  '   /\\     /    \\      /        \\  /            \\                                 ',
  ' /    \\ /        \\  /                                                            ',
  '/                                                                               ',
  '................................................................................',
]
