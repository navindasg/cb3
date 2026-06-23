import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  skyPortOpen,
  contributed,
  remaining,
  commissionComplete,
  galleonCommissioned,
  galleonName,
  contribute,
  nameGalleon,
} from '@/engine/content/galleonCommission'
import {
  GALLEON_COMMISSION,
  GALLEON_CONTRIB_PREFIX,
  GALLEON_NAME_KEY,
} from '@/content/ship/galleon'
import { CELESTIAL_NAVIGATION_FLAG, FISHBOWL_HELM_FORGED_FLAG } from '@/content/flags'
import type { GameState, ResourceKey } from '@/engine/types/GameState'
import { createResource } from '@/engine/types/Resource'

const contribKey = (r: ResourceKey): string => `${GALLEON_CONTRIB_PREFIX}${r}`

/** A state with the Act-1 gate cleared (the sky port is open). */
const withGate = (): GameState => {
  const s = createDefaultSave()
  return {
    ...s,
    flags: { ...s.flags, [CELESTIAL_NAVIGATION_FLAG]: true, [FISHBOWL_HELM_FORGED_FLAG]: true },
  }
}

/** A state that holds `n` of every commission resource (gate cleared). */
const withStock = (n: number): GameState => {
  const s = withGate()
  const stocked: Partial<Record<ResourceKey, ReturnType<typeof createResource>>> = {}
  for (const line of GALLEON_COMMISSION) stocked[line.resource] = createResource(n)
  return { ...s, ...stocked }
}

/** A state with every line already fully delivered (ledger filled), gate cleared. */
const withCompleteCommission = (): GameState => {
  const s = withGate()
  const numbers = { ...s.numbers }
  for (const line of GALLEON_COMMISSION) numbers[contribKey(line.resource)] = line.amount
  return { ...s, numbers }
}

describe('the galleon commission — the sky port gate', () => {
  it('is shut until the Act-1 gate (navigation + the fishbowl helm) is cleared', () => {
    const s = createDefaultSave()
    expect(skyPortOpen(s)).toBe(false)
    expect(skyPortOpen({ ...s, flags: { ...s.flags, [CELESTIAL_NAVIGATION_FLAG]: true } })).toBe(false)
    expect(skyPortOpen({ ...s, flags: { ...s.flags, [FISHBOWL_HELM_FORGED_FLAG]: true } })).toBe(false)
    expect(skyPortOpen(withGate())).toBe(true)
  })
})

describe('the galleon commission — the materials ledger', () => {
  it('starts empty: nothing contributed, everything still required', () => {
    const s = withGate()
    for (const line of GALLEON_COMMISSION) {
      expect(contributed(s, line.resource)).toBe(0)
      expect(remaining(s, line.resource)).toBe(line.amount)
    }
    expect(commissionComplete(s)).toBe(false)
  })

  it('remaining is 0 for a resource not on the commission (lollipops)', () => {
    expect(remaining(withGate(), 'lollipops')).toBe(0)
  })

  it('contributes all of a resource the player holds, capped at what the line needs', () => {
    const line = GALLEON_COMMISSION[0]!
    // Hold less than needed: the whole hoard is delivered, line still short.
    const partial = contribute({ ...withGate(), [line.resource]: createResource(line.amount - 10) }, line.resource)
    expect(partial.ok).toBe(true)
    expect(partial.delivered).toBe(line.amount - 10)
    expect(partial.state[line.resource].current).toBe(0)
    expect(contributed(partial.state, line.resource)).toBe(line.amount - 10)
    expect(remaining(partial.state, line.resource)).toBe(10)
  })

  it('caps a contribution at the remaining need, leaving the surplus with the player', () => {
    const line = GALLEON_COMMISSION[0]!
    const result = contribute({ ...withGate(), [line.resource]: createResource(line.amount + 250) }, line.resource)
    expect(result.ok).toBe(true)
    expect(result.delivered).toBe(line.amount)
    expect(result.state[line.resource].current).toBe(250) // surplus untouched
    expect(remaining(result.state, line.resource)).toBe(0)
  })

  it('refuses to contribute when the port is shut (same reference)', () => {
    const before = { ...createDefaultSave(), candies: createResource(1_000_000) }
    const result = contribute(before, 'candies')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('closed')
    expect(result.state).toBe(before)
  })

  it('refuses to contribute to an already-full line (same reference)', () => {
    const before = withCompleteCommission()
    const stocked = { ...before, candies: createResource(1_000_000) }
    const result = contribute(stocked, 'candies')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('lineFull')
    expect(result.state).toBe(stocked)
  })

  it('refuses to contribute when the player holds none of the resource (same reference)', () => {
    const before = withGate() // default stock of rock candy is 0
    const result = contribute(before, 'rockCandy')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('nothingToGive')
    expect(result.state).toBe(before)
  })

  it('refuses to contribute an off-commission resource (same reference, lineFull)', () => {
    const before = { ...withGate(), lollipops: createResource(99) }
    const result = contribute(before, 'lollipops')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('lineFull') // off-commission lines need nothing
    expect(result.state).toBe(before)
  })

  it('floors a fractional delivery so the ledger stays whole (producers drip sub-unit amounts)', () => {
    const line = GALLEON_COMMISSION[0]!
    // Hold a fractional amount below the line need: the whole units are delivered, the dust stays.
    const before = { ...withGate(), [line.resource]: createResource(1234.56) }
    const result = contribute(before, line.resource)
    expect(result.ok).toBe(true)
    expect(result.delivered).toBe(1234)
    expect(contributed(result.state, line.resource)).toBe(1234)
    expect(result.state[line.resource].current).toBeCloseTo(0.56)
  })

  it('reaches exactly the line amount across repeated partial (fractional) deliveries', () => {
    const line = GALLEON_COMMISSION[1]! // rock candy, 100
    let s = { ...withGate(), [line.resource]: createResource(40.4) }
    s = contribute(s, line.resource).state // delivers 40
    s = { ...s, [line.resource]: createResource(70.9) }
    s = contribute(s, line.resource).state // delivers min(floor(70.9), 60) = 60 -> exactly 100
    expect(contributed(s, line.resource)).toBe(line.amount)
    expect(remaining(s, line.resource)).toBe(0)
  })

  it('does not mutate the input state', () => {
    const line = GALLEON_COMMISSION[0]!
    const before = { ...withGate(), [line.resource]: createResource(line.amount) }
    contribute(before, line.resource)
    expect(before[line.resource].current).toBe(line.amount)
    expect(contributed(before, line.resource)).toBe(0)
  })

  it('completes once every line is delivered', () => {
    let s = withStock(1_000_000)
    for (const line of GALLEON_COMMISSION) {
      expect(commissionComplete(s)).toBe(false)
      s = contribute(s, line.resource).state
    }
    expect(commissionComplete(s)).toBe(true)
  })
})

describe('the galleon commission — naming + laying her down', () => {
  it('refuses to name an incomplete commission (same reference)', () => {
    const before = withGate()
    const result = nameGalleon(before, 'the Sweet Tooth')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('incomplete')
    expect(result.state).toBe(before)
    expect(galleonCommissioned(before)).toBe(false)
  })

  it('refuses an empty / whitespace-only name on a complete commission (same reference)', () => {
    const before = withCompleteCommission()
    const result = nameGalleon(before, '   ')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('emptyName')
    expect(result.state).toBe(before)
  })

  it('names + lays down a complete commission, trimming the name', () => {
    const before = withCompleteCommission()
    const result = nameGalleon(before, '  the Sweet Tooth  ')
    expect(result.ok).toBe(true)
    expect(galleonCommissioned(result.state)).toBe(true)
    expect(galleonName(result.state)).toBe('the Sweet Tooth')
    expect(result.state.strings[GALLEON_NAME_KEY]).toBe('the Sweet Tooth')
  })

  it('refuses to re-name an already-commissioned galleon (same reference)', () => {
    const launched = nameGalleon(withCompleteCommission(), 'Candy Box').state
    const result = nameGalleon(launched, 'something else')
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('alreadyNamed')
    expect(result.state).toBe(launched)
    expect(galleonName(result.state)).toBe('Candy Box')
  })

  it('galleonName is empty before naming', () => {
    expect(galleonName(withGate())).toBe('')
  })
})
