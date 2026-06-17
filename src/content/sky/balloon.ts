import type { ShopEntry } from '@/engine/types/defs'

// The cotton-candy balloon recipe (DESIGN §8 Act 1) — the balloon workshop's single commission.
// Modelled as a ShopEntry so the generic, tested purchase handler builds it: it spends BOTH price
// lines (the cotton candy you've been shearing + the licorice the beanstalk sheds) and grants the
// balloon item, whose saveFlag ('balloonBuilt') reveals the jawbreaker moon. This is the SINK that
// finally gives cotton candy a purpose. Pure data.

export const BALLOON_ENTRY: ShopEntry = {
  itemId: 'cottonCandyBalloon',
  price: [
    { resource: 'cottonCandy', amount: 500 },
    { resource: 'licorice', amount: 50 },
  ],
  speechKey: 'balloon.built',
}
