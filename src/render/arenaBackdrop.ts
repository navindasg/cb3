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
