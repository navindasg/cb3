// The mint planet (Act 2 — quest 10, the act capstone, DESIGN §182/§184). Pure config the mint-planet
// engine (engine/content/mintPlanet) reads. An ice labyrinth ("the labyrinth keeps you. it was lonely",
// §356) you navigate by FOLLOWING THE COLD — every passage reads a temperature; the coldest leads
// deeper, a warmer one wanders you back to the mouth. At the frozen heart: the FROST WYRM, a dragon that
// froze instead of igniting (the larval-star lynchpin, §15/§285 — revealed by environment, never said).
// Freeing it (breaking the peppermint-frost from around it) opens the peppermint fields. Peppermint —
// the §184 Act-2 gate AND the Act-4 sun gate (§94) — is then mined by CONDENSERS you build from rock
// candy (tying the Act-1 mining economy into the act's tail-end grind). All §22-open tuning.
//
// Deferred + signposted (not stubbed): a frost-wyrm BOSS FIGHT (this is the quiet, tragic version — the
// dragon arc pays off at the caramel core, §15), the mint FLAVOR for the gummy army (§259), mint coolant
// / peppermint plating (the Act-3/4 sun descent gear, §233/§250), and Act 3 itself (the dyson scaffold).

/** A passage out of a labyrinth room — its prose label, the room it leads to, and how cold it reads
 * (colder = deeper toward the frozen heart; the coldest passage in a room is the way on). */
export interface Passage {
  readonly label: string
  readonly to: string
  /** Temperature in degrees (negative; lower = colder = toward the heart). */
  readonly temp: number
}

/** A labyrinth room — its id, the line you read on entering, and the passages out. The heart has none. */
export interface LabyrinthRoom {
  readonly id: string
  readonly text: string
  readonly passages: readonly Passage[]
}

/** Where the labyrinth begins. */
export const LABYRINTH_START = 'mouth'
/** The frozen heart — reaching it ends the maze (the frost wyrm waits there). */
export const LABYRINTH_HEART = 'heart'

/**
 * The ice labyrinth. Each non-heart room offers the coldest passage (which advances toward the heart)
 * plus warmer decoys that wander you back to the mouth — "the labyrinth keeps you" until you learn to
 * follow the cold. A small fixed graph: deterministic, unit-testable, and e2e-followable by temperature.
 */
export const LABYRINTH_ROOMS: readonly LabyrinthRoom[] = [
  {
    id: 'mouth',
    text: 'A throat of blue ice swallows the daylight behind you. Ways breathe out of the dark, each a different cold.',
    passages: [
      { label: 'down the frost-furred stair', to: 'galleries', temp: -11 },
      { label: 'toward a faint pale glow', to: 'hollow', temp: -4 },
    ],
  },
  {
    id: 'galleries',
    text: 'Galleries of frozen organ-pipes climb out of sight. Your breath cracks and falls as snow.',
    passages: [
      { label: 'where the air bites hardest', to: 'singingIce', temp: -19 },
      { label: 'the echoing left fork', to: 'hollow', temp: -9 },
      { label: 'the still right fork', to: 'mouth', temp: -7 },
    ],
  },
  {
    id: 'hollow',
    text: 'A bubble of dead, warmer air, ringed with claw-marks gone soft at the edges. Something paced this hollow once, round and round, for a long time. The only way on is back the way you came.',
    passages: [{ label: 'back toward the deeper cold', to: 'mouth', temp: -6 }],
  },
  {
    id: 'singingIce',
    text: 'The ice here sings, very faintly, on one held note. It has been holding it a long time.',
    passages: [
      { label: 'into the deep hush', to: 'antechamber', temp: -28 },
      { label: 'back toward the warmth', to: 'mouth', temp: -15 },
    ],
  },
  {
    id: 'antechamber',
    text: 'An antechamber of black ice, and beyond the last arch a shape too large to be a wall.',
    passages: [
      { label: 'through the last arch', to: 'heart', temp: -41 },
      { label: 'the side passage that doubles back', to: 'hollow', temp: -23 },
    ],
  },
  {
    id: 'heart',
    text: 'The heart of the labyrinth. The cold is total, and it has a shape.',
    passages: [],
  },
]

// --- peppermint mining (the condensers, post-wyrm) ----------------------------------------------------

/** numbers-namespace key for the peppermint condensers you have built. */
export const PEPPERMINT_CONDENSER_KEY = 'peppermintCondensers'

/** Cost to build one condenser: rock candy (ties in the Act-1 mining economy) + candies. §22-open. */
export const CONDENSER_ROCK_CANDY_COST = 100
export const CONDENSER_CANDY_COST = 5_000

/** Peppermint each condenser sublimates per second from the wyrm's frozen breath. Deliberately a slow
 * trickle: 10,000 is the §182 "tail-end grind", so even a fair fleet is a real haul, not an afternoon
 * (a few dozen condensers is the intended fleet — itself a rock-candy sink). §22-open. */
export const PEPPERMINT_PER_CONDENSER_PER_SEC = 0.1

/** The §184 Act-2 gate: peppermint to bank alongside a tier-3 (jawbreaker-plated) hull. */
export const PEPPERMINT_GATE_AMOUNT = 10_000
