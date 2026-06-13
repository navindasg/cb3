import LZString from 'lz-string'
import { makeEnvelope, encodeSave, decodeSave, SaveDecodeError } from '@/engine/save/envelope'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { CURRENT_SCHEMA_VERSION } from '@/engine/types/GameState'

describe('envelope', () => {
  it('makeEnvelope stamps version and timestamps', () => {
    const env = makeEnvelope(createDefaultSave(), 1234)
    expect(env.v).toBe(CURRENT_SCHEMA_VERSION)
    expect(env.t).toBe(1234)
    expect(env.lastTick).toBe(1234)
    expect(env.state.candies.current).toBe(1)
  })

  it('round-trips through encode/decode', () => {
    const env = makeEnvelope(createDefaultSave(), 42)
    expect(decodeSave(encodeSave(env))).toEqual(env)
  })

  it('throws SaveDecodeError on non-base64 garbage', () => {
    expect(() => decodeSave('@@@not valid@@@')).toThrow(SaveDecodeError)
  })

  it('throws SaveDecodeError when the payload is valid base64 but not JSON', () => {
    const notJson = LZString.compressToBase64('hello, not json')
    expect(() => decodeSave(notJson)).toThrow(SaveDecodeError)
  })
})
