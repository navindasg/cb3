import type { UnlockFeature } from '@/engine/types/defs'
import type { GameTextKey } from '@/content/i18n/schema'

// The Act 0 "request a feature" ladder (CB2's CandyBox request chain, mapped to CB3's chrome).
// CB2 went status bar -> cfg -> save -> health bar -> map; CB3 auto-saves and has no cfg/save
// tabs, so the ladder is trimmed to the three pieces of chrome that are actually real here:
//   the status bar (30) -> a health bar (5) -> the map (10).
// The map is the capstone — cumulative ~45 candies, the "draw a map around fifty candies" beat —
// and unlocking it is what first reveals the overworld. Mana stays hidden until the grimoire, so
// it is NOT in this ladder. Each entry carries the button label and the comment that narrates it
// once unlocked (shown beside the NEXT offer — CB2's off-by-one narration).

export interface FeatureRequest extends UnlockFeature {
  /** i18n key for the request button label (the accelerator letter is underlined in the UI). */
  readonly buttonKey: GameTextKey
  /** i18n key for the deadpan comment shown once this feature is unlocked. */
  readonly commentKey: GameTextKey
}

export const ACT0_FEATURE_REQUESTS: readonly FeatureRequest[] = [
  {
    flag: 'statusBarUnlocked',
    price: 30,
    buttonKey: 'gui.request.statusBar',
    commentKey: 'gui.comment.statusBar',
  },
  {
    flag: 'healthBarUnlocked',
    price: 5,
    buttonKey: 'gui.request.healthBar',
    commentKey: 'gui.comment.healthBar',
  },
  {
    flag: 'mapUnlocked',
    price: 10,
    buttonKey: 'gui.request.map',
    commentKey: 'gui.comment.map',
  },
]

/** The flag set when the player has unlocked the world map (the capstone request). */
export const MAP_UNLOCKED_FLAG = 'mapUnlocked'
/** The flag set when the player has unlocked the pinned status bar (the first request). */
export const STATUS_BAR_UNLOCKED_FLAG = 'statusBarUnlocked'
/** The flag set when the player has unlocked the health readout. */
export const HEALTH_BAR_UNLOCKED_FLAG = 'healthBarUnlocked'
