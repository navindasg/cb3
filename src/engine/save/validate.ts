import { z } from 'zod'
import type { SaveEnvelope } from '@/engine/types/GameState'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { decodeSave } from '@/engine/save/envelope'
import {
  migrateEnvelope,
  FutureVersionError,
  type RawEnvelope,
  type MigrateOptions,
} from '@/engine/save/migrations'

// Import is resilient by design: saves are shareable and hand-editable, so a
// single bad field must never crash the game — it falls back to its default.
// Only a fundamentally unrecognisable payload is rejected (caller keeps the
// current save and surfaces the error). Prototype-pollution keys are stripped
// before anything touches the object.

const D = createDefaultSave()

const finiteNumber = (fallback: number) =>
  z.preprocess((v) => (typeof v === 'number' && Number.isFinite(v) ? v : fallback), z.number())

const nonNegative = (fallback: number) =>
  z.preprocess(
    (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : fallback),
    z.number(),
  )

const flag = (fallback: boolean) =>
  z.preprocess((v) => (typeof v === 'boolean' ? v : fallback), z.boolean())

const nullableId = () =>
  z.preprocess((v) => (typeof v === 'string' ? v : null), z.union([z.string(), z.null()]))

const resource = (d: { current: number; lifetimeAccumulated: number; historicalMax: number }) =>
  z
    .object({
      current: nonNegative(d.current),
      lifetimeAccumulated: nonNegative(d.lifetimeAccumulated),
      historicalMax: nonNegative(d.historicalMax),
    })
    .catch(d)

const stateSchema = z.object({
  accumulatedGameTimeMs: nonNegative(D.accumulatedGameTimeMs),
  totalPlaytimeSeconds: nonNegative(D.totalPlaytimeSeconds),
  nGPlusRun: nonNegative(D.nGPlusRun),

  candies: resource(D.candies),
  lollipops: resource(D.lollipops),
  chocolate: resource(D.chocolate),
  caramel: resource(D.caramel),
  rockCandy: resource(D.rockCandy),
  cottonCandy: resource(D.cottonCandy),
  licorice: resource(D.licorice),
  popRocks: resource(D.popRocks),
  sour: resource(D.sour),
  peppermint: resource(D.peppermint),
  mint: resource(D.mint),
  stardust: resource(D.stardust),

  lifetimeCandiesEaten: nonNegative(D.lifetimeCandiesEaten),
  lifetimeCandiesThrown: nonNegative(D.lifetimeCandiesThrown),
  starsRemaining: nonNegative(D.starsRemaining),

  boxClosed: flag(D.boxClosed),

  playerHpCurrent: nonNegative(D.playerHpCurrent),
  manaCurrent: nonNegative(D.manaCurrent),

  equipped: z
    .object({
      weapon: nullableId(),
      hat: nullableId(),
      armour: nullableId(),
      gloves: nullableId(),
      boots: nullableId(),
    })
    .catch(D.equipped),

  ownedItems: z.record(z.string(), z.boolean()).catch({}),
  flags: z.record(z.string(), z.boolean()).catch({}),
  numbers: z.record(z.string(), finiteNumber(0)).catch({}),
  strings: z.record(z.string(), z.string()).catch(D.strings),

  ngPlusCarryover: z
    .union([
      z.object({
        lifetimeCandiesEaten: nonNegative(0),
        starsRemaining: nonNegative(0),
        nGPlusRun: nonNegative(0),
      }),
      z.null(),
    ])
    .catch(null),
})

const envelopeSchema = z.object({
  v: finiteNumber(1),
  t: finiteNumber(0),
  lastTick: finiteNumber(0),
  checksum: z.string().optional(),
  state: stateSchema,
})

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

function stripDangerousKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripDangerousKeys)
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [key, child] of Object.entries(value)) {
      if (DANGEROUS_KEYS.has(key)) continue
      out[key] = stripDangerousKeys(child)
    }
    return out
  }
  return value
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export type ImportResult =
  | { ok: true; envelope: SaveEnvelope }
  | { ok: false; reason: 'decode' | 'future-version' | 'invalid'; error: string }

/** decode -> strip -> refuse-future -> migrate -> validate. Never throws. */
export function importSave(encoded: string, options: MigrateOptions = {}): ImportResult {
  let decoded: unknown
  try {
    decoded = decodeSave(encoded)
  } catch (error) {
    return { ok: false, reason: 'decode', error: messageOf(error) }
  }

  const sanitized = stripDangerousKeys(decoded)
  if (!isObject(sanitized) || typeof sanitized['v'] !== 'number' || !isObject(sanitized['state'])) {
    return { ok: false, reason: 'invalid', error: 'not a recognisable save envelope' }
  }

  let migrated: RawEnvelope
  try {
    migrated = migrateEnvelope(sanitized as unknown as RawEnvelope, options)
  } catch (error) {
    if (error instanceof FutureVersionError) {
      return { ok: false, reason: 'future-version', error: error.message }
    }
    return { ok: false, reason: 'invalid', error: messageOf(error) }
  }

  const parsed = envelopeSchema.safeParse(migrated)
  if (!parsed.success) {
    return { ok: false, reason: 'invalid', error: parsed.error.message }
  }
  return { ok: true, envelope: parsed.data as unknown as SaveEnvelope }
}
