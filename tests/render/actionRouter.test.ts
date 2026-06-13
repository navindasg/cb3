import { parseAction } from '@/render/actionRouter'

describe('parseAction', () => {
  it('splits a kind:target action', () => {
    expect(parseAction('enter:shop')).toEqual({ kind: 'enter', target: 'shop' })
    expect(parseAction('quest:beanstalkClimb')).toEqual({ kind: 'quest', target: 'beanstalkClimb' })
    expect(parseAction('travel:beanstalkElevator')).toEqual({
      kind: 'travel',
      target: 'beanstalkElevator',
    })
  })

  it('treats a bare action as its own kind with an empty target', () => {
    expect(parseAction('eat')).toEqual({ kind: 'eat', target: '' })
  })

  it('keeps colons in the target intact (only the first colon splits)', () => {
    expect(parseAction('interact:well:north')).toEqual({ kind: 'interact', target: 'well:north' })
  })

  it('trims surrounding whitespace', () => {
    expect(parseAction('  enter:forge  ')).toEqual({ kind: 'enter', target: 'forge' })
  })
})
