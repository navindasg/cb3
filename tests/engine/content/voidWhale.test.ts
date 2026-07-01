import {
  voidLeg,
  voidWaypoint,
  voidReached,
  currentVoidLeg,
  expectedVoidBearing,
  plotVoidBearing,
  deriveWhaleWeapon,
  createWhaleFight,
  whaleOutcome,
  telegraphedTooth,
  strikeTarget,
  resolveWhaleTurn,
  voidWhaleDefeated,
  grantWhaleReward,
  blackGrimoireOwned,
  castGrimoireEclipse,
  type WhaleState,
  type WhaleAction,
} from '@/engine/content/voidWhale'
import {
  VOID_LEGS,
  VOID_BEARINGS,
  VOID_LEG_KEY,
  TOOTH_COUNT,
  TOOTH_HP,
  WHALE_PLAYER_HP,
  CRUSH_DMG_BY_DIST,
  MAX_TURNS,
  FAST_COOLDOWN_MS,
  HERMIT_SHOP,
  ECLIPSE_DURATION_MS,
} from '@/content/void/voidWhale'
import {
  VOID_REACHED_FLAG,
  VOID_WHALE_DEFEATED_FLAG,
  BLACK_LICORICE_GRIMOIRE_OWNED_FLAG,
} from '@/content/flags'
import { HERMIT_GLOVES, BLACK_LICORICE_GRIMOIRE, VOID_PEARL, ITEM_MAP } from '@/content/items/items'
import { purchase } from '@/engine/shop/purchase'
import { visibleShopRows } from '@/engine/shop/shopView'
import { eclipsed, eclipseUntilMs } from '@/engine/content/starCounter'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { addResource } from '@/engine/types/Resource'
import { MS_PER_STAR } from '@/engine/content/starCounter'
import type { GameState } from '@/engine/types/GameState'

/** A save with the given weapon equipped (the fight reads only the equipped hand weapon). */
const withWeapon = (weaponId: string | null): GameState => ({
  ...createDefaultSave(),
  equipped: { ...createDefaultSave().equipped, weapon: weaponId },
})

// --- the crossing to empty space (plot-a-course) ------------------------------------------------

describe('the void whale — the crossing to empty space', () => {
  it('starts unplotted and unreached', () => {
    const s = createDefaultSave()
    expect(voidLeg(s)).toBe(0)
    expect(voidWaypoint(s)).toBe(0)
    expect(voidReached(s)).toBe(false)
    expect(currentVoidLeg(s, VOID_LEGS)).toBe(VOID_LEGS[0])
    expect(expectedVoidBearing(s, VOID_LEGS)).toBe(VOID_LEGS[0]![0])
  })

  it('a correct pick advances the plot within a leg', () => {
    const s = createDefaultSave()
    const first = VOID_LEGS[0]![0]!
    const r = plotVoidBearing(s, first, VOID_LEGS)
    expect(r.ok).toBe(true)
    expect(r.correct).toBe(true)
    expect(r.legComplete).toBe(false)
    expect(voidWaypoint(r.state)).toBe(1)
  })

  it('a wrong pick loses the leg run (resets to 0) — never a soft-lock', () => {
    const s = createDefaultSave()
    const first = VOID_LEGS[0]![0]!
    const stepped = plotVoidBearing(s, first, VOID_LEGS).state
    expect(voidWaypoint(stepped)).toBe(1)
    // pick a wrong bearing next
    const wrong = VOID_BEARINGS.find((b) => b.id !== VOID_LEGS[0]![1])!.id
    const r = plotVoidBearing(stepped, wrong, VOID_LEGS)
    expect(r.ok).toBe(true)
    expect(r.correct).toBe(false)
    expect(voidWaypoint(r.state)).toBe(0) // the run restarts — you can always try again
    expect(voidReached(r.state)).toBe(false)
  })

  it('completing every leg reaches the empty coordinate and sets the flag', () => {
    let s = createDefaultSave()
    for (const leg of VOID_LEGS) {
      for (const bearing of leg) {
        s = plotVoidBearing(s, bearing, VOID_LEGS).state
      }
    }
    expect(voidReached(s)).toBe(true)
    expect(s.flags[VOID_REACHED_FLAG]).toBe(true)
    expect(expectedVoidBearing(s, VOID_LEGS)).toBeNull()
  })

  it('is a no-op (SAME reference) once already reached', () => {
    let s = createDefaultSave()
    for (const leg of VOID_LEGS) for (const b of leg) s = plotVoidBearing(s, b, VOID_LEGS).state
    const r = plotVoidBearing(s, VOID_BEARINGS[0]!.id, VOID_LEGS)
    expect(r.ok).toBe(false)
    expect(r.state).toBe(s)
  })

  it('is a defensive no-op (SAME reference) when the leg cursor runs past the legs without the reached flag', () => {
    // A defensive guard: reaching the last leg always sets the flag, but if the leg index were somehow past the
    // array with the flag unset, plotting is a clean no-op rather than a crash.
    const base = createDefaultSave()
    const s: GameState = { ...base, numbers: { ...base.numbers, [VOID_LEG_KEY]: VOID_LEGS.length + 1 } }
    const r = plotVoidBearing(s, VOID_BEARINGS[0]!.id, VOID_LEGS)
    expect(r.ok).toBe(false)
    expect(r.state).toBe(s)
    expect(r.reached).toBe(false)
  })
})

// --- the optional whale fight (telegraph-and-sever, reads the equipped weapon) -------------------

const playOut = (start: WhaleState, choose: (s: WhaleState) => WhaleAction): WhaleState => {
  let s = start
  for (let i = 0; i < 100 && whaleOutcome(s) === null; i++) s = resolveWhaleTurn(s, choose(s))
  return s
}

/** Best reachable final HP via perfect play (minimax over the two actions); -Infinity if no win exists. */
const bestFinalHp = (start: WhaleState): number => {
  const memo = new Map<string, number>()
  const search = (s: WhaleState): number => {
    const o = whaleOutcome(s)
    if (o === 'won') return s.yourHp
    if (o === 'lost') return -Infinity
    const key = `${s.yourHp}|${s.turn}|${s.teeth.map((t) => `${t.id}:${t.hp}:${t.dist}`).join(',')}`
    const cached = memo.get(key)
    if (cached !== undefined) return cached
    const r = Math.max(search(resolveWhaleTurn(s, 'strike')), search(resolveWhaleTurn(s, 'brace')))
    memo.set(key, r)
    return r
  }
  return search(start)
}

const alwaysStrike = (): WhaleAction => 'strike'

describe('the void whale — reading the equipped weapon', () => {
  it('derives damage/reach off the equipped weapon; a fast weapon strikes twice; bare hands the minimum', () => {
    const mace = deriveWhaleWeapon(withWeapon('jawbreakerMace'))
    expect(mace).toEqual({ damage: 8, reach: 1.5, strikes: 1 })
    const whip = deriveWhaleWeapon(withWeapon('licoriceWhip'))
    expect(whip.strikes).toBe(2) // cooldown 350 < FAST_COOLDOWN_MS
    expect(whip.reach).toBe(3)
    expect(deriveWhaleWeapon(withWeapon(null))).toEqual({ damage: 1, reach: 1.2, strikes: 1 })
    expect(FAST_COOLDOWN_MS).toBe(400)
  })

  it('opens with every tooth at full hp, you at full hp, turn zero', () => {
    const s = createWhaleFight(withWeapon('ironSword'))
    expect(s.teeth).toHaveLength(TOOTH_COUNT)
    expect(s.teeth.every((t) => t.hp === TOOTH_HP)).toBe(true)
    expect(s.yourHp).toBe(WHALE_PLAYER_HP)
    expect(s.turn).toBe(0)
    expect(whaleOutcome(s)).toBeNull()
  })

  it('telegraphs the farthest tooth; a long weapon intercepts its crush (no damage taken)', () => {
    const s = createWhaleFight(withWeapon('candyCaneBow')) // reach 5, reaches everything
    const tel = telegraphedTooth(s)!
    expect(tel.dist).toBe(Math.max(...s.teeth.map((t) => t.dist)))
    const before = s.yourHp
    const next = resolveWhaleTurn(s, 'strike')
    expect(next.yourHp).toBe(before) // intercepted -> no crush lands
    const sameTooth = next.teeth.find((t) => t.id === tel.id)
    expect(sameTooth && sameTooth.hp).toBeLessThan(TOOTH_HP)
  })

  it('a short weapon whiffs on the far telegraphed tooth and eats the crush; bracing halves it', () => {
    const s = createWhaleFight(withWeapon('jawbreakerMace')) // reach 1.5, cannot reach the far teeth
    expect(strikeTarget(s)).toBeNull() // start dists 2,3,3,4,5 — nothing at <= 1.5
    const tel = telegraphedTooth(s)!
    const blow = CRUSH_DMG_BY_DIST[tel.dist]!
    expect(resolveWhaleTurn(s, 'strike').yourHp).toBe(s.yourHp - blow) // whiff -> full crush
    expect(resolveWhaleTurn(s, 'brace').yourHp).toBe(s.yourHp - blow / 2) // brace halves it
  })

  it('every surviving tooth grinds one band closer each turn', () => {
    const s = createWhaleFight(withWeapon('jawbreakerMace'))
    const next = resolveWhaleTurn(s, 'brace')
    for (const t of next.teeth) {
      const prev = s.teeth.find((p) => p.id === t.id)!
      expect(t.dist).toBe(Math.max(1, prev.dist - 1))
    }
  })

  it('scores the outcome and is a no-op (SAME reference) once over', () => {
    const base = createWhaleFight(withWeapon('ironSword'))
    expect(whaleOutcome({ ...base, teeth: [] })).toBe('won')
    expect(whaleOutcome({ ...base, yourHp: 0 })).toBe('lost')
    expect(whaleOutcome({ ...base, turn: MAX_TURNS })).toBe('lost')
    expect(whaleOutcome({ ...base, teeth: [], yourHp: 0 })).toBe('won') // killing stroke beats simultaneity
    const next = resolveWhaleTurn(base, 'strike')
    expect(next).not.toBe(base)
    expect(base.teeth.every((t) => t.hp === TOOTH_HP)).toBe(true) // original untouched
    const won = playOut(createWhaleFight(withWeapon('jawbreakerMace')), (st) => (strikeTarget(st) ? 'strike' : 'brace'))
    if (whaleOutcome(won) !== null) expect(resolveWhaleTurn(won, 'strike')).toBe(won)
  })
})

// The balance contract (grid-searched, asserted against the real engine). The optional fight must reward the
// forge ladder just like the sour kraken: bare-handed you cannot win; the mace's naive all-strike LOSES (you
// must learn to brace); and the bow safe-wins by interception on a tight clock. Tuning lives in content/void.
describe('the void whale — the balance contract', () => {
  it('cannot be won bare-handed (come armed, or simply leave)', () => {
    expect(bestFinalHp(createWhaleFight(withWeapon(null)))).toBe(-Infinity)
  })

  it('punishes naive all-strike with the mace, but the mace can win with bracing', () => {
    const start = createWhaleFight(withWeapon('jawbreakerMace'))
    expect(whaleOutcome(playOut(start, alwaysStrike))).toBe('lost') // mash-strike loses
    expect(bestFinalHp(start)).toBeGreaterThan(0) // but a braced line wins
  })

  it('bracing forever is a loss — the teeth close and wear you down', () => {
    expect(whaleOutcome(playOut(createWhaleFight(withWeapon('ironSword')), () => 'brace'))).toBe('lost')
  })

  it('lets each forged weapon win with skilled play, bow untouched (pure interception)', () => {
    for (const id of ['woodenSword', 'ironSword', 'candyCaneBow', 'licoriceWhip', 'jawbreakerMace']) {
      expect(bestFinalHp(createWhaleFight(withWeapon(id)))).toBeGreaterThan(0)
    }
    expect(bestFinalHp(createWhaleFight(withWeapon('candyCaneBow')))).toBe(WHALE_PLAYER_HP)
  })
})

// --- the rewards: the hermit's shop, the optional drop, the eclipse ------------------------------

describe("the void whale — the hermit's shop (gloves + grimoire, on the generic rails)", () => {
  /** Reached (in the belly), holding enough candies to buy both. */
  const inBelly = (candies = 2_000_000): GameState => {
    const base = createDefaultSave()
    return {
      ...base,
      flags: { ...base.flags, [VOID_REACHED_FLAG]: true },
      candies: addResource(base.candies, candies),
    }
  }

  it('both entries are visible in the belly, before either is bought', () => {
    const rows = visibleShopRows(inBelly(), HERMIT_SHOP, ITEM_MAP)
    const ids = rows.map((r) => r.item.id)
    expect(ids).toContain(HERMIT_GLOVES.id)
    expect(ids).toContain(BLACK_LICORICE_GRIMOIRE.id)
  })

  it('buying the gloves grants + AUTO-EQUIPS them into the empty gloves slot', () => {
    const glovesEntry = HERMIT_SHOP.find((e) => e.itemId === HERMIT_GLOVES.id)!
    const s = inBelly()
    expect(s.equipped.gloves).toBeNull() // the slot existed, unused
    const r = purchase(s, glovesEntry, ITEM_MAP)
    expect(r.ok).toBe(true)
    expect(r.state.ownedItems[HERMIT_GLOVES.id]).toBe(true)
    expect(r.state.flags[HERMIT_GLOVES.saveFlag]).toBe(true)
    expect(r.state.equipped.gloves).toBe(HERMIT_GLOVES.id) // gloves-slot purchase honored
  })

  it('buying the grimoire grants it + sets the owned flag (which the black grimoire reads)', () => {
    const grimEntry = HERMIT_SHOP.find((e) => e.itemId === BLACK_LICORICE_GRIMOIRE.id)!
    const s = inBelly()
    expect(blackGrimoireOwned(s)).toBe(false)
    const r = purchase(s, grimEntry, ITEM_MAP)
    expect(r.ok).toBe(true)
    expect(r.state.ownedItems[BLACK_LICORICE_GRIMOIRE.id]).toBe(true)
    expect(r.state.flags[BLACK_LICORICE_GRIMOIRE_OWNED_FLAG]).toBe(true)
    expect(blackGrimoireOwned(r.state)).toBe(true)
  })

  it('an owned entry hides its buy (its unlock closes once owned) — bought once each', () => {
    const grimEntry = HERMIT_SHOP.find((e) => e.itemId === BLACK_LICORICE_GRIMOIRE.id)!
    const bought = purchase(inBelly(), grimEntry, ITEM_MAP).state
    const rows = visibleShopRows(bought, HERMIT_SHOP, ITEM_MAP)
    const grimRow = rows.find((r) => r.item.id === BLACK_LICORICE_GRIMOIRE.id)!
    expect(grimRow.owned).toBe(true) // shows as owned, not buyable
  })

  it('the shop + grimoire are reachable WITHOUT fighting (leaving is always allowed — no soft-lock)', () => {
    // Reached but never fought: both items still buyable, the whale-defeated flag never set.
    const s = inBelly()
    expect(voidWhaleDefeated(s)).toBe(false)
    const rows = visibleShopRows(s, HERMIT_SHOP, ITEM_MAP)
    expect(rows.filter((r) => !r.owned)).toHaveLength(2) // both available, no fight required
  })
})

describe('the void whale — the optional void-pearl drop (commit-once)', () => {
  it('grants the pearl + sets the cleared flag exactly once; a second call is SAME ref (farm-proof)', () => {
    const before = createDefaultSave()
    expect(voidWhaleDefeated(before)).toBe(false)
    const after = grantWhaleReward(before)
    expect(after.flags[VOID_WHALE_DEFEATED_FLAG]).toBe(true)
    expect(after.ownedItems[VOID_PEARL.id]).toBe(true)
    expect(after.flags[VOID_PEARL.saveFlag]).toBe(true)
    expect(voidWhaleDefeated(after)).toBe(true)
    expect(grantWhaleReward(after)).toBe(after) // never twice
  })
})

describe("the black grimoire's eclipse — the world spell (pauses the star counter)", () => {
  const telescopeAt = (t: number): GameState => {
    const base = createDefaultSave()
    return {
      ...base,
      flags: { ...base.flags, telescopeOwned: true },
      numbers: { ...base.numbers, telescopeBoughtAtMs: 0 },
      accumulatedGameTimeMs: t,
      starsRemaining: 5000,
    }
  }

  it('refuses to cast without the grimoire owned (SAME reference)', () => {
    const s = telescopeAt(100 * MS_PER_STAR)
    const r = castGrimoireEclipse(s)
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('noGrimoire')
    expect(r.state).toBe(s)
  })

  it('with the grimoire owned, casting pauses the counter for the window (drift-free)', () => {
    const base = telescopeAt(100 * MS_PER_STAR)
    const owned: GameState = { ...base, flags: { ...base.flags, [BLACK_LICORICE_GRIMOIRE_OWNED_FLAG]: true } }
    expect(blackGrimoireOwned(owned)).toBe(true)
    const r = castGrimoireEclipse(owned)
    expect(r.ok).toBe(true)
    expect(eclipsed(r.state)).toBe(true)
    expect(eclipseUntilMs(r.state)).toBe(100 * MS_PER_STAR + ECLIPSE_DURATION_MS)
  })
})
