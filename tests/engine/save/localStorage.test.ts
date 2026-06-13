import {
  createSaveStore,
  requestPersistence,
  type StorageLike,
} from '@/engine/save/localStorage'
import { makeEnvelope } from '@/engine/save/envelope'
import { createDefaultSave } from '@/engine/state/defaultSave'

function fakeStorage(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>()
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v)
    },
    removeItem: (k) => {
      map.delete(k)
    },
  }
}

const env = makeEnvelope(createDefaultSave(), 7)

describe('createSaveStore', () => {
  it('writes slot data and meta on save', () => {
    const storage = fakeStorage()
    const result = createSaveStore({ storage }).save(1, env)
    expect(result.ok).toBe(true)
    expect(storage.map.has('cb3.slot1')).toBe(true)
    expect(storage.map.has('cb3.slot1.meta')).toBe(true)
  })

  it('reads meta without decoding the full save', () => {
    const storage = fakeStorage()
    const store = createSaveStore({ storage })
    store.save(1, env)
    const meta = store.readMeta(1)
    expect(meta?.version).toBe(env.v)
    expect(meta?.savedAt).toBe(7)
    expect(meta?.lifetimeCandiesEaten).toBe(0)
  })

  it('round-trips raw save bytes and returns null for a missing slot', () => {
    const storage = fakeStorage()
    const store = createSaveStore({ storage })
    store.save('main', env)
    expect(store.loadRaw('main')).toBe(storage.map.get('cb3.slotmain'))
    expect(store.loadRaw('missing')).toBeNull()
  })

  it('returns null meta for a missing or corrupt meta key', () => {
    const storage = fakeStorage()
    const store = createSaveStore({ storage })
    expect(store.readMeta(9)).toBeNull()
    storage.map.set('cb3.slot9.meta', 'not json')
    expect(store.readMeta(9)).toBeNull()
  })

  it('degrades gracefully on quota errors (no throw)', () => {
    const store = createSaveStore({
      storage: {
        getItem: () => null,
        setItem: () => {
          throw new Error('QuotaExceededError')
        },
        removeItem: () => {},
      },
    })
    const result = store.save(1, env)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain('Quota')
  })

  it('rotates autosaves across the configured slots', () => {
    const storage = fakeStorage()
    const store = createSaveStore({ storage, autosaveSlots: 3 })
    store.autosave(env)
    store.autosave(env)
    store.autosave(env)
    store.autosave(env) // wraps back to slot 1
    expect(storage.map.has('cb3.slotautosave1')).toBe(true)
    expect(storage.map.has('cb3.slotautosave2')).toBe(true)
    expect(storage.map.has('cb3.slotautosave3')).toBe(true)
  })

  it('clear removes both slot and meta keys', () => {
    const storage = fakeStorage()
    const store = createSaveStore({ storage })
    store.save(1, env)
    store.clear(1)
    expect(storage.map.has('cb3.slot1')).toBe(false)
    expect(storage.map.has('cb3.slot1.meta')).toBe(false)
  })
})

describe('requestPersistence', () => {
  it('resolves to a boolean even when the API is unavailable', async () => {
    expect(typeof (await requestPersistence())).toBe('boolean')
  })
})
