import { buildBeanstalkBackdrop, BEANSTALK_BACKDROP } from '@/render/arenaBackdrop'
import { BEANSTALK_CLIMB } from '@/content/quests/beanstalkClimb'

describe('buildBeanstalkBackdrop', () => {
  const rows = buildBeanstalkBackdrop()

  it('matches the climb grid dimensions exactly (so it composites 1:1 under the entities)', () => {
    expect(rows.length).toBe(BEANSTALK_CLIMB.height)
    for (const row of rows) expect(row.length).toBe(BEANSTALK_CLIMB.width)
  })

  it('draws the clouds at the top and the garden soil at the bottom', () => {
    expect(rows[0]).toContain('the clouds')
    expect(rows[rows.length - 1]).toBe('#'.repeat(BEANSTALK_CLIMB.width))
    expect(rows.some((r) => r.includes('the garden'))).toBe(true)
  })

  it('runs a continuous beanstalk stalk up the middle', () => {
    // The two centre columns carry the stalk through the mid-section of the climb.
    const mid = rows[24] ?? ''
    expect(mid[7]).toBe('|')
    expect(mid[8]).toBe('|')
  })

  it('exposes a prebuilt singleton', () => {
    expect(BEANSTALK_BACKDROP).toEqual(rows)
  })
})
