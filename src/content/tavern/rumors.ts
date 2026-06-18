import type { RumorDef } from '@/engine/types/defs'

// Tavern rumors — hints, one free per accumulated GAME hour (resolved decision 8; cadence in
// engine/content/tavern). Each is a single hint i18n key; the cadence engine cycles through
// them in order. Data only.

export const TAVERN_RUMORS: readonly RumorDef[] = [
  { id: 'mines', textKey: 'rumor.mines' },
  { id: 'fossil', textKey: 'rumor.fossil' },
  { id: 'telescope', textKey: 'rumor.telescope' },
  { id: 'well', textKey: 'rumor.well' },
  { id: 'stormFront', textKey: 'rumor.stormFront' },
  { id: 'fizzyLiftingSoda', textKey: 'rumor.fizzyLiftingSoda' },
  { id: 'beanstalkCuttings', textKey: 'rumor.beanstalkCuttings' },
  { id: 'moonWorm', textKey: 'rumor.moonWorm' },
]
