# ADR-001: Candy Box 3 — Core Architecture

**Status:** Accepted · **Date:** 2026-06-13 · **Author:** Lead Architect
**Locked stack:** vanilla TypeScript + Vite, hand-rolled signals, no UI framework, pure ASCII, single-page, no backend. Vitest + Playwright, TDD, 80%+ coverage.

This ADR makes concrete, non-negotiable calls for the build. Where the 8 briefs disagreed, the decision and its rationale are recorded inline.

---

## 1. Context

CB3 is a ~15–20h ASCII incremental-RPG. The reference (CB2) is 285 single-class TypeScript files: a global mutable `Saving` key-value store, two `setInterval`/`setTimeout` timers with **no delta-time and no offline catch-up**, full-DOM-replace jQuery rendering rebinding all handlers every frame, one hand-coded `Quest` subclass per quest, unversioned saves, and all content (prices, recipes, dialogue) hardcoded inside class bodies. The briefs converge on what to keep (resource triple, place lifecycle hooks, two-rate tick split, glyph-grid ASCII model, conditional zone reveal) and what to replace (mutation, jQuery re-binding, no offline progress, hardcoded content, single global spell cooldown, fixed-size horizontal map).

CB3 must additionally support a **vertical-growing map**, **four quest modes** (horizontal / vertical / zero-G / ship), 2026 **background-throttling-proof** timekeeping, **versioned migratable saves**, and **fully data-driven content**.

---

## 2. Decision Summary (the load-bearing calls)

| # | Decision | Rationale |
|---|---|---|
| D1 | **Plain serializable `GameState` object is the single source of truth; signals mirror primitives from it.** | Briefs 2/5/7 all warn: never serialize signal wrappers/closures. Save = `JSON.stringify(state)`. Signals are a *view* over state for reactivity, never the canonical store. |
| D2 | **Native `number`, integers only. No big-number lib.** | Brief 7: peak is 10^12, ~6000× below `MAX_SAFE_INTEGER` (9.007e15). break_infinity earns its keep only past 1e308. All arithmetic/format routed through `core/number/` so a future swap is one-directory change. |
| D3 | **One `requestAnimationFrame` driver + fixed-timestep accumulator at 10 Hz sim. Offline/background catch-up is a SEPARATE timestamp-delta path, computed analytically (closed-form), run before the live loop resumes.** | Briefs 6/7/8: rAF pauses when hidden, timers throttle to 1/min, iOS suspends. The *amount* of production always derives from a measured `Date.now()` delta — the loop only decides *when* to call `tick`. |
| D4 | **`tick(state, dtMs) -> newState` is PURE w.r.t. time and clock.** | Brief 8 P0. Enables unit tests with plain numbers; no fake timers needed for economy logic. |
| D5 | **Hand-rolled signals (~60 lines) with auto dependency tracking, hardened against the 3 potch toy flaws (dep cleanup, lazy/memoized computed, equality gating).** | Brief 7: fine-grained signals beat nanostores/zustand for hundreds of small interdependent counters; no dependency added. |
| D6 | **ONE generalized data-driven quest engine. A `QuestDef` data object + a `PhysicsDriver` strategy per mode. No per-quest subclass.** | Briefs 3/5: CB2's biggest waste is 1 class per quest. Four modes share entity/weapon/collision; only the driver + scroll axis + win condition differ. |
| D7 | **Hybrid renderer behind one `Renderer` interface: DOM (`<pre>` + span tags + delegated events + glow overlay) for idle UI / map / slow quests; a single `<canvas>` + glyph-atlas arena renderer mounted only for per-frame-motion quests (drift combat mandatory).** | Briefs 4/6: DOM is right for mostly-static text (selection, glow, hotspots free); canvas+atlas is the documented 10× path for full-frame redraws. Both share one immutable `CellBuffer` model. |
| D8 | **Versioned save envelope `{v, t, lastTick, state}` in localStorage (one key per slot + tiny meta key); ordered migration ladder; LZ-string base64 export; Zod validate-and-migrate on import; refuse future versions; `lifetimeCandiesEaten` is a first-class never-reset field.** | Briefs 2/7/8: CB2 has zero versioning and silently corrupts. Migrate-then-validate; never crash on hand-edited saves; never destroy the pasted string. |
| D9 | **All content (zones, items, recipes, quests, dialogue, death messages, shop entries, production) authored as typed `*Def` data records under `src/content/`, separate from `src/engine/`. Engine reads defs; defs import no engine code.** | Briefs 1/3/5: the single largest architectural improvement over CB2. New content = append a data object, touch no engine file. |
| D10 | **Map is a bottom-to-top `Stratum` registry; zones declare position relative to a named stratum anchor, never absolute pixel coords.** | Brief 1: CB2's fixed bitmap with hardcoded char offsets cannot grow upward. CB3's map literally extends the page as acts unlock. |

---

## 3. Module / Folder Layout

Strict separation: `engine/` (pure logic, no DOM), `render/` (DOM/canvas, no game rules), `content/` (typed data, imports only types), `app/` (wiring). Files target 200–400 lines, 800 hard max (per coding-style rule). See `moduleLayout` for the full {path, purpose} table.

Dependency direction (enforced, e.g. via eslint-plugin-boundaries later):
```
content/  ──imports types only──►  engine/types
app/      ──►  engine/ + render/ + content/
render/   ──►  engine/types  (never engine logic, never content)
engine/   ──► (nothing above; pure)
```

---

## 4. Reactive Signals / Store Design

### 4.1 Decision
A hand-rolled `signal / computed / effect / batch` module (Brief 7's hardened skeleton). State of record is a **plain `GameState` object**; engine reducers produce new state; the app layer mirrors selected primitives into signals so the renderer auto-updates. We do NOT make every state field a signal — only the values the UI binds to (resource counts, derived rates, unlock flags, active place). The sim tick mutates `GameState` immutably (returns new objects); after each committed tick we `batch()` the signal writes.

### 4.2 Core primitive sketch
```ts
// engine/signals/signal.ts  (~60 lines hardened)
type Sub = { run(): void; deps: Set<Set<Sub>> };
let active: Sub | null = null;
let batchDepth = 0;
const pending = new Set<Sub>();

export function signal<T>(initial: T) {
  let value = initial;
  const subs = new Set<Sub>();
  return {
    get(): T {
      if (active) { subs.add(active); active.deps.add(subs); }   // auto dep-track
      return value;
    },
    set(next: T): void {
      if (Object.is(next, value)) return;                         // (flaw 3) equality gate
      value = next;
      for (const s of [...subs]) (batchDepth ? pending.add(s) : s.run());
    },
    peek: () => value,
  };
}

export function effect(fn: () => void): () => void {
  const sub: Sub = {
    deps: new Set(),
    run() {
      for (const d of sub.deps) d.delete(sub);                    // (flaw 1) cleanup stale deps
      sub.deps.clear();
      const prev = active; active = sub;
      try { fn(); } finally { active = prev; }
    },
  };
  sub.run();
  return () => { for (const d of sub.deps) d.delete(sub); sub.deps.clear(); };  // disposer
}

export function computed<T>(fn: () => T) {
  const s = signal<T>(undefined as unknown as T);                 // (flaw 2) memoized in a cached signal
  effect(() => s.set(fn()));
  return { get: s.get, peek: s.peek };
}

export function batch(fn: () => void): void {
  batchDepth++;
  try { fn(); } finally {
    if (--batchDepth === 0) { const run = [...pending]; pending.clear(); for (const s of run) s.run(); }
  }
}
```

### 4.3 Resource model (steal CB2's triple)
```ts
// engine/types/Resource.ts
interface ResourceState { current: number; lifetimeAccumulated: number; historicalMax: number; }
// add(state, n): only-positive n increments lifetimeAccumulated; current never goes < 0; updates max.
// transferTo(): the auditable flow used for eating/crafting (Brief 5).
```
`lifetimeCandiesEaten` is NOT a Resource field derived from balance — it is a dedicated top-level `number` mutated only via `eatCandies()` (gates ending 3 + scales "wrapper"; Briefs 2/7/8). Same for `starsRemaining` (8128 → down).

### 4.4 Place lifecycle = signal disposal (steal CB2, fix the leak)
Each Place/Zone `mount()` returns a `dispose()` that tears down its `effect()` subscriptions and event listeners. `GameController.setPlace(next)` calls `current.dispose()` before `next.mount()` — the typed replacement for CB2's `resetResourcesCallbacks()`. `savedPlace` becomes a `mapReturnTarget` of depth 1 (Brief 1).

---

## 5. Tick + Render Loop Architecture

### 5.1 Two clocks, three loops, one truth
- **Sim loop (fixed 10 Hz):** one `requestAnimationFrame` driver with an accumulator. `STEP_MS=100`, `MAX_DELTA=250` (clamp refocus spike), `MAX_UPDATES=50` (spiral-of-death break). Each step calls `tick(state, STEP_MS)`; production = `rate * (STEP_MS/1000)` so it is refresh-rate-independent (Brief 7).
- **Render:** idle UI renders **lazily on signal change** (no rAF spin — critical for an 18h tab; Brief 6). The **canvas arena rAF render** runs at up to 60 fps **only while a real-time quest is mounted**, then unmounts.
- **Offline / background catch-up (separate path):** persist `lastTickWallClock` + `accumulatedGameTimeMs` on every autosave and on `visibilitychange→hidden`. On `load` and on `visibilitychange→visible`: `elapsed = clamp(Date.now() - lastTickWallClock, 0, MAX_OFFLINE_MS)`; award `rate * elapsed * (boxClosed ? 2 : 1)` analytically in ONE `batch()`; set new `lastTickWallClock`; THEN resume the rAF driver. Reject negative deltas (clock rollback → 0 gain). `MAX_OFFLINE_MS` is a tuning knob (start 24–72h) capped to keep the §5 curve honest.

```ts
// engine/loop/driver.ts (foreground sim only — amounts come from tick, but live loop uses fixed dt)
let last = performance.now(), lag = 0;
function frame(now: number) {
  lag += Math.min(now - last, MAX_DELTA); last = now;
  let n = 0;
  while (lag >= STEP_MS) { commit(tick(getState(), STEP_MS)); lag -= STEP_MS; if (++n >= MAX_UPDATES) { lag = 0; break; } }
  // render is driven by signal effects, not called here
  rafId = requestAnimationFrame(frame);
}
```

### 5.2 The Schrödinger box (§18.12)
`boxClosed: boolean` in state; the `×2` lives ONLY inside the catch-up multiplier. **Never** surfaced in any tooltip, log, or candies/sec breakdown (Briefs 7/8). The resulting candy total is the only tell.

### 5.3 The comet (§22.2) — by construction, never wall-clock-gated
First pass fires at `accumulatedGameTimeMs >= 5min` after telescope purchase (accumulated game time survives reload/background via the same delta machinery). Later passes are driven by event/candy counters with a soft real-time floor. No `new Date()` comparison ever gates progression (Brief 8 P0).

### 5.4 Persistence triggers
Autosave debounced 30–60s + on `visibilitychange→hidden` (last reliable moment; `beforeunload` best-effort only). Read `document.wasDiscarded` on load. Call `navigator.storage.persist()` on first interaction (Safari ITP 7-day wipe). `setItem` wrapped in try/catch for `QuotaExceededError` → non-fatal "couldn't save" state.

---

## 6. Generalized Quest Engine (all 4 modes from shared code)

### 6.1 Decision
A single `Scene` runtime executes any `QuestDef`. Modes differ only by a swappable `PhysicsDriver` + scroll axis + win condition. Entities keep CB2's composition model (entity owns renderArea + collision + movement + weapons + team) but **immutable** (`Vec2` operations return new vectors; `tick` returns new entities) per coding-style rule. Per-spell cooldowns replace CB2's single global cooldown. Boss phases are a declarative `BossPhase[]` state machine, not ad-hoc switches. Death = respawn at last `SafeZone` (lose nothing), with a death message picked from `QuestDef.deathMessages`.

### 6.2 Shared layers
- **L0 primitives:** immutable `Vec2`, `CollisionBox`, `CollisionBoxCollection` (AABB), `CellBuffer` + transparency (alpha/meta-alpha char convention, Brief 4).
- **L1 entity:** `Entity { id; team; pos: Vec2; cbc; hp; maxHp; weapons; abilities; tags; render }`. `update(scene, input, dt) -> Entity`.
- **L2 PhysicsDriver interface:** `{ gravity: Vec2; applyGravity; applyMovement; canJump; isGrounded }`.
  - `HorizontalDriver` gravity `(0,+1)`, wormsLike step. (Mode A)
  - `VerticalDriver` gravity `(0,+1)` but player input/scroll is the Y axis; gusts = periodic `forceMoveAll(0,+g)`; inversion zones flip `gravity` sign while player inside a trigger volume. (Mode B — beanstalk)
  - `ZeroGDriver` gravity `(0,0)` + persistent `velocity` on the player; gumball cannon adds impulse opposite facing, drag decays per tick; ammo=gumballs, ammo-out → respawn-at-ship (not death). Asteroids `willDie()` split into ≤2 children, max 2 generations. (Mode C — drift)
  - `ShipBroadsideDriver` timing mini-game; boarding **switches the driver in place to `HorizontalDriver`** and spawns a player-entity on the deck — same entity array continues. (Mode D)
- **L3 `QuestDef` (data):** `{ id, size, mode, playerStart, boundary, background?, playerConfig{speed,maxHp,allowedSpells,allowedPotions}, staticEntities, waves: WaveDef[], winCondition, deathMessages, drops, safeZones, onWin(flags) }`.
- **L4 `WaveScheduler`:** evaluates triggers (`distance | timer | event | bossHpBelow | manual`) and emits spawn orders; holds all wave state in one object so progress is in principle snapshottable (Brief 3). Unifies CB2's scattered timers + TheSea pattern chain.
- **L5 `Scene`:** owns flat `entities[]`, `scrollOffset`, `phase`. Base loop hoists CB2's per-quest boilerplate into hooks: `tick → schedule spawns → update entities → cull dead → checkWin → checkDeath → applyScroll`. Scrolling generalized from TheSea's `forceMovingAllEntities` into a `ScrollingDriver` (X for A, Y for B, both for C).

### 6.3 Collision performance
Brute-force AABB O(n²) is fine for A/B/D (<50 entities). Drift (C) can hit 100+ asteroids → optional 10×10 spatial-grid bucketing enabled by the driver (Brief 3).

### 6.4 Phase-1 scope of the engine
Phase 1 implements L0–L5 + `HorizontalDriver` + `VerticalDriver` + `WaveScheduler` (trigger types: distance, timer, event) + DOM arena renderer. `ZeroGDriver`/`ShipBroadsideDriver` and the canvas arena renderer are deferred to Phases 3+ behind the same interfaces (proven by the beanstalk needing only the vertical driver).

---

## 7. ASCII Render Layer

### 7.1 Decision — hybrid behind one interface
```ts
interface Renderer { mount(root: HTMLElement): void; render(prev: CellBuffer|null, next: CellBuffer, hotspots: Hotspot[], glows: GlowSpec[]): void; unmount(): void; }
```
- **`DomRenderer` (default, always for idle UI / map / shop / forge / observatory / slow quests):** one `<pre>` per surface; serialize `CellBuffer` → HTML by splicing style/`data-action` `<span>` tags right-to-left per row (CB2's descending-x invariant, Brief 4) and joining with `\n`. Color = inline `<span style>` over char ranges. No String.prototype mutation (pure utils).
- **`CanvasArenaRenderer` (mounted only for per-frame-motion quests; drift combat mandatory):** prerendered **glyph atlas** keyed by `(char,colorClass)`, `drawImage` blit per changed cell (dirty-cell diff of prev vs next immutable buffer), `getContext('2d',{alpha:false})`, integer coords, DPR-scaled backing store. No `shadowBlur`; glowing glyphs are baked atlas variants. (Brief 6, the documented 10× path.)

### 7.2 Glow (CSS only, the new aesthetic CB2 lacks)
Static `text-shadow` via a CSS class per glowing entity (`.glow-sun`, `.glow-moonpop`, `.glow-rockcandy`) — data-driven from flavor. Pulsing = a separate absolutely-positioned overlay `<div>` (`pointer-events:none`) whose spans animate **opacity only** (never the shadow values), reconciled by a `Map<"col,row",GlowSpec>`, gated behind `@media (prefers-reduced-motion: no-preference)`, wrapped in `contain: paint`. (Briefs 4/6/8.)

### 7.3 Clickable hotspots — delegation, not re-binding
One delegated `click`/`mousemove` listener per surface. Pixel→cell is integer math: `col=floor((x-left)/cellW); row=floor((y-top)/cellH)`. A sparse `hotspotMap` keyed by `"col,row"` (or rectangles for irregular shapes) dispatches by `data-action`. This eliminates CB2's per-render jQuery re-binding entirely (Briefs 1/4/6). For single-token idle controls, prefer real `<button>`/`<a>` (free a11y).

### 7.4 Cell metrics & font
Self-host **JetBrains Mono variable** (validated for box-drawing alignment to 120% line-height — CB3's map uses `│ ═ ╧ ∴ ◯ ☾ ☀ ▽`). Load via `await document.fonts.load(...)` **before first render** (avoid FOUT misaligning the grid). Measure `cellW` from `1ch` and `cellH` from `--line-height` once after font load; store as CSS vars + JS constants so DOM and canvas share identical metrics. `font-variant-numeric: tabular-nums lining-nums` on the candy counter (no digit-jitter); `white-space: pre`. (Briefs 4/6.)

### 7.5 Vertical scrolling map
DOM, virtualized. Render only visible strata + buffer; each stratum is a `contain: content; content-visibility: auto` block with a `contain-intrinsic-size` hint (offscreen strata cost nothing — never `getBoundingClientRect` them). Scroll via `transform: translateY` (compositor), not animated `scrollTop`. New strata append as acts unlock (page grows upward). Status bar pinned `position: fixed; top:0`. Persist `scrollY` to save, restore on load (CB2 pattern). The beanstalk reveal = append sky strata + smooth `translateY` pan upward.

### 7.6 Accessibility (Brief 8)
`aria-hidden` on decorative ASCII; `role="img"` + `aria-label` on meaningful scenes/map (with a text description of player location). `prefers-reduced-motion: reduce` ⇒ `animation:none` on all glow/comet/sun motion (static glow color stays). Viewport `width=device-width, initial-scale=1`; never disable zoom. `rem`/`em` sizing. Horizontal-scroll container for wide art on narrow screens. Visible focusable `<input>` for typed-secret box (mobile keyboard). Act 4 audio gated behind the descent click that also calls `audioContext.resume()`.

---

## 8. Number Handling

**Decision: native `number`, integers only; no big-number library.** Rationale (Brief 7): the §5 ceiling is ~10^12, ~6000× below `Number.MAX_SAFE_INTEGER` (9.007e15) and ~10^296 below the float limit. break_infinity.js only benefits past 1e308 and would poison every comparison (`a<b`→`a.lt(b)`), the signals layer, and serialization — a one-way door for numbers CB3 never reaches.

**Containment for a cheap escape hatch:** all currencies are integers; never let one become a float. Route all formatting/arithmetic-display through `engine/number/format.ts` (and a `type Currency = number` alias) so a future migration is a single-directory change. **When to introduce a big-number lib:** only if a *future design change* pushes any persisted, tracked value past ~1e15 — the current DESIGN.md never does; revisit only if NG+ stacking or a new act blows the curve.

**Formatting:** `formatCount(n)` uses `Intl.NumberFormat('en-US')` (pinned locale) for comma-grouped full numbers — required for the deadpan "1,000,000,000 candies. The number has stopped meaning anything to you." `formatCompact(n)` gives K/M/B/T for dense UI. Adaptive truncation by available char width (CB2 pattern) keeps the status bar readable at any magnitude.

---

## 9. Save Schema + Versioning/Migration + Import Validation

**Decision (D8):** Envelope `{ v: schemaVersion, t: savedAt, lastTick: wallClock, state: GameState }`.
- **localStorage:** one key per slot (`cb3.slot{n}` = LZ-string base64 of the envelope) + a tiny `cb3.slot{n}.meta` (date, version, lifetimeCandiesEaten, actReached, ngPlusRun) for cheap slot-picker reads. One key per slot = atomic writes (no CB2 partial-write corruption). Separate `cb3.settings` survives slot loads. 3 rotating autosave slots.
- **Export string:** `LZString.compressToBase64(JSON.stringify(envelope))` — compact, shareable, still editable (base64-decode → edit JSON → re-encode).
- **Import flow (order matters):** decode → **refuse if `v > CURRENT_VERSION`** (clear message, keep current save) → **migrate** (ordered ladder `migrations[from](state)` applied sequentially) → **Zod validate** with `.default()`/`.finite()`/clamps on every field, strip `__proto__`/`constructor` (prototype-pollution guard), reject NaN/Infinity → commit only on success; on failure keep current save AND the pasted string in the textarea, list failing fields. Unknown keys: warn but load known fields (never silently corrupt like CB2; never crash like a naive parse).
- **`lifetimeCandiesEaten`** is a first-class persisted field, incremented only via `eatCandies()`, never reset (survives NG+). `starsRemaining` (8128↓) likewise persists across NG+.
- **NG+ (`beginNGPlus`)**: archive the completed run to `cb3.completedRun.{n}` (never mutate it); fresh state carrying over only `lifetimeCandiesEaten`, `starsRemaining`, `nGPlusRun+1`.

See `saveSchemaSketch` for v1.

---

## 10. Data-Driven Content Model

**Decision (D9):** every content type is a typed `*Def` record under `src/content/`, importing only types from `engine/types`. Engine consumes registries; adding content never edits engine code.

```ts
ItemDef        { id; displayKey; descKey; ascii; saveFlag; slot?; stats?; special? }
ShopEntry      { itemId; price: {resource; amount}[]; unlock: (s: GameState)=>boolean; speechKey }
RecipeDef      { id; matcher: (log: readonly CauldronEntry[])=>boolean; output; quantity: (log)=>number }   // cauldron = data-driven action-log matcher, not nested ifs
EnchantmentDef { id; from: ItemId; to: ItemId; cost }            // graph edges; multi-tier trivial
ProducerDef    { id; getRate: (s: GameState)=>number; resource } // composable producer registry; tick sums all
ZoneDef        { id; displayKey; unlock; stratumAnchor; subZones; hotspots }
StratumDef     { id; yAnchor; asciiKey; zones: ZoneDef[]; unlockFlag }   // bottom→top map registry
QuestDef       { ...§6.2 }
DialogueDef    { speaker; lines; conditions }
DeathMessage   { source: DamageSourceId|'generic'; message }
SecretDef      { trigger: string|RegExp; effect(state, dispatch) }
```
Number formatting + production are composable: a `ProducerDef[]` registry replaces CB2's hardcoded `handleCandiesProduction` — the tick sums `getRate()` over all registered producers (grandma recipes, field expansions, gummy farmhands, solar collectors), so a new source is a new data record. i18n uses typed locale modules (`en.ts` satisfies `interface GameText`; missing keys = compile errors) instead of CB2's flat `lang.key` text files.

---

## 11. Consequences

**Positive:** No runtime dependency beyond LZ-string + Zod (both tiny, both at the save boundary only). Economy logic is pure and unit-testable without timers. Offline progress, background-throttling, and iOS suspension are neutralized by one architectural choice (D3/D4). New content is data, not code. The four quest modes share one engine. Renderer is swappable per surface.

**Negative / accepted costs:** Two renderers to maintain (mitigated by the shared `CellBuffer` + `Renderer` interface). The signals layer is hand-rolled (mitigated: ~60 lines, fully unit-tested, three known flaws fixed up front). Immutable entity updates allocate per tick (mitigated: bounded entity counts; dirty-cell diff; pre-allocated arena buffers in Phase 3).

**Risks** tracked separately below.

