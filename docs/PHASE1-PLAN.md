## Phase 1 — Vertical Slice Build Plan

**Goal (DESIGN §21):** core tick/save/shop/forge engine + all of Act 0 + the seed PIVOT + the beanstalk vertical-climb quest. "This is the moment the game becomes itself; ship this first." The vertical climb is the *raison d'être* of Phase 1 — it proves the rotated quest engine.

**Method:** strict TDD per unit (RED → GREEN → REFACTOR), 80%+ coverage. Pure logic unit-tested with plain numbers (no fake timers). Scheduler/save round-trips use Vitest fake timers + Clock. Critical flows (Act 0 → seed → beanstalk; save export/import incl. corrupted string; offline catch-up; box-2x) covered by Playwright with `clock.install()` before navigation. Tag each unit **[ENGINE]** or **[CONTENT]**. Units are in dependency order; later units depend only on earlier ones.

---

### Block A — Pure foundations (no DOM, no time)

**A1. Number + format module** **[ENGINE]**
Build: `Currency` alias, `formatCount` (Intl, pinned en-US), `formatCompact` (K/M/B/T), adaptive width truncation.
Test: comma grouping at 1e9; suffix tiers; the deadpan "1,000,000,000 candies" string; integer clamping; no float drift.

**A2. Signals primitive** **[ENGINE]**
Build: `signal/computed/effect/batch` (§4.2 hardened skeleton).
Test: auto dep-tracking; equality gate suppresses identical-write re-fire; effect re-run cleans stale deps (read different signals across runs → no phantom subs); computed memoization; `batch` coalesces to one notification pass; disposer detaches.

**A3. GameState shape + defaults + Resource ops** **[ENGINE]**
Build: `GameState` interface (save schema v1), `createDefaultSave()`, `Resource` ops (`add` only-positive→lifetimeAccumulated; clamp ≥0; track max; `transferTo`), dedicated `eatCandies()` incrementing `lifetimeCandiesEaten`.
Test: defaults match schema; add never overdrafts; transferTo conserves total; eaten never decrements; max is high-water mark.

**A4. Pure tick + producer registry** **[ENGINE]**
Build: `tick(state, dtMs) -> state` summing `ProducerDef[]` rates × dt; `accumulatedGameTimeMs` advance; comet accumulated-time counter; box flag plumbed (multiplier lives in catch-up, not here).
Test: production = rate×dt deterministic; multiple producers sum; tick is pure (same input → same output); no wall-clock read inside tick.

**A5. Offline catch-up math** **[ENGINE]**
Build: `computeOfflineCatchup(elapsedMs, rate, boxClosed, cap)` closed-form; clamp dt≥0 (rollback→0); cap at MAX_OFFLINE_MS; box ×2 multiplier (never surfaced).
Test: rate×elapsed; clamp negative→0; cap enforced; box-closed doubles; closed-form == summing N ticks (within rounding) but O(1).

---

### Block B — Persistence

**B1. Save envelope + encode/decode** **[ENGINE]**
Build: `encodeSave`/`decodeSave` (JSON→LZ-string base64), envelope `{v,t,lastTick,state}`.
Test: round-trip equality; base64 stable; decode of garbage throws cleanly (not crash).

**B2. Migration ladder** **[ENGINE]**
Build: `migrate(raw)` ordered `migrations[from]` to CURRENT; refuse `v>CURRENT`.
Test: v1 passes through; a synthetic v0→v1 migration applies; future version refused with message; missing migration throws named error.

**B3. Zod import validation** **[ENGINE]**
Build: schema with `.default()/.finite()/min/max`, strip `__proto__`/`constructor`, reject NaN/Infinity; `importSave` = decode→refuse-future→migrate→validate→commit-or-keep.
Test: hand-edited valid save loads; out-of-range field clamps/defaults (no crash); prototype-pollution payload stripped; NaN rejected; corrupted string keeps current save + returns error.

**B4. localStorage adapter** **[ENGINE]**
Build: one key per slot + meta key; 3 rotating autosave slots; `settings` key; try/catch `QuotaExceededError`→non-fatal; `navigator.storage.persist()` on first interaction.
Test (fake storage): atomic slot write; meta readable without full decode; quota error degrades gracefully; autosave rotation.

---

### Block C — Loop + lifecycle wiring

**C1. rAF fixed-timestep driver** **[ENGINE]**
Build: accumulator (STEP 100ms, MAX_DELTA 250, MAX_UPDATES 50); start/stop; commit tick → batch signal mirror.
Test (fake timers): 1s real → 10 sim steps; refocus spike clamped; spiral break caps updates; refresh-rate independence.

**C2. Wake/visibility scheduler** **[ENGINE]**
Build: on load + `visibilitychange→visible`: run B-decode → A5 catch-up in one `batch()` BEFORE starting C1; persist on `visibilitychange→hidden` + debounced interval; read `document.wasDiscarded`.
Test (fake timers + Clock): background then advance Date.now() → correct catch-up applied once; rollback → 0 gain; hidden triggers save; "while you were away" summary value.

**C3. Place lifecycle + controller** **[ENGINE]**
Build: `Place` (`mount→dispose`), `GameController.setPlace` (dispose current before mount next), `mapReturnTarget` depth-1.
Test: dispose tears down effects (no leak across place switches); return-to-map restores prior place; no double-tick.

---

### Block D — Render layer

**D1. CellBuffer + serializer** **[ENGINE/RENDER]**
Build: immutable `CellBuffer` (drawString, drawArea, alpha/meta-alpha transparency), `StyleRegion`/`Hotspot` lists, `serialize()` (right-to-left tag splice, join `\n`).
Test: width-preserving draws; transparency skips alpha char; tags inject at correct columns; out-of-bounds clipped.

**D2. DomRenderer + delegation + metrics** **[RENDER]**
Build: `<pre>` mount, innerHTML per render, font-load-before-first-render, measure cellW/cellH, one delegated click/mousemove → pixel→cell → `data-action` dispatch, glow overlay reconcile.
Test (jsdom + Playwright): action fires on cell click; metrics derived post-font-load; glow span added/removed on state change; no listener accumulation across renders.

**D3. Status bar reactive regions** **[RENDER]**
Build: candy/lollipop/HP/mana as independent `effect`-bound regions (tabular-nums); only changed region re-renders.
Test: candy tick re-renders only the candy span, not the whole bar.

**D4. Vertical map / Stratum registry** **[ENGINE+RENDER]**
Build: `StratumDef[]` bottom→top registry; virtualized DOM render (`content-visibility:auto`, `translateY`); zone hotspots; scrollY persist/restore; conditional zone reveal by unlock flag.
Test: only unlocked strata/zones render; scroll persists; appending a stratum grows the page upward; zone click navigates.

---

### Block E — Engine: shop / forge / quest

**E1. Generic shop/purchase engine** **[ENGINE]**
Build: `ShopEntry[]` renderer + one generic purchase handler (afford-check → deduct via transferTo → set saveFlag → gainItem → speech). Reused by shop, forge, observatory.
Test: insufficient funds blocks; purchase deducts exact cost; flag set; item granted; unlock gating.

**E2. Quest engine core (Scene L0–L5)** **[ENGINE]**
Build: immutable `Vec2`, `CollisionBox`/AABB, `Entity`, `PhysicsDriver` interface, `HorizontalDriver`, `WaveScheduler` (distance/timer/event triggers), `Scene` base loop (schedule→update→cull→win→death→scroll), `SafeZone` respawn, per-spell cooldowns, death-message pick.
Test: AABB hits; gravity/jump/wormsLike step; wave triggers fire once; win condition ends scene; player death → respawn at last safe zone (lose nothing); immutable updates (no shared-Vec2 aliasing).

**E3. VerticalDriver** **[ENGINE]**
Build: Y-axis player input + Y scroll; gusts as periodic `forceMoveAll(0,+g)`; gravity still `(0,+1)`; inversion trigger volumes.
Test: player climbs upward; gust pushes down; gravity pulls down when not climbing; scroll follows player on Y; reuses E2 collision/entity unchanged.

**E4. DOM arena renderer** **[RENDER]**
Build: `Renderer` impl over CellBuffer for quests (Phase 1 is DOM-only; canvas+atlas deferred to Phase 3 drift).
Test: entities composite into arena buffer; HP bars draw; exit button hotspot.

---

### Block F — Act 0 CONTENT (data + thin zone renderers)

**F1. Your field & house + grandma + wooden spoon** **[CONTENT]**
Build: candy counter, eat/throw buttons (progressive reveal by `historicalMax` thresholds — CB2 pattern), grandma dialogue, wooden spoon grant, the un-takeable mantle sword (foreshadow), `eatCandies` wired.
Test: eat moves candy→lifetimeCandiesEaten; throw reveals at threshold; spoon enters inventory; sword not takeable yet.

**F2. The village** **[CONTENT]**
Build: shop (escalating items), forge/blacksmith (weapon upgrades via E1), tavern (rumor = hint, one free/real-hour), three houses (gummy-worm cellar mini-quest as a short E2 horizontal quest = CB2 rat-cellar homage; locked attic stub; mailbox stub), the well (throw-candies-at-well +1 interest secret stub).
Test: shop/forge entries gated and purchasable; cellar mini-quest completes and drops reward; tavern rumor cadence.

**F3. The sugar mines — Quest 1** **[CONTENT]**
Build: horizontal E2 quest below the village; candy bats, sugar golems; rock candy veins (resource); accelerated descent (§22.1); at the bottom **the fossil** (feed exactly 1 candy → twitches secret); `onWin` unlocks rock candy + zone.
Test: quest completes; rock candy awarded; fossil twitch on exactly-1-candy; death message on loss; respawn.

**F4. The observatory** **[CONTENT]**
Build: astronomer dialogue (sells beginner's grimoire, telescope); telescope reveals the corner counter **"stars in the sky: 8,128"** already ticking down (game never mentions it); beginner grimoire spells registered; the cauldron in the basement (CB2 sorceress portrait) — data-driven `RecipeDef` matcher engine + syrup of health recipe as the first recipe.
Test: telescope purchase reveals star counter; counter decrements on schedule (accumulated-time driven); grimoire grants spells; cauldron health-potion recipe matches its action log.

---

### Block G — The PIVOT + the beanstalk (the payoff)

**G1. Seed event (act gate)** **[CONTENT+ENGINE]**
Build: trigger = telescope owned + ~50k total candies earned; falling star lands in field; star counter ticks 8128→8127; seed appears in crater; astronomer's (wrong) theories.
Test: gate fires exactly once at threshold; counter decrements by 1; seed added; idempotent across reload.

**G2. The beanstalk garden (feed-to-grow + map extension)** **[CONTENT+ENGINE]**
Build: plant seed → garden zone; feed candies; at 1,000 candies fed it reaches the clouds and **the map extends upward** (append sky stratum + smooth translateY pan — the genre reveal); single-lollipop secret (giant leaf + hammock rest buff).
Test: feeding accumulates; threshold appends stratum and pans; reveal idempotent; lollipop secret triggers.

**G3. The beanstalk climb — Quest 2 (PROVES THE VERTICAL ENGINE)** **[CONTENT]**
Build: first `VerticalDriver` quest; gusts, gummy aphids, cloud rats; reaching the top permanently converts the beanstalk into a fast-travel elevator (sets flag).
Test: vertical climb completes via E3; gusts apply; top reached sets elevator flag; death→respawn at last safe zone; e2e Playwright run of Act 0 → seed → beanstalk climb end-to-end.

---

### Block H — Integration & a11y polish

**H1. App bootstrap + boundaries** — wire load→catch-up→loop→first render; enforce content→engine import direction. Test: cold start renders "You have 1 candy."; warm start restores place + scrollY.
**H2. Accessibility pass** — aria-hidden decorative / role=img map with location description; `prefers-reduced-motion` kills glow pulse; viewport correct; focusable typed-secret input. Test: reduced-motion disables pulse; map has aria-label.
**H3. Playwright critical-flow suite** — Act0→seed→beanstalk; export/import incl. deliberately corrupted string (must not crash); offline catch-up (background→fastForward hours→return); box-2x while questing; clock-rollback→0 gain.

**Ship gate:** all blocks green, 80%+ coverage, the beanstalk reveal lands and the vertical quest is playable.


## Initial module layout

| Path | Purpose |
|---|---|
| `index.html` | Single-page shell: pinned status-bar container + main-content surface(s). Viewport meta (no zoom-disable). Self-hosted JetBrains Mono preload. |
| `vite.config.ts` | Vite build/dev config; Vitest config (jsdom env, coverage thresholds 80%). |
| `src/main.ts` | Entry point. Loads font, runs bootstrap (load→catch-up→loop→render). Thin. |
| `src/engine/signals/signal.ts` | Hand-rolled signal/computed/effect/batch with auto dep-tracking (hardened: dep cleanup, lazy computed, equality gate). |
| `src/engine/number/format.ts` | formatCount (Intl en-US), formatCompact (K/M/B/T), adaptive-width truncation. Single big-number escape hatch. Currency alias. |
| `src/engine/types/GameState.ts` | Canonical serializable GameState interface = save schema v1 source of truth. No logic. |
| `src/engine/types/Resource.ts` | ResourceState triple (current/lifetimeAccumulated/historicalMax) + pure add/transferTo ops. |
| `src/engine/types/defs.ts` | All content def interfaces: ItemDef, ShopEntry, RecipeDef, EnchantmentDef, ProducerDef, ZoneDef, StratumDef, QuestDef, WaveDef, DialogueDef, DeathMessage, SecretDef. |
| `src/engine/state/defaultSave.ts` | createDefaultSave() factory; merges per-system default partials. |
| `src/engine/state/reducers.ts` | Pure immutable state transitions: eatCandies, throwCandies, gainItem, spendResource, setFlag. |
| `src/engine/loop/tick.ts` | Pure tick(state, dtMs)->state; sums ProducerDef registry; advances accumulatedGameTimeMs + comet counter. |
| `src/engine/loop/offline.ts` | computeOfflineCatchup(elapsed, rate, boxClosed, cap): closed-form, clamped, box-2x multiplier. |
| `src/engine/loop/driver.ts` | requestAnimationFrame fixed-timestep accumulator (STEP/MAX_DELTA/MAX_UPDATES). Start/stop. |
| `src/engine/loop/scheduler.ts` | Wake/visibility orchestration: load + visibilitychange catch-up before live loop; autosave triggers; wasDiscarded. |
| `src/engine/save/envelope.ts` | Envelope type + encodeSave/decodeSave (JSON <-> LZ-string base64). |
| `src/engine/save/migrations.ts` | Ordered migration ladder migrate(raw); refuse future versions. |
| `src/engine/save/validate.ts` | Zod schema; strip __proto__/constructor; reject NaN/Infinity; importSave pipeline (decode->refuse->migrate->validate->commit). |
| `src/engine/save/localStorage.ts` | Slot + meta keys, autosave rotation, QuotaExceededError handling, storage.persist(). |
| `src/engine/place/Place.ts` | Place base: mount()->dispose() lifecycle (signal/listener teardown). |
| `src/engine/place/GameController.ts` | Active-place orchestration; setPlace disposes current before mounting next; mapReturnTarget depth-1. |
| `src/engine/quest/Vec2.ts` | Immutable 2D vector; ops return new vectors. |
| `src/engine/quest/collision.ts` | CollisionBox + CollisionBoxCollection AABB; optional spatial-grid bucketing. |
| `src/engine/quest/Entity.ts` | Immutable quest entity: pos/team/hp/weapons/abilities/tags + update(). |
| `src/engine/quest/physics/PhysicsDriver.ts` | PhysicsDriver interface (gravity vector, applyGravity/Movement, jump, grounded). |
| `src/engine/quest/physics/HorizontalDriver.ts` | Mode A side-scroller driver (wormsLike step, gravity +y). |
| `src/engine/quest/physics/VerticalDriver.ts` | Mode B climb driver (Y input/scroll, gusts, inversion zones). Phase 1. |
| `src/engine/quest/WaveScheduler.ts` | Wave/trigger state machine (distance/timer/event/bossHp/manual) emitting spawn orders. |
| `src/engine/quest/Scene.ts` | Generic QuestDef runtime: base loop (schedule->update->cull->win->death->scroll), SafeZone respawn, per-spell cooldowns. |
| `src/engine/shop/purchase.ts` | Generic ShopEntry purchase handler (afford/deduct/flag/grant/speech). Reused by shop/forge/observatory. |
| `src/engine/cauldron/recipeMatcher.ts` | Data-driven RecipeDef action-log matcher (replaces CB2 nested ifs). |
| `src/render/Renderer.ts` | Renderer interface (mount/render/unmount) shared by DOM and canvas. |
| `src/render/CellBuffer.ts` | Immutable char grid + StyleRegion/Hotspot/GlowSpec lists + transparency. |
| `src/render/HtmlSerializer.ts` | CellBuffer -> HTML string (right-to-left tag splice). No DOM access. |
| `src/render/DomRenderer.ts` | Owns <pre>, innerHTML render, delegated click/move hit-testing, glow overlay reconcile, cell metrics. |
| `src/render/glyphAtlas.ts` | (Phase 3) prerendered (char,color) atlas for canvas arena. |
| `src/render/CanvasArenaRenderer.ts` | (Phase 3) canvas+atlas dirty-cell blit renderer for per-frame-motion quests. |
| `src/render/StatusBar.ts` | Independent reactive status-bar regions (candy/lollipop/HP/mana, tabular-nums). |
| `src/render/Map.ts` | Virtualized vertical map renderer (Stratum stacking, content-visibility, translateY, scrollY persist). |
| `src/render/font.ts` | CSS Font Loading API: load JetBrains Mono before first render; measure cellW/cellH. |
| `src/render/a11y.ts` | aria-hidden/role=img helpers, prefers-reduced-motion gate, map location description. |
| `src/content/strata.ts` | StratumDef[] map registry bottom->top (ground..sky..); the page-growing world. |
| `src/content/zones/act0.ts` | ZoneDef[] for field/house, village, sugar mines, observatory, beanstalk garden. |
| `src/content/quests/sugarMines.ts` | QuestDef quest 1 (horizontal). CONTENT. |
| `src/content/quests/beanstalkClimb.ts` | QuestDef quest 2 (vertical) — proves VerticalDriver. CONTENT. |
| `src/content/quests/gummyWormCellar.ts` | QuestDef intro mini-quest (CB2 rat-cellar homage). |
| `src/content/items/weapons.ts` | WeaponDef[] (wooden spoon, etc.). |
| `src/content/shops/forge.ts` | ShopEntry[] for the blacksmith. |
| `src/content/shops/observatory.ts` | ShopEntry[] (grimoire, telescope). |
| `src/content/producers/candy.ts` | ProducerDef[] (grandma recipes, field expansions). |
| `src/content/recipes/cauldron.ts` | RecipeDef[] (syrup of health first). |
| `src/content/dialogue/grandma.ts` | DialogueDef (grandma, heirloom foreshadow). |
| `src/content/dialogue/astronomer.ts` | DialogueDef (astronomer; star-counter reveal flavor). |
| `src/content/deathMessages.ts` | DeathMessage[] keyed by source + generic fallback. |
| `src/content/secrets.ts` | SecretDef[] (fossil twitch, beanstalk lollipop, well interest stubs). |
| `src/content/i18n/schema.ts` | GameText interface (all UI string keys; missing key = compile error). |
| `src/content/i18n/en.ts` | English GameText const satisfying schema. |
| `src/content/ascii/` | ASCII art assets (.txt, @author line stripped on load), organized by category. |
| `tests/` | Vitest unit/integration mirrors of src; Playwright e2e for critical flows. |

## Save schema v1 (sketch)

// ===== SAVE SCHEMA v1 =====
// Envelope (what is serialized to localStorage + export string)

interface SaveEnvelope {
  v: number;            // schemaVersion — 1; bumped on every schema change; import refuses v > CURRENT
  t: number;            // savedAt (Date.now() ms)
  lastTick: number;     // wall-clock at last save — drives offline catch-up
  checksum?: string;    // non-cryptographic, corruption detection only (not anti-cheat)
  state: GameState;
}

interface ResourceState { current: number; lifetimeAccumulated: number; historicalMax: number; }

interface GameState {
  // --- meta ---
  accumulatedGameTimeMs: number;   // survives reload/background; drives comet + scripted timers (NEVER wall-clock)
  totalPlaytimeSeconds: number;
  nGPlusRun: number;               // 0 = first run

  // --- core resources (Phase 1 uses candies/lollipops/chocolate/rockCandy; rest reserved) ---
  candies: ResourceState;
  lollipops: ResourceState;
  chocolate: ResourceState;
  caramel: ResourceState;
  rockCandy: ResourceState;
  // (cotton/popRocks/licorice/peppermint/stardust/gummies added in later phases via migrations)

  // --- lifetime stats (NEVER reset; survive NG+) ---
  lifetimeCandiesEaten: number;    // gates ending 3, scales "wrapper" — mutated only by eatCandies()
  lifetimeCandiesThrown: number;
  starsRemaining: number;          // 8128 -> down; persists across NG+

  // --- the Schrödinger box (multiplier lives ONLY in offline catch-up; never surfaced) ---
  boxClosed: boolean;

  // --- player ---
  playerHpCurrent: number;         // maxHp recomputed from lifetimeCandiesEaten, NOT stored
  manaCurrent: number;

  // --- equipment (slot -> itemId | null) ---
  equipped: { weapon: string|null; hat: string|null; armour: string|null; gloves: string|null; boots: string|null };
  ownedItems: Record<string, boolean>;

  // --- progression (flat namespaces — typed key unions in code, defaulted via migrations) ---
  flags: Record<string, boolean>;     // unlock/quest-done/secret-found bools (e.g. telescopeOwned, beanstalkReachedClouds, fossilTwitched)
  numbers: Record<string, number>;    // zone steps, candies-fed-to-beanstalk, rumor timers, scrollY
  strings: Record<string, string>;    // language, gameMode

  // --- NG+ carry-over (null except at NG+ transition) ---
  ngPlusCarryover: { lifetimeCandiesEaten: number; starsRemaining: number; nGPlusRun: number } | null;
}

// CURRENT_SCHEMA_VERSION = 1
// migrations: Record<from, (state)=>state>  applied 1->N sequentially on load
// localStorage keys: cb3.slot{n} = LZString.compressToBase64(JSON.stringify(envelope));
//                    cb3.slot{n}.meta = {savedAt, v, lifetimeCandiesEaten, actReached, nGPlusRun};
//                    cb3.autosave.{1..3} (rotating); cb3.settings (survives slot loads)
// export string = same LZ-string base64 of the envelope.


## Risks

- Two-renderer maintenance (DOM + canvas) can drift. Mitigation: both consume the same immutable CellBuffer behind one Renderer interface; Phase 1 ships DOM-only, canvas added in Phase 3 strictly for per-frame-motion quests (drift combat).
- Hand-rolled signals are easy to get subtly wrong (glitches, leaks). Mitigation: implement the 3 known potch-toy fixes up front (dep cleanup, lazy/memoized computed, equality gate) and unit-test each before any consumer uses it.
- Offline catch-up is the single most load-bearing correctness path (background throttle, iOS suspend, discard). A bug here silently under/over-credits the whole economy. Mitigation: pure computeOfflineCatchup tested with plain numbers + Playwright clock.fastForward; closed-form result asserted equal to N-tick summation.
- Clock-cheat / NTP jump could mint candies via Date.now() deltas. Mitigation: clamp dt>=0 (rollback->0 gain) and cap at MAX_OFFLINE_MS; accept mild single-player cheating per series tradition, only guard against crashes/absurd windfalls.
- Immutable per-tick entity allocation in quests could GC-thrash at high entity counts (drift asteroid fields, finale gummy army). Mitigation: bounded counts + spatial-grid bucketing + dirty-cell diff; pre-allocated arena buffers when canvas lands (Phase 3).
- Box-drawing/glow glyph misalignment across browsers/line-heights would break the map aesthetic. Mitigation: JetBrains Mono validated to 120% line-height, font loaded before first render, cell metrics measured once and shared between DOM and canvas.
- Safari ITP wipes localStorage after 7 days idle; a 15-20h game is exactly abandoned-for-a-week shaped. Mitigation: navigator.storage.persist() on first interaction + make the export share-string prominent as the durable backstop.
- QuotaExceededError or Safari private-mode write failures mid-save. Mitigation: one atomic key per slot (no partial writes), try/catch every setItem, degrade to non-fatal 'unsaved' indicator.
- Scope creep: 4 quest modes + full content could tempt a from-scratch class-per-quest regression to CB2's anti-pattern. Mitigation: enforce QuestDef-as-data + one Scene runtime; ESLint import-boundary rule blocking content/ from importing engine logic.
- The Act 4 single audio track will not autoplay after 18 silent hours (suspended AudioContext). Mitigation (later phase, design now): create context lazily and resume() inside the descent click handler; verify on iOS Safari.

## Open questions

**RESOLVED at the 2026-06-13 checkpoint** (recommended option chosen for all 8):

1. Cauldron matcher → raw action log + helper combinators (`inOrder`/`contains`/`exactlyOne`).
2. Stratum positioning → named symbolic anchors (`groundLevel`/`cloudLevel`/…) resolved to rows at registry build.
3. Beanstalk reveal pan → DOM `translateY` (canvas stays Phase 3).
4. Derived values (maxHp) → single `recomputeCaches(state)` pass post-load/migration, before the loop.
5. Spell cooldowns → live in-memory only, not persisted (quests don't survive mid-run).
6. Seed-event gate metric → `candies.lifetimeAccumulated` (total ever earned).
7. i18n → full typed `GameText` interface + `en.ts` only.
8. Tavern rumor → accumulated game time (soft floor), never wall-clock.

_Original deliberations, for the record:_

- Cauldron recipe matcher API: CB2 matches the last-5 action log with nested predicates. Should CB3 RecipeDef.matcher receive the raw action log (max flexibility, harder to author) or a normalized summary (easier, less expressive)? Leaning raw log + helper combinators; confirm against the Phase 1 health-potion recipe.
- Stratum vertical positioning unit: yAnchor in character rows vs. a named symbolic anchor ('groundLevel', 'cloudLevel'). Rows are concrete but couple to art height; named anchors are flexible but need a resolver. Recommend named anchors resolved to rows at registry build.
- Does the beanstalk reveal pan need the canvas at all, or is DOM translateY sufficient for the one-time cinematic? Assuming DOM-only for Phase 1; revisit if the smooth pan stutters on low-end mobile.
- Where exactly does maxHp recompute live so it's never stored yet always fresh on load before the first tick (CB2 had a stale-derived-value bug)? Proposal: a recomputeCaches(state) pass run once post-load/post-migration, before driver start.
- Per-spell cooldown storage: on the live QuestPlayerSpell instance (not persisted, fine) vs. in save (needed only if quests must survive reload mid-fight). DESIGN implies quests don't persist mid-run; confirm so we don't over-serialize.
- Exact seed-event gate: '~50k total candies earned' — is that lifetimeAccumulated of candies or a separate totalCandiesEarned counter? They differ once spending starts. Recommend candies.lifetimeAccumulated; confirm with design.
- i18n scope for Phase 1: full typed GameText interface now, or English-only strings inline with the interface stubbed? Recommend the interface + en.ts only; defer other locales to avoid Phase 1 drag.
- Tavern 'one free rumor per real-time hour' — this is a soft real-time floor like the comet, not a hard gate. Confirm it uses accumulatedGameTimeMs (survives reload) and not wall-clock, consistent with the §22.2 rule.

