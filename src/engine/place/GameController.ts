import type { Place } from '@/engine/place/Place'

// Owns the single active place. Every transition disposes the outgoing place
// before mounting the next, so effects/listeners never accumulate. A depth-1
// "map return target" remembers the last map-type place so quests/shops can pop
// back to where the player was (CB2's savedPlace, made explicit).

export interface GameController {
  current(): Place | null
  setPlace(place: Place): void
  /** Enter a map-type place and remember it as the return target. */
  enterMap(place: Place): void
  /** Return to the remembered map place. False if none was set. */
  returnToMap(): boolean
}

export function createGameController(): GameController {
  let current: Place | null = null
  let dispose: (() => void) | null = null
  let mapReturnTarget: Place | null = null

  function setPlace(place: Place): void {
    if (dispose) {
      dispose()
      dispose = null
    }
    current = place
    dispose = place.mount()
  }

  function enterMap(place: Place): void {
    mapReturnTarget = place
    setPlace(place)
  }

  function returnToMap(): boolean {
    if (!mapReturnTarget) return false
    setPlace(mapReturnTarget)
    return true
  }

  return {
    current: () => current,
    setPlace,
    enterMap,
    returnToMap,
  }
}
