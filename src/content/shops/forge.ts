import type { ShopEntry } from '@/engine/types/defs'

// The blacksmith / forge — weapon upgrades, purchased via the SAME generic handler as the
// shop (ADR §6; Block E reuse). Each upgrade gates on owning the previous tier, so the forge
// is a linear weapon ladder: spoon → wooden sword → iron sword. Data only.

export const FORGE_ENTRIES: readonly ShopEntry[] = [
  {
    itemId: 'woodenSword',
    price: [{ resource: 'candies', amount: 100 }],
    unlock: (s) => s.flags['spoonOwned'] === true,
    speechKey: 'forge.woodenSword.thanks',
  },
  {
    itemId: 'ironSword',
    price: [
      { resource: 'candies', amount: 400 },
      { resource: 'rockCandy', amount: 5 },
    ],
    unlock: (s) => s.flags['woodenSwordOwned'] === true,
    speechKey: 'forge.ironSword.thanks',
  },
]
