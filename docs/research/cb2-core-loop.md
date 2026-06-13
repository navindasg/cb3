---
title: "CB2 Core Game Loop, Bootstrap, and Map/Places System — Deep Analysis for CB3"
slug: cb2-core-loop
type: code
---

> Candy Box 2 is a single-page TypeScript+jQuery incremental game compiled to one large `candybox2.js` bundle. Its architecture has three foundational pillars: a global in-memory key-value store (`Saving` module) that acts as all game state; a two-rate timer system (1 Hz for idle production, ~10 Hz for quests) that runs as persistent `setInterval`/`setTimeout`; and a full-DOM-replace render pipeline (`RenderArea` → `RenderLocation` → `innerHTML`) with jQuery event wiring re-executed on every render. The map system (`MainMap`) is a static large ASCII art image with overlaid click regions conditionally loaded based on `Saving.loadBool` flags that gate zone visibility. CB3 needs a vertical-scrolling cross-section map that extends upward as content unlocks — the CB2 pattern of flag-gated `loadZone(x, y)` calls is directly reusable but must be adapted for a data-driven vertical layout rather than a single fixed-size bitmap.

### Key findings
- BOOTSTRAP SEQUENCE: jQuery $(document).ready → Main.documentIsReady() → Main.start() → new Game(gameMode) (registers all state, creates resources, statusBar, player, starts intervals) → Saving.load(game, loadingType, loadingString) (hydrates in-memory Saving maps from localStorage or file) → game.postLoad() (recalculates HP, updates status bar, calls goToCandyBox(), sets savedPlace = new Village). The entire sequence is synchronous except the two timers launched in the Game constructor.
- TWO-RATE TICK LOOP: Game constructor launches exactly two timers. (1) `window.setInterval(this.oneSecondMethod.bind(this), 1000)` — fires every real second, handles: player magic regen, candy production (adds lollipopFarmCurrentCandiesProduction candies), lollipop farm production (adds 1 lollipop when timer expires, or N/sec when farm is large enough), pond conversion (candies→lollipops), and local autosave. (2) `window.setTimeout(this.questMethod.bind(this), 100)` — self-rescheduling ~10 Hz loop; fires `questCallbackCollection`, rate slows to 5 Hz when questSlowedDown=true. Both loops fire a `CallbackCollection` of registered callbacks; quests register `this.update.bind(this)` into `questCallbackCollection` via `willBeDisplayed()`.
- IDLE/PASSIVE CANDY GENERATION: The base candy production rate is stored in `Saving.number('lollipopFarmCurrentCandiesProduction')`, default 1. Each 1 Hz tick, `Game.handleCandiesProduction()` calls `this.candies.add(Saving.loadNumber('lollipopFarmCurrentCandiesProduction'))`. This rate is a Fibonacci-like number (seed: prev=1, curr=1) that grows when the player feeds lollipops to the mill. The mill cost is `(currentCandiesProduction * 120)^2` lollipops. Lollipop farm production itself uses a lookup table for 1–20 lollipops planted (seconds between lollipops, from 8 hours down to 2 seconds) and an exponential formula `ceil(100 * (1 - exp(-(N-20)/5000)))` for 21+ lollipops.
- GLOBAL STATE ARCHITECTURE: All game state lives in the `Saving` module's three in-memory dictionaries: `bools`, `numbers`, `strings`. These are initialized via `Saving.registerBool/Number/String()` calls at module-level (file load time), which means registration order matters and all files must be included before the game starts. Saving to localStorage iterates ALL keys and writes each as a string. Load reads them back. There is NO versioning, migration, or schema validation — a key not found logs an error and returns undefined.
- PLACE / ZONE SYSTEM: `Place` is the abstract base for everything displayed in `#mainContent`. The active place is `Game.place`; there is exactly one at a time. `Game.setPlace(place)` calls `place.willStopBeingDisplayed()` on the old place (which resets hotkeys and fires `willBeClosed()` if it was not a saved map place), resets all resource callbacks and interval callbacks, then calls `place.willBeDisplayed()` on the new place, then calls `displayPlace()` which calls `mainContentLocation.render(renderArea)`. Places implement `getRenderArea(): RenderArea`, `getScrolling(): boolean`, `getGap(): number`, `getDefaultScroll(): number`, plus lifecycle hooks `willBeDisplayed()`, `willStopBeingDisplayed()`, `willBeClosed()`.
- MAP SCROLLING MECHANISM: `MainMap.getScrolling()` returns `true`. When `Game.setPlace(mainMap)` runs, `RenderLocation.setScrolling(true, defaultScroll)` is called, which sets `#mainContent` to `position:absolute; left:0; top:0; overflow-x:scroll` and sets `#aroundStatusBar` to `position:fixed; top:0`. This makes the status bar sticky while the map scrolls. The scroll position is saved to `Saving.number('mainMapDefaultScroll')` in `MainMap.willStopBeingDisplayed()`. Scrolling is disabled for all other places, resetting CSS to `position:relative`.
- MAP ZONE REGISTRATION PATTERN: `MainMap.load()` first calls `renderArea.resizeFromArray(Database.getAscii('maps/map'))` and `renderArea.drawArray(...)` to paint the static ASCII background, then conditionally calls individual `loadXxx(x, y)` methods. Each `loadZone` method: (a) calls `renderArea.addMultipleAsciiButtons(cssClass, x1,x2,y, ...)` to mark clickable ASCII cells, (b) calls `renderArea.addFullComment(x,y,text,translated,class)` to place the hover label, (c) calls `renderArea.addLinkOver(selectors, commentSelector)` for hover show/hide, (d) calls `renderArea.addLinkCall(selectors, new CallbackCollection(this.goToZone.bind(this)))`. Zone visibility is gated by `Saving.loadBool('mainMapDone[ZoneName]')` or item possession flags.
- RENDER PIPELINE: `RenderArea` holds a `string[]` (one string per row, fixed-width). Drawing mutates these strings in-place using `replaceAt()`. Tags (`RenderTag[][]` — one array per row) inject HTML strings at specific column positions during rendering. `getForRendering()` clones the string array, injects all tags, joins with `\n`, and returns the HTML string. `RenderLocation.render()` calls `$(selector).html(htmlString)` then `renderArea.runLinks()`. `runLinks()` iterates `RenderLink[]` — each link registers a jQuery event handler (mouseup, mouseenter, etc.) on the freshly-injected DOM. This means ALL event handlers are re-wired on EVERY render call.
- CALLBACK-DRIVEN REACTIVITY: `Resource.setCurrent()` calls `this.callbackCollection.fire()`, which triggers all registered callbacks. `StatusBarResource.setCurrent()` additionally calls `game.updateStatusBar()`. Places register callbacks in `willBeDisplayed()` (e.g., CandyBox registers `this.checkCandies.bind(this)` on `game.getCandies().getCallbackCollection()`). When `setPlace()` is called, `resetResourcesCallbacks()` clears all callback collections, severing old places. This is a manual reactive system with no dependency tracking.
- SAVING / LOAD BOUNDARY: `Saving.load(game, loadingType, loadingString)` hydrates the in-memory maps from localStorage (all keys prefixed with slotId), then calls `game.load()` (which calls `resource.load()` on each resource — reading `Accumulated`, `Current`, `Max` from Saving maps) and `game.getPlayer().load()`. Then `game.postLoad()` runs. The save path reverses this: `game.save()` → `resource.save()` → `LocalSaving.save()` → iterates all Saving maps → `localStorage.setItem`. Autosave fires every 600 seconds (10 minutes) via the 1 Hz loop.
- QUEST TICK INTEGRATION: When a Quest `willBeDisplayed()` is called, it sets `game.weAreQuesting = true` and registers `this.update.bind(this)` into `game.questCallbackCollection`. The self-rescheduling `questMethod` fires this every ~100ms. Quest entities update physics/position each tick inside `Quest.updateEntities()`. When the quest ends or the player navigates away, `willBeClosed()` sets `weAreQuesting = false` and `resetResourcesCallbacks()` removes the quest update callback.
- SAVED MAP PLACE PATTERN: `Game.savedPlace` holds the last map-type place (Village or MainMap). `saveCurrentMapPlace()` sets `savedPlace = place` only if `savedPlace == null`. `goToMap()` calls `setPlaceFromSavedMapPlace()` which restores it. Tab places (Inventory, CandyBox, etc.) call `saveCurrentMapPlace()` before switching, preserving the map context. Quests do NOT call `saveCurrentMapPlace()` — they use `setPlace()` directly, so exiting a quest goes back to whatever `savedPlace` was set before.
- PROCEDURE TO ADD A NEW ZONE: (1) Register `Saving.registerBool('mainMapDoneNewZone', false)` at file top. (2) Add a `loadNewZone(x, y)` private method to MainMap following the 4-step button/comment/hover/callback pattern. (3) Add a conditional `if(Saving.loadBool('mainMapDoneNewZone')) this.loadNewZone(x, y)` inside `MainMap.load()`. (4) Implement `goToNewZone()` private method calling `this.getGame().setPlace(new NewZone(this.getGame()))`. (5) Create `NewZone extends Place` (or `Quest`). (6) In the quest's `endQuest(win)`, call `Saving.saveBool('mainMapDoneNewZone', true)` on win. (7) Add zone ASCII art to the Database. (8) Add a `goToNewZone()` method on `Game` if it's a reusable destination.
- DATABASE SYSTEM: `Database` module holds two maps: `asciiMap` (key → string[]) and `textMap` (key → string, keyed as 'lang.textKey'). Content is registered via `Database.addAscii()` and `Database.addText()` called from data files that are included in the compiled bundle. There is no lazy loading — everything is in memory at startup. The map's ASCII art (`maps/map`) is a single large string array loaded this way.
- HTML STRUCTURE: Exactly two `<pre>` elements: `#statusBar` (inside `#aroundStatusBar`) and `#mainContent`. The status bar is 100 chars wide × 6 rows, fixed-width font. The main content area is the active place's render area. Both are replaced wholesale on each render. jQuery is the only external dependency.

### Patterns to steal
- TWO-RATE TIMER SPLIT: Separating the 1 Hz idle/production loop from the ~10 Hz quest physics loop is correct and should be preserved in CB3. The 1 Hz loop handles all resource accumulation; the 10 Hz loop handles quest frame updates. Keep them distinct signals in the reactive layer.
- CALLBACK COLLECTION RESET ON PLACE CHANGE: The pattern of `resetResourcesCallbacks()` in `setPlace()` is elegant — it prevents stale callbacks from accumulating. In CB3's signals layer, `effect()` subscriptions registered by a place should be tracked and disposed when the place deactivates. The lifecycle hooks (`willBeDisplayed` / `willStopBeingDisplayed` / `willBeClosed`) are clean seams for this.
- CONDITIONAL ZONE LOADING IN MAP: The `load()` method in MainMap that iterates through `if(flag) loadZone(x, y)` is the right pattern for progressive map reveal. In CB3 for a vertical map, keep this exact data-driven approach but make zones data objects with a `{key, x, yFromBottom, unlockFlag, destinationFactory}` shape so new zones can be registered without touching the render method.
- RESOURCE WITH ACCUMULATED/CURRENT/MAX TRIPLE: Every resource tracking `accumulated` (lifetime), `current` (spendable), and `max` (high-water mark) is a sound pattern. `max` drives the 'you had at least N' checks that gate UI reveals (CB2's `candies.getMax() > 0` to show the eat button). CB3 should make this a typed `Resource<T>` signal with the same triple.
- SAVED PLACE / TAB NAVIGATION: The `savedPlace` pattern to remember the last map location across tab switches is clean. CB3 should use a `mapRouteStack` with at most depth 1 — same semantics, no call-stack navigation complexity.
- PLACE AS UNIT OF SCREEN: The `Place` abstraction that owns its own `RenderArea`, registers its own callbacks, and has lifecycle hooks is the right unit. In CB3 each zone/screen should be a `Place`-equivalent class with `mount()` / `unmount()` returning a disposal function — replacing jQuery wiring with direct DOM event listeners on a freshly-rendered fragment.
- SAVINGPREFIX NAMING CONVENTION: Using a consistent `savingPrefix + 'Current'` / `savingPrefix + 'Accumulated'` / `savingPrefix + 'Max'` pattern for resource serialization is clean and mechanical. In CB3, the signal store should use the same flat-key namespace so save/load is a trivial JSON serialization.
- QUEST AS A PLACE: Quests extend Place and integrate into the same place-switching mechanism. The quest loop merely registers into `questCallbackCollection`. This means quests and map views are symmetric from the game's perspective. CB3 should maintain this symmetry — quests are places with a faster tick callback.

### Pitfalls
- FULL DOM REPLACEMENT ON EVERY RENDER: `RenderLocation.render()` calls `$(selector).html(html)` which destroys and recreates all DOM nodes every render cycle. For the status bar (updated every candy tick via `StatusBarResource.setCurrent`) this means jQuery re-binds ALL tab click handlers 10+ times per second. In CB3 with signals, reactive DOM patching (even naive innerHTML diffing per section) would be significantly better.
- JQUERY EVENT HANDLERS ACCUMULATE: `RenderLink.run()` calls `$(element).mouseup(handler)` on the freshly-replaced DOM. Since the DOM was just replaced, there are no stale handlers — but this means every render registers ALL event handlers from scratch. If CB2 ever had a render without a corresponding DOM replacement, handlers would stack. CB3 should use event delegation on the container instead of per-element binding.
- GLOBAL MUTABLE SAVING STORE: All state is in a single global module-level mutable dictionary. There is no immutability, no transaction safety, no undo. Any code anywhere can call `Saving.saveBool()` and mutate state silently. In CB3, state mutations should go through explicit signal setters so the reactive layer can track what changed.
- REGISTRATION ORDER DEPENDENCY: `Saving.registerX()` calls happen at file-load time (module-level code). If the compiled file order is wrong, `registerX` may be called after `saveX`, causing 'key already registered' errors or silent failures. CB3 should use a typed game state object initialized in one place.
- NO DELTA-TIME IN IDLE LOOP: The 1 Hz `setInterval` fires once per second and adds exactly `lollipopFarmCurrentCandiesProduction` candies, with no catch-up for missed ticks (tab hidden, browser throttled). A player who keeps the tab open does better than one who doesn't. CB3 should record `lastTickTimestamp` and compute delta-time on wake to catch up missed production, capped at some maximum.
- HARDCODED PIXEL COORDINATES IN MAP: Every zone in `MainMap` has hardcoded `(x, y)` coordinates into the static ASCII art. Adding a new zone requires manually counting characters in the ASCII art. For CB3's vertical map which extends upward, this approach is fragile — zones should declare their position relative to a named anchor or stratum, not absolute pixel offsets in a fixed bitmap.
- CANDY PRODUCTION HARDCODED IN GAME: `Game.handleCandiesProduction()` directly reads `lollipopFarmCurrentCandiesProduction` — the production rate is tightly coupled to the lollipop farm. CB3 will have multiple production sources (field expansions, gummy farmhands, solar collectors). The production calculation should be a composable function that sums contributions from all registered producers.
- QUEST SPEED ASYMMETRY: The quest loop runs at 10 Hz via `setTimeout` self-scheduling, while idle production is 1 Hz `setInterval`. If the quest loop is slow (heavy computation), `setTimeout` will drift later than 100ms. There is no mechanism to detect or compensate for this drift. CB3 should use `requestAnimationFrame` for the quest render loop with proper delta-time.
- STATUS BAR IS ALWAYS FULLY RE-RENDERED: `StatusBar.updateAll()` redraws the entire 100×6 status bar on every call, including all tab buttons and borders. It is called every time ANY resource changes (via `StatusBarResource.setCurrent()`). In CB3, the status bar should be split into independent reactive regions so only changed cells re-render.
- NO VERTICAL MAP SUPPORT: CB2's `MainMap` is designed as a single fixed-size horizontal-ish scrolling area loaded from one ASCII art file. It has no concept of zones being added to extend the map. CB3's design requires the map to literally grow upward as new strata unlock. CB2's pattern of a single static `renderArea.resizeFromArray(Database.getAscii('maps/map'))` does NOT support this — CB3 needs a map that is dynamically assembled from stratum components stacked vertically.

### Recommendations
- REPLACE SAVING MODULE WITH A TYPED SIGNAL STORE: Create a typed `GameState` interface with all keys. Initialize it as a plain object with defaults (replacing all the `Saving.registerX` calls). Expose it through a signals layer (`createSignal`, `createComputed`, `createEffect`). Save/load is just `JSON.stringify(gameState)` / `Object.assign`. This eliminates registration-order bugs, enables TypeScript type checking, and makes the reactive layer possible.
- IMPLEMENT DELTA-TIME CATCH-UP FOR IDLE PRODUCTION: Store `lastIdleTickMs` in the save. On game load and on every tick, compute `dt = Date.now() - lastIdleTickMs`, compute `missedTicks = Math.floor(dt / 1000)`, apply production for all missed ticks (capped at e.g. 24 hours), then set `lastIdleTickMs = now`. This is the standard idle-game offline progress pattern and CB2 completely lacks it.
- BUILD VERTICAL MAP AS A COMPOSABLE STRATUM REGISTRY: Define a `Stratum` data type: `{ id: string; yAnchor: number; asciiArt: string[]; zones: ZoneDescriptor[]; unlockSignal: Signal<boolean> }`. The map renderer iterates all registered strata in order from bottom to top, stacking their ASCII art vertically, and renders only unlocked zones. Adding a new stratum is adding a data object to the registry — no map render code changes. The total map height is computed as the sum of unlocked strata heights.
- USE EVENT DELEGATION INSTEAD OF PER-ELEMENT BINDING: Attach one `click` and one `mouseover` listener to `#mainContent` using `data-action` attributes on interactive elements. Each render stamps `data-action='goToVillage'` or similar. The single delegated handler reads the attribute and dispatches. This eliminates the `runLinks()` step entirely and survives re-renders without re-wiring.
- IMPLEMENT PLACE LIFECYCLE WITH SIGNAL DISPOSAL: Each Place's `mount()` method returns a `dispose()` function that tears down all `createEffect()` subscriptions, event listeners, and timer registrations. `GameController.setPlace(place)` calls `currentPlace.dispose()` before calling `newPlace.mount()`. This replaces the manual `resetResourcesCallbacks()` call in CB2's `setPlace()`.
- SPLIT RENDER INTO STATUS BAR SIGNALS AND PLACE SIGNAL: The status bar (candy count, HP bar, tabs) should be independent reactive components subscribed to their respective signals. The main content area renders the active Place's output. This means a candy tick only triggers re-render of the candy count span, not the entire status bar or the active place.
- USE requestAnimationFrame FOR QUEST RENDER, setInterval FOR IDLE: The quest physics loop should be driven by `requestAnimationFrame` with delta-time accumulation. The idle production loop should remain `setInterval(fn, 1000)` but with the delta-time catch-up described above. This matches CB2's two-rate design while fixing drift and enabling pause-on-tab-hide behavior.
- DATA-DRIVEN ZONE DESCRIPTOR: Define each zone as a data object: `{ id: 'village', unlockFlag: 'always', asciiButtonRegions: RegionDescriptor[], label: string, destination: () => Place }`. The map render function is generic — it knows nothing about specific zones. Adding a zone means appending to the zone registry array, not modifying any render function. This is the primary architectural improvement over CB2's manually-coded `loadVillage(x, y)` methods.
- MAKE LOLLIPOP FARM PRODUCTION PART OF A PRODUCER REGISTRY: Instead of `handleCandiesProduction()` hardcoded in `Game`, create a `candyProducers: CandyProducer[]` array. Each producer registers with `{ id, getRate(): number }`. The 1 Hz tick sums all rates and adds the total. Sources: the mill (current production value), field expansions, gummy farmhands, solar collectors (Act 3). This makes the production system extensible without modifying the core tick loop.
- PRESERVE THE MAP SCROLL-POSITION SAVE PATTERN: `MainMap.willStopBeingDisplayed()` saving the scroll position to state is a good UX pattern. In CB3, when navigating away from the vertical map, save `scrollY` to the game state so returning to the map restores the player's position in the vertical cross-section.

---

# CB2 Core Game Loop, Bootstrap, and Map/Places System — Full Analysis

## Overview

Candy Box 2 is a TypeScript codebase (circa 2013) compiled to a single `candybox2.js` bundle, loaded alongside jQuery 1.9.1 into a minimal HTML page with two `<pre>` elements. There is no framework, no module bundler, no runtime type checking. The entire game runs synchronously on a single thread driven by two browser timers.

---

## 1. HTML Shell

**File:** `/Users/navindasgupta/workspace/cb3/reference/candybox2/index.html`

```html
<div id="aroundStatusBar"><pre id="statusBar"></pre></div>
<pre id="mainContent"></pre>
```

- `#statusBar`: 100-char-wide × 6-row fixed-width status area. Rendered as a `<pre>` so monospace layout works.
- `#mainContent`: The active place's render area. Also `<pre>`.
- Two CSS IDs. That's the entire DOM structure.

---

## 2. Bootstrap Sequence

**Entry:** `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/main.ts`

```
$(document).ready
  → Main.setUrlData(window.location.search)     // parse ?slot=N or ?gamemode=X
  → Main.documentIsReady()
      → Keyboard.execute()                       // attach jQuery keydown/keyup handlers
      → Main.start()
          → game = new Game(gameMode)            // ALL setup happens here
          → Keyboard.setGame(game)
          → Saving.load(game, loadingType, str)  // hydrate state from localStorage or file
          → game.postLoad()                      // navigate to initial place
```

### Game Constructor (`/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Game.ts`, line 139)

Order of operations inside `new Game()`:
1. `Saving.saveString("gameGameMode", gameMode)` if gameMode non-null
2. `this.createGridItems()` — registers all inventory items (key items like MainMap, TimeRing, etc.)
3. `this.createEqItems()` — registers all weapons/hats/armours/gloves/boots
4. `new StatusBar(this, 0)` — creates the status bar (reads Saving flags to decide which tabs exist)
5. `new Player(this)` — creates the player object
6. `new Candies(this, "gameCandies")` and other resources
7. `this.updateStatusBar()` — first render of the status bar
8. `window.setInterval(this.oneSecondMethod.bind(this), 1000)` — **the idle tick**
9. `window.setTimeout(this.questMethod.bind(this), 100)` — **the quest tick (self-rescheduling)**

Note: all `Saving.registerX()` calls happen at **file load time** (module-level code outside any class), before `Game` is constructed. This means the Saving module's dictionaries are fully populated before the Game constructor runs.

### postLoad (`Game.ts`, line 307)

```typescript
game.postLoad()
  → player.reCalcMaxHp()
  → updateStatusBar(true)          // full rebuild including tabs
  → emptyAndFillSelectedEqItemsArray()
  → goToCandyBox()                 // navigate to the candy counter
  → savedPlace = new Village(this) // remember village as the default map place
```

---

## 3. The Two-Rate Tick Loop

**File:** `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Game.ts`, lines 787–823

### Idle Loop (1 Hz)

```typescript
private oneSecondMethod(): void {
    this.player.magicHealthRegain();
    this.handleCandiesProduction();    // candies.add(lollipopFarmCurrentCandiesProduction)
    this.handleLollipopProduction();   // add 1 lollipop on schedule or N/sec
    this.handlePondConversion();       // candies → lollipops via lolligators
    this.localAutosave();              // save to localStorage every 600 ticks
    this.oneSecondCallbackCollection.fire();  // place-registered 1-Hz callbacks
}
```

`oneSecondCallbackCollection` callbacks are registered by active places in their `willBeDisplayed()` method. The Village, for example, registers `actionSmokes` (smoke animation). LollipopFarm registers `handlePond`. All of these are cleared by `resetResourcesCallbacks()` when `setPlace()` is called.

### Quest Loop (~10 Hz)

```typescript
private questMethod(): void {
    window.setTimeout(this.questMethod.bind(this),
        (this.questSlowedDown && this.weAreQuesting) ? 200 : 100 + this.getQuestSpeedUp());
    this.questCallbackCollection.fire();  // quest.update() registered here
}
```

Rate: 100ms base (10 Hz), slows to 200ms (5 Hz) when `questSlowedDown=true` and questing. `questSpeedUp` is an additive ms offset allowing quests to slow themselves further. The quest registers `this.update.bind(this)` into `questCallbackCollection` from `willBeDisplayed()`.

### How Idle Production Is Computed Each Tick

**Candy production (`Game.ts`, line 722):**
```typescript
this.candies.add(Saving.loadNumber("lollipopFarmCurrentCandiesProduction"));
```
Default: 1/sec. The mill (LollipopFarm feature) uses a Fibonacci-like update:
```typescript
// Feed mill: costs (currentProd * 120)^2 lollipops
var oldCurrent = Saving.loadNumber("lollipopFarmCurrentCandiesProduction");
Saving.saveNumber("lollipopFarmCurrentCandiesProduction", oldCurrent + prev);
Saving.saveNumber("lollipopFarmPreviousCandiesProduction", oldCurrent);
```
Sequence: 1, 2, 3, 5, 8, 13, 21 ... candies/sec (Fibonacci progression).

**Lollipop production (`Game.ts`, line 728):**
- For ≤ 20 planted lollipops: lookup table of seconds-between-lollipops (1 lollipop every N seconds; N from 8 hours down to 2 seconds). Timer: `lollipopFarmTimeSinceLastProduction` increments each tick.
- For > 20 planted lollipops: `ceil(100 * (1 - exp(-(N-20)/5000)))` lollipops/sec, where N is count planted. Items (shell powder ×3, pitchfork ×3, green shark fin ×5) are multiplied together.

---

## 4. Global State: The Saving Module

**File:** `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Saving.ts`

```typescript
module Saving {
    var bools:   { [s: string]: boolean } = {};
    var numbers: { [s: string]: number } = {};
    var strings: { [s: string]: string } = {};
}
```

Three flat dictionaries. All game state is in here. Keys are string identifiers like `"mainMapDoneDesert"`, `"gameCandiesCurrent"`, `"lollipopFarmLollipopsPlanted"`.

**Registration:** `Saving.registerX(key, defaultValue)` writes the default and sets a flag `canRegister`. After `Saving.canRegister = false` (set when loading from file), no new keys can be registered.

**Load from localStorage (`LocalSaving.ts`):** iterates all keys in `Saving.getAllBools/Numbers/Strings()` and reads `localStorage.getItem(slotId + "." + key)`. Missing keys return `null`, which causes `stringToBool(null)` to log an error.

**Save:** iterates all maps, writes `localStorage.setItem(slotId + "." + key, value.toString())`.

**No versioning, no migration, no schema.** If a key is renamed or a new key is added in an update, old saves silently fail (key not found, console error, undefined returned).

---

## 5. Resource Class

**File:** `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Resource.ts`

Every trackable quantity (candies, lollipops, chocolate bars, candies eaten, candies thrown) is a `Resource`. It holds:
- `accumulated` — lifetime total added (never decremented)
- `current` — spendable balance
- `max` — high-water mark of `current`

`setCurrent()` fires `callbackCollection` on every change. `StatusBarResource.setCurrent()` additionally calls `game.updateStatusBar()`, triggering a full status bar re-render on every resource change.

`add(n)` returns `false` if the operation would go below zero — this is CB2's guard against overdrafting.

---

## 6. Render Pipeline

### RenderArea (`/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/RenderArea.ts`)

A 2D ASCII canvas:
- `area: string[]` — one fixed-width string per row
- `tags: RenderTag[][]` — HTML tags to inject at specific column positions
- `links: RenderLink[]` — jQuery event registrations to run after DOM insertion

**Drawing:** `drawString(str, x, y)` calls `string.replaceAt(x, str)` to mutate the row string in-place.

**Tagging:** `addTwoTags(x1, x2, y, openTag, closeTag)` inserts `<span>` boundaries around a cell range. Tags are sorted by x position and injected during `getForRendering()`.

**Rendering:** `getForRendering()` clones `area`, injects all tags via `RenderTag.draw()` (which does string insertion at the stored x position), and returns `clonedArea.join("\n")`.

**Links:** `addLinkCall(cssSelector, callbackCollection)` adds a `RenderLinkClick` which in `run()` calls `$(selector).mouseup(handler)`. All links run after the HTML is set.

### RenderLocation (`/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/RenderLocation.ts`)

```typescript
render(renderArea: RenderArea): void {
    $(this.locationString).html(renderArea.getForRendering());
    renderArea.runLinks();
}
```

Replaces the entire `innerHTML` of the target element, then wires all event handlers. **Every render is a full DOM replacement.**

### Scrolling Mode (for the map)

`setScrolling(true, defaultScroll)` applies CSS:
```
#mainContent: position:absolute; left:0; top:0; overflow-x:scroll
#aroundStatusBar: position:fixed; top:0; left:0; right:0; height:0
```
This makes the status bar stick to the top while the map content scrolls. `getScroll()` returns `$("html").scrollTop()`, which is saved to Saving when leaving the map.

---

## 7. Place System

**File:** `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Place.ts`

`Place` is an abstract base:
- `getGame(): Game` — access to the game singleton
- `getRenderArea(): RenderArea` — the content to display
- `getScrolling(): boolean` — default `false`
- `getGap(): number` — horizontal centering offset for quests
- `getDefaultScroll(): number` — scroll position when entering
- `willBeDisplayed()` — lifecycle: register callbacks, set up hotkeys
- `willStopBeingDisplayed()` — lifecycle: save scroll position, etc.
- `willBeClosed()` — lifecycle: called when the place is being permanently left (not just hidden by tab switch)

### setPlace flow (`Game.ts`, line 354)

```
setPlace(newPlace)
  → currentPlace.willStopBeingDisplayed()     // save state, e.g. scroll position
  → resetHotkeys()                             // clear all place-specific key bindings
  → if savedPlace == null: currentPlace.willBeClosed()  // permanent close
  → this.place = newPlace
  → resetResourcesCallbacks()                 // clear ALL callback collections
  → newPlace.willBeDisplayed()               // register new callbacks and hotkeys
  → displayPlace()                           // render to DOM
```

`resetResourcesCallbacks()` clears: `candies.callbackCollection`, `lollipops.callbackCollection`, `candiesEaten.callbackCollection`, `candiesThrown.callbackCollection`, `oneSecondCallbackCollection`, `questCallbackCollection`. This is the de-facto teardown of all place-specific reactivity.

---

## 8. MainMap — Zone Registration

**File:** `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/MainMap.ts`

### Map ASCII Art Loading

```typescript
private load(): void {
    this.renderArea.resetAllButSize();
    this.renderArea.resizeFromArray(Database.getAscii("maps/map"));
    this.renderArea.drawArray(Database.getAscii("maps/map"));
    // then conditionally load zones...
}
```

The map is a single large ASCII art stored in the Database. All zone coordinates are absolute offsets into this fixed-size bitmap.

### Zone Unlock Conditions

```typescript
this.loadATree(143, 26);                                          // always visible
if(Saving.loadBool("gridItemPossessedFortressKey")) this.loadFortress(117, 39);
if(Saving.loadBool("mainMapDoneDesert")) {
    this.loadFarm(115, 57);
    this.loadBridge(99, 61);
    // ...
}
if(Saving.loadBool("mainMapDoneBridge")) this.loadSorceressHut(95, 68);
// etc.
```

Each unlock flag is a `bool` in the Saving module. Flags are set in quest `endQuest(true)` callbacks.

### Zone Load Pattern (4 steps)

```typescript
private loadVillage(x: number, y: number): void {
    // 1. Mark clickable cells with CSS class
    this.renderArea.addMultipleAsciiButtons("mapVillageButton",
        x+11, x+19, y,
        x+7, x+19, y+1,
        // ... more rows
    );
    // 2. Place hover label
    this.renderArea.addFullComment(x+11, y+3, Database.getText("mapVillageComment"),
        Database.getTranslatedText("mapVillageComment"), "mapVillageComment");
    // 3. Wire hover show/hide
    this.renderArea.addLinkOver(".mapVillageButton, .mapVillageComment", ".mapVillageComment");
    // 4. Wire click callback
    this.renderArea.addLinkCall(".mapVillageButton, .mapVillageComment",
        new CallbackCollection(this.getGame().goToVillage.bind(this.getGame())));
}
```

`addMultipleAsciiButtons` wraps character ranges in `<span class="asciiButton mapVillageButton">`. The hover label is a `<span class="comment">` that jQuery `.show()` / `.hide()` on mouseenter/mouseleave. The click calls the go-to method.

### Map Scroll Persistence

```typescript
public willStopBeingDisplayed(): void {
    Saving.saveNumber("mainMapDefaultScroll", this.getGame().getMainContentLocation().getScroll());
}
public getDefaultScroll(): number {
    return Saving.loadNumber("mainMapDefaultScroll");
}
```

Scroll is saved to the Saving store when leaving the map and restored when entering.

---

## 9. CandyBox (The Starting Screen)

**File:** `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/CandyBox.ts`

The progressive reveal pattern:
1. `willBeDisplayed()` registers `checkCandies` on `game.getCandies().getCallbackCollection()`
2. `checkCandies()` runs on every candy change; it checks thresholds:
   - `candies.getMax() > 0` → show Eat button
   - `candies.getMax() >= 10` → show Throw button
   - `candies.getMax() >= 30 && !statusBarUnlockedMap` → show Request Feature button

Each new button shown triggers `this.update()` and `game.updatePlace()` — a full re-render of the candy box area.

The "spend candies to unlock features" flow is the CB2 tutorial, sequencing through: StatusBar → Cfg → Save → HealthBar → Map.

---

## 10. StatusBar

**File:** `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/StatusBar.ts`

- Fixed 100×6 `RenderArea`
- `deleteAndReAddEverything()` rebuilds all tabs from Saving flags — called on `updateStatusBar(true)`
- `updateAll()` redraws borders, resource counts (candies, lollipops, chocolate bars, pains au chocolat), all tabs, health bar, and corner decorations
- `StatusBarResource.setCurrent()` calls `game.updateStatusBar()` on every resource change — meaning a candy tick triggers a full status bar re-render

Tabs are conditionally created from `statusBarUnlockedX` booleans. Each tab is a 3-line ASCII button with `xPos` and callback.

---

## 11. Quest Integration

**File:** `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Quest.ts`

Quests extend Place. Key integration points:

```typescript
public willBeDisplayed(): void {
    this.getGame().setWeAreQuesting(true);
    this.getGame().getQuestCallbackCollection().addCallback(this.update.bind(this));
    // register spell hotkeys
}

public willBeClosed(): void {
    this.getGame().setWeAreQuesting(false);
}
```

The quest `update()` method is called every ~100ms by `questMethod`. Inside `update()`, quests call `this.updateEntities()` (physics, AI, collision), `this.preDraw()` (reset area), draw everything, `this.postDraw()` (call `game.updatePlace()`), and `this.lowerCountdowns()`.

Quest end: `endQuest(win)` is called from within entity callbacks (e.g., player dying, boss dying). It shows a victory/defeat screen, distributes resources gained during the quest, sets unlock flags, and navigates back via `setPlace()`.

---

## 12. Keyboard Handling

**File:** `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Keyboard.ts`

Single jQuery `$(document).keydown` handler. Checks `game.getHotkeys()` (place-specific: 'e' for eat, 't' for throw) and `game.getSpecialHotkeys()` (global: 'n' for next tab). `canUseHotkeys()` returns `false` if a `.noHotkeys` element has focus (text inputs), preventing hotkeys from firing while typing.

---

## 13. Database / Content Loading

**File:** `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Database.ts`

Two in-memory dictionaries:
- `asciiMap`: `key → string[]` (one string per row of ASCII art)
- `textMap`: `"lang.key" → string` (e.g., `"en.mapVillageComment"`)

Content is registered via `Database.addAscii()` and `Database.addText()` called from data files included in the compiled bundle. Everything is in memory at startup — no lazy loading.

---

## 14. Save / Load Flow

### Save path
```
game.save()                           // resources save their current/max/accumulated
game.getPlayer().save()               // player HP
LocalSaving.save(slotId)             // iterate ALL Saving dicts → localStorage
```

### Load path
```
LocalSaving.load(slotId)             // iterate ALL Saving dicts, read from localStorage
game.load()                          // resources read from Saving maps
game.getPlayer().load()              // player HP from Saving maps
game.postLoad()                      // navigate to starting place
```

### Exportable save string (file mode)
```
MainLoadingType.FILE: regex-parse "bool key = value", "number key = value", "string key = value"
```
Allows sharing saves as text. No version encoding, no integrity check.

---

## 15. Adding a New Zone — Step-by-Step

1. **Register unlock flag:** `Saving.registerBool("mainMapDoneNewZone", false)` at file top (before Game constructor runs)
2. **Create zone class:** `class NewZone extends Place` (or `extends Quest`), implement `getRenderArea()`, `getScrolling()`, and lifecycle hooks
3. **Add loadNewZone method to MainMap:**
   ```typescript
   private loadNewZone(x: number, y: number): void {
       this.renderArea.addMultipleAsciiButtons("mapNewZoneButton", x, x+5, y, ...);
       this.renderArea.addFullComment(x+2, y+2, Database.getText("mapNewZoneComment"), ...);
       this.renderArea.addLinkOver(".mapNewZoneButton, .mapNewZoneComment", ".mapNewZoneComment");
       this.renderArea.addLinkCall(".mapNewZoneButton, .mapNewZoneComment",
           new CallbackCollection(this.goToNewZone.bind(this)));
   }
   ```
4. **Add conditional in MainMap.load():** `if(Saving.loadBool("mainMapDoneNewZone")) this.loadNewZone(x, y);`
5. **Set unlock flag:** in the quest or event that unlocks the zone, call `Saving.saveBool("mainMapDoneNewZone", true)` then (if the map is active) reload the map
6. **Add ASCII art** to the Database for the zone's content
7. **Add go-to method on Game** if the zone is reachable from multiple places

---

## 16. Architectural Gaps for CB3

### Gap 1: No vertical map extension
CB2's map is a fixed bitmap. CB3 needs a map that literally grows upward. Solution: a `StratumRegistry` where each stratum has `{ asciiLines: string[], heightPx: number, zones: ZoneDescriptor[], unlockSignal }`. The map renderer stacks strata from bottom to top, computing cumulative Y offsets.

### Gap 2: No offline progress
CB2 has zero offline progress. Players who keep the tab open forever gain more than those who return daily. CB3 should save `lastTickTimestamp` and catch up on load.

### Gap 3: Hardcoded candy production in Game
CB2 has `game.handleCandiesProduction()` reading a single Saving key. CB3 needs a composable producer system for the wealth curve described in §5 of DESIGN.md (1/s → 100/s → 10k/s → 1M+/s).

### Gap 4: jQuery DOM replacement
Every render calls `innerHTML` replacement. At CB3's scope (vertical map, multiple resources), this will cause visible reflow. A signals-based reactive approach targeting individual DOM nodes is needed.

---

## 17. Essential Files Reference

| File | Purpose |
|------|---------|
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/main.ts` | Entry point, bootstrap sequence |
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Game.ts` | Game singleton, tick loops, setPlace, all goTo methods |
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/MainMap.ts` | Map rendering, zone registration pattern |
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Place.ts` | Abstract base for all screens/zones |
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/RenderArea.ts` | 2D ASCII canvas, tag injection, link collection |
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/RenderLocation.ts` | DOM target, scroll management, jQuery render call |
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Saving.ts` | Global state store (all three dicts), load/save orchestration |
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/LocalSaving.ts` | localStorage serialization |
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Resource.ts` | accumulated/current/max with callback firing |
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/StatusBarResource.ts` | Resource that auto-updates status bar on change |
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/StatusBar.ts` | 100×6 header with tabs and resource display |
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/CallbackCollection.ts` | Simple observer list |
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Candies.ts` | Candy resource with formatted string output |
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/CandyBox.ts` | The starting screen, progressive reveal logic |
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Database.ts` | ASCII art and text content registry |
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Quest.ts` | Quest base class, entity loop, willBeDisplayed hook |
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Desert.ts` | Example quest implementation showing the pattern |
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/LollipopFarm.ts` | Idle production system (production formulas, mill, pond) |
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/RenderLinkClick.ts` | jQuery mouseup wiring for clickable elements |
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Keyboard.ts` | Global keydown handler, hotkey dispatch |
| `/Users/navindasgupta/workspace/cb3/reference/candybox2/index.html` | HTML shell — the entire page structure |