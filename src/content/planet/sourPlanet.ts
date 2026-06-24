// The sour planet & the gummy folk (Act 2 — quest 9, DESIGN §181/§260). Pure config the sour-planet
// engine (engine/content/sourPlanet) reads. Floating platforms in corrosive sour gas, and the first
// alien contact: the GUMMY FOLK — small, translucent, entirely friendly, mildly baffled by you. They
// teach FLAVOR FUSION (working two flavor essences into one gummy, §12/§260) and trade you SOUR essence
// (the attack flavor, §259) for candies. That sour feeds the gummy vat back on the moon: a sour-fused
// burrower (worm mold x licorice + sour) mines rock candy harder than a plain licorice one.
//
// Deferred + signposted (not stubbed): the sour KRAKEN (deep in the gas; drops the kraken crown, §10),
// the other flavors/molds the folk will trade later, gummy COMBAT units + ship crew (§272), and the
// corrosive-gas armor degradation / mint coating hazard (§181 — mint is the Q10 planet). All §22-open.

/** The gummy folk's trade: this many candies buys this much sour essence. Candies are plentiful by Act
 * 2, so this is a candy SINK that feeds fusion — not a wall. §22-open tuning.
 * NOTE: §181 says the folk "teach flavor fusion AND trade molds." v1 trades the sour ESSENCE instead —
 * the one fusion input usable right now (the molds catalog, §258, is shown locked at the vat). Trading
 * actual molds (and the other flavors) lands when those molds/flavors come online. */
export const SOUR_TRADE_CANDY_COST = 2_000
export const SOUR_TRADE_BATCH = 5
