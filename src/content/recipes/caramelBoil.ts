// Boiling candies down into caramel (Act 3 — Increment 0, the §111 industry step). Plain content
// numbers the caramel-cauldron engine (engine/content/caramelCauldron) reads. The village cauldron has
// muttered to itself since Act 0; this is the kingdom's first real INDUSTRY — you feed it candy and it
// gives you back something slower and darker. Caramel exists as a RESOURCE_KEY with no source until now;
// the boil is its first source, landed BEFORE any Act-3 cost draws on it (the soft-lock-proof floor).
//
// A strict 1:1 conversion of a resource already paid for: not a farm, just a chore that unlocks the
// stars. The scaling FAUCET (the solar-caramel collector, dyson-stage-1-gated) arrives in Increment 2;
// this boil is the never-soft-locking manual floor that is always available. §22-open tuning.

/** Candies consumed to boil one unit of caramel — the §111 "100 candies -> 1 caramel" industry step. */
export const BOIL_CANDY_COST = 100

/** Caramel produced per boil. */
export const CARAMEL_PER_BOIL = 1
