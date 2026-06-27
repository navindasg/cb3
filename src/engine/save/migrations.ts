import { CURRENT_SCHEMA_VERSION } from '@/engine/types/GameState'
import { createResource } from '@/engine/types/Resource'

// Ordered migration ladder. MIGRATIONS[from] upgrades a state from version `from`
// to `from + 1`. They run in sequence on load so an ancient save climbs to the
// current schema one rung at a time. v1 is the base; each schema change adds one rung.

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
  // v1 → v2: Act 1 adds cottonCandy (sheared from cloud sheep). Seed it at zero (a fresh object
  // per migration, the createResource idiom) so a pre-Act-1 save climbs cleanly; an existing field
  // is preserved (the spread of `s` wins over the default when a save already carries it).
  1: (s) => ({ cottonCandy: createResource(0), ...s }),
  // v2 → v3: Act 1 adds licorice (cut from the thickened beanstalk). Same idiom.
  2: (s) => ({ licorice: createResource(0), ...s }),
  // v3 → v4: Act 2 adds popRocks (harvested from the comet). Same idiom.
  3: (s) => ({ popRocks: createResource(0), ...s }),
  // v4 → v5: Act 2 adds sour (the gummy folk's flavor essence). Same idiom.
  4: (s) => ({ sour: createResource(0), ...s }),
  // v5 → v6: Act 2 adds peppermint (mined on the mint planet — the §184 act gate). Same idiom.
  5: (s) => ({ peppermint: createResource(0), ...s }),
  // v6 → v7: Act 2 adds mint (the frost wyrm's flavor essence — a fusion input). Same idiom.
  6: (s) => ({ mint: createResource(0), ...s }),
  // v7 → v8: Act 2 adds stardust (harvested with pop rocks at the comet — ride-fuel + star-sea craft). Same idiom.
  7: (s) => ({ stardust: createResource(0), ...s }),
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
