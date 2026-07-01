import type { ItemDef, LetterDef } from '@/engine/types/defs'
import {
  MINE_GATE_CLEARED_FLAG,
  BALLOON_BUILT_FLAG,
  GALLEON_COMMISSIONED_FLAG,
  FLAVOR_FUSION_FLAG,
  STAR_EATER_DEFEATED_FLAG,
} from '@/content/flags'

// The village mailbox (§30) + the grandma-hero reveal (§5/§288), as data. Six milestone letters
// from "the first climber" — someone who came this way long before you, left the mines glowing,
// reached the moon, sailed the dark. Each unlocks on an EXISTING milestone flag (they never grant
// anything to farm; the reward is lore). The letters never SAY "I was the hero" — they get quietly
// warmer as you climb higher, and the SIXTH is SIGNED with grandma's real name. The signature does
// all the work: the first climber was Grandma, and she has been reading every letter you never sent.
//
// Content owns the letter data + the name string; the pure availableLetters / read-marker logic
// lives in engine/content/mailbox. The mailbox house + reader are coverage-excluded render glue.

/**
 * Grandma's real name — the ONE deliberate name-drop in a game of unnamed NPCs (§22). Revealed only
 * as the signature on the sixth and final letter, after the star-eater is driven off: the first
 * climber and Grandma are the same person, and the game never states it outright. A plain, warm name.
 */
export const GRANDMA_REAL_NAME = 'Marion'

/** The dyson-stage-1 done flag re-declared as a plain string (content owns the letter gates; the
 * DYSON_STAGE_DONE_FLAGS array is the source of truth and index 0 is stage 1). */
export const DYSON_STAGE1_DONE_FLAG = 'dysonStage1Done'

/** Letter 1 — the mines. Delivered once the mine-gate is cleared. Curt, a stranger's note. */
export const LETTER_MINES: LetterDef = {
  id: 'letterMines',
  gateFlag: MINE_GATE_CLEARED_FLAG,
  bodyKey: 'letter.mines.body',
}

/** Letter 2 — the moon. Delivered once the balloon is built (the moon is reachable). A little kinder. */
export const LETTER_MOON: LetterDef = {
  id: 'letterMoon',
  gateFlag: BALLOON_BUILT_FLAG,
  bodyKey: 'letter.moon.body',
}

/** Letter 3 — the galleon. Delivered once she is commissioned. Warmer; the writer is proud of you now. */
export const LETTER_GALLEON: LetterDef = {
  id: 'letterGalleon',
  gateFlag: GALLEON_COMMISSIONED_FLAG,
  bodyKey: 'letter.galleon.body',
}

/** Letter 4 — the gummy folk. Delivered once flavor fusion is learned. The writer remembers them too. */
export const LETTER_FUSION: LetterDef = {
  id: 'letterFusion',
  gateFlag: FLAVOR_FUSION_FLAG,
  bodyKey: 'letter.fusion.body',
}

/** Letter 5 — the sun. Delivered once the first dyson stage is raised. Almost frightened for you now. */
export const LETTER_SUN: LetterDef = {
  id: 'letterSun',
  gateFlag: DYSON_STAGE1_DONE_FLAG,
  bodyKey: 'letter.sun.body',
}

/** Letter 6 — the last. Delivered once the star-eater is driven off. Signed with her real name (§288). */
export const LETTER_LAST: LetterDef = {
  id: 'letterLast',
  gateFlag: STAR_EATER_DEFEATED_FLAG,
  bodyKey: 'letter.last.body',
  signed: true,
}

/** Every first-climber letter, in delivery order (each gated on a later milestone). */
export const CLIMBER_LETTERS: readonly LetterDef[] = [
  LETTER_MINES,
  LETTER_MOON,
  LETTER_GALLEON,
  LETTER_FUSION,
  LETTER_SUN,
  LETTER_LAST,
]

// --- grandma's attic (the old-days ×3 secret) ----------------------------------------------------
// Ask Grandma about the old days three times and she goes quiet, then nods at the ladder to the attic.
// Up there: a pogo stick that still works, an old map fragment of a climb that is not on any map — and,
// wrapped in wax paper at the bottom of a trunk, a sword. She wrapped it herself, a long time ago. The
// wrapper sets MANTLE_SWORD_UNLOCK_FLAG (cashing the mantle-sword foreshadow). None of these are gates.

/** The pogo stick from the attic. Not equippable — a keepsake that, per the reveal, still works. */
export const POGO_STICK: ItemDef = {
  id: 'pogoStick',
  displayKey: 'item.pogoStick.name',
  descKey: 'item.pogoStick.desc',
  ascii: '!i',
  saveFlag: 'pogoStickOwned',
}

/** An old map fragment of a climb no map shows — the first climber's own. A lore keepsake. */
export const OLD_MAP_FRAGMENT: ItemDef = {
  id: 'oldMapFragment',
  displayKey: 'item.oldMapFragment.name',
  descKey: 'item.oldMapFragment.desc',
  ascii: '#\\',
  saveFlag: 'oldMapFragmentOwned',
}

/**
 * The wrapper — the wax paper the heirloom sword was wrapped in, folded and kept. Not equippable; a
 * keepsake. Owning it is the moment MANTLE_SWORD_UNLOCK_FLAG is set (grandma's blessing to take the
 * sword off the mantle at last). The mantle sword's damage scales off lifetimeCandiesEaten — the
 * "wrapper still scales" design intent, never stated (see content/items/playerLoadout). Its saveFlag
 * IS the unlock flag, so owning the wrapper and unlocking the sword are the same one-time event.
 */
export const WRAPPER: ItemDef = {
  id: 'wrapper',
  displayKey: 'item.wrapper.name',
  descKey: 'item.wrapper.desc',
  ascii: '..',
  saveFlag: 'mantleSwordUnlocked',
}

/** Everything found in the attic, granted together the first time it is opened. */
export const ATTIC_ITEMS: readonly ItemDef[] = [POGO_STICK, OLD_MAP_FRAGMENT, WRAPPER]
