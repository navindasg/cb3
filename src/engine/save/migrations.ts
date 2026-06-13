import { CURRENT_SCHEMA_VERSION } from '@/engine/types/GameState'

// Ordered migration ladder. MIGRATIONS[from] upgrades a state from version `from`
// to `from + 1`. They run in sequence on load so an ancient save climbs to the
// current schema one rung at a time. v1 is the base, so the ladder is empty until
// the first schema change (e.g. when Act 2 adds the peppermint resource).

export class FutureVersionError extends Error {
  constructor(
    readonly found: number,
    readonly current: number,
  ) {
    super(`save version ${found} is newer than this game (v${current}); refusing to load`)
    this.name = 'FutureVersionError'
  }
}

export class MigrationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MigrationError'
  }
}

export type StateMigration = (state: Record<string, unknown>) => Record<string, unknown>

export interface RawEnvelope {
  v: number
  state: Record<string, unknown>
  [key: string]: unknown
}

export const MIGRATIONS: Readonly<Record<number, StateMigration>> = {
  // 1: (s) => ({ ...s, peppermint: { current: 0, lifetimeAccumulated: 0, historicalMax: 0 } }),
}

export interface MigrateOptions {
  currentVersion?: number
  ladder?: Readonly<Record<number, StateMigration>>
}

/** Walk the ladder from `raw.v` up to the current version. Refuses newer saves. */
export function migrateEnvelope(raw: RawEnvelope, options: MigrateOptions = {}): RawEnvelope {
  const currentVersion = options.currentVersion ?? CURRENT_SCHEMA_VERSION
  const ladder = options.ladder ?? MIGRATIONS

  if (!Number.isInteger(raw.v)) {
    throw new MigrationError('save envelope has no integer version')
  }
  if (raw.v > currentVersion) {
    throw new FutureVersionError(raw.v, currentVersion)
  }

  let state = raw.state
  for (let from = raw.v; from < currentVersion; from++) {
    const step = ladder[from]
    if (!step) throw new MigrationError(`no migration registered from v${from}`)
    state = step(state)
  }

  return { ...raw, v: currentVersion, state }
}
