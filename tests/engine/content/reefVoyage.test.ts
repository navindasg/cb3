import { createDefaultSave } from '@/engine/state/defaultSave'
import {
  voyageLeg,
  voyageWaypoint,
  reefReached,
  currentLeg,
  expectedWaypoint,
  plotWaypoint,
} from '@/engine/content/reefVoyage'
import { VOYAGE_LEGS, REEF_LEG_KEY, REEF_WAYPOINT_KEY } from '@/content/reef/voyage'
import { REEF_REACHED_FLAG } from '@/content/flags'
import type { GameState } from '@/engine/types/GameState'

/** Plot a whole leg correctly, returning the resulting state. */
const plotLeg = (start: GameState, leg: readonly string[]): GameState =>
  leg.reduce((s, id) => plotWaypoint(s, id, VOYAGE_LEGS).state, start)

describe('the first voyage — plotting the crossing', () => {
  it('starts at the first leg, nothing plotted, reef not reached', () => {
    const s = createDefaultSave()
    expect(voyageLeg(s)).toBe(0)
    expect(voyageWaypoint(s)).toBe(0)
    expect(reefReached(s)).toBe(false)
    expect(currentLeg(s, VOYAGE_LEGS)).toEqual(VOYAGE_LEGS[0])
    expect(expectedWaypoint(s, VOYAGE_LEGS)).toBe(VOYAGE_LEGS[0]![0])
  })

  it('a correct pick advances the plot within a leg', () => {
    const s = createDefaultSave()
    const result = plotWaypoint(s, VOYAGE_LEGS[0]![0]!, VOYAGE_LEGS)
    expect(result.ok).toBe(true)
    expect(result.correct).toBe(true)
    expect(result.legComplete).toBe(false)
    expect(voyageWaypoint(result.state)).toBe(1)
    expect(expectedWaypoint(result.state, VOYAGE_LEGS)).toBe(VOYAGE_LEGS[0]![1])
  })

  it('a wrong pick loses the leg (plot back to 0), but keeps the leg — cannot soft-lock', () => {
    const s = plotWaypoint(createDefaultSave(), VOYAGE_LEGS[0]![0]!, VOYAGE_LEGS).state
    expect(voyageWaypoint(s)).toBe(1)
    const wrong = plotWaypoint(s, 'reefEdge', VOYAGE_LEGS) // not the expected 2nd waypoint of leg 0
    expect(wrong.ok).toBe(true)
    expect(wrong.correct).toBe(false)
    expect(voyageWaypoint(wrong.state)).toBe(0)
    expect(voyageLeg(wrong.state)).toBe(0) // leg preserved
    expect(reefReached(wrong.state)).toBe(false)
  })

  it('a wrong pick on a fresh leg (waypoint 0) stays at 0 on the same leg — no soft-lock', () => {
    const s = createDefaultSave()
    const wrong = plotWaypoint(s, 'reefEdge', VOYAGE_LEGS) // leg 0 expects moonShadow first
    expect(wrong.ok).toBe(true)
    expect(wrong.correct).toBe(false)
    expect(voyageWaypoint(wrong.state)).toBe(0)
    expect(voyageLeg(wrong.state)).toBe(0)
    expect(reefReached(wrong.state)).toBe(false)
  })

  it('completing a leg steps to the next leg (not the final one)', () => {
    const after = plotLeg(createDefaultSave(), VOYAGE_LEGS[0]!)
    expect(voyageLeg(after)).toBe(1)
    expect(voyageWaypoint(after)).toBe(0)
    expect(reefReached(after)).toBe(false)
    expect(currentLeg(after, VOYAGE_LEGS)).toEqual(VOYAGE_LEGS[1])
  })

  it('the leg-complete result flags legComplete but not reached (mid-voyage)', () => {
    const leg0 = VOYAGE_LEGS[0]!
    let s = createDefaultSave()
    for (let i = 0; i < leg0.length - 1; i++) s = plotWaypoint(s, leg0[i]!, VOYAGE_LEGS).state
    const last = plotWaypoint(s, leg0[leg0.length - 1]!, VOYAGE_LEGS)
    expect(last.legComplete).toBe(true)
    expect(last.reached).toBe(false)
  })

  it('plotting every leg reaches the reef and sets the flag', () => {
    let s = createDefaultSave()
    for (const leg of VOYAGE_LEGS) s = plotLeg(s, leg)
    expect(reefReached(s)).toBe(true)
    expect(s.flags[REEF_REACHED_FLAG]).toBe(true)
    expect(voyageLeg(s)).toBe(VOYAGE_LEGS.length)
  })

  it('the final correct pick reports reached + legComplete', () => {
    let s = createDefaultSave()
    for (let i = 0; i < VOYAGE_LEGS.length - 1; i++) s = plotLeg(s, VOYAGE_LEGS[i]!)
    const finalLeg = VOYAGE_LEGS[VOYAGE_LEGS.length - 1]!
    for (let i = 0; i < finalLeg.length - 1; i++) s = plotWaypoint(s, finalLeg[i]!, VOYAGE_LEGS).state
    const last = plotWaypoint(s, finalLeg[finalLeg.length - 1]!, VOYAGE_LEGS)
    expect(last.reached).toBe(true)
    expect(last.legComplete).toBe(true)
  })

  it('is a no-op (same reference) once the reef is reached', () => {
    let s = createDefaultSave()
    for (const leg of VOYAGE_LEGS) s = plotLeg(s, leg)
    const result = plotWaypoint(s, VOYAGE_LEGS[0]![0]!, VOYAGE_LEGS)
    expect(result.ok).toBe(false)
    expect(result.state).toBe(s)
    expect(expectedWaypoint(s, VOYAGE_LEGS)).toBeNull()
    expect(currentLeg(s, VOYAGE_LEGS)).toBeNull()
  })

  it('does not mutate the input state', () => {
    const before = createDefaultSave()
    plotWaypoint(before, VOYAGE_LEGS[0]![0]!, VOYAGE_LEGS)
    expect(before.numbers[REEF_LEG_KEY]).toBeUndefined()
    expect(before.numbers[REEF_WAYPOINT_KEY]).toBeUndefined()
  })
})
