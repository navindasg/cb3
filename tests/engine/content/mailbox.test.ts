import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  letterAvailable,
  availableLetters,
  letterRead,
  unreadCount,
  markLetterRead,
  oldDaysAsked,
  atticUnlocked,
  atticOpened,
  askAboutOldDays,
  openAttic,
  OLD_DAYS_ASKED_KEY,
  OLD_DAYS_THRESHOLD,
  ATTIC_OPENED_FLAG,
  MANTLE_SWORD_UNLOCK_FLAG,
} from '@/engine/content/mailbox'
import {
  CLIMBER_LETTERS,
  LETTER_MINES,
  LETTER_MOON,
  LETTER_GALLEON,
  LETTER_FUSION,
  LETTER_SUN,
  LETTER_LAST,
  ATTIC_ITEMS,
  POGO_STICK,
  OLD_MAP_FRAGMENT,
  WRAPPER,
  GRANDMA_REAL_NAME,
} from '@/content/letters'
import { MANTLE_SWORD_UNLOCK_FLAG as ITEMS_UNLOCK_FLAG } from '@/content/items/items'
import type { GameState } from '@/engine/types/GameState'

const base = (): GameState => createDefaultSave()

const withFlags = (...keys: string[]): GameState => {
  const s = base()
  const flags: Record<string, boolean> = { ...s.flags }
  for (const k of keys) flags[k] = true
  return { ...s, flags }
}

// --- the six milestone letters --------------------------------------------------------------------

describe('availableLetters — each letter is delivered by exactly its milestone flag', () => {
  it('none are delivered on a fresh save', () => {
    expect(availableLetters(base(), CLIMBER_LETTERS)).toEqual([])
  })

  it('there are exactly six letters, in ascending-milestone order', () => {
    expect(CLIMBER_LETTERS.map((l) => l.id)).toEqual([
      'letterMines',
      'letterMoon',
      'letterGalleon',
      'letterFusion',
      'letterSun',
      'letterLast',
    ])
  })

  const cases: [string, typeof LETTER_MINES][] = [
    ['mineGateCleared', LETTER_MINES],
    ['balloonBuilt', LETTER_MOON],
    ['galleonCommissioned', LETTER_GALLEON],
    ['flavorFusionLearned', LETTER_FUSION],
    ['dysonStage1Done', LETTER_SUN],
    ['starEaterDefeated', LETTER_LAST],
  ]

  it.each(cases)('flag %s delivers its letter (and nothing else)', (flag, letter) => {
    const s = withFlags(flag)
    expect(letterAvailable(s, letter)).toBe(true)
    // only the one gated letter is delivered
    expect(availableLetters(s, CLIMBER_LETTERS)).toEqual([letter])
  })

  it('milestones accumulate — later flags deliver earlier letters too', () => {
    const s = withFlags('mineGateCleared', 'balloonBuilt', 'galleonCommissioned')
    expect(availableLetters(s, CLIMBER_LETTERS).map((l) => l.id)).toEqual([
      'letterMines',
      'letterMoon',
      'letterGalleon',
    ])
  })

  it('the sixth (signed) letter requires the finale flag (star-eater defeated)', () => {
    expect(letterAvailable(base(), LETTER_LAST)).toBe(false)
    expect(letterAvailable(withFlags('starEaterDefeated'), LETTER_LAST)).toBe(true)
    expect(LETTER_LAST.signed).toBe(true)
    // the reveal is the signature, not the body — grandma's real name is a plain content constant.
    expect(GRANDMA_REAL_NAME).toBe('Marion')
    // and only the final letter is the signed one.
    expect(CLIMBER_LETTERS.filter((l) => l.signed === true)).toEqual([LETTER_LAST])
  })
})

describe('letter read-markers — cosmetic, read-once, idempotent (nothing to farm)', () => {
  it('a delivered letter starts unread; reading it sets the marker', () => {
    const s = withFlags('mineGateCleared')
    expect(letterRead(s, LETTER_MINES)).toBe(false)
    const read = markLetterRead(s, LETTER_MINES)
    expect(letterRead(read, LETTER_MINES)).toBe(true)
  })

  it('a second read is a no-op (SAME reference) — the mailbox never changes anything', () => {
    const s = markLetterRead(withFlags('mineGateCleared'), LETTER_MINES)
    const again = markLetterRead(s, LETTER_MINES)
    expect(again).toBe(s)
  })

  it('marking an UNDELIVERED letter read is a no-op (SAME reference)', () => {
    const s = base()
    expect(markLetterRead(s, LETTER_LAST)).toBe(s)
    expect(letterRead(markLetterRead(s, LETTER_LAST), LETTER_LAST)).toBe(false)
  })

  it('unreadCount counts only delivered, unread letters', () => {
    const s = withFlags('mineGateCleared', 'balloonBuilt')
    expect(unreadCount(s, CLIMBER_LETTERS)).toBe(2)
    const afterOne = markLetterRead(s, LETTER_MINES)
    expect(unreadCount(afterOne, CLIMBER_LETTERS)).toBe(1)
    const afterBoth = markLetterRead(afterOne, LETTER_MOON)
    expect(unreadCount(afterBoth, CLIMBER_LETTERS)).toBe(0)
  })

  it('reading grants NO resource/item — only the marker flag changes', () => {
    const s = withFlags('mineGateCleared')
    const read = markLetterRead(s, LETTER_MINES)
    expect(read.candies.current).toBe(s.candies.current)
    expect(read.ownedItems).toEqual(s.ownedItems)
  })
})

// --- the old-days counter → attic unlock ----------------------------------------------------------

describe('askAboutOldDays — a monotonic counter that unlocks the attic at exactly 3', () => {
  it('starts at zero, attic locked', () => {
    expect(oldDaysAsked(base())).toBe(0)
    expect(atticUnlocked(base())).toBe(false)
  })

  it('each ask increments the counter by one', () => {
    let s = base()
    const seen: number[] = []
    for (let i = 0; i < 5; i++) {
      s = askAboutOldDays(s).state
      seen.push(oldDaysAsked(s))
    }
    expect(seen).toEqual([1, 2, 3, 4, 5])
    expect(s.numbers[OLD_DAYS_ASKED_KEY]).toBe(5)
  })

  it('justUnlocked fires on EXACTLY the third ask, and only then', () => {
    let s = base()
    const first = askAboutOldDays(s)
    expect(first.justUnlocked).toBe(false)
    const second = askAboutOldDays(first.state)
    expect(second.justUnlocked).toBe(false)
    const third = askAboutOldDays(second.state)
    expect(third.justUnlocked).toBe(true) // crosses the threshold here
    expect(atticUnlocked(third.state)).toBe(true)
    // asking again past the threshold keeps counting but never re-unlocks
    const fourth = askAboutOldDays(third.state)
    expect(fourth.justUnlocked).toBe(false)
    expect(atticUnlocked(fourth.state)).toBe(true)
  })

  it('the threshold constant is 3 (three asks)', () => {
    expect(OLD_DAYS_THRESHOLD).toBe(3)
  })
})

// --- opening the attic → the wrapper cashes the mantle-sword unlock --------------------------------

describe('openAttic — commit-once grant of the pogo stick, map fragment, and wrapper', () => {
  const unlocked = (): GameState => {
    let s = base()
    for (let i = 0; i < OLD_DAYS_THRESHOLD; i++) s = askAboutOldDays(s).state
    return s
  }

  it('is locked until the old-days threshold is reached (SAME reference back)', () => {
    const locked = base()
    const result = openAttic(locked, ATTIC_ITEMS)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('locked')
    expect(result.state).toBe(locked) // no grant, same object
    expect(atticOpened(result.state)).toBe(false)
    expect(result.state.flags[MANTLE_SWORD_UNLOCK_FLAG]).toBeUndefined()
  })

  it('is still locked at ask 1 and 2, unlocks at ask 3', () => {
    let s = base()
    s = askAboutOldDays(s).state
    expect(openAttic(s, ATTIC_ITEMS).ok).toBe(false)
    s = askAboutOldDays(s).state
    expect(openAttic(s, ATTIC_ITEMS).ok).toBe(false)
    s = askAboutOldDays(s).state
    expect(openAttic(s, ATTIC_ITEMS).ok).toBe(true)
  })

  it('opening grants all three attic keepsakes exactly once', () => {
    const result = openAttic(unlocked(), ATTIC_ITEMS)
    expect(result.ok).toBe(true)
    expect(atticOpened(result.state)).toBe(true)
    expect(result.state.flags[ATTIC_OPENED_FLAG]).toBe(true)
    expect(result.state.ownedItems[POGO_STICK.id]).toBe(true)
    expect(result.state.ownedItems[OLD_MAP_FRAGMENT.id]).toBe(true)
    expect(result.state.ownedItems[WRAPPER.id]).toBe(true)
  })

  it('the wrapper grant sets MANTLE_SWORD_UNLOCK_FLAG (cashing the mantle-sword foreshadow)', () => {
    const result = openAttic(unlocked(), ATTIC_ITEMS)
    expect(result.state.flags[MANTLE_SWORD_UNLOCK_FLAG]).toBe(true)
    // the wrapper's saveFlag IS the unlock flag — engine + item declare the SAME literal (ADR §3)
    expect(WRAPPER.saveFlag).toBe(MANTLE_SWORD_UNLOCK_FLAG)
    expect(MANTLE_SWORD_UNLOCK_FLAG).toBe(ITEMS_UNLOCK_FLAG)
  })

  it('a second open is a no-op (SAME reference) — farm-proof', () => {
    const first = openAttic(unlocked(), ATTIC_ITEMS)
    expect(first.ok).toBe(true)
    const second = openAttic(first.state, ATTIC_ITEMS)
    expect(second.ok).toBe(false)
    expect(second.reason).toBe('alreadyOpened')
    expect(second.state).toBe(first.state)
  })

  it('the attic keepsakes are exactly [pogo stick, old map fragment, wrapper]', () => {
    expect(ATTIC_ITEMS.map((i) => i.id)).toEqual(['pogoStick', 'oldMapFragment', 'wrapper'])
  })
})
