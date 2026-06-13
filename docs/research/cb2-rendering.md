---
title: "CB2 ASCII Rendering Pipeline — Deep Analysis & CB3 Recommendations"
slug: cb2-rendering
type: code
---

> Candy Box 2's entire visual output is produced by a single class, RenderArea, which maintains an in-memory character grid (array of fixed-width strings) plus two parallel data structures: a sorted list of HTML tag-injection points (RenderTag) per row, and a list of jQuery event binders (RenderLink). Each game tick, the quest or place calls getForRendering(), which splices the HTML tags into the character rows and joins everything with newlines, then RenderLocation.render() dumps the result into a &lt;pre&gt; element via jQuery .html(). Color is applied purely through inline CSS color/background-color spans inserted at specific character columns; there is no per-character DOM node. The map uses the same mechanism with CSS overflow scroll enabled on the container. For CB3, the recommended approach is a hybrid: a single &lt;pre&gt;/innerHTML update per frame for quest arenas (matching CB2's exact strategy), with a sparse span-overlay layer for glow effects on specific characters, delegated click detection on the &lt;pre&gt; for hotspot regions, and a tall always-present DOM column that the browser page scrolls through naturally for the vertical world map.

### Key findings
- The entire game renders into exactly two <pre> elements in index.html: #statusBar (fixed top) and #mainContent (scrollable body). No canvas, no SVG, no shadow DOM.
- RenderArea (code/main/RenderArea.ts, 597 lines) is the central primitive: it holds this.area[] (string[]) as the character grid, this.tags[][] (RenderTag[]) as sorted per-row HTML injection points, and this.links[] (RenderLink[]) as jQuery event binders. Width and height are fixed integers.
- getForRendering() (RenderArea.ts:541) clones area[], iterates every row's tags in sorted-by-x order, and uses String.addAt() (string_prototype.ts:8) to splice raw HTML strings into the cloned rows at their character-column offset. The entire grid becomes one big HTML string joined with '\n'.
- RenderTag (code/main/RenderTag.ts) holds a character-column x and an HTML string. Tags are sorted in DESCENDING x order per row so that inserting tags from right to left keeps prior column indices valid — a critical detail for correctness.
- RenderLocation.render() (code/main/RenderLocation.ts:14) calls $(selector).html(renderArea.getForRendering()) then renderArea.runLinks(). runLinks() iterates all RenderLink objects and binds jQuery event listeners (click, change, mouseenter) to freshly-rendered DOM elements. This means event listeners are re-bound on every render call — a deliberate but expensive pattern.
- Color is applied by calling renderArea.addColor(x1, x2, y, color) which inserts <span style='color:rgb(...)'> and </span> tags at the specified column range. Background color, bold, and italic are applied the same way. There is no per-character DOM node — color spans cover character ranges, not individual characters.
- Clickable regions ('links') in the ASCII grid are implemented by first drawing character spans with CSS classes (addAsciiButton, addAsciiNinjaButton) and then registering a RenderLinkClick which binds a jQuery mouseup handler to that class selector. The .asciiButton class in design.css sets cursor:pointer; user-select:none — no other affordance.
- The map (code/main/MainMap.ts) loads ascii/maps/map.txt from the Database module, draws it in one drawArray() call, then overlays invisible .asciiButton span regions per location using addMultipleAsciiButtons(). Each button group shares a CSS class and gets one mouseup callback. Tooltip comments appear on mouseenter via RenderLinkOver. The map enables scrolling by toggling CSS: the #mainContent <pre> gets position:absolute; the #aroundStatusBar gets position:fixed.
- ASCII assets (.txt files in ascii/) are loaded at startup and stored as string[] in Database.asciiMap keyed by path. The first line of each .txt file is an @author credit line — it is stripped when loaded. Assets are plain text with no binary encoding.
- Quest rendering (code/main/Quest.ts) runs at 100ms intervals (10 fps) via window.setTimeout with a self-rescheduling pattern. Each tick calls: preDraw() (resetAllButSize), then the background drawArray(), then drawEntities() (each entity composites its own RenderArea into the quest's RenderArea via drawArea()), then drawAroundQuest() (spells/log UI), then postDraw() which calls updatePlace() → displayPlace() → RenderLocation.render(). The full grid is serialized and injected into the DOM on every tick.
- Entity animation (QuestEntityAnimation.ts) cycles through multiple named ASCII assets stored in Database; it calls renderArea.drawArray() with the current asset index, updating the RenderArea that the entity owns. Frame timing is tick-count based (every N quest ticks), not wall-clock based.
- Transparency in entity drawing (RenderTransparency.ts) is done character-by-character: a designated 'alpha character' (typically space) is skipped, and a 'meta-alpha character' can represent a literal space that SHOULD be drawn. This allows entities to be overlaid without their bounding-box background overwriting the quest background.
- The quest camera/scrolling uses a getGap() method that calculates a left CSS offset in 'ex' units to keep the player centered horizontally. The status bar's outerWidth divided by 100 gives the real ex pixel value. There is no canvas clipping; the entire quest RenderArea is always rendered, just positioned horizontally.
- There is zero use of CSS text-shadow, CSS animation, CSS glow, or any animated CSS in CB2. All glow/color effects are inline CSS color/background-color spans. CB3's design calls for CSS text-shadow glow which is an addition that CB2's pipeline does not demonstrate.
- The CSS for <pre> elements (design.css:38) is minimal: font-family:monospace; font-size:1em. All layout is driven by the pre element's natural monospace character grid. Elements injected via tags use position:absolute to float above the text layer.

### Patterns to steal
- The RenderArea abstraction itself: maintain a string[] grid + a sorted RenderTag[][] overlay + a RenderLink[] event list as three separate concerns. This separation makes it trivial to reset just tags/links without clearing the character grid (resetAllButSize pattern), which is the most common quest-tick operation.
- Tag sorting in descending x order per row so right-to-left insertion keeps column indices valid when splicing HTML into plain strings. This is the key correctness insight of the entire renderer.
- The alpha/meta-alpha transparency convention for entity overlay: designate one character as 'don't draw me' (typically space) and a second character as 'draw an actual space here'. This lets entity ASCII art have transparent holes without requiring per-character DOM nodes.
- The Database module pattern: load all ASCII assets at startup into a flat keyed map (path → string[]). Strip the first @author line on load. Expose getAscii(key), getPartOfAscii(key, y1, y2) for viewport slicing. This makes all asset references synchronous at runtime.
- The Place/Quest class hierarchy: Place is an abstract renderable that returns getRenderArea() and getScrolling(). Quest extends Place and adds the entity list, per-tick update loop, collision system, and spell UI. This clean separation means menus and arenas use the same rendering path.
- The willBeDisplayed/willStopBeingDisplayed/willBeClosed lifecycle on Place: allows each screen to register and clean up its own callbacks (resource watchers, interval callbacks) without a global event bus. Game.setPlace() orchestrates this consistently.
- Saving the map scroll position in willStopBeingDisplayed (MainMap.ts:24) and restoring it in getDefaultScroll(). For CB3's vertical map this exact pattern applies — persist scroll Y to save state, restore on return.
- The two-timer architecture: window.setInterval at 1000ms for economy/production ticks, and a self-rescheduling window.setTimeout at 100ms for quest rendering. The quest timer can be slowed to 200ms or sped up via getQuestSpeedUp(). This is the right model for separating idle-game economy from real-time quest rendering.
- addMultipleAsciiButtons() accepting variadic (x1, x2, y) triples: a concise, data-driven way to define irregular clickable polygon-of-rectangles regions on ASCII art. The castle's 11 button rectangles covering its irregular shape illustrate why this is needed.
- The RenderLinkOver pattern (mouseenter shows element, mouseleave hides it) for tooltip/comment reveal on map hover. Decoupled from the click handler on the same element class.

### Pitfalls
- Re-binding jQuery event listeners on every render call (RenderLocation.render calls runLinks() which calls $(selector).on(...) fresh every tick) is expensive and creates listener accumulation if the selector matches multiple elements. CB3 must use event delegation on the <pre> container instead of per-render binding.
- CB2's tag insertion is O(rows * tags_per_row) per frame with string concatenation/slicing. For a 240-wide quest grid with many colored entities this becomes expensive. CB3 should profile this before replicating it at larger quest sizes.
- Storing tags sorted in descending x order means addTag() does a linear scan. For rows with many tags (e.g., the forest map with 18 button rectangles per location) this is O(n) per tag insert. A binary search or insertion-sort approach is better for CB3.
- The getForRendering() method clones the entire area[] on every call (this.area.slice(0)). For large grids (map.txt is 89 rows × ~260 chars) this is a significant allocation per frame. CB3 should avoid full clones by writing directly into a pre-allocated output buffer.
- CB2's color application is purely via inline CSS color spans over character RANGES, not individual characters. You cannot apply two different colors to two adjacent characters without two separate addColor calls, and overlapping spans require careful ordering. CB3's glow effect via text-shadow is per-element; you cannot apply text-shadow to a character range inside a span without making each glowing character its own span.
- The position:absolute trick for floating UI elements (buttons, select boxes, text inputs) inside a <pre> relies on the monospace character grid as a coordinate system. This breaks at non-integer zoom levels and non-standard DPI. CB3 should test this carefully, especially for mobile.
- CB2 uses String.prototype extension (string_prototype.ts). This is a global mutation that CB3's design rules prohibit. Replace with pure utility functions.
- The questMethod self-reschedule (Game.ts:787) uses setTimeout not setInterval, which means timer drift accumulates over long quests. Real elapsed time matters for the comet timer and star counter; CB3 should use performance.now() deltas instead of tick counts for these.
- CB2 has no debounce on the click handlers registered via runLinks(). A player who clicks rapidly during a re-render window can fire multiple callbacks. CB3 should guard stateful callbacks with a cooldown flag.
- The map's horizontal scrolling relies on CSS overflow-x:scroll on the #mainContent pre. CB3's vertical map requires overflow-y:scroll on the page (body), which is already CB2's default (design.css:5 sets overflow-y:scroll on body). The vertical direction is already correct — just make the content tall enough.

### Recommendations
- Use a single <pre id='mainContent'> with innerHTML assignment per frame, exactly as CB2 does. This is the correct strategy for CB3's quest arenas. The browser's HTML parser is fast enough for a 100x30 quest grid at 10fps. Do NOT use spans-per-character (too many DOM nodes), CSS-grid-of-chars (layout cost per frame), or canvas (loses accessibility, makes text-shadow glow harder, kills the terminal illusion).
- For the CSS glow aesthetic (moonpops, rock candy, the sun), maintain a SEPARATE glow layer: a <div> absolutely positioned over the <pre>, containing a small number of individual <span> elements with `text-shadow` for only the characters that need glow. Update this layer separately from the full grid re-render — it changes rarely (only when glow targets change state). This avoids the O(n_chars) cost of wrapping every glowing char. Example: `text-shadow: 0 0 8px #ffe066, 0 0 20px #ffaa00;` for a moonpop.
- Implement a CB3 RenderArea in pure TypeScript with no String.prototype mutation. The core interface: `{ grid: string[], tags: RenderTag[][], hotspots: Hotspot[] }`. Keep tags sorted descending by x. Add a `serialize(): string` method that returns the final HTML string by splicing tags right-to-left per row and joining with `\n`.
- Replace CB2's per-render event re-binding with a single delegated listener on the <pre> element: `pre.addEventListener('click', e => { const target = e.target; if (target.matches('.asciiButton')) dispatch(target.dataset.action); })`. Store action identifiers as data-attributes on the injected spans. This is O(1) regardless of how many buttons exist and survives re-renders without rebinding.
- For clickable hotspot regions that span multiple character rectangles (like the map locations), store Hotspot objects as `{ x1, x2, y, handler }` triples in the RenderArea and use a click listener on the <pre> that converts the click's offsetX/offsetY to character grid coordinates using `Math.floor(offsetX / charWidth)` and `Math.floor(offsetY / lineHeight)`. This is the correct approach for irregular ASCII shapes and requires zero injected HTML spans.
- Implement the vertical scrolling world map by making the map's <pre> content as tall as the full world cross-section from the start (all strata pre-rendered as whitespace/placeholder), and revealing/filling strata as the player progresses. Use `window.scrollTo({ top: targetY, behavior: 'smooth' })` for programmatic scroll. Pin the status bar with `position: fixed; top: 0`. Persist scroll Y in save state and restore it on load — exact CB2 pattern from MainMap.ts:24.
- Separate the two game loops in CB3 as CB2 does: (A) an economy/idle setInterval at 1000ms for candy production, farm ticks, and autosave; (B) a requestAnimationFrame loop (not setTimeout) for quest rendering, capped to 10fps with a delta accumulator. requestAnimationFrame is better than setTimeout for quest rendering because it pauses when the tab is hidden, preventing state drift.
- For the quest arena, pre-allocate the output buffer as a flat Uint16Array of character codes (width * height entries) and a parallel Uint8Array for color indices. Serialize to HTML string only at render time. This avoids per-tick string[] allocation and is cache-friendly. Only serialize changed rows using a dirty-flag array — for typical quest frames where only the player and a few enemies moved, most rows are unchanged.
- Structure the CB3 ASCII renderer as three composable modules: (1) `AsciiGrid` — pure character buffer, no HTML knowledge; (2) `HtmlSerializer` — takes AsciiGrid + styled regions + hotspots, emits HTML string; (3) `DomRenderer` — owns the <pre> element, calls serializer, manages the delegated event listener and the glow overlay <div>. This matches CB3's design goal of high cohesion, low coupling.
- For the glow aesthetic specifically: define a `GlowSpec` type `{ char: string, x: number, y: number, color: string, radius: number }`. The DomRenderer maintains a Map of active glows keyed by `${x},${y}`. When the glow set changes, it reconciles the overlay <div>'s children rather than rebuilding it. Each glow span is absolutely positioned using `left: x * charWidth + 'px'; top: y * lineHeight + 'px'` measured once at init and cached.

---

# CB2 ASCII Rendering Pipeline — Exhaustive Analysis

## Overview

Candy Box 2 renders its entire visual output — menus, map, quest arenas, status bar — through a single pipeline: `RenderArea` (in-memory character grid + HTML tag overlays) → `RenderLocation.render()` → two `<pre>` elements in the DOM. There is no canvas, no WebGL, no sprite system, no per-character DOM nodes. The terminal-as-medium illusion is maintained from first byte to last pixel.

---

## 1. DOM Structure (index.html)

```html
<div id="aroundStatusBar"><pre id="statusBar"></pre></div>
<pre id="mainContent"></pre>
```

Two `<pre>` elements. Both use `font-family: monospace; font-size: 1em` (design.css:38). The game's entire visual output is the `.innerHTML` of these two elements. `overflow-y: scroll` on `body` (design.css:5) means a vertical scrollbar is always present — critical for the map.

---

## 2. RenderArea — The Central Primitive

**File:** `/code/main/RenderArea.ts` (597 lines)

### Internal State

```typescript
private area: string[]       // character grid rows, each exactly `width` chars wide
private width: number
private height: number
private tags: RenderTag[][]  // per-row list of HTML injection points, sorted descending by x
private links: RenderLink[]  // jQuery event binders, registered after each render
```

### The Character Grid

`area` is an array of fixed-width strings. Every row is exactly `width` characters. `drawString(str, x, y)` (RenderArea.ts:346) uses `String.replaceAt(index, text)` (string_prototype.ts:32) — `str.substr(0, index) + text + str.substr(index + text.length)` — to overwrite characters in place. Bounds checking clips both left and right. The transparency system (RenderTransparency.ts) makes character-by-character writes, skipping the designated alpha character.

`drawArea(renderArea, x, y, transparency)` (RenderArea.ts:263) composites one `RenderArea` into another: it iterates the source's rows, calls `drawString` for each, then re-adds all source tags offset by `(x, y)`. This is how entity rendering works at quest time.

### The Tag System — How HTML Gets Into The Grid

`RenderTag` (code/main/RenderTag.ts) is a struct: `{ x: number, tagString: string }`. It represents an HTML string to be inserted at character column `x` in a given row.

Tags are stored sorted in **descending x order** per row. This is the key correctness invariant: when `getForRendering()` inserts tags from right to left, earlier insertions don't shift the column indices of later ones.

`addTag(tag, y)` (RenderArea.ts:207) inserts into the sorted position via linear scan. `addTwoTags(x1, x2, y, openTag, closeTag)` is the workhorse — called by every styling method:

- `addColor(x1, x2, y, color)` → `<span style="color:rgb(...)">` / `</span>`
- `addBackgroundColor(x1, x2, y, color)` → `<span style="background-color:...">`
- `addBold(x1, x2, y)` → `<b>` / `</b>`
- `addAsciiButton(x1, x2, y, otherClass)` → `<span class="asciiButton ...">` / `</span>`
- `addAsciiRealButton(str, x, y, otherClass)` → `<span class="aroundRealButton"><span class="asciiRealButton ...">str</span></span>` injected at a single `x` (not a range)

### getForRendering() — Serialization

```typescript
public getForRendering(): string {
    var areaClone: string[] = this.area.slice(0); // full copy
    for (var i = 0; i < this.height; i++) {
        for (var j = 0; j < this.tags[i].length; j++) {
            areaClone[i] = this.tags[i][j].draw(areaClone[i]);
            // draw() calls str.addAt(this.x, this.tagString)
        }
    }
    return areaClone.join("\n");
}
```

`String.addAt(index, text)` (string_prototype.ts:8) = `str.substr(0, index) + text + str.substr(index)` — pure insertion without replacement, which is why tags must be processed right-to-left (they don't displace each other's coordinates).

The result is a single HTML string: rows of monospace text interleaved with inline HTML tags. No virtual DOM, no diffing.

---

## 3. RenderLocation — The DOM Bridge

**File:** `/code/main/RenderLocation.ts`

```typescript
public render(renderArea: RenderArea): void {
    $(this.locationString).html(renderArea.getForRendering());
    renderArea.runLinks();
}
```

`runLinks()` iterates `this.links[]` and calls `.run()` on each, which binds a jQuery event listener to the freshly-rendered DOM. This binding happens **after** every render call. RenderLink subtypes:

- `RenderLinkClick` — `.mouseup()` handler on a CSS selector
- `RenderLinkChange` — `.change()` handler (for `<select>`)
- `RenderLinkOver` — `.mouseenter()` / `.mouseleave()` (for tooltip show/hide)
- `RenderLinkInput` — handles text input + enigma answer checking
- `RenderLinkCheckbox` — checkbox state callbacks
- `RenderLinkOnHoverShowTooltip` — specialized hover-to-show pattern

**Critical issue for CB3:** jQuery listeners are re-bound on every render. In CB2 this works because jQuery's `.mouseup()` replaces existing handlers on the same element. In vanilla TS without jQuery, `addEventListener` accumulates — use event delegation instead.

---

## 4. The Game Loop

**File:** `/code/main/Game.ts`

Two timers:
1. `window.setInterval(this.oneSecondMethod.bind(this), 1000)` — economy: candy production, lollipop farm, autosave.
2. `window.setTimeout(this.questMethod.bind(this), 100)` — self-rescheduling, 10fps. When quest is slowed, 200ms. `questMethod` fires `questCallbackCollection`, which the active Quest registers `this.update.bind(this)` into via `willBeDisplayed()`.

Quest `update()` (e.g., HardcorePlatformer_Quest.ts:72) is the per-tick sequence:
```
1. preDraw()          → renderArea.resetAllButSize() (erase chars, clear tags/links, keep size)
2. drawArray(background)  → blit static background ASCII
3. drawEntities()     → each entity composites its RenderArea into the quest RenderArea
4. drawAroundQuest()  → spells UI, quest log
5. addExitQuestButton()
6. postDraw()         → game.updatePlace() → displayPlace() → RenderLocation.render()
```

Everything from step 1 to 6 happens in one synchronous call. The DOM update is the last step.

---

## 5. Entity Drawing — Composition Model

**File:** `/code/main/QuestEntity.ts:180`

Each `QuestEntity` owns a `RenderArea` (its ASCII art) and knows its `globalPosition`. The `draw()` method:

```typescript
renderArea.drawArea(
    this.renderArea,
    quest.getRealQuestPosition().x + quest.getGlobalDrawingOffset().x + this.globalPosition.x + this.renderAreaPosition.x,
    quest.getRealQuestPosition().y + quest.getGlobalDrawingOffset().y + this.globalPosition.y + this.renderAreaPosition.y,
    this.transparency
);
```

This blits the entity's character grid and its tags (colored regions, buttons) into the quest's master `RenderArea` at the computed screen position. Out-of-bounds entities are clipped before drawing.

Animation (`QuestEntityAnimation.ts`) cycles through multiple named Database assets at a configurable tick interval. Each frame it calls `renderArea.drawArray(Database.getAscii(currentAsset))` to update the entity's private RenderArea before composition.

---

## 6. Color Application

**File:** `/code/main/Color.ts`, `/code/main/ColorType.ts`

Color is a pure value object: `ColorType` enum → RGB triple → `rgb(r, g, b)` string. Applied via `renderArea.addColor(x1, x2, y, color)` which inserts a `<span style="color:...">` range. The inverted-colors mode negates each channel: `rgb(255-r, 255-g, 255-b)`.

There is **no CSS glow, no text-shadow, no animation in CB2**. This is entirely new territory for CB3.

---

## 7. The World Map

**File:** `/code/main/MainMap.ts`

`MainMap` extends `Place` with `getScrolling() = true`. The map asset `ascii/maps/map.txt` is 89 rows × ~260 chars of pure ASCII art. It loads once:

```typescript
this.renderArea.resizeFromArray(Database.getAscii("maps/map"));
this.renderArea.drawArray(Database.getAscii("maps/map"));
```

Then, per-location methods like `loadVillage(x, y)` call `addMultipleAsciiButtons(className, x1, x2, y, ...)` with variadic (x1, x2, y) triples defining the bounding rectangles of the location's irregular shape. A `RenderLinkOver` shows a comment tooltip on hover; a `RenderLinkClick` navigates to the location.

`getScrolling() = true` triggers `RenderLocation.setScrolling(true, defaultScroll)` which:
- Scrolls to `defaultScroll` pixels
- Sets `#mainContent` to `position: absolute; left: 0; top: 0; overflow-x: scroll`
- Sets `#aroundStatusBar` to `position: fixed; top: 0; left: 0; right: 0; height: 0`

The scroll position is saved in `willStopBeingDisplayed()` and restored via `getDefaultScroll()`.

---

## 8. Menus vs. Quests vs. Map — Rendering Differences

| Context | RenderArea size | Update frequency | Scrolling | Tags/Links |
|---|---|---|---|---|
| Status bar | 100×6, fixed | On resource change | No | Many (tab buttons) |
| Menu (CandyBox, Shop) | ~100×40 | On state change only | No | Moderate (buttons, inputs) |
| Map | ~260×89 | Once on load | Yes (vertical) | Many (location buttons) |
| Quest arena | ~260×25 | Every 100ms (10fps) | No (horizontal gap) | Many (spell buttons, entities) |

The `Gap` mechanic in quests: `getGap()` returns a signed pixel offset that horizontally centers the player's position in the viewport. This is applied as a `left` CSS property on `#mainContent` by `RenderLocation.setContentGap()`. The formula uses `#statusBar.outerWidth() / 100` as the `ex` pixel size — a browser-compatibility hack noted in the source.

---

## 9. ASCII Asset Loading

`Database.ts` stores assets as `{ [key: string]: string[] }` where each value is the .txt file split into lines, with the first `@author` line stripped. Assets are referenced as path strings like `"general/box"`, `"eqItems/weapons/woodenSword"`, `"maps/map"`. The loading mechanism (not shown in source but in the compiled JS) reads all assets synchronously before game start.

`Database.getPartOfAscii(key, y1, y2)` slices a sub-range of rows — used for animated entities that share a sprite sheet, and for the `InsideYourBox` frames.

---

## 10. CB3 Rendering Architecture Recommendations

### 10.1 Primary Output Method: `<pre>` + innerHTML

Use a single `<pre id="mainContent">` as CB2 does. On each render call, serialize the `AsciiGrid` to an HTML string and assign to `pre.innerHTML`. This is the correct choice because:

- **Spans-per-character:** A 100×30 quest grid = 3,000 DOM nodes. At 10fps that is 30,000 DOM mutations/sec before any text-shadow. Too expensive.
- **CSS-grid-of-chars:** Forces layout recalc per frame for a 3,000-node grid. Worse than spans.
- **Canvas:** Requires font rendering per-character or glyph atlas; kills the CSS text-shadow glow approach; loses native text accessibility; breaks the terminal aesthetic. Ruled out.
- **`<pre>` + innerHTML:** One DOM mutation per frame (the `.innerHTML` assignment), the browser reuses existing text nodes where possible. At 10fps for a 100×30 grid this is a non-issue on any device made after 2015.

### 10.2 CSS Glow — Separate Overlay Layer

CB2's color spans work within the serialized HTML string. CSS `text-shadow` cannot be applied to a character range within a running string without making each glowing character its own `<span>`. The CB3 approach:

1. Maintain a **glow overlay `<div>`** absolutely positioned over the `<pre>`, with `pointer-events: none`.
2. Each glowing character is one `<span>` in the overlay, positioned with `left: col * charWidth + 'px'; top: row * lineHeight + 'px'`.
3. Measure `charWidth` and `lineHeight` once at init from a test character, and re-measure on window resize.
4. Store active glows as a `Map<string, GlowSpec>` keyed by `"${col},${row}"`. On state change, reconcile the Map against the overlay's children — add/remove/update only what changed.

```typescript
type GlowSpec = { char: string; col: number; row: number; cssClass: string };
```

Example glow classes:
```css
.glow-sun       { text-shadow: 0 0 4px #ffe566, 0 0 16px #ff9900, 0 0 40px #ff6600; }
.glow-moonpop   { text-shadow: 0 0 6px #aaddff, 0 0 18px #5599ff; }
.glow-rockcandy { text-shadow: 0 0 4px #ff88cc, 0 0 12px #cc44aa; }
```

This approach: zero cost when no glow changes, O(k) where k = number of glowing characters (typically < 50), and completely independent from the main grid serialization path.

### 10.3 Clickable Hotspots — Event Delegation

Do NOT re-bind listeners on every render. Instead:

```typescript
pre.addEventListener('click', (e: MouseEvent) => {
    const col = Math.floor(e.offsetX / charWidth);
    const row = Math.floor(e.offsetY / lineHeight);
    const key = `${col},${row}`;
    const handler = hotspotMap.get(key);
    if (handler) handler(e);
});
```

The `hotspotMap` is a `Map<string, () => void>` rebuilt from the current `RenderArea`'s hotspot list each frame (O(hotspots) not O(characters)). For irregular shapes (e.g., a castle covering 11 rectangles), register each rectangle's character cells into the map. For cursor affordance, also update a `cursorMap: Map<string, string>` and set `pre.style.cursor` on `mousemove`.

This replaces ALL of CB2's RenderLink/jQuery binding. One listener, zero re-binding, no jQuery.

### 10.4 Vertical Scrolling World Map

CB3's map is fundamentally different from CB2's horizontal map: it is a tall vertical cross-section that grows upward as the player progresses. Implementation:

1. Make the map `<pre>` as tall as the full world from the start. Undiscovered strata are filled with blank/dark space or "..." placeholder characters.
2. Use `document.body.style.overflowY = 'scroll'` (already CB2's default).
3. Fix the status bar: `#statusBar { position: fixed; top: 0; left: 0; right: 0; z-index: 100; }`.
4. Each new stratum's reveal appends characters to the top of the map `<pre>` content (the world grows upward = content added at the beginning of the string array, which appears visually at the top).
5. Save `window.scrollY` to save state; restore with `window.scrollTo(0, savedY)` on load.
6. The "map extends upward" moment (the beanstalk reveal): append the new sky strata to the top of the pre content, then `window.scrollTo({ top: document.body.scrollHeight - window.innerHeight, behavior: 'smooth' })` to keep the viewport on the ground level, then animate a scroll upward.

### 10.5 Reactive Signals Integration

CB3's hand-rolled signal layer should drive re-renders as follows:
- Economy state (candy count, resources): signal → status bar re-render only.
- Place/screen change: signal → full main content re-render.
- Quest tick: requestAnimationFrame loop with 100ms accumulator → quest render. Quest state is NOT a signal; it is imperative simulation.
- Glow state changes: signal → glow overlay reconciliation only.

Avoid connecting signals to the per-frame quest loop — that path must be as synchronous and allocation-free as possible.

### 10.6 CB3 AsciiGrid Module Structure

```
src/renderer/
  AsciiGrid.ts          — character buffer, drawString, drawArea, transparency
  StyleRegion.ts        — { x1, x2, y, cssClass } for colored ranges  
  Hotspot.ts            — { x1, x2, y, handler } for click regions
  GlowSpec.ts           — { col, row, cssClass } for text-shadow overlay
  HtmlSerializer.ts     — AsciiGrid + StyleRegion[] → HTML string
  DomRenderer.ts        — owns <pre>, manages glow overlay, event delegation
  Database.ts           — asset map, loadAscii(key): string[]
  RenderArea.ts         — composes AsciiGrid + StyleRegion[] + Hotspot[] + GlowSpec[]
```

This keeps file sizes within the 200-400 line target and separates concerns cleanly: `AsciiGrid` has no HTML knowledge; `HtmlSerializer` has no DOM access; `DomRenderer` has no game logic.

---

## 11. Essential Files for Understanding CB2 Rendering

- `/code/main/RenderArea.ts` — the entire rendering model
- `/code/main/RenderTag.ts` — how HTML is injected at character positions  
- `/code/main/RenderLocation.ts` — how the grid reaches the DOM + scroll management
- `/code/main/RenderLink.ts` + all `RenderLink*.ts` — event binding layer
- `/code/main/RenderTransparency.ts` — alpha character compositing
- `/code/main/Database.ts` — asset storage and retrieval
- `/code/main/Game.ts` — the two-timer architecture, place management
- `/code/main/Place.ts` — abstract renderable interface
- `/code/main/Quest.ts` — per-tick update/draw sequence for arenas
- `/code/main/MainMap.ts` — scrolling world map with hotspot regions
- `/code/main/Color.ts` + `/code/main/ColorType.ts` — color system
- `/code/main/QuestEntity.ts` — entity composition into the quest grid
- `/code/main/QuestEntityAnimation.ts` — frame-cycling from Database assets
- `/code/main/string_prototype.ts` — replaceAt/addAt string primitives
- `/css/design.css` — minimal CSS; the key insight is that `<pre>` does all the work
- `/ascii/maps/map.txt` — the full world map as a plain text asset
- `/code/arena/hardcorePlatformer/HardcorePlatformer_Quest.ts` — canonical quest update loop example
