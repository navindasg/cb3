import type { ProducerDef } from '@/engine/types/defs'
import { BEANSTALK_THICKENED_FLAG } from '@/content/flags'

// Licorice producers as data (ADR §10 ProducerDef) — the first licorice source. Once the beanstalk
// has thickened (fed well past the clouds, DESIGN §8 Act 1; feedBeanstalk sets the thickened flag),
// it grows woody and sheds licorice cuttings on a steady passive trickle, exactly like the cloud-
// sheep paddock sheds cotton candy. It slots into the same tick (summed by resource) and accrues
// offline too (catch-up is resource-agnostic). Pure over state; imports only content + a type
// (gates on the content-owned thickened flag, never on engine logic — ADR §3 layering).

/** Cuttings the thickened beanstalk sheds per second (a §22-open tuning knob; tune in playtest). */
export const LICORICE_PER_SEC = 1 / 30

/** The thickened beanstalk sheds licorice cuttings — the supply that funds the balloon. */
const BEANSTALK_CUTTINGS: ProducerDef = {
  id: 'beanstalkCuttings',
  resource: 'licorice',
  getRate: (s) => (s.flags[BEANSTALK_THICKENED_FLAG] === true ? LICORICE_PER_SEC : 0),
}

export const LICORICE_PRODUCERS: readonly ProducerDef[] = [BEANSTALK_CUTTINGS]
