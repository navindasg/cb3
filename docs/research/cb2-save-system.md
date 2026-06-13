---
title: "CB2 Save System Deep Dive — Architecture Analysis for CB3"
slug: cb2-save-system
type: code
---

> Candy Box 2's save system is a flat, unversioned key-value store split into three typed maps (bools, numbers, strings). Keys are registered globally at module load time, scattered across 31 source files. Serialization for the exportable "file save" is a human-readable, comma-delimited string of typed key=value pairs with no compression, no version field, and no schema. localStorage stores each key as a separate item under a slot-prefixed path. Autosave fires every 10 minutes. The system has zero migration logic: unknown keys on import are silently discarded, missing keys on load return undefined (which silently corrupts game state). For CB3, we need a versioned JSON envelope with a migration ladder, base64-encoded for sharing, validated on import against a Zod schema, with explicit lifetime-candies-eaten tracking as a first-class field that never decrements.

### Key findings
- The Saving module (code/main/Saving.ts) is a singleton module holding three plain JS object maps: bools: { [s: string]: boolean }, numbers: { [s: string]: number }, strings: { [s: string]: string }. All 163 keys across 31 files are registered at script-parse time via Saving.registerBool/Number/String() before the Game constructor runs.
- Registration is a one-time act guarded by Saving.canRegister (set to false in main.ts:31 after the first game object is constructed). Registering a duplicate key logs an error but does not throw, meaning the second registration is silently skipped.
- LocalSaving (code/main/LocalSaving.ts) stores each registered key as a separate localStorage item under the key 'slotN.keyName' (e.g., 'slot1.gameCandiesCurrent'). The slot sentinel key 'slot1' stores a human-readable date string (DD/MM/YYYY @ HH:MM:SS) produced by getDateAsString().
- The file-export string (the shareable save) is built in Save.ts:clickedFileSave() by iterating Saving.getAllBools/Numbers/Strings() and concatenating entries as 'bool keyName=true, number keyName=42, string keyName=en' — no compression, no base64, fully human-readable and plaintext. Commas and spaces are the delimiters.
- Import parsing (Saving.ts:load() case FILE, lines 141-168) uses three regexes: /bool +[a-zA-Z0-9_]+ *= *[a-zA-Z0-9_]+/g, same for number and string. Unknown keys are silently discarded (Saving.saveBool checks 'if(key in bools)' and logs an error but does not crash). Missing keys produce undefined at read time.
- There is NO version field anywhere in the save format — not in the file string, not in localStorage. There is NO migration logic anywhere in the codebase. Adding or renaming a Saving key in a new build instantly invalidates all existing saves silently.
- Autosave cadence: Game.setDefaultLocalAutosaveTime() sets 600 seconds (10 minutes). Game.localAutosave() is called in oneSecondMethod(), counts down, fires Saving.save(). The save/load page UI shows a countdown in whole minutes.
- The Resource class (code/main/Resource.ts) tracks three numbers per resource: current (present balance), max (historical high watermark), and accumulated (monotonically increasing total ever added). All three are persisted. For candiesEaten this means 'current' IS the lifetime-eaten count because candies transferred to candiesEaten are never subtracted — the resource only grows.
- gameCandiesEatenCurrent is used as the 'lifetime candies eaten' gate in Player.reCalcMaxHp() (lines 319-321) and Player.magicHealthRegain() (line 286). It is a number key registered in Game.ts:39. The distinction from gameCandiesCurrent is architectural: eating candies calls this.candies.transferTo(this.candiesEaten) which subtracts from candies and adds to candiesEaten.current.
- The gameGameMode string ('normal', 'hard') is persisted; 'hard' disables the HP scaling formula that uses candiesEaten. This is the CB2 analogue of the NG+ save variant CB3 needs.
- All EqItems (weapons, hats, armour, gloves, boots) and all GridItems register a boolean possession flag in their Item constructor (Item.ts:23: Saving.registerBool(this.savingName, false)). The selected equipment slot is stored as a string key (e.g., 'gameWeaponSelected' = 'eqItemWeaponWoodenSword').
- Quest progression uses per-quest bools (e.g., dragonDone, mainMapDoneDesert, castleTowerFirstVisitDone) plus per-zone step enumerations stored as numbers (e.g., statusBarCornerStep, cauldronBookCurrentPage). There is no quest log serialization — only whether a gate was passed.
- number values are serialized as JavaScript toString() and deserialized as parseFloat(). This correctly handles scientific notation (e.g., 1e12) and is intentional (comment in Saving.ts:212).
- The slot summary shown in the UI (LocalSaving.getSlotSummaryAsString) reads slotId (the date string) and slotId+'.gameCandiesCurrent' — two localStorage reads, no aggregation.

### Patterns to steal
- The three-tier Resource (current / max / accumulated) pattern from code/main/Resource.ts is excellent. 'max' = historical high watermark (useful for achievements and display), 'accumulated' = total ever gained (useful for analytics). Steal this pattern for all CB3 resources. For candiesEaten, 'current' serves as the lifetime total because the resource is write-only (candies go in, nothing comes out).
- Registering save-key defaults in each feature module file (e.g., Saving.registerBool('lollipopFarmMillConstructed', false) at the top of LollipopFarm.ts) keeps default state collocated with feature logic. CB3 should do the equivalent but with typed Partial<SaveSchema> default objects declared at the top of each system file, merged at init time.
- The MainLoadingType enum (NONE / LOCAL / FILE) cleanly separates the three startup paths. CB3 should keep this three-way switch: fresh game, load from localStorage slot, import from string. Add a fourth: DEMO (a curated mid-game save for new-player previews, hardcoded in source).
- LocalSaving.getSlotSummaryAsString() pattern: a cheap read of just the summary metadata for slot-picker UI without deserializing the full save. CB3 should make this even cheaper by storing a SlotMeta object separately.
- The URL-parameter slot loader (main.ts:setUrlData, case 'slot') is a neat QoL feature — sharing a URL like ?slot=2 auto-loads that slot. CB3 can extend this to support ?import=<base64string> for one-click save sharing via URL.

### Pitfalls
- CB2's silent discard of unknown keys on file-import means a save from a newer build loaded in an older build silently loses all the new state, and vice versa. In CB3, unknown keys should trigger a warning but still load known fields — never silently corrupt.
- CB2's one-localStorage-item-per-key design means a save has ~163+ individual localStorage writes per save operation. If localStorage is nearly full (5MB quota is browser-specific), QUOTA_EXCEEDED_ERR silently aborts the save mid-write, leaving a corrupted partial save in localStorage. The catch block in LocalSaving.save() logs but does not recover. CB3's one-key-per-slot design eliminates this partial-write failure mode.
- CB2 has no protection against a save from the future (higher schemaVersion) being loaded by an older game build — it just silently ignores unrecognized keys and the game starts broken. CB3 should explicitly refuse to load a save whose schemaVersion exceeds the current build's version, with a clear user-facing message.
- The canRegister boolean guard in CB2 is a global flag; once set to false (in main.ts:31 before load()), no new keys can be registered. This means file-import cannot add keys not already registered in the current build. This is actually the right behavior for security, but it must be documented — CB3 should make the same guarantee explicit: imports can only overwrite known fields.
- CB2's Saving.loadBool/Number/String() methods log errors (not exceptions) for unknown keys, meaning callers receive undefined silently. Every caller that treats undefined as a falsy value or as 0 has a latent corruption bug. CB3 must make unknown-key reads throw at dev time (behind a DEBUG flag) and return the schema default at runtime.
- CB2 uses parseFloat() for numbers which handles scientific notation (e.g., 1e12). However, values that are NaN (e.g., from a corrupted field) will silently propagate through arithmetic. CB3's Zod schema should use z.number().finite() to reject NaN and Infinity at import time.
- CB2's file save format uses a regex that matches only [a-zA-Z0-9_] characters in values, which means string values containing spaces, commas, or equals signs would be silently truncated or misread. CB3's base64-JSON format has no such character-set limitation.
- The Accumulated field in Resource is only incremented on add(n) when n > 0. If game code directly calls setCurrent() instead of add() (which does happen in load()), accumulated is not updated. CB3's lifetimeCandiesEaten must be incremented only through a single dedicated function, never by direct field assignment, to prevent accidental reset.
- CB2 stores lollipopFarmProduction (a computed value) in the save. On load, this derived value is used before recalculation, meaning stale computation from a previous session can affect the first second of the next session. CB3 should clearly annotate which fields are authoritative state vs. cached computations, and recalculate caches on load before the first tick.

### Recommendations
- Define a single SaveSchema type in TypeScript with an explicit schemaVersion: number field at the root. Start at version 1. Every time content is added, bump the version and write a migration function in a migrations array indexed by [fromVersion]. On load, run all applicable migrations in sequence before handing data to the game. This is the single most important divergence from CB2.
- Use a Zod schema (or equivalent hand-rolled validator) to parse imported save strings. Validate every field type and range. Use .default() / .optional() on every field so an edited or partially-truncated save degrades gracefully rather than crashing. Zod's .safeParseAsync() returns a typed success/error union — never let a bad import throw into game code.
- Encode the exportable share-string as: JSON.stringify(saveObject) → UTF-8 bytes → base64 (btoa()). This produces a compact, opaque string that players can copy-paste and trivially edit (base64-decode → edit JSON → re-encode). Do NOT use a custom delimiter format — JSON is already a far better structured interchange format, and base64 makes it share-friendly without compression overhead.
- Track lifetimeCandiesEaten as a dedicated top-level field in the save schema, not as a derived value. It must NEVER be reset between NG+ runs. It must accumulate across all runs in perpetuity. Initialize to 0, increment by N on every eat-N action, persist on every save tick. Make it the single source of truth for ending 3 availability and 'wrapper' scaling.
- For localStorage, store the entire save as ONE key per slot (e.g., 'cb3.slot1' = the base64 share-string). This is the inverse of CB2's approach (which used one localStorage item per Saving key). One key per slot means: atomic writes (either the whole save lands or none of it does), easy slot inspection, and trivially listing occupied slots without reading all keys.
- Implement a SlotMeta object stored as a second, tiny localStorage key per slot ('cb3.slot1.meta' = JSON with date, schemaVersion, lifetimeCandiesEaten, actReached, totalPlaytimeSeconds). The save screen can read slot summaries without deserializing and migrating the full save payload.
- Autosave every 60 seconds (not 10 minutes like CB2). With modern localStorage this is essentially free and prevents the frustrating 10-minute data-loss window CB2 players experienced. Keep the last 3 autosave slots plus 5 manual slots.
- On import, perform migration before validation. If migration fails, show the error with the original string still in the textarea — never destroy a save the user pasted. If migration succeeds but validation fails, list the specific failing fields so the player knows what they edited that was out of range.
- Define content registration as a declarative array/object at the top of each system module (e.g., LOLLIPOP_FARM_DEFAULTS: Partial<SaveSchema> = { lollipopFarmLollipopsPlanted: 0, ... }). At game init, merge all defaults into a single DEFAULT_SAVE. This replaces CB2's scattered Saving.registerX() calls and makes the full default state visible in one place per module.
- For NG+, add a nGPlusRun: number field (starts 0, increments on ending 3). On NG+ start, produce a new SaveSchema from DEFAULT_SAVE but carry over: lifetimeCandiesEaten, nGPlusRun, starsRemaining (the persistent downward counter), and any cross-run flags (e.g., hasSeenEnding3). Reset everything else. Never mutate the completed run's save — write it to a 'completed runs' archive key.

---

# CB2 Save System — Complete Architecture Analysis for CB3

## 1. Entry Points

### 1a. Startup (code/main/main.ts)

```
$(document).ready → Main.documentIsReady()
  → Main.setUrlData(window.location.search)   # parse ?slot=N or ?gamemode=X
  → Main.start()
      → new Game(gameMode)                     # all Saving.registerX() calls fire here
      → Saving.load(game, loadingType, loadingString)
      → game.postLoad()
```

`loadingType` is one of `MainLoadingType.{NONE, LOCAL, FILE}`. The enum is defined in `code/main/MainLoadingType.ts`.

### 1b. In-game Save (code/main/Save.ts)

- **Manual save**: `clickedSave()` → `Saving.save(game, LOCAL, slotId)`
- **Enable autosave**: `clickedAutosave()` → `Saving.save()` + `game.enableLocalAutosave(slotId)` → sets `localAutosaveTime = 600`
- **File export**: `clickedFileSave()` → builds textarea content string in-place
- **File import**: `clickedFileLoad()` → `Main.reloadEverythingFromFile(textarea.val())`

---

## 2. The Saving Module (code/main/Saving.ts)

The `Saving` TypeScript module (not a class — a module with module-level variables) is the single global registry and runtime store for all persisted state.

### 2a. Storage Structure

```typescript
var bools:   { [s: string]: boolean } = {};
var numbers: { [s: string]: number  } = {};
var strings: { [s: string]: string  } = {};
```

Three flat maps, typed. All 163 registered keys across 31 files live here at runtime. There is no hierarchy, no namespacing beyond a naming convention (e.g., `lollipopFarm*`, `game*`, `statusBar*`, `questPlayerSpell*`).

### 2b. Registration Lifecycle

Registration happens via `Saving.registerBool/Number/String(key, default)`. These are called as module-level statements in TypeScript files (outside any class body), so they fire when the script is parsed — before `new Game()` runs. The `canRegister` flag is set to `false` in `main.ts:31` just before `Saving.load()`, so no new keys can be added during or after loading.

Each `registerX()` call:
1. Checks for duplicate key across all three maps (logs error, does not throw)
2. Calls `saveX(key, default, registering: true)` — the `registering=true` flag bypasses the "key must already exist" guard

This means registration both creates the key AND sets its default value simultaneously.

### 2c. Load Path (Saving.load)

**Case NONE**: No-op. All keys hold their registered defaults. (The large commented-out block in lines 17-135 is a debug override that unlocks everything — it is never active in production.)

**Case LOCAL**: Delegates to `LocalSaving.load(slotId)`. This iterates all registered keys in all three maps and calls `Saving.saveBool/Number/String(key, LocalSaving.loadX(slotId + "." + key))` for each. If a localStorage item doesn't exist, `localStorage.getItem()` returns `null`, which then flows through `stringToBool(null)` or `stringToNumber(null)` — `stringToNumber` calls `parseFloat(null)` which returns `NaN`, and `stringToBool(null)` logs an error and returns `undefined`.

**Case FILE**: Runs three regexes against the input string:
```
/bool +[a-zA-Z0-9_]+ *= *[a-zA-Z0-9_]+/g
/number +[a-zA-Z0-9_]+ *= *[a-zA-Z0-9_]+/g
/string +[a-zA-Z0-9_]+ *= *[a-zA-Z0-9_]+/g
```
Extracts key and value from each match, calls `Saving.saveBool/Number/String(key, value)`. **The `saveBool` guard `if(key in bools)` silently discards keys not registered in the current build.** No error is surfaced to the player.

After all three cases: `game.load()` and `game.getPlayer().load()` are called to push the Saving values into live objects.

### 2d. Save Path (Saving.save)

1. Calls `game.save()` and `game.getPlayer().save()` — these push live object state back into the Saving maps
2. For LOCAL: delegates to `LocalSaving.save(slotId)`
3. For FILE: returns false immediately (file export is handled separately in `Save.ts:clickedFileSave`)

---

## 3. LocalSaving (code/main/LocalSaving.ts)

### 3a. localStorage Layout

For slot "slot1":
- `"slot1"` → date string `"DD/MM/YYYY @ HH:MM:SS"` (slot existence sentinel + timestamp)
- `"slot1.gameCandiesCurrent"` → `"12345"`
- `"slot1.gameCandiesEatenCurrent"` → `"999"`
- `"slot1.lollipopFarmMillConstructed"` → `"true"`
- ... one item per registered key

Total items per slot at CB2's 163 registered keys: **164 localStorage items** (163 + the sentinel). All are plain strings.

### 3b. Save Operation

```typescript
localStorage.setItem(slotId, getDateAsString());    // sentinel first
for str in bools:    localStorage.setItem(slotId + "." + str, boolToString(bools[str]));
for str in numbers:  localStorage.setItem(slotId + "." + str, numberToString(numbers[str]));
for str in strings:  localStorage.setItem(slotId + "." + str, strings[str]);
```

Wrapped in try/catch for `QUOTA_EXCEEDED_ERR`. **Critical flaw**: The catch does not roll back partial writes. If localStorage is near capacity, writes may succeed for the first N keys and fail thereafter, leaving a half-written save.

### 3c. Load Operation

```typescript
if(loadString(slotId) == null) return false;   // check sentinel
for str in bools:    Saving.saveBool(str, loadBool(slotId + "." + str));
for str in numbers:  Saving.saveNumber(str, loadNumber(slotId + "." + str));
for str in strings:  Saving.saveString(str, loadString(slotId + "." + str));
```

`LocalSaving.loadBool(key)` = `Saving.stringToBool(localStorage.getItem(key))`. If the item is missing, `stringToBool(null)` logs `"Error: trying to convert a string to a bool but the string value is null."` and returns `undefined` — which gets stored in the bools map as a falsy value. This is the "missing key" silent corruption path.

### 3d. Autosave Cadence

`Game.setDefaultLocalAutosaveTime()` sets `localAutosaveTime = 600`. `Game.oneSecondMethod()` calls `localAutosave()` every second, which decrements `localAutosaveTime` and fires when it reaches 0. **Effective cadence: 10 minutes.** The UI countdown displays in whole minutes (ceiling division).

---

## 4. File Export Format (the shareable save string)

Produced by `Save.ts:clickedFileSave()`:

```
bool gameCandyBoxBoxOpened=false, bool statusBarUnlocked=true, ..., number gameCandiesCurrent=12345, number gameCandiesEatenCurrent=999, ..., string gameLanguage=en, string gameWeaponSelected=eqItemWeaponWoodenSword
```

Rules:
- **Delimiter**: `, ` (comma + space) between entries
- **Type tags**: literal strings `bool`, `number`, `string` prefix each entry
- **Values**: `true`/`false` for bools; JS `.toString()` for numbers (produces scientific notation for large values, e.g., `1e+15`); raw string value for strings
- **No header, no version, no checksum, no encoding**
- **Character restriction**: The import regex only matches `[a-zA-Z0-9_]` in values. String values with spaces, commas, or special characters would be silently truncated.
- **Order**: Iteration order of JS object properties, which in V8 is insertion order — effectively registration order across files.

A real export looks like:
```
bool candyBoxBoxOpened=false, bool statusBarUnlocked=true, bool statusBarUnlockedCfg=true, ..., number gameCandiesCurrent=50000000, number gameCandiesEatenCurrent=500000000, ..., string gameLanguage=fr, string gameWeaponSelected=eqItemWeaponGiantSpoon
```

**There is no version field.** A save from CB2 v1.0 is indistinguishable from a save from v1.5 in the format itself. If a key was renamed between versions, the old key is silently discarded and the new key gets its registration default — silent corruption.

---

## 5. Persisted State Inventory

### 5a. Resources (from Game.ts, via Resource class)

Each resource stores three numbers: `Accumulated`, `Current`, `Max`.

| Saving prefix | Description |
|---|---|
| `gameCandies` | Main candy balance |
| `gameLollipops` | Lollipop balance |
| `gameChocolateBars` | Chocolate bar balance |
| `gamePainsAuChocolat` | Pain au chocolat balance |
| `gameCandiesEaten` | Lifetime candies eaten (never decrements) |
| `gameCandiesThrown` | Lifetime candies thrown |
| `gameCandiesUsedToRequestFeatures` | Candy "votes" spent |
| `gameCandiesInCauldron` | Cauldron input queue |
| `gameLollipopsInCauldron` | Cauldron lollipop queue |

### 5b. Player

- `playerHp` (number) — current HP
- Max HP is **recomputed** on every load from `gameCandiesEatenCurrent` — it is NOT stored

### 5c. Equipment

- `gameWeaponSelected`, `gameHatSelected`, `gameBodyArmourSelected`, `gameGlovesSelected`, `gameBootsSelected` — strings, hold the savingName of the equipped item
- One bool per item: `eqItemWeapon*`, `eqItemHat*`, `eqItemBodyArmour*`, `eqItemGloves*`, `eqItemBoots*` — possession flags

### 5d. Inventory / Grid Items

One bool per grid item (`gridItemPossessed*`).

### 5e. Feature Unlock Flags

- `statusBarUnlocked*` bools (11 keys)
- `lonelyHouse*Done` bools (quest progression)
- `mainMapDone*` bools (world map zone completion)
- `castleTower*`, `dragonDone`, `dragonUnlockedCyclops` (story progression)
- `lollipopFarm*` (13 keys — farm state)
- `cauldronBookCurrentPage` (number)
- `wishingWell*` (10 keys)
- `secondHouse*Bought`, `forgeBought*`, `sorceressHut*` (shop purchase history)
- `questPlayerSpell*HasSpell`, `questPlayerSpellXQuantity` (spell inventory)

### 5f. Configuration

- `gameDebug` (bool)
- `gameLanguage` (string)
- `gameInvertedColors` (bool)
- `gameGameMode` (string: `"normal"` or `"hard"`)

### 5g. Recomputed on Load (NOT persisted)

- Max HP (computed from `gameCandiesEatenCurrent` in `Player.reCalcMaxHp()`)
- Lollipop farm production rate (called via `calcLollipopFarmProduction()` on item gain)
- Selected equipment object references (rebuilt from savingName strings via `emptyAndFillSelectedEqItemsArray()`)

---

## 6. The CandiesEaten Mechanics

`gameCandiesEaten` is a standard `Resource` (via `CandiesEaten extends StatusBarResource extends Resource`). In CB2, eating candies calls:

```typescript
// CandyBox.ts:169
this.getGame().getCandies().transferTo(this.getGame().getCandiesEaten());
```

`Resource.transferTo()` calls `this.add(-howMany)` on candies (balance decreases) and `resource.add(howMany)` on candiesEaten (balance increases). The `add()` method only increments `accumulated` when adding a positive number. The candiesEaten resource only ever receives positive additions — it never has `add(-n)` called on it. Therefore `candiesEaten.current` **is** the lifetime total. In CB3 terminology this IS the `lifetimeCandiesEaten` field.

CB2 uses it for:
- HP cap scaling formula (`Player.reCalcMaxHp()`, line 320)
- Regen rate scaling (`Player.magicHealthRegain()`, line 286)
- Display in status bar (`CandiesEaten.getCurrentAsString()`)

CB3 additionally needs it for: ending 3 gate, "wrapper" sword damage scaling.

---

## 7. Version Handling and Migration (Absence Thereof)

**There is none.** No version field exists in any part of the format. No migration code exists anywhere in the codebase. The strategy is implicitly "keep all old key names forever" and "if a key is missing, the registration default is used silently."

This works for CB2 because:
1. It shipped as a single complete version; patches were rare and small
2. The community accepted save breakage on major updates as part of the genre
3. The game is short enough that restarting is tolerable

For CB3 with a planned 18-20 hour progression, this is not acceptable.

---

## 8. Proposed CB3 Save Architecture

### 8a. Schema Shape (TypeScript)

```typescript
// src/save/SaveSchema.ts

interface ResourceState {
  current: number;
  lifetimeAccumulated: number;  // monotonically increasing, never resets
  historicalMax: number;        // high watermark
}

interface CB3SaveData {
  schemaVersion: number;        // REQUIRED — bumped on every schema change
  saveFormatVersion: number;    // bumps only when encoding format changes (e.g., base64 → something else)
  savedAt: string;              // ISO 8601 timestamp
  totalPlaytimeSeconds: number; // wall-clock time, incremented by game loop
  nGPlusRun: number;            // 0 = first run, 1+ = NG+

  // Core resources
  candies: ResourceState;
  lollipops: ResourceState;
  chocolate: ResourceState;
  caramel: ResourceState;
  rockCandy: ResourceState;
  cottonCandy: ResourceState;
  popRocks: ResourceState;
  licorice: ResourceState;
  peppermint: ResourceState;
  stardust: ResourceState;
  gummies: ResourceState;

  // Lifetime stats (never reset, survive NG+)
  lifetimeCandiesEaten: number;   // primary gate for ending 3 + wrapper scaling
  lifetimeCandiesThrown: number;
  starsRemaining: number;         // 8128 at start, ticks down all game

  // Player
  playerHpCurrent: number;
  // Max HP is recomputed from lifetimeCandiesEaten — not stored

  // Equipment
  equippedWeapon: string | null;
  equippedHat: string | null;
  equippedBodyArmour: string | null;
  equippedGloves: string | null;
  equippedBoots: string | null;
  ownedItems: Record<string, boolean>;  // item savingName → possessed

  // Progression flags
  flags: Record<string, boolean>;       // feature unlock bools
  numbers: Record<string, number>;      // zone step numbers, timers, etc.
  strings: Record<string, string>;      // language, game mode, etc.

  // NG+ carry-overs (populated only on NG+ transition, otherwise null)
  ngPlusCarryover: {
    lifetimeCandiesEaten: number;
    starsRemaining: number;
    nGPlusRun: number;
  } | null;
}
```

### 8b. Default Save Factory

```typescript
// src/save/defaultSave.ts
export function createDefaultSave(): CB3SaveData {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    saveFormatVersion: 1,
    savedAt: new Date().toISOString(),
    totalPlaytimeSeconds: 0,
    nGPlusRun: 0,
    candies: { current: 0, lifetimeAccumulated: 0, historicalMax: 0 },
    // ... all resources
    lifetimeCandiesEaten: 0,
    lifetimeCandiesThrown: 0,
    starsRemaining: 8128,
    playerHpCurrent: 100,
    equippedWeapon: null,
    equippedHat: null,
    equippedBodyArmour: null,
    equippedGloves: null,
    equippedBoots: null,
    ownedItems: {},
    flags: {},
    numbers: {},
    strings: { language: 'en', gameMode: 'normal' },
    ngPlusCarryover: null,
  };
}
```

### 8c. Versioning and Migration

```typescript
// src/save/migrations.ts
type MigrationFn = (data: unknown) => unknown;

// Index = fromVersion. migrations[1] upgrades version 1 → 2.
const migrations: MigrationFn[] = [
  // migrations[0] is unused (no version 0 → 1 needed; 1 is the initial version)
  undefined,
  // v1 → v2: added starsRemaining field
  (data: any) => ({ ...data, schemaVersion: 2, starsRemaining: 8128 }),
  // v2 → v3: renamed 'flags.candyBoxBoxOpened' to 'flags.candyBoxIsOpen'
  (data: any) => ({
    ...data,
    schemaVersion: 3,
    flags: {
      ...data.flags,
      candyBoxIsOpen: data.flags.candyBoxBoxOpened ?? false,
      candyBoxBoxOpened: undefined,  // remove old key
    },
  }),
];

export function migrate(raw: unknown): unknown {
  let data = raw as any;
  const currentVersion = CURRENT_SCHEMA_VERSION;
  while (data.schemaVersion < currentVersion) {
    const fn = migrations[data.schemaVersion];
    if (!fn) throw new Error(`No migration from schema version ${data.schemaVersion}`);
    data = fn(data);
  }
  return data;
}
```

### 8d. Export String Encoding

```typescript
// src/save/encoding.ts
export function encodeSave(save: CB3SaveData): string {
  const json = JSON.stringify(save);
  return btoa(unescape(encodeURIComponent(json)));  // UTF-8-safe base64
}

export function decodeSave(str: string): unknown {
  try {
    const json = decodeURIComponent(escape(atob(str)));
    return JSON.parse(json);
  } catch {
    throw new Error('Save string is not valid base64-encoded JSON.');
  }
}
```

### 8e. Import Validation (Zod)

```typescript
// src/save/saveSchema.zod.ts
import { z } from 'zod';

const ResourceStateSchema = z.object({
  current: z.number().finite().min(0).default(0),
  lifetimeAccumulated: z.number().finite().min(0).default(0),
  historicalMax: z.number().finite().min(0).default(0),
});

export const CB3SaveSchema = z.object({
  schemaVersion: z.number().int().positive(),
  savedAt: z.string().default(() => new Date().toISOString()),
  totalPlaytimeSeconds: z.number().finite().min(0).default(0),
  nGPlusRun: z.number().int().min(0).default(0),
  candies: ResourceStateSchema.default(() => ({ current: 0, lifetimeAccumulated: 0, historicalMax: 0 })),
  // ... all resources
  lifetimeCandiesEaten: z.number().finite().min(0).default(0),
  starsRemaining: z.number().int().min(0).max(8128).default(8128),
  playerHpCurrent: z.number().finite().min(0).default(100),
  equippedWeapon: z.string().nullable().default(null),
  // ...
  flags: z.record(z.string(), z.boolean()).default({}),
  numbers: z.record(z.string(), z.number().finite()).default({}),
  strings: z.record(z.string(), z.string()).default({}),
  ngPlusCarryover: z.object({
    lifetimeCandiesEaten: z.number().finite().min(0),
    starsRemaining: z.number().int().min(0).max(8128),
    nGPlusRun: z.number().int().min(1),
  }).nullable().default(null),
});
```

### 8f. Import Flow

```typescript
// src/save/importSave.ts
export function importSave(str: string): Result<CB3SaveData, string> {
  let raw: unknown;
  try {
    raw = decodeSave(str);
  } catch (e) {
    return { ok: false, error: 'Could not decode save string. Is it a valid CB3 save?' };
  }

  // Refuse future versions
  if (typeof raw === 'object' && raw !== null && 'schemaVersion' in raw) {
    if ((raw as any).schemaVersion > CURRENT_SCHEMA_VERSION) {
      return { ok: false, error: `Save is from a newer version (v${(raw as any).schemaVersion}). Please update CB3.` };
    }
  }

  let migrated: unknown;
  try {
    migrated = migrate(raw);
  } catch (e) {
    return { ok: false, error: `Migration failed: ${e}` };
  }

  const parsed = CB3SaveSchema.safeParse(migrated);
  if (!parsed.success) {
    // List invalid fields but still try to use .default() values
    console.warn('Save import warnings:', parsed.error.issues);
    // Parse again with loose mode — Zod's .default() handles missing fields
    const loose = CB3SaveSchema.parse(migrated);  // throws only on non-defaultable errors
    return { ok: true, data: loose };
  }

  return { ok: true, data: parsed.data };
}
```

### 8g. localStorage Layout (CB3)

```
cb3.slot1            →  base64-encoded full save string
cb3.slot1.meta       →  JSON: { savedAt, schemaVersion, lifetimeCandiesEaten, actReached, nGPlusRun }
cb3.slot2            →  base64-encoded full save string
cb3.slot2.meta       →  JSON meta
...
cb3.autosave.1       →  most recent autosave
cb3.autosave.2       →  second most recent
cb3.autosave.3       →  third most recent
cb3.settings         →  JSON: { language, invertColors } — persists across slot loads
```

One key per slot = atomic writes, no partial-write corruption. Meta key allows slot-picker UI to read summaries cheaply.

### 8h. Autosave Cadence

- Every 60 seconds (not 10 minutes)
- Rotate three autosave slots (cb3.autosave.1/2/3) round-robin
- On a fresh load from a manual slot, also write to autosave.1 immediately (so autosave is always recent)

### 8i. NG+ Transition

```typescript
export function beginNGPlus(completedSave: CB3SaveData): CB3SaveData {
  const fresh = createDefaultSave();
  return {
    ...fresh,
    nGPlusRun: completedSave.nGPlusRun + 1,
    // Carry-over fields:
    lifetimeCandiesEaten: completedSave.lifetimeCandiesEaten,
    starsRemaining: completedSave.starsRemaining,  // persists the downward count
    ngPlusCarryover: {
      lifetimeCandiesEaten: completedSave.lifetimeCandiesEaten,
      starsRemaining: completedSave.starsRemaining,
      nGPlusRun: completedSave.nGPlusRun + 1,
    },
    strings: { ...fresh.strings, gameMode: 'ngplus' },
  };
}
```

The completed run save is archived to `cb3.completedRun.N` before overwriting. Never mutate it.

---

## 9. Files Essential for Understanding CB2 Save System

| File | Why essential |
|---|---|
| `/code/main/Saving.ts` | The entire runtime store and serialization logic |
| `/code/main/LocalSaving.ts` | localStorage adapter; key naming; autosave mechanics |
| `/code/main/Save.ts` | UI; file export string construction; import dispatch |
| `/code/main/main.ts` | Startup sequencing; canRegister gate; FILE reload path |
| `/code/main/Game.ts` | Resource registration (40 keys); save/load methods; autosave timer |
| `/code/main/Resource.ts` | The current/accumulated/max pattern; add() and transferTo() |
| `/code/main/Player.ts` | player save/load; HP formula using candiesEaten |
| `/code/main/MainLoadingType.ts` | The three-way enum |
| `/code/main/CandiesEaten.ts` | The lifetime-eaten resource; why it never decrements |
| `/code/main/LollipopFarm.ts` | Example of feature-local key registration (17 keys) |
| `/code/main/StatusBar.ts` | Tab unlock flags; statusBarCornerStep number |
| `/code/main/Item.ts` | Item base class; why every EqItem/GridItem auto-registers a bool |