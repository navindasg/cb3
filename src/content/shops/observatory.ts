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
  // The sugar-glass shard (Phase 5 — the mirror-potion reagent, hidden boss 2, §17/§18). A cheap offcut from the
  // astronomer's lens-grinding: always available, so the reflection is never gated behind an unobtainable item
  // (soft-lock-free). The entry re-appears after the shard is consumed into a brew (its owned flag is cleared),
  // so you can re-buy and face your reflection again. Gated only on owning the telescope (you have met the
  // astronomer + his workshop by then) so it surfaces in context, never as a mystery on day one.
  {
    itemId: 'sugarGlassShard',
    price: [{ resource: 'candies', amount: 120 }],
    unlock: (s) => s.flags['telescopeOwned'] === true && s.ownedItems['sugarGlassShard'] !== true,
    speechKey: 'obs.sugarGlassShard.thanks',
  },
]
