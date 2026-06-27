import type { ProducerDef } from '@/engine/types/defs'
import { SOLAR_COLLECTOR_KEY, SOLAR_CANDY_PER_COLLECTOR_PER_SEC } from '@/content/sun/solarWorks'
import { DYSON_STAGE_DONE_FLAGS } from '@/content/flags'

// The solar candy collectors as data (ADR §10 ProducerDef) — the §5 ~x100 income jump, the engine that
// funds dyson stages 2-5. Once the first strut is raised (dysonStage1Done) every collector you hang on the
// scaffold drinks the star and pours out candy on a steady rate, exactly like the condensers sublimate
// peppermint. Slots into the same tick (summed by resource), accrues offline (catch-up is resource-
// agnostic). Pure over state; reads the collector count + rate + the stage-1 flag (a content value), never
// engine logic. The gate is belt-and-braces: the count is already 0 until stage 1 (collectors can only be
// built then), but we read the flag so the rate is honest even if a stray count slips into save data.

const STAGE1_DONE = DYSON_STAGE_DONE_FLAGS[0]

/** The collectors' candy stream scales with how many you have hung — 0 until the first strut is raised. */
const SOLAR_CANDY_COLLECTORS: ProducerDef = {
  id: 'solarCandyCollectors',
  resource: 'candies',
  getRate: (s) =>
    s.flags[STAGE1_DONE] === true
      ? Math.max(0, Math.floor(s.numbers[SOLAR_COLLECTOR_KEY] ?? 0)) * SOLAR_CANDY_PER_COLLECTOR_PER_SEC
      : 0,
}

export const SOLAR_COLLECTOR_PRODUCERS: readonly ProducerDef[] = [SOLAR_CANDY_COLLECTORS]
