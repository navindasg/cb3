import type { ProducerDef } from '@/engine/types/defs'
import { CARAMEL_COLLECTOR_KEY, CARAMEL_PER_COLLECTOR_PER_SEC } from '@/content/sun/solarWorks'
import { DYSON_STAGE_DONE_FLAGS } from '@/content/flags'

// The solar-caramel collector as data (ADR §10 ProducerDef) — caramel's first PASSIVE source (Increment 0
// gave caramel its first source at all, the manual cauldron boil; this is the scaling FAUCET). Once the
// first dyson strut is raised (dysonStage1Done) each caramel-collector you hang renders caramel from the
// star on a slow, steady trickle, keeping caramel ahead of the escalating struts + the bathysphere hull-
// seal + Act 4. Slots into the same tick (summed by resource), accrues offline (catch-up is resource-
// agnostic). Pure over state; reads the collector count + rate + the stage-1 flag, never engine logic.

const STAGE1_DONE = DYSON_STAGE_DONE_FLAGS[0]

/** The caramel-collectors' caramel trickle scales with how many you have hung — 0 until stage 1. */
const SOLAR_CARAMEL_COLLECTORS: ProducerDef = {
  id: 'solarCaramelCollectors',
  resource: 'caramel',
  getRate: (s) =>
    s.flags[STAGE1_DONE] === true
      ? Math.max(0, Math.floor(s.numbers[CARAMEL_COLLECTOR_KEY] ?? 0)) * CARAMEL_PER_COLLECTOR_PER_SEC
      : 0,
}

export const CARAMEL_PRODUCERS: readonly ProducerDef[] = [SOLAR_CARAMEL_COLLECTORS]
