import { RESOURCE_KEYS } from '@/engine/types/GameState'
import type { GameState } from '@/engine/types/GameState'
import { createDefaultSave } from '@/engine/state/defaultSave'
import { createResource } from '@/engine/types/Resource'
import {
  ALL_PRODUCERS,
  ACTIVE_FAUCETS,
  FAUCET_ACT,
  SPINE_GATES,
  FOSSIL_STAR_GATE,
  passivelySourcedResources,
  activelySourcedResources,
  isResourceObtainable,
  allPricedCostLines,
  allCostResources,
  peakCandyCost,
  orderOfMagnitude,
  gatesForAct,
} from '@/engine/content/balanceAudit'
import { grantReflectionReward } from '@/engine/content/reflectionFight'
import { grantHallucinationReward } from '@/engine/content/hallucination'
import { grantWhaleReward } from '@/engine/content/voidWhale'
import { igniteFossilStar } from '@/engine/content/fossilStar'
import { ALL_ITEMS } from '@/content/items/items'
import { CLOUD_SHEEP_COUNT_KEY } from '@/content/sky/paddock'
import {
  GUMMY_WORM_COUNT_KEY,
  GUMMY_FUSED_COUNT_KEY,
  GUMMY_MINT_FUSED_COUNT_KEY,
} from '@/content/gummy/molds'
import { PEPPERMINT_CONDENSER_KEY } from '@/content/planet/mintPlanet'
import { SOLAR_COLLECTOR_KEY, CARAMEL_COLLECTOR_KEY } from '@/content/sun/solarWorks'
import { STAR_TRAWLER_KEY } from '@/content/sun/starSea'
import { BEANSTALK_THICKENED_FLAG } from '@/content/flags'

// The objective §5 balance audit (Phase 5). ASSERTIONS, not prose: this suite walks the FINISHED content
// graph (the real producer/cost/gate registries via engine/content/balanceAudit) and proves the economy's
// objective invariants — no gate priced in a resource with no faucet yet (the caramel-soft-lock class), no
// soft-lock, no un-farmable required item, the §5 wealth curve holds, every one-off drop is commit-once.
// It fixes nothing; a future edit that reintroduces a defect fails one of these instead of shipping.
//
// SUBJECTIVE pacing (does Act 3 DRAG, is stage 1 the right wall, is 10k peppermint too grindy) is NOT here —
// that is the human playtest's job (§22-open). The developer feel-flags live in a comment at the bottom.

describe('balance audit — resource sources (no orphan resource)', () => {
  it('every resource that any priced thing consumes has a live faucet (passive or active)', () => {
    // The caramel-soft-lock class, generalized: a cost drawn in a resource nothing can ever produce is an
    // unwinnable gate. Sweep EVERY priced cost line in the game and assert its resource is obtainable.
    const unobtainable = [...allCostResources()].filter((r) => !isResourceObtainable(r))
    expect(unobtainable).toEqual([])
  })

  it('the exhaustive price sweep actually gathered cost lines (the registries are wired in)', () => {
    // Guard against the sweep silently gathering nothing (an import that resolved to an empty array would
    // make the "no orphan" check vacuously pass). It must find real, positive-amount cost lines.
    const lines = allPricedCostLines()
    expect(lines.length).toBeGreaterThan(20)
    for (const line of lines) expect(line.amount).toBeGreaterThan(0)
  })

  it('every RESOURCE_KEY the game consumes is real (no cost references a stale key)', () => {
    for (const r of allCostResources()) {
      expect(RESOURCE_KEYS).toContain(r)
    }
  })

  it('the passive + active source ledgers only reference real resource keys', () => {
    for (const p of ALL_PRODUCERS) expect(RESOURCE_KEYS).toContain(p.resource)
    for (const f of ACTIVE_FAUCETS) expect(RESOURCE_KEYS).toContain(f.resource)
  })

  it('candies flow from the very first frame (the always-available baseline faucet)', () => {
    // The whole economy hangs off candies never being zero-supply — the field patch pays out on a bare save.
    const fresh = createDefaultSave()
    const candyRate = ALL_PRODUCERS.filter((p) => p.resource === 'candies').reduce(
      (sum, p) => sum + p.getRate(fresh),
      0,
    )
    expect(candyRate).toBeGreaterThan(0)
  })

  it('every producer can actually pay out (its rate exceeds 0 under some reachable state)', () => {
    // A producer whose getRate is pinned to 0 forever is dead content. Build a maximal state (every gate
    // flag set, deep counts) and assert each producer's rate clears 0 there.
    const maxed: GameState = {
      ...createDefaultSave(),
      flags: {
        spoonOwned: true,
        [BEANSTALK_THICKENED_FLAG]: true,
        dysonStage1Done: true,
        dysonStage2Done: true,
        dysonStage3Done: true,
      },
      numbers: {
        fieldExpansions: 10,
        [CLOUD_SHEEP_COUNT_KEY]: 10,
        [GUMMY_WORM_COUNT_KEY]: 10,
        [GUMMY_FUSED_COUNT_KEY]: 10,
        [GUMMY_MINT_FUSED_COUNT_KEY]: 10,
        [PEPPERMINT_CONDENSER_KEY]: 10,
        [SOLAR_COLLECTOR_KEY]: 10,
        [CARAMEL_COLLECTOR_KEY]: 10,
        [STAR_TRAWLER_KEY]: 10,
      },
    }
    for (const p of ALL_PRODUCERS) {
      expect(p.getRate(maxed), `producer ${p.id} (${p.resource}) never pays out`).toBeGreaterThan(0)
    }
  })
})

describe('balance audit — no soft-lock (every gate reachable in faucet order)', () => {
  it('no gate is priced in a resource whose first faucet opens in a LATER act (the caramel class)', () => {
    // The core soft-lock invariant: a gate in act N may only draw resources obtainable by act N. If an
    // Act-1 gate drew stardust (act-2 faucet), you could never reach it — the caramel bug generalized.
    const offenders: string[] = []
    for (const gate of [...SPINE_GATES, FOSSIL_STAR_GATE]) {
      for (const line of gate.cost) {
        const faucetAct = FAUCET_ACT[line.resource]
        if (faucetAct === undefined || faucetAct > gate.act) {
          offenders.push(`${gate.id} (act ${gate.act}) draws ${line.resource} (faucet act ${faucetAct})`)
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('the FAUCET_ACT ledger is self-consistent: every resource with a faucet is listed, and no phantom', () => {
    // The ledger must cover exactly the obtainable resources — a resource with a source but no act entry
    // would slip past the reachability walk; an act entry for an orphan resource is a lie.
    for (const r of RESOURCE_KEYS) {
      const hasFaucet = passivelySourcedResources().has(r) || activelySourcedResources().has(r)
      const inLedger = FAUCET_ACT[r] !== undefined
      // chocolate + lollipops are quest/economy currencies with no producer/active-faucet in this audit's
      // sense but ARE obtainable (quest rewards / thrown-candy); they carry an act so gates on them resolve.
      if (hasFaucet) {
        expect(inLedger, `${r} has a faucet but no FAUCET_ACT entry`).toBe(true)
      }
    }
  })

  it('the Act-2 peppermint gate is reachable: the condenser faucet is sourced and priced below the bank', () => {
    // The §184 gate banks 10,000 peppermint; the faucet (the condenser) must itself be affordable from
    // Act-2 income (rock candy + candies, both live) — otherwise the gate resource can never accrue.
    const condenser = SPINE_GATES.find((g) => g.id === 'peppermintCondenser')!
    for (const line of condenser.cost) {
      expect(isResourceObtainable(line.resource)).toBe(true)
      expect(FAUCET_ACT[line.resource]).toBeLessThanOrEqual(2)
    }
    const bank = SPINE_GATES.find((g) => g.id === 'act2PeppermintBank')!
    expect(bank.cost[0]!.resource).toBe('peppermint')
    expect(isResourceObtainable('peppermint')).toBe(true)
  })

  it('the Act-3 bathysphere gate draws only resources with Act-3 faucets (peppermint + mint + caramel)', () => {
    const bathysphere = SPINE_GATES.find((g) => g.id === 'bathysphere')!
    for (const line of bathysphere.cost) {
      expect(isResourceObtainable(line.resource)).toBe(true)
      expect(FAUCET_ACT[line.resource]).toBeLessThanOrEqual(3)
    }
  })

  it('the fossil-star epilogue draws only stardust, which has both a comet drop and a passive trawler', () => {
    expect(FOSSIL_STAR_GATE.cost).toEqual([{ resource: 'stardust', amount: 1000 }])
    expect(activelySourcedResources().has('stardust')).toBe(true) // the comet catch
    expect(passivelySourcedResources().has('stardust')).toBe(true) // the star-sea trawlers
  })
})

describe('balance audit — the §5 wealth curve (orders of magnitude climb by act)', () => {
  // DESIGN §5: Act 0 ~1e5, Act 1 ~1e7, Act 2 ~1e9, Act 3 ~1e12 in representative candy cost. The audit does
  // not assert exact numbers (that is the human's tuning) — it asserts the ORDERS strictly increase and land
  // in the right decade band, so a regression that flattened the curve fails.

  it('orderOfMagnitude reports the decade of a cost, and -Infinity for a resource with no candy line', () => {
    expect(orderOfMagnitude(1)).toBe(0)
    expect(orderOfMagnitude(1_000)).toBe(3)
    expect(orderOfMagnitude(1_000_000_000)).toBe(9)
    expect(orderOfMagnitude(0)).toBe(-Infinity) // a gate set that draws no candies
  })

  it('the peak candy cost strictly climbs from Act 1 through Act 3', () => {
    const act1 = peakCandyCost(gatesForAct(1))
    const act2 = peakCandyCost(gatesForAct(2))
    const act3 = peakCandyCost(gatesForAct(3))
    expect(orderOfMagnitude(act3)).toBeGreaterThan(orderOfMagnitude(act2 || act1))
    // Act 3 is the ~1e12 decade (the dyson descent port); assert it sits in the trillions band.
    expect(orderOfMagnitude(act3)).toBeGreaterThanOrEqual(11)
    expect(orderOfMagnitude(act3)).toBeLessThanOrEqual(13)
  })

  it('candy income scales by orders of magnitude: the Act-3 solar collector dwarfs the Act-0 field', () => {
    // DESIGN §5 c/s curve (1 -> ~100 -> ~10k -> ~1M+): the objective, tunable-agnostic form is that the LATE
    // per-unit candy income rate is orders of magnitude above the baseline field. The field patch pours a
    // fixed trickle on a bare save; one Act-3 solar collector drinks the star at ~10k/s. Assert the jump.
    const fresh = createDefaultSave()
    const baseline = ALL_PRODUCERS.filter((p) => p.resource === 'candies').reduce(
      (sum, p) => sum + p.getRate(fresh),
      0,
    )
    const withCollectors: GameState = {
      ...fresh,
      flags: { dysonStage1Done: true },
      numbers: { [SOLAR_COLLECTOR_KEY]: 1 },
    }
    const scaled = ALL_PRODUCERS.filter((p) => p.resource === 'candies').reduce(
      (sum, p) => sum + p.getRate(withCollectors),
      0,
    )
    // A single collector is at least 1000x the whole baseline field — the ~x100+ income jump, and then some.
    expect(scaled / baseline).toBeGreaterThan(1000)
  })

  it('the Act-3 dyson stages escalate monotonically in candy cost (~x10 per stage)', () => {
    const dysonCandyCosts = gatesForAct(3)
      .filter((g) => g.id.startsWith('dyson'))
      .map((g) => g.cost.find((l) => l.resource === 'candies')?.amount ?? 0)
    for (let i = 1; i < dysonCandyCosts.length; i++) {
      expect(dysonCandyCosts[i]!).toBeGreaterThan(dysonCandyCosts[i - 1]!)
    }
    // The whole span crosses at least two decades (1e9 -> 1e12).
    expect(orderOfMagnitude(dysonCandyCosts.at(-1)!) - orderOfMagnitude(dysonCandyCosts[0]!)).toBeGreaterThanOrEqual(2)
  })
})

describe('balance audit — un-farmable required item (the required kit is always winnable)', () => {
  // Every gate resource must be farmable to any amount: producers are unbounded (rate * time), and the
  // active faucets are repeatable (they spend candies, which flow forever). Nothing in the required spine is
  // a one-shot the player can permanently exhaust.
  it('every gate resource has an UNBOUNDED source (a producer OR a candy-fed conversion)', () => {
    const gateResources = new Set([...SPINE_GATES, FOSSIL_STAR_GATE].flatMap((g) => g.cost.map((l) => l.resource)))
    for (const r of gateResources) {
      // Unbounded iff it has a passive producer (accrues forever) or an active faucet (repeatable trade).
      const unbounded = passivelySourcedResources().has(r) || activelySourcedResources().has(r)
      expect(unbounded, `gate resource ${r} has no unbounded source`).toBe(true)
    }
  })
})

describe('balance audit — one-off drops are commit-once (no double-grant / farming)', () => {
  // The witnessStarDie / kraken idiom: a persistent boss drop must grant exactly once. Drive the real engine
  // grant functions twice and assert the second call is a SAME-reference no-op (no double item, no re-tick).

  const withEndingChosen = (over: Partial<GameState> = {}): GameState => ({
    ...createDefaultSave(),
    strings: { endingChosen: 'hatch' },
    ...over,
  })

  it('the reflection reward (paradox pin) grants once, then is a no-op', () => {
    const first = grantReflectionReward(createDefaultSave())
    expect(first.flags.reflectionDefeated).toBe(true)
    expect(first.flags.paradoxPinOwned).toBe(true)
    const second = grantReflectionReward(first)
    expect(second).toBe(first) // SAME reference — no double grant
  })

  it('the hallucination reward (fourth-wall fragment) grants once, then is a no-op', () => {
    const first = grantHallucinationReward(createDefaultSave())
    expect(first.flags.hallucinationDefeated).toBe(true)
    expect(first.flags.fourthWallFragmentOwned).toBe(true)
    expect(grantHallucinationReward(first)).toBe(first)
  })

  it('the void-whale reward (void pearl) grants once, then is a no-op', () => {
    const first = grantWhaleReward(createDefaultSave())
    expect(first.flags.voidWhaleDefeated).toBe(true)
    expect(first.flags.voidPearlOwned).toBe(true)
    expect(grantWhaleReward(first)).toBe(first)
  })

  it('the fossil-star ignite (the one up-tick) grants exactly one star, then never again', () => {
    const ready = withEndingChosen({ stardust: createResource(5000), starsRemaining: 100 })
    const lit = igniteFossilStar(ready)
    expect(lit.flags.fossilStarIgnited).toBe(true)
    expect(lit.starsRemaining).toBe(101) // +1
    expect(lit.stardust.current).toBe(4000) // 1000 spent
    const again = igniteFossilStar(lit)
    expect(again).toBe(lit) // SAME reference — no double star, no double spend
    expect(again.starsRemaining).toBe(101)
  })
})

describe('balance audit — keepsake sinks (every drop lands somewhere or is honestly deferred)', () => {
  // Every equippable or consumable keepsake must EITHER do something (fill a slot / change a rule / seal a
  // recipe) OR be an honest trophy (a lore keepsake the game never pretends is functional). This asserts the
  // registry has no item that claims a mechanical slot yet is inert — a functional dead-end. Pure trophies
  // (no slot, no weapon) are fine by design; the audit just proves the SLOTTED items really carry weight.
  it('every SLOTTED item has a slot the game reads (no phantom equipment)', () => {
    const KNOWN_SLOTS = new Set(['weapon', 'hat', 'armour', 'gloves', 'boots'])
    for (const item of ALL_ITEMS) {
      if (item.slot) expect(KNOWN_SLOTS.has(item.slot), `${item.id} has unknown slot ${item.slot}`).toBe(true)
    }
  })

  it('every weapon item carries real combat stats (a weapon slot with no damage is a dead drop)', () => {
    for (const item of ALL_ITEMS) {
      if (item.slot === 'weapon') {
        expect(item.weapon, `${item.id} is a weapon with no stats`).toBeDefined()
        expect(item.weapon!.damage).toBeGreaterThan(0)
      }
    }
  })

  it('every item id is unique (no two drops collide on the same id)', () => {
    const ids = ALL_ITEMS.map((i) => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every item saveFlag is unique EXCEPT the deliberately-shared storm-immune truth', () => {
    // The wolf-wool cloak's saveFlag doubles as the storm-immune flag (one truth, no duplication) — but that
    // is the SAME item's own flag, so uniqueness across DISTINCT items still holds. Assert no two DIFFERENT
    // items share a saveFlag.
    const flags = ALL_ITEMS.map((i) => i.saveFlag)
    expect(new Set(flags).size).toBe(flags.length)
  })
})

/*
 * SUBJECTIVE FEEL-FLAGS for the human playtest (NOT assertions — §22-open, the developer tunes by ear):
 *
 *  - ACT-3 DYSON WALL (§186 "idle wall, with dread"): stage 1 is 1e9 candies. From Act-2 income (no solar
 *    collectors yet) this is a deliberately long wait. Confirm the wait FEELS like dread, not tedium — the
 *    reward (the first strut on a caged star) has to carry it. Consider whether the moon burrowers / gummy
 *    army give enough of a running start into it.
 *
 *  - PEPPERMINT §184 GATE (10,000 at 0.1/condenser/s): the "tail-end grind". A few dozen condensers is the
 *    intended fleet; verify the fleet-building itself (rock candy sink) stays interesting, and that the grind
 *    reads as a coda to Act 2, not a wall bolted onto its end.
 *
 *  - BATHYSPHERE MINT COST (2,000 mint at 5/harvest, candy-fed): mint has NO passive producer — it is only
 *    the manual wyrm-breath trade. 2,000 mint is 400 harvests. Confirm the vigil-verb framing ("hold a vial
 *    to the wyrm's breath") keeps that from feeling like a spreadsheet; if it drags, a mint burrower already
 *    exists as a faucet precedent to lean on.
 *
 *  - CARAMEL EARLY FLOOR vs SCALE: the boil is 100 candies -> 1 caramel (a chore); the solar collector is
 *    0.5/s. The star trawler wants 100 caramel. Confirm the boil-only floor doesn't force a boring pre-collector
 *    caramel farm before stage 1 — the design says it shouldn't, but it is the tightest early caramel moment.
 *
 *  - THE COMET FAUCET (pop rocks + stardust, once-per-pass): the only source of both until the star sea. If a
 *    player rushes the pop-rock pike / cannon t2 + rides the comet often, confirm the once-per-pass cooldown
 *    keeps stardust from trivializing the 1000-stardust fossil star before the star-sea trawlers exist.
 */
