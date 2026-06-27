import type { PriceLine } from '@/engine/types/defs'

// The peppermint bathysphere (Act 3 — Increment 6, the stage-5 reward, DESIGN §5/§190/§196). Pure config
// the bathysphere engine (engine/content/bathysphere) and the scaffold screen read. Once the descent port
// is raised (dysonStage5Done) the cage around the sun is all but closed, and the works turns to the one
// thing it was always for: a vessel to ride the scaffold DOWN, into the photosphere, to the caramel core
// (§196) — the thing keeping the light on, waiting below. The bathysphere is mint-cold and peppermint-
// armored against a star: cold inside, which is the point; the sun is warm, which is the problem.
//
// It is a ONE-OFF craft (the forge-capstone / freeFrostWyrm idiom): a flag + an owned keepsake item, no
// new resource. Its three cost lines all draw EXISTING resources with LIVE sources by now — peppermint
// (the mint planet's condensers + the gummy mint-burrowers), mint (the frost wyrm's slow breath), and
// caramel (the Inc-0 cauldron boil floor + the Inc-2 solar-caramel collector). The §184 act-2 gate already
// demanded 10k peppermint just to ENTER Act 3, so plating is never the soft-lock. Building it sets
// act3GateCleared — the Act-4 descent hook. The §194 audio cue (the game's only sound) is the Act-4
// payoff; it is signposted here, NOT fired.
//
// All §22-open tuning. No logic here — the engine spends + sets, the screen draws.

/** numbers/flag namespace is content-owned; the build flag lives in content/flags.BATHYSPHERE_BUILT_FLAG. */

/** The item id banked when the bathysphere is built (a held keepsake, not equippable — the §190 vessel). */
export const BATHYSPHERE_ITEM_ID = 'peppermintBathysphere'

// --- the three cost lines (all existing resources with live sources by Act 3) -------------------------
// Peppermint PLATING (§250) — the hull armor against the star; the same resource the §184 gate banked.
// Mint COOLANT (§259) — the wyrm-breath essence, to keep the inside cold (the whole point of the vessel).
// Caramel HULL-SEAL — the §111 caramel-industry capstone, sealing the seams; sourced since Inc-0/2.

/** Peppermint plating cost (§250) — the hull armor. Drawn from condensers + the gummy mint-burrowers. */
export const BATHYSPHERE_PEPPERMINT_COST = 25_000

/** Mint coolant cost (§259) — to keep the inside cold against a sun. Drawn from the wyrm's slow breath. */
export const BATHYSPHERE_MINT_COST = 2_000

/** Caramel hull-seal cost — the §111 caramel capstone. Drawn from the cauldron boil + the solar-caramel collector. */
export const BATHYSPHERE_CARAMEL_COST = 1_000

/** The bathysphere's three cost lines, every one paid (no partial spend), all live-sourced by Act 3. */
export const BATHYSPHERE_PRICE: readonly PriceLine[] = [
  { resource: 'peppermint', amount: BATHYSPHERE_PEPPERMINT_COST },
  { resource: 'mint', amount: BATHYSPHERE_MINT_COST },
  { resource: 'caramel', amount: BATHYSPHERE_CARAMEL_COST },
] as const

// --- the descent-port flavor (the screen reads these; pure ASCII, in voice) ---------------------------

/** The descent port's landing blurb — the cage closed, the works turned to the descent. Terse, tired, dread. */
export const DESCENT_PORT_BLURB =
  'The last ring closes and the sun goes quiet behind a lattice of struts — a dying star wrapped in a candy cage, burning on as if it has not noticed. The works-master walks you out along the final gantry to a hatch that opens onto nothing but light. "This is as far as the scaffold goes. The rest is down." Below the photosphere, something keeps the light on. You are going to go and look at it.'

/** The bathysphere PLAN blurb — the pre-build state. The parts staged, the intent, the joke as a plan. Forward-looking. */
export const BATHYSPHERE_PLAN_BLURB =
  'The parts wait on the gantry: peppermint plates, a mint-cold core to seal them around, a vat of caramel to run the seams. The works-master walks the plan with you. "It will be cold inside, which is the point. The sun is warm, which is the problem." Far out past the staging, the shape in the dark is closer than it was. Nobody mentions it.'

/** The bathysphere BUILT blurb — the post-build payoff. The seal lands here, not before. Past tense, sealed, done. */
export const BATHYSPHERE_BLURB =
  'They sink the vessel together on the gantry: peppermint plates lashed over a mint-cold core, every seam run with caramel until it is one cold dark bead of a thing. The works-master raps it once with a knuckle. "It is sealed. It is cold inside, which is the point. The sun is warm, which is the problem." Far out past the glass, the shape in the dark is closer than it was. Nobody mentions it.'

/** The Act-3-complete beat — quiet triumph undercut. The hatch is ready; the counter races; the thing waits. */
export const ACT3_COMPLETE_BLURB =
  'The bathysphere hangs in its cradle over the open hatch, cold and ready. The scaffold is finished; the star is caged; the descent waits. The corner counter falls faster than it ever has, and far below the light something is keeping it lit, and has been all along. You could go down now. You are not, quite, ready to.'

/**
 * The scaffold overlay for the completed sun at stage 5 — the cage fully closed, the descent hatch at the
 * pole. Mirrors content/sun/dysonScaffold.SCAFFOLD_OVERLAY[5] (the engine assembles every completed stage's
 * overlay, so stage 5's ring is already drawn by sunArt(5)); this is the descent-port flavor frame the
 * SCREEN may draw beside the caged sun to mark the hatch. Pure printable ASCII; no logic, no glow chars.
 */
export const DESCENT_HATCH_ART: readonly string[] = [
  '    .-----------.    ',
  '   /  the hatch  \\   ',
  '  |   [ V V V ]   |  ',
  '   \\  the down   /   ',
  "    '-----------'    ",
] as const
