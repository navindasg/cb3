import {
  createChase,
  aimBy,
  looseHarpoon,
  chaseOver,
  cometExited,
  interceptAimRad,
  interceptPoint,
  aimAdvice,
  currentPass,
  cometCatchable,
  msUntilNextPass,
  canRide,
  rideComet,
  type ChaseState,
} from '@/engine/content/cometChase'
import {
  AIM_MIN,
  AIM_MAX,
  AIM_STEP,
  HARPOONS_PER_PASS,
  COMET_LAST_PASS_KEY,
  COMET_PERIOD_MS,
  ARENA_W,
  RIDE_STARDUST_COST,
} from '@/content/comet/cometChase'
import { addResource } from '@/engine/types/Resource'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { Vec2 } from '@/engine/quest/Vec2'

describe('the comet chase — the lead-the-target harpoon', () => {
  it('starts with the comet at entry, full ammo, not caught', () => {
    const c = createChase()
    expect(c.harpoonsLeft).toBe(HARPOONS_PER_PASS)
    expect(c.caught).toBe(false)
    expect(chaseOver(c)).toBe(false)
    expect(cometExited(c)).toBe(false)
  })

  it('catches the comet when fired exactly at the intercept lead', () => {
    const c = createChase()
    const lead = interceptAimRad(c)
    const aimed: ChaseState = { ...c, aimRad: lead }
    const result = looseHarpoon(aimed)
    expect(result.caught).toBe(true)
    expect(result.state.caught).toBe(true)
    expect(chaseOver(result.state)).toBe(true)
    expect(result.state.harpoonsLeft).toBe(HARPOONS_PER_PASS - 1)
  })

  it('tolerates aiming a notch off the perfect lead (the by-eye window)', () => {
    const c = createChase()
    const lead = interceptAimRad(c)
    expect(looseHarpoon({ ...c, aimRad: lead + AIM_STEP }).caught).toBe(true)
    expect(looseHarpoon({ ...c, aimRad: lead - AIM_STEP }).caught).toBe(true)
  })

  it('misses on a wildly wrong aim, spends a harpoon, and the comet drifts on', () => {
    const c = createChase()
    const result = looseHarpoon({ ...c, aimRad: AIM_MIN }) // straight up — nowhere near the lead
    expect(result.caught).toBe(false)
    expect(result.state.harpoonsLeft).toBe(HARPOONS_PER_PASS - 1)
    // the comet kept moving down-and-left during the (missed) flight
    expect(result.state.comet.x).toBeLessThan(c.comet.x)
    expect(result.state.comet.y).toBeGreaterThan(c.comet.y)
  })

  it('ends the chase when the comet exits the arena', () => {
    // a comet at the field's left edge: one drift step carries it out of bounds
    const nearEdge: ChaseState = { comet: new Vec2(1, 2), aimRad: AIM_MIN, harpoonsLeft: 3, caught: false }
    const result = looseHarpoon(nearEdge) // wild upward shot — won't catch a comet at the far edge
    expect(result.caught).toBe(false)
    expect(cometExited(result.state)).toBe(true)
    expect(chaseOver(result.state)).toBe(true)
  })

  it('ends the chase when the harpoons run out', () => {
    let c = createChase()
    for (let i = 0; i < HARPOONS_PER_PASS; i++) c = looseHarpoon({ ...c, aimRad: AIM_MIN }).state
    expect(c.harpoonsLeft).toBe(0)
    expect(c.caught).toBe(false)
    expect(chaseOver(c)).toBe(true)
  })

  it('is a no-op (same reference) once the chase is over', () => {
    const dead: ChaseState = { comet: new Vec2(5, 5), aimRad: -0.5, harpoonsLeft: 0, caught: false }
    const result = looseHarpoon(dead)
    expect(result.state).toBe(dead)
    expect(result.caught).toBe(false)
  })

  it('still yields a finite lead for a receding comet (the harpoon outpaces it)', () => {
    // even a comet that has drifted off-field is interceptable — the harpoon is faster than the comet
    const gone: ChaseState = { comet: new Vec2(-50, 40), aimRad: -0.5, harpoonsLeft: 3, caught: false }
    expect(Number.isFinite(interceptAimRad(gone))).toBe(true)
  })
})

describe('the comet chase — aiming', () => {
  it('nudges the aim and clamps to the battery arc', () => {
    const c = createChase()
    expect(aimBy(c, AIM_STEP).aimRad).toBeCloseTo(c.aimRad + AIM_STEP)
    // cannot aim above the arc top
    let up = c
    for (let i = 0; i < 200; i++) up = aimBy(up, -AIM_STEP)
    expect(up.aimRad).toBeCloseTo(AIM_MIN)
    // cannot aim below the arc bottom
    let down = c
    for (let i = 0; i < 200; i++) down = aimBy(down, AIM_STEP)
    expect(down.aimRad).toBeCloseTo(AIM_MAX)
  })

  it('returns the SAME reference when a nudge hits an arc limit (no-op)', () => {
    const atTop: ChaseState = { ...createChase(), aimRad: AIM_MIN }
    expect(aimBy(atTop, -AIM_STEP)).toBe(atTop)
  })

  it('the intercept lead falls inside the battery arc for the seed comet', () => {
    const lead = interceptAimRad(createChase())
    expect(lead).toBeGreaterThanOrEqual(AIM_MIN)
    expect(lead).toBeLessThanOrEqual(AIM_MAX)
  })

  it('interceptPoint leads the comet — ahead of it along its drift (down and to the left)', () => {
    const c = createChase()
    const lead = interceptPoint(c)
    // the comet drifts down-left, so the lead point sits left of and below its current position
    expect(lead.x).toBeLessThan(c.comet.x)
    expect(lead.y).toBeGreaterThan(c.comet.y)
    // and aiming the battery AT the lead point catches the comet
    const aimedAtLead = looseHarpoon({ ...c, aimRad: Math.atan2(lead.y - 14, lead.x - 3) })
    expect(aimedAtLead.caught).toBe(true)
  })

  it('aimAdvice says fire at the lead, and which way to swing off it', () => {
    const c = createChase()
    const lead = interceptAimRad(c)
    expect(aimAdvice({ ...c, aimRad: lead })).toBe('fire')
    // aim well above the lead (more negative) -> swing down toward it = 'lower'
    expect(aimAdvice({ ...c, aimRad: AIM_MIN })).toBe('lower')
    // aim well below the lead (less negative) -> swing up toward it = 'higher'
    expect(aimAdvice({ ...c, aimRad: AIM_MAX })).toBe('higher')
  })
})

describe('the comet pass cooldown (the soft-timer faucet)', () => {
  it('derives the pass index from accumulated game time', () => {
    const s = createDefaultSave()
    expect(currentPass({ ...s, accumulatedGameTimeMs: 0 })).toBe(0)
    expect(currentPass({ ...s, accumulatedGameTimeMs: COMET_PERIOD_MS * 2.5 })).toBe(2)
  })

  it('is catchable on a fresh pass and not after it has been harvested', () => {
    const s = { ...createDefaultSave(), accumulatedGameTimeMs: COMET_PERIOD_MS * 4 }
    expect(cometCatchable(s)).toBe(true)
    const harvested = { ...s, numbers: { ...s.numbers, [COMET_LAST_PASS_KEY]: currentPass(s) } }
    expect(cometCatchable(harvested)).toBe(false)
  })

  it('becomes catchable again on the next pass', () => {
    const s = { ...createDefaultSave(), accumulatedGameTimeMs: COMET_PERIOD_MS * 4 }
    const harvested = { ...s, numbers: { ...s.numbers, [COMET_LAST_PASS_KEY]: currentPass(s) } }
    const nextPass = { ...harvested, accumulatedGameTimeMs: COMET_PERIOD_MS * 5 }
    expect(cometCatchable(nextPass)).toBe(true)
  })

  it('reports the time until the next pass when on cooldown, 0 when catchable', () => {
    const s = { ...createDefaultSave(), accumulatedGameTimeMs: COMET_PERIOD_MS * 4 + 20_000 }
    expect(msUntilNextPass(s)).toBe(0)
    const harvested = { ...s, numbers: { ...s.numbers, [COMET_LAST_PASS_KEY]: currentPass(s) } }
    expect(msUntilNextPass(harvested)).toBe(COMET_PERIOD_MS - 20_000)
  })

  it('the seed comet stays within the arena width (a sanity check on the config)', () => {
    expect(createChase().comet.x).toBeLessThanOrEqual(ARENA_W)
  })
})

describe('riding the comet (the §175 fast-travel, fuelled by stardust)', () => {
  const withStardust = (n: number) => ({
    ...createDefaultSave(),
    stardust: addResource(createDefaultSave().stardust, n),
  })

  it('cannot ride with no stardust', () => {
    expect(canRide(createDefaultSave())).toBe(false)
  })

  it('can ride once you hold the fare', () => {
    expect(canRide(withStardust(RIDE_STARDUST_COST))).toBe(true)
    expect(canRide(withStardust(RIDE_STARDUST_COST - 1))).toBe(false)
  })

  it('a ride burns exactly the fare and leaves the rest', () => {
    const s = withStardust(RIDE_STARDUST_COST + 3)
    const result = rideComet(s)
    expect(result.ok).toBe(true)
    expect(result.state.stardust.current).toBe(3)
  })

  it('refuses (and is a no-op, same reference) when the fare is short', () => {
    const s = withStardust(RIDE_STARDUST_COST - 1)
    const result = rideComet(s)
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('unaffordable')
    expect(result.state).toBe(s)
  })
})
