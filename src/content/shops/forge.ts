import type { ShopEntry } from '@/engine/types/defs'

// The blacksmith / forge — weapons, purchased via the SAME generic handler as the shop
// (ADR §6; Block E reuse). NOT a sword ladder: it is a varied arsenal of distinct archetypes
// (design directive — "mix it up, surprise me; a bow to get used to ranged"). The wooden sword,
// the candy-cane bow (ranged) and the licorice whip (fast) all open up once you own grandma's
// spoon; the iron sword and the jawbreaker mace need rock candy from the sugar mines. The shop
// screen hides rows whose `unlock` is unmet, so the arsenal reveals as you progress. Data only.

export const FORGE_ENTRIES: readonly ShopEntry[] = [
  {
    // Ranged. Listed first because REACH — not raw damage — is what clears the mine gate, and the
    // bow out-reaches the sentinel from safety. Cheap, to get you hooked on hitting from afar.
    itemId: 'candyCaneBow',
    price: [{ resource: 'candies', amount: 120 }],
    unlock: (s) => s.flags['spoonOwned'] === true,
    speechKey: 'forge.candyCaneBow.thanks',
  },
  {
    // Also out-reaches the gate sentinel, and fast.
    itemId: 'licoriceWhip',
    price: [{ resource: 'candies', amount: 200 }],
    unlock: (s) => s.flags['spoonOwned'] === true,
    speechKey: 'forge.licoriceWhip.thanks',
  },
  {
    // A damage upgrade, but the SAME reach as the spoon — it will not get you past the gate.
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
  {
    // The brute. Needs a real haul of rock candy from the mines.
    itemId: 'jawbreakerMace',
    price: [
      { resource: 'candies', amount: 550 },
      { resource: 'rockCandy', amount: 8 },
    ],
    unlock: (s) => s.flags['rockCandyUnlocked'] === true,
    speechKey: 'forge.jawbreakerMace.thanks',
  },
  {
    // Act 2 — forged from the comet's own pop rocks (DESIGN §175). Gated on having caught the comet
    // (cometFirstCaught), so the recipe only appears once you have pop rocks to spend. A distinct archetype:
    // the longest melee reach in the arsenal (see items.ts POP_ROCK_PIKE) — a positioning weapon, not a
    // damage spike. Priced as a real haul of pop rocks (a handful of comet passes) plus a candy fee.
    itemId: 'popRockPike',
    price: [
      { resource: 'candies', amount: 2_000 },
      { resource: 'popRocks', amount: 150 },
    ],
    unlock: (s) => s.flags['cometFirstCaught'] === true,
    speechKey: 'forge.popRockPike.thanks',
  },
  {
    // The Act-1 capstone: first vacuum gear (DESIGN §171/§233). Gated on celestial navigation
    // (the lighthouse) — once you can sail into the dark, the blacksmith seals you a helm. A real
    // capstone haul of candies + the moon's rock candy. Forging it closes the Act-1 gate.
    itemId: 'fishbowlHelm',
    price: [
      { resource: 'candies', amount: 250_000 },
      { resource: 'rockCandy', amount: 30 },
    ],
    unlock: (s) => s.flags['celestialNavigationLearned'] === true,
    speechKey: 'forge.fishbowlHelm.thanks',
  },
]
