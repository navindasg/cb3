import LZString from 'lz-string'
import { importSave } from '@/engine/save/validate'
import { makeEnvelope, encodeSave } from '@/engine/save/envelope'
import { createDefaultSave } from '@/engine/state/defaultSave'

const encodeObject = (obj: unknown): string => LZString.compressToBase64(JSON.stringify(obj))

describe('importSave', () => {
  it('accepts a valid save and returns the envelope', () => {
    const result = importSave(encodeSave(makeEnvelope(createDefaultSave(), 100)))
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.envelope.state.candies.current).toBe(1)
      expect(result.envelope.state.starsRemaining).toBe(8128)
    }
  })

  it('loads a hand-edited but valid save', () => {
    const obj = JSON.parse(JSON.stringify(makeEnvelope(createDefaultSave(), 0)))
    obj.state.candies.current = 999
    const result = importSave(encodeObject(obj))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.envelope.state.candies.current).toBe(999)
  })

  it('clamps out-of-range fields instead of crashing', () => {
    const obj = JSON.parse(JSON.stringify(makeEnvelope(createDefaultSave(), 0)))
    obj.state.candies.current = -50
    const result = importSave(encodeObject(obj))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.envelope.state.candies.current).toBe(0)
  })

  it('defaults non-finite/corrupted numbers to safe values', () => {
    const obj = JSON.parse(JSON.stringify(makeEnvelope(createDefaultSave(), 0)))
    obj.state.starsRemaining = null // JSON has no NaN; null stands in for corruption
    const result = importSave(encodeObject(obj))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.envelope.state.starsRemaining).toBe(8128)
  })

  it('strips prototype-pollution keys and still loads', () => {
    const stateJson = JSON.stringify(createDefaultSave())
    const polluted = `{"v":1,"t":0,"lastTick":0,"state":${stateJson.replace(
      '{',
      '{"__proto__":{"polluted":true},',
    )}}`
    const result = importSave(LZString.compressToBase64(polluted))
    expect(result.ok).toBe(true)
    expect((Object.prototype as Record<string, unknown>)['polluted']).toBeUndefined()
  })

  it('returns a decode error for a corrupted string', () => {
    const result = importSave('@@@garbage@@@')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('decode')
  })

  it('refuses a future-version save', () => {
    const obj = JSON.parse(JSON.stringify(makeEnvelope(createDefaultSave(), 0)))
    obj.v = 999
    const result = importSave(encodeObject(obj))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('future-version')
  })

  it('rejects a non-envelope object', () => {
    const result = importSave(encodeObject({ hello: 'world' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid')
  })

  it('returns invalid when an old save has no migration path', () => {
    const obj = JSON.parse(JSON.stringify(makeEnvelope(createDefaultSave(), 0)))
    obj.v = 0 // older than current (1), but no v0 -> v1 migration is registered
    const result = importSave(encodeObject(obj))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe('invalid')
  })
})
