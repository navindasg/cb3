import type { GameState } from '@/engine/types/GameState'
import { createResource } from '@/engine/types/Resource'

/** A fresh new-game state. Opens on the series' first line: "You have 1 candy." */
export function createDefaultSave(): GameState {
  return {
    accumulatedGameTimeMs: 0,
    totalPlaytimeSeconds: 0,
    nGPlusRun: 0,

    candies: createResource(1),
    lollipops: createResource(0),
    chocolate: createResource(0),
    caramel: createResource(0),
    rockCandy: createResource(0),
    cottonCandy: createResource(0),
    licorice: createResource(0),
    popRocks: createResource(0),
    sour: createResource(0),
    peppermint: createResource(0),

    lifetimeCandiesEaten: 0,
    lifetimeCandiesThrown: 0,
    starsRemaining: 8128,

    boxClosed: false,

    playerHpCurrent: 10,
    manaCurrent: 0,

    equipped: { weapon: null, hat: null, armour: null, gloves: null, boots: null },
    ownedItems: {},

    flags: {},
    numbers: {},
    strings: { language: 'en' },

    ngPlusCarryover: null,
  }
}
