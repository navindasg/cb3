import type { ShopEntry } from '@/engine/types/defs'

// The observatory shop — the astronomer sells the beginner's grimoire and the telescope.
// Buying the telescope reveals the (never-mentioned) star counter; the wiring stamps
// numbers.telescopeBoughtAtMs at purchase so engine/content/starCounter can begin the
// accumulated-time descent. Same generic purchase handler; data only here.

export const OBSERVATORY_ENTRIES: readonly ShopEntry[] = [
  {
    itemId: 'beginnerGrimoire',
    price: [{ resource: 'candies', amount: 150 }],
    speechKey: 'obs.beginnerGrimoire.thanks',
  },
  {
    itemId: 'telescope',
    price: [{ resource: 'candies', amount: 800 }],
    speechKey: 'obs.telescope.thanks',
  },
]
