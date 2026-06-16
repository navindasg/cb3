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

// The storm-front arena backdrop (Quest 3, a VerticalDriver climb): an 18×52 cloud shaft you
// ascend from the bridge head (bottom) to the thunderhead at the summit (top). Updraft arrows mark
// the gusts the fizzy lifting soda lets you ride; stray lightning crackles down the flanks. Built
// (not hand-laid) so the column stays exactly the quest's width; decorative only — the sprites and
// the djinn draw over it. Matches STORM_FRONT.width × .height and its safe-zone rows.
const STORM_W = 18
const STORM_H = 52

function stampRow(grid: string[][], y: number, text: string): void {
  const row = grid[y]
  if (!row) return
  for (let x = 0; x < text.length && x < STORM_W; x++) {
    const ch = text[x]
    if (ch !== undefined) row[x] = ch
  }
}

/** Build the 18×52 storm-front world as exactly-`STORM_W`-wide rows. Pure. */
export function buildStormFrontBackdrop(): readonly string[] {
  const grid: string[][] = Array.from({ length: STORM_H }, () =>
    Array.from({ length: STORM_W }, () => ' '),
  )

  // The bridge head at the bottom (the start / a safe zone).
  for (let y = STORM_H - 2; y < STORM_H; y++) stampRow(grid, y, '='.repeat(STORM_W))
  stampRow(grid, STORM_H - 3, '  the bridge head ')

  // Updraft arrows climbing the flanks — the gusts you ride with the fizzy lifting soda.
  for (let y = STORM_H - 6; y > 8; y -= 5) {
    const row = grid[y]
    if (row) {
      row[2] = '^'
      row[STORM_W - 3] = '^'
    }
  }

  // A sheltered eddy ledge mid-climb (matches STORM_FRONT safe zone y:28).
  stampRow(grid, 29, ' ~~~~ eddy ~~~~ ')

  // Stray lightning down the flanks (decorative crackle).
  for (let y = 12; y < 40; y += 9) {
    const row = grid[y]
    if (row) row[1] = '/'
    const row2 = grid[y + 1]
    if (row2) row2[STORM_W - 2] = '\\'
  }

  // The thunderhead at the summit (where the djinn looms — the goal).
  stampRow(grid, 0, '  the thunderhead ')
  stampRow(grid, 1, '  .--~~~~~~~--.   ')
  stampRow(grid, 2, ' (             )  ')
  stampRow(grid, 3, "  `~~-.....-~~`   ")

  return grid.map((row) => row.join(''))
}

/** The storm-front world, built once (it never changes during a climb). */
export const STORM_FRONT_BACKDROP: readonly string[] = buildStormFrontBackdrop()

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
