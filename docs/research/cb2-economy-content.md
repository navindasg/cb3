---
title: "Candy Box 2 — Deep Codebase Analysis for CB3 Clean-Room Reimplementation"
slug: cb2-economy-content
type: code
---

> Candy Box 2 is a single-page TypeScript (pre-ES6 class syntax, compiled by tsc) + jQuery game with no framework. All state lives in a flat global key-value store (Saving module). The tick loop drives two timers: a 1-second interval for idle production (candies, lollipops, pond conversion) and a 100ms quest loop. Items and enchantments are hardcoded as class instantiations inside Game.createEqItems() / createGridItems(), with prices, unlock conditions, and dialogue all scattered directly in Place subclasses. Text is externalised to per-locale flat-file databases (text/en.txt, etc.) loaded into a global map keyed by "lang.key", which is CB2's sole i18n mechanism. TheComputer is a hidden terminal Place unlocked by opening the candy box; it accepts typed commands (add/bug/help) and easter-egg words but has no connection to game design notes — CB3's "context window" meta-zone must be built from scratch. For CB3, all content (items, recipes, shop entries, zone definitions, death messages, quest configs) should be authored as typed TypeScript config objects (data files), completely separate from engine code.

### Key findings
- IDLE LOOP: Game.ts runs two timers. oneSecondIntervalId (1s) calls oneSecondMethod(), which calls handleCandiesProduction(), handleLollipopProduction(), handlePondConversion(), and player.magicHealthRegain(). A separate 100ms questMethod() drives combat. There is no delta-time accumulation — the game assumes 1 tick = 1 real second. (Game.ts:167-805)
- LOLLIPOP FARM PRODUCTION: calcLollipopFarmProduction() in Game.ts (line 187) computes a production rate from lollipopsPlanted using a switch-case lookup table for 1-20 planted (slow, measured in seconds per lollipop) then switches to a continuous exponential formula 100*(1-exp(-(planted-20)/5000)) lollipops/second for planted>20. Three grid items (ShellPowder ×3, Pitchfork ×3, GreenSharkFin ×5) multiply this rate as flat multipliers. Stored in Saving as lollipopFarmProduction + lollipopFarmIsProductionEachSecond. (Game.ts:187-223, LollipopFarm.ts:405-414)
- LOLLIPOP FARM UPGRADES: The mill costs 10,000 lollipops and unlocks a candy production boost via a Fibonacci-like sequence: feedMill() sets currentCandiesProduction += previousCandiesProduction, previousCandiesProduction = old current. Mill feed cost = (currentCandiesProduction * 120)^2. The pond costs 100,000 lollipops, lets you buy lolligators at 1,200 candies each; lolligators convert candies to lollipops at ceil(count*3 + 1.3^count) per second. (LollipopFarm.ts:99-444)
- CAULDRON BREWING: Not a recipe table. Potions are made by pattern-matching the last 5 action log entries at bottling time. Each action log entry records (action: MIXING|BOILING, time elapsed, candies in cauldron, lollipops in cauldron). Health potion = 1 MIXING action, no lollipops, candies%100==0, time<30. X-potion = 5 consecutive BOILING actions with specific candy sequences (1,2,3,4,4) and the last one hot. There are 6 potion types total, each with a different multi-step sequential recipe embedded as deeply nested if-chains. Zero data-table; 100% hardcoded logic. (Cauldron.ts:379-498)
- ITEM MODEL: Base class Item (Item.ts) holds savingName (save key), databaseName (text key), databaseDescriptionName (text key), ascii (asset key). isPossessed() reads Saving.loadBool(savingName). GridItem extends Item with a grid position (Pos). EqItem extends Item with getQuestEntityWeapon() and slot-specific behaviour via subclassing (one class per item). No data table; each item is a TypeScript class registered in Game.createEqItems() / createGridItems(). (Item.ts:1-63, EqItem.ts:1-12, GridItem.ts:1-22, Game.ts:636-709)
- ENCHANTING: WishingWell.ts hardcodes enchantment pairs in createPossibleEnchantments() as Enchantment(beforeItem, afterItem). Throwing 1 chocolate bar enters enchanting mode; player picks from a list of valid pairs (only pairs where the before-item is possessed and the enchanted version is not). Enchanting destroys the before-item and grants the after-item. All 8 enchantment pairs are hardcoded inline. (WishingWell.ts:86-110)
- SHOP/FORGE PURCHASE PATTERN: Forge.ts shows the canonical pattern. Each purchasable item has: (a) a Saving.registerBool('forgeBought___', false) at file scope, (b) a click handler that checks getCandies() >= price, deducts, calls Saving.saveBool('forgeBought___', true), then game.gainItem(savingName). Prices are hardcoded numeric literals (150, 400, 2000, 15000, 5000000). Unlock conditions are if-chains checking other Saving bools. No price table, no data-driven unlock graph. (Forge.ts:53-186)
- SAVING / PERSISTENCE: Saving module is a plain in-memory key-value store (three dictionaries: bools, numbers, strings). Keys are registered at module load via registerBool/registerNumber/registerString at file scope (before class bodies). Load/save serialise to/from localStorage via LocalSaving or a regex-parsed plain-text file format: 'bool key = value\nnumber key = value'. Resource class wraps a triple (current, accumulated, max) and auto-tracks max. No versioning, no migration strategy. (Saving.ts, Resource.ts)
- I18N: Database module (Database.ts) holds two maps: asciiMap (key -> string[]) and textMap (key -> string). Text keys are prefixed with the locale: 'en.someKey'. getText(key) reads 'en.' + key. getTranslatedText(key) reads loadString('gameLanguage') + '.' + key. All locale strings live in flat text files (text/en.txt, text/fr.txt, etc.) with alternating key/value lines. Chinese gets a special addChineseSpaces() post-processing call. Translation is UI-only (bilingual tooltips); the game never dynamically chooses locale for runtime logic. (Database.ts, text/en.txt)
- THE COMPUTER: TheComputer.ts is a Place subclass unlocked by openBox() in CandyBox.ts (line 189: Saving.saveBool('statusBarUnlockedTheComputer', true)). It renders an ASCII CRT frame, maintains a lines[] array (max 12 lines), and handles keypresses via hotkeys registered to every a-z/0-9 key + space/delete/enter. Commands are parsed with split(' ') and a big switch(words[0]). Three real commands: 'add quantity resource' (adds candies/lollipops/chocolatebars/painsauchocolat), 'bug type level' (sets Bugs static levels), 'help'. ~25 easter-egg word responses (ls, whoami, vim, 42, aniwey, etc.). There is NO design-notes content; the 'context window' meta-zone is entirely original to CB3. (TheComputer.ts:1-414, CandyBox.ts:183-196)
- PLAYER HP SCALING: reCalcMaxHp() uses two exponential saturation curves over lifetime candies eaten: 100 + ceil((1-exp(-eaten/3000))*100) + ceil((1-exp(-eaten/400000))*800). Grid items heart pendant (+300) and heart plug (×1.2) stack on top. Hard mode skips the candies-eaten bonus. HP recovers at 1/s (floor) up to a ceiling of 500 via magicHealthRegain() using a similar exponential formula. (Player.ts:314-341, 283-290)
- ASCII ASSETS: Stored as pre-split string[] in Database.asciiMap, keyed by path strings like 'general/theComputer/computer' or 'eqItems/weapons/woodenSword'. Populated at startup by addAscii() calls from generated loader code. The ascii/ directory is organized by category (eqItems/weapons, eqItems/bodyArmours, gridItems, players, places/...). Each .txt file has an @author line stripped at load time. (Database.ts:10-13, ascii/ directory)

### Patterns to steal
- RESOURCE TRIPLE PATTERN: current / accumulated (lifetime total) / max (high-water mark) on a single Resource object. This elegantly tracks both real-time balance and lifetime stats (needed for CB3's ending-3 gate and the 'wrapper' sword scaling) in one place without separate counters. Adapt as an immutable value object in CB3's signal layer.
- CALLBACK-ON-RESOURCE-CHANGE: Resource.setCurrent() fires a CallbackCollection, and places subscribe on willBeDisplayed() / unsubscribe on willStopBeingDisplayed(). This is a primitive version of CB3's reactive signals. CB3 should formalise this: a Signal<T> that places subscribe to, with automatic cleanup when a zone unmounts.
- PROGRESSIVE BUTTON UNLOCK: LollipopFarm.checkLollipops() checks thresholds (max>=1, >=10, >=100, >=1000) and sets bools on first crossing. This is a solid pattern for CB3's discovery system: track first-crossing of resource thresholds to reveal UI elements. Implement as a threshold-watcher that runs on every resource tick.
- PRODUCTION RATE AS SAVED STATE: lollipopFarmProduction and lollipopFarmIsProductionEachSecond are stored in the save, not recomputed on load. CB3 should do the same for all production rates — store the computed rate, recompute it only when inputs change (planted count, items owned), not every tick.
- FIBONACCI MILL UPGRADE COST: The mill's feed cost = (current * 120)^2 uses a Fibonacci-sequence internal state (previous + current) to create an ever-escalating upgrade cost that rewards early investment. CB3's gummy crew upgrades and scaffold stages could use the same pattern.
- PLACE LIFECYCLE PATTERN: willBeDisplayed() / willStopBeingDisplayed() / willBeClosed() triple gives clear setup / teardown / permanent-close hooks. CB3's zone system should adopt these three lifecycle events verbatim. Each zone registers its subscriptions in willBeDisplayed() and cleans up in willStopBeingDisplayed().
- SEQUENTIAL ACTION LOG FOR RECIPES: The cauldron's 5-entry action log + pattern matching at bottling is genius for discoverable secret recipes — players stumble onto them experimentally. CB3 should generalise this as a typed RecipeLog<ActionEntry> with a separate data-driven recipe matcher: an array of RecipeDef objects, each with a predicate function over the log, rather than nested if-chains.
- TRANSFER SEMANTICS: Resource.transferTo() is cleaner than manual add(-n)/add(n) pairs. CB3 should use this pattern for all resource flows (cauldron loading, crafting costs, lollipop-to-candy conversion), making the accounting auditable.
- TYPED-INPUT SECRET SYSTEM: CB2's hidden text input (TheComputer keyboard capture + word-matching) is a clean pattern for CB3's §18 secrets. In CB3, maintain a global typed-input buffer in the engine; each secret zone/NPC registers a set of trigger strings with callbacks. The 'context window' zone itself is the place this surfaces.
- STATUS BAR RESOURCE TRUNCATION: Candies.getCurrentAsString() and ChocolateBars.getCurrentAsString() adaptively truncate based on available character width — 'You have 1,337 candies' vs '-> 1337 cnd' vs '1337 c'. CB3 should implement this same adaptive formatter for every status bar resource to ensure the ASCII layout stays readable at any count magnitude.

### Pitfalls
- ALL CONTENT IS HARDCODED IN CLASS BODIES: Every item price, unlock condition, enchantment pair, potion recipe, and shop entry is an inline literal or if-chain inside a Place or Game method. Adding a new item requires editing Game.ts, the relevant Place's update() method, and the text database. CB3 must not replicate this — every content type needs a typed config record.
- MUTABLE GLOBAL SAVE STATE: The Saving module is a plain mutable dictionary. Any code anywhere can write any key. CB3 should replace this with an immutable save-state object updated via a reducer (or signal writes with explicit schema). The entire save schema should be defined in one typed interface.
- NO DELTA-TIME: The tick loop assumes exactly 1 second per tick. On slow devices or after browser throttling, ticks drop and production stalls silently. CB3 should accumulate delta-time and apply missed ticks in catch-up (with a reasonable cap to prevent exploit-level offline accumulation).
- RECIPE SYSTEM IS UNFINDABLE FROM CODE: The cauldron's potion recipes are buried in a 120-line if-else chain in putIntoBottles(). There is no central recipe registry. Debugging or adding a recipe means reading and modifying that method. CB3 must externalise recipes as data.
- JQUERY DIRECT DOM MUTATION IN PRODUCTION CALLBACKS: Every item-bought handler calls this.getGame().updatePlace() which re-renders the entire place DOM. On fast tick loops this causes layout thrash. CB3's signal-based invalidation should batch DOM writes to animation frames.
- SAVING KEY COLLISIONS ARE UNDETECTED AT RUNTIME IN PRACTICE: registerBool/registerNumber log errors to console but do not throw, so a typo silently corrupts save state. CB3 should use a single typed SaveSchema interface and derive all save keys from it, making typos compile errors.
- THECOMPUTER HAS NO CONTENT HOOK: CB2's TheComputer is purely a toy terminal. It has no mechanism for scrolling external text or displaying lore. CB3's 'context window' needs a completely original scrolling-text renderer — there is nothing in CB2 to port.
- ENCHANTMENT PAIRS ARE NOT SYMMETRIC OR COMPOSABLE: CB2 enchantments are hardcoded one-to-one replacement pairs. Adding a third enchantment tier requires rewriting the WishingWell code. CB3 should model enchantments as a graph: item nodes, enchantment edges, with depth calculated dynamically.
- ITEM POSITION IN INVENTORY IS HARDCODED AS Pos(column, row): GridItem layout is fixed at construction time. CB3's inventory should compute layout from the item registry order, not bake coordinates into each item definition.
- THE LOLLIPOP FARM PRODUCTION TABLE (SWITCH-CASE FOR 1-20) IS FRAGILE: Adding a new breakpoint (e.g., moonpops at count=15) requires editing the switch. CB3 should replace this with a data array of [threshold, secondsPerLollipop] breakpoints iterated at compute time.

### Recommendations
- DEFINE A CENTRAL SAVE SCHEMA TYPE: Create /src/engine/SaveSchema.ts — a single TypeScript interface SaveState { candies: ResourceState; lollipops: ResourceState; /* all resources */; flags: Record<FlagKey, boolean>; counters: Record<CounterKey, number>; strings: Record<StringKey, string>; } with string-literal union types for all key names. This makes any key access a compile error if the key is not registered. The entire Saving module becomes a typed store update function: applyPatch(state: SaveState, patch: Partial<SaveState>): SaveState.
- DATA-DRIVEN ITEM REGISTRY: Create /src/data/items/weapons.ts, /src/data/items/armour.ts, etc. Each exports an array of typed ItemDef records: { id: ItemId; displayKey: LocaleKey; descriptionKey: LocaleKey; ascii: AsciiKey; slot: EquipSlot; saveFlag: FlagKey; stats: WeaponStats | ArmourStats; specialAbility?: SpecialAbilityDef; }. Game engine reads these at startup; no per-item class needed for simple items.
- DATA-DRIVEN SHOP/FORGE CONFIG: Create /src/data/shops/forge.ts exporting ShopEntry[]: { itemId: ItemId; price: { resource: ResourceId; amount: number }[]; unlockCondition: (state: SaveState) => boolean; purchaseSpeech: LocaleKey; }. The Forge zone becomes a pure renderer over this array, with a single generic purchase handler.
- DATA-DRIVEN RECIPE SYSTEM FOR THE CAULDRON: Define RecipeDef: { id: RecipeId; matcher: (log: CauldronActionEntry[]) => boolean; output: PotionId; quantityFn: (log: CauldronActionEntry[]) => number; }. Store all recipes in /src/data/recipes/cauldronRecipes.ts. The bottling function iterates the array, finds the first matching recipe, and calls makePotions(). New recipes require zero engine changes.
- DATA-DRIVEN ENCHANTMENT GRAPH: Define EnchantmentDef: { id: string; fromItem: ItemId; toItem: ItemId; cost: { resource: ResourceId; amount: number }; }. Store in /src/data/enchantments.ts. WishingWell computes available enchantments at runtime by filtering the array against possessed items. This makes multi-tier enchanting (CB3's kraken crown) trivial to author.
- TYPED LOCALE SYSTEM: Replace CB2's flat text file with TypeScript locale modules. /src/i18n/en.ts exports a const record satisfying interface GameText { candyBoxEatCandiesButton: string; /* ... all keys */ }. Other locales (fr.ts, etc.) implement the same interface — missing keys become compile errors. The Database module becomes a typed gettext(key: keyof GameText): string function.
- THE CONTEXT WINDOW META-ZONE IMPLEMENTATION: TheComputer in CB2 is just a toy terminal with no content. CB3's 'context window' (§18.28) needs a completely original zone. Recommended approach: (1) Maintain a scrolling text buffer seeded from a string array defined in /src/data/contextWindow/designNotes.ts (this is where the game's own design notes / system prompt live as authored strings, not the DESIGN.md file itself). (2) The terminal accepts typed commands that trigger hallucination boss events and fourth-wall reveals. (3) Use a ref-counted ScrollingTextRenderer that renders N visible lines of the buffer, auto-scrolling at 1 line/2s. The command parser should be data-driven: /src/data/contextWindow/commands.ts exports CommandDef[].
- IDLE PRODUCTION AS A SIGNAL GRAPH: Rather than CB2's scattered handleX() calls in oneSecondMethod(), CB3 should model production as a directed signal graph: each producer is a node; resources are signals; the scheduler fires all dirty producers each tick in topological order. This makes adding a new production source (cloud sheep, solar collectors) a matter of registering a new producer node, not modifying the tick loop.
- DELTA-TIME TICK LOOP WITH OFFLINE CATCH-UP: Replace the fixed setInterval(1000) with requestAnimationFrame-based accumulator. On each frame: accumulator += deltaMs; while (accumulator >= TICK_MS) { tick(); accumulator -= TICK_MS; }. On load, compute missedTicks = min((now - lastSaveTime) / TICK_MS, MAX_OFFLINE_TICKS) and run them synchronously. Cap MAX_OFFLINE_TICKS at something sane (e.g., 8 hours worth) to prevent exploit-level offline farming.
- DEATH MESSAGE REGISTRY: Create /src/data/deathMessages.ts exporting DeathMessage[]: { source: DamageSourceId | 'generic'; message: string; }. The death handler picks a matching message by source, falling back to generic. All ~40 death messages from §19 of DESIGN.md are authored in this file; no engine code changes needed to add more.
- ZONE/QUEST STATE MACHINE AS DATA: Each quest is a state machine. Define QuestDef: { id: QuestId; states: QuestStateDef[]; transitions: QuestTransition[]; enemies: EnemySpawnDef[]; loot: LootTableDef; deathMessage: string; }. Store in /src/data/quests/. The quest engine executes any QuestDef generically. CB2 has a separate Quest subclass per quest — this is the single biggest architectural waste to avoid in CB3.

---

# Candy Box 2 — Full Analysis Brief for CB3

## 1. Repository Layout

```
/code/main/          — all TypeScript source (one file per class, concatenated by tsc)
/ascii/              — ASCII art as .txt files, organized by category
/text/               — per-locale flat text files (en.txt, fr.txt, zh.txt, ...)
```

Key source files:
- `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Game.ts` — central game object, tick loop, item registry
- `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Saving.ts` — global key-value store + save/load
- `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Resource.ts` — current/accumulated/max triple with callbacks
- `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Database.ts` — ASCII art and text string maps
- `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Cauldron.ts` — brewing / potion recipe system
- `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/LollipopFarm.ts` — idle lollipop production + mill + pond
- `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Item.ts` — base item class
- `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/EqItem.ts` — equipped item subclass
- `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/GridItem.ts` — inventory grid item subclass
- `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Inventory.ts` — inventory UI + equipment selection
- `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/EnchantmentItem.ts` — thin wrapper for enchantment endpoints
- `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/WishingWell.ts` — enchanting + wishing system
- `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/ChocolateBars.ts` — chocolate resource display
- `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Player.ts` — player entity, HP scaling, equipment delegation
- `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/TheComputer.ts` — the meta-terminal secret zone
- `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/CandyBox.ts` — the opening screen, unlock chain
- `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Forge.ts` — shop/purchase reference implementation
- `/Users/navindasgupta/workspace/cb3/reference/candybox2/text/en.txt` — all English UI strings

---

## 2. Idle Production — Full Flow

### 2a. Tick Loop

`Game.ts:167` starts `setInterval(oneSecondMethod, 1000)`. This fires every second regardless of frame rate and calls:

1. `player.magicHealthRegain()` — HP recovery using `1 - exp(-eaten/400000000)` curve
2. `handleCandiesProduction()` — adds `lollipopFarmCurrentCandiesProduction` to candies
3. `handleLollipopProduction()` — time-based or rate-based lollipop production
4. `handlePondConversion()` — converts candies to lollipops if lolligators active
5. `localAutosave()` — saves to localStorage every 600 seconds

A separate `questMethod()` runs every 100ms (200ms slowed) driving combat entity updates.

### 2b. Lollipop Farm Production Formula

`Game.calcLollipopFarmProduction()` (`Game.ts:187`):

- 1–20 planted: discrete lookup table (switch-case), 1 lollipop every N seconds (28800s for 1, down to 2s for 20)
- 21+ planted: continuous formula: `prod = (shellPowder?3:1) * (pitchfork?3:1) * (greenSharkFin?5:1) * ceil(100 * (1 - exp(-(planted-20)/5000)))` lollipops/second
- Result stored in `Saving` as `lollipopFarmProduction` + `lollipopFarmIsProductionEachSecond`

### 2c. Mill Upgrade — Fibonacci Candy Production

`LollipopFarm.feedMill()` (`LollipopFarm.ts:304`):

```
newCurrent = currentCandiesProduction + previousCandiesProduction
newPrevious = oldCurrent
```

So starting at current=1, previous=1: feeds give candy/s of 2, 3, 5, 8, 13... (Fibonacci).
Cost per feed = `(current * 120)^2`.

### 2d. Pond — Lolligator Conversion

`updatePondConversionRate()`: `ceil(count * 3 + 1.3^count)` candies/second converted to lollipops.
Checkbox toggles conversion on/off. UI animates lolligators moving through ASCII pond lines.

---

## 3. Cauldron Brewing — Pattern-Matched Recipes

The Cauldron has three actions: MIXING, BOILING, NOTHING. Each action maintains a timer. When the player presses "Stop" or switches actions, the completed action is pushed to `actionLog[0]` (shifting older entries toward index 4). The log stores: `{ action, timeElapsed, candiesInCauldron, lollipopsInCauldron }`.

`putIntoBottles()` (`Cauldron.ts:379`) then inspects this log with a waterfall of if-else checks:

| Potion | Recipe (summarised) |
|--------|---------------------|
| Health potion | log[0]: MIXING, no lollipops, candies%100==0, time<30 |
| Turtle potion | log[1]: MIXING, candies%50==0, lollipops%500==0, ratio 1:10, time 7-13; log[0]: MIXING, 2× candies, same lollipops |
| Anti-gravity | log[1]: BOILING, candies%1000==0, time 3-5 (lukewarm); log[0]: BOILING, 2× candies, time>17 (boiling) |
| Berserk/Cloning | log[0]: MIXING, lollipops%20000==0, time>=60; berserk if no candies, cloning if candies>0 |
| P potion | 3-step recipe involving specific candy arithmetic between steps |
| X potion | 5 consecutive BOILING actions, candies 1,2,3,4,4 with specific temperatures |

This is all hardcoded in a single 120-line if-else chain. There is no recipe registry; the logic IS the data.

The boiling text progression (`getSpecialBoilingText()`) is a timer-indexed string lookup (cold/lukewarm/hot/very hot/bubbles/BOILING/burnt). This UI feedback is the player's only signal for recipe timing.

---

## 4. Item and Inventory Architecture

### 4a. Item Hierarchy

```
Item (base: savingName, databaseName, descriptionName, ascii)
├── GridItem (adds: position Pos)
│   ├── Feather (custom foundCandies override)
│   ├── UnicornHorn (custom inflictDamage)
│   └── XinopherydonClaw (custom hit)
└── EqItem (adds: getQuestEntityWeapon)
    ├── WoodenSword, IronAxe, PolishedSilverSword, ... (one class each)
    ├── OctopusKingCrown, MerchantHat, ... (one class each)
    └── KnightBodyArmour, EnchantedKnightBodyArmour, ... (one class each)
```

`isPossessed()` = `Saving.loadBool(savingName)`. `gainItem(savingName)` = `Saving.saveBool(savingName, true)` + trigger recalc.

### 4b. Equipment System

Five slots: weapon, hat, bodyArmour, gloves, boots. Each is a string-keyed dictionary in Game. Selected items stored as `Saving.saveString('gameWeaponSelected', savingName)`. `emptyAndFillSelectedEqItemsArray()` rebuilds the selected-item map from these saved strings on every equip action or load.

During quests, `Player.hit()` delegates through all `selectedEqItems[slot].hit()` and `gridItems[name].hit()` hooks, then applies gift bonuses.

### 4c. Enchanting

`WishingWell.createPossibleEnchantments()` (`WishingWell.ts:86`): Hardcoded array of 8 Enchantment pairs. Each checks whether the "before" item is possessed. Throwing 1 chocolate bar enters enchant mode; player picks from the filtered list. Enchanting calls `enchant()` which: sets before-item saveFlag to false (loses it, and unequips if equipped), sets after-item saveFlag to true.

The `EnchantmentItem` class (`EnchantmentItem.ts`) is just a thin accessor pairing (savingName, EqItemType) for display and possession check — it has no data of its own.

---

## 5. Shop / Forge Purchase Pattern

`Forge.ts` is the canonical reference. The full pattern:

1. `Saving.registerBool('forgeBoughtWoodenSword', false)` at file scope
2. In `update()`, a conditional renders the buy button only when unlock conditions are met (checked via `Saving.loadBool` of prerequisite flags AND progression flags like `mainMapDoneCaveEntrance`)
3. The click handler: check `getCandies() >= HARDCODED_PRICE`, deduct, set bought-flag, call `gainItem(eqItemSavingName)`, update speech
4. Next item's button appears because the condition now includes `forgeBoughtWoodenSword == true`

Prices: wooden sword 150, iron axe 400, silver sword 2000, lightweight armour 15000, scythe 5000000.

---

## 6. Saving and Persistence

All game state is three flat dictionaries in the `Saving` module:
- `bools: { [key: string]: boolean }` 
- `numbers: { [key: string]: number }`
- `strings: { [key: string]: string }`

Keys must be registered at startup via `register*()` calls. The save-to-file format is a plain text regex-parseable format (`bool key = value\nnumber key = value`). LocalSaving (not shown) wraps localStorage. There is no schema versioning; loading a save from a different version silently leaves unknown keys at defaults.

The `Resource` class stores `(current, accumulated, max)` and serialises all three. `accumulated` is the lifetime total (never decremented); `max` is the historical peak. This pattern elegantly supports: CB3's lifetime-candies-eaten ending gate, the 'wrapper' sword scaling, and NG+ star counter persistence.

---

## 7. i18n Architecture

`Database.textMap` is populated at load time from `text/en.txt` (and other locale files). The format is alternating lines: key then value. Keys follow the pattern `en.someKey` or `fr.someKey`. `Database.getText(key)` looks up `'en.' + key`. `Database.getTranslatedText(key)` looks up `currentLanguage + '.' + key`. Both can be null (logged to console, not thrown).

In the render layer, bilingual rendering draws the English text normally and the translated text on the next line with italic styling. All button and speech text goes through this layer. Item descriptions, map labels, and NPC dialogue are all in the text database.

There is NO runtime locale switching; the language is a saved string (`gameLanguage`).

---

## 8. TheComputer Meta-Terminal

**How it's unlocked**: `CandyBox.openBox()` (`CandyBox.ts:189`) sets `statusBarUnlockedTheComputer = true` and `statusBarUnlockedInsideYourBox = true` and `statusBarUnlockedTheArena = true` simultaneously. This requires the player to possess the Talking Candy item and click the box-opening button.

**What it renders**: An ASCII CRT frame (`ascii/general/theComputer/computer.txt`) with a scrolling 12-line terminal buffer. The power button toggles the terminal on/off.

**Input system**: When on, `addHotkeys()` registers every a-z, 0-9, space, delete, and enter key. Keypresses build `currentCommandText`. Enter fires `executeCommand()`.

**Commands**:
- `help [topic]` — list commands or describe a topic
- `add <quantity> <resource>` — directly adds candies/lollipops/chocolatebars/painsauchocolat
- `bug <graphical|quest|ultimate> <0-4>` — sets Bugs static levels (graphical: display corruption; quest: gameplay weirdness; ultimate: can corrupt save)
- ~25 easter-egg words: `aniwey`, `42`, `vim`, `emacs`, `ls`, `whoami`, `mlp`, `cedric`, `tobias`, etc.

**Critical for CB3**: TheComputer has **zero design-notes content**. CB3's §18.28 "context window" zone (a terminal scrolling the game's own system prompt / design notes) is **entirely original** — there is nothing to port from CB2. The architectural pattern (Place subclass + keyboard hotkey capture + line buffer) is reusable, but the content layer must be built from scratch.

---

## 9. CandyBox Opening Sequence — Progression Gate

`CandyBox.ts` is the game's opening screen. Its `checkCandies()` callback fires on every candy change:
- `max >= 1` → show Eat button
- `max >= 10` → show Throw button  
- `max >= 30 && map not yet unlocked` → show "Request a feature" button

The request chain is a sequential set of unlocks costing 30, 5, 5, 5, 10 candies, each unlocking a new status bar tab. This is CB2's version of the "game pretends to be nothing" opening. CB3's §8 Act 0 mirror of this pattern is the seed event trigger: `telescope owned && totalCandiesEarned >= 50000`.

---

## 10. CB3 Data-Driven Architecture Recommendations

### Proposed File Structure

```
src/
  engine/
    tick.ts              — delta-time accumulator, production scheduler
    saving.ts            — typed immutable save state
    signals.ts           — reactive signal layer
    resource.ts          — Resource<T> signal with accumulated/max
    recipeEngine.ts      — generic CauldronActionLog matcher
    questEngine.ts       — generic QuestDef state machine runner
    
  data/
    resources.ts         — ResourceId union type + initial values
    
    items/
      weapons.ts         — WeaponDef[]
      armour.ts          — ArmourDef[]
      hats.ts            — HatDef[]
      gridItems.ts       — GridItemDef[]
      
    shops/
      forge.ts           — ShopEntry[] for the blacksmith
      observatory.ts     — ShopEntry[] for the astronomer
      
    recipes/
      cauldronRecipes.ts — RecipeDef[] with matcher predicates
      
    enchantments.ts      — EnchantmentDef[] (graph edges)
    
    production/
      lollipopFarm.ts    — ProductionBreakpoint[], mill config, pond config
      cloudSheep.ts      — sheep paddock config
      solarCollectors.ts — scaffold stage configs
      
    zones/
      act0.ts            — ZoneDef[] for Act 0 zones
      act1.ts            — ZoneDef[] for Act 1 zones
      ...
      
    quests/
      sugarMines.ts      — QuestDef (quest 1)
      beanstalKClimb.ts  — QuestDef (quest 2)
      ...
      
    dialogue/
      grandma.ts         — DialogueDef[]
      astronomer.ts      — DialogueDef[]
      ...
      
    deathMessages.ts     — DeathMessage[]
    secrets.ts           — SecretDef[]
    
    contextWindow/
      designNotes.ts     — string[] (the scrolling text content for §18.28)
      commands.ts        — ContextCommandDef[]
      
  i18n/
    en.ts                — const satisfying GameText interface
    fr.ts                — const satisfying GameText interface
    schema.ts            — interface GameText (all keys, compile-time enforced)
    
  zones/
    CandyCounter.ts      — Act 0 opening zone
    Village.ts           — village zone
    Forge.ts             — forge zone (thin renderer over shops/forge.ts data)
    Cauldron.ts          — cauldron zone (thin renderer over recipes data)
    LollipopFarm.ts      — farm zone (thin renderer over production data)
    ContextWindow.ts     — §18.28 meta-zone (NEW, no CB2 equivalent)
    ...
```

### Key Typed Interfaces for CB3

```typescript
// resources
interface ResourceState { current: number; accumulated: number; max: number; }

// items  
interface ItemDef {
  id: ItemId;
  displayKey: keyof GameText;
  descriptionKey: keyof GameText;
  ascii: AsciiKey;
  saveFlag: FlagKey;
}
interface WeaponDef extends ItemDef {
  slot: 'weapon';
  damage: DamageSpec;
  speed: number;
  specialAbility?: SpecialAbilityDef;
}

// shop
interface ShopEntry {
  itemId: ItemId;
  price: Array<{ resource: ResourceId; amount: number }>;
  unlockCondition: (state: SaveState) => boolean;
  purchaseSpeech: keyof GameText;
}

// cauldron recipes
interface CauldronActionEntry {
  action: 'MIXING' | 'BOILING';
  timeSeconds: number;
  candies: number;
  lollipops: number;
}
interface RecipeDef {
  id: RecipeId;
  matcher: (log: readonly CauldronActionEntry[]) => boolean;
  output: PotionId;
  quantityFn: (log: readonly CauldronActionEntry[]) => number;
}

// production
interface ProductionBreakpoint {
  plantedCount: number;
  secondsPerUnit: number;  // only for slow (< threshold)
}
interface FarmConfig {
  slowBreakpoints: ProductionBreakpoint[];   // 1-20 planted
  fastFormula: (planted: number) => number;  // lollipops/s for 20+
  multiplierItems: Array<{ flagKey: FlagKey; multiplier: number }>;
}

// zones
interface ZoneDef {
  id: ZoneId;
  displayName: keyof GameText;
  unlockCondition: (state: SaveState) => boolean;
  asciiMapKey: AsciiKey;
  subZones: SubZoneDef[];
}

// context window
interface ContextCommandDef {
  trigger: string | RegExp;
  response: string | ((input: string, state: SaveState) => string);
  sideEffect?: (state: SaveState, dispatch: StateDispatch) => SaveState;
}
```

---

## 11. Essential Files to Read Before Writing CB3 Engine Code

1. `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Game.ts` — the full tick loop and item registration
2. `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Resource.ts` — the resource model
3. `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Saving.ts` — the persistence layer (and what NOT to replicate)
4. `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Cauldron.ts` — understand the action-log recipe system before designing CB3's
5. `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/LollipopFarm.ts` — the full idle upgrade chain
6. `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/TheComputer.ts` — what CB2's meta-terminal IS (a toy) vs what CB3's context window must BE (a content channel)
7. `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Forge.ts` — the purchase pattern in its clearest form
8. `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/WishingWell.ts` — the enchanting pattern
9. `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Item.ts` — the base item class (simple, keep it)
10. `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Player.ts` — the HP scaling curves (port the math, not the class)
11. `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/Database.ts` — the asset and text map pattern
12. `/Users/navindasgupta/workspace/cb3/reference/candybox2/text/en.txt` — the full text key corpus (reference for CB3's i18n schema)
