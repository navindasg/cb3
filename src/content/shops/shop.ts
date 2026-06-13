import type { ShopEntry } from '@/engine/types/defs'

// The village shop — escalating buyables, each a ShopEntry consumed by the generic purchase
// handler (engine/shop/purchase). Prices escalate; a later entry gates on owning the prior
// one so the shop reveals progressively. Content is data only.

export const SHOP_ENTRIES: readonly ShopEntry[] = [
  {
    itemId: 'leatherHat',
    price: [{ resource: 'candies', amount: 30 }],
    speechKey: 'shop.leatherHat.thanks',
  },
  {
    itemId: 'beginnerGrimoire',
    price: [{ resource: 'candies', amount: 150 }],
    // Only after the hat — the shopkeeper "trusts you with the back-room stock".
    unlock: (s) => s.flags['leatherHatOwned'] === true,
    speechKey: 'shop.beginnerGrimoire.thanks',
  },
]
