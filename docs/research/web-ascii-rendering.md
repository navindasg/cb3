---
title: "Rendering ASCII Text-Art Games in the Browser at 30-60fps: Architecture Recommendation for Candy Box 3"
slug: web-ascii-rendering
type: web
---

> For Candy Box 3 (vanilla TS + Vite, pure ASCII), the right architecture is a hybrid: DOM-based rendering for the idle/incremental UI and the vertical scrolling map (where most cells are static and you want native text selection, CSS glow, and clickable hotspots for free), and a single dedicated 2D canvas with a prerendered glyph atlas for the real-time quest arenas (where the whole grid changes every frame). This mirrors what the broader ecosystem converged on: terminals like xterm.js render text on canvas/WebGL with glyph atlases for speed, while UI frameworks keep mostly-static text in the DOM because the DOM is fast when it is not thrashing and gives you selection, accessibility, and CSS effects for free. The original Candy Box 2 was pure jQuery DOM manipulation, which is fine for idle screens but would not hold 60fps for a fully-redrawing drift-combat arena. CSS text-shadow glow is cheap when static but must be gated behind prefers-reduced-motion and confined with CSS containment when animated; never animate the shadow itself, animate opacity on a pre-glowing layer. Cell-metric consistency comes from the ch unit plus a self-hosted variable monospace font (JetBrains Mono) loaded with the CSS Font Loading API before first paint, with font-variant-numeric: tabular-nums to stop digit-width drift in the candy counter.

### Key findings
- Canvas fillText is the single biggest cost in text-heavy canvas rendering - a well-built canvas data grid spends ~50% of CPU in fillText, because each call crosses the JS/native bridge and re-rasterizes the glyph. The fix is universal: rasterize each glyph ONCE to an offscreen canvas (a glyph atlas/cache) and blit with drawImage. Measured results: 10ms/frame to 1ms/frame (10x), fillText CPU from 41% to <1% on Firefox/Linux. This is exactly what xterm.js's canvas and WebGL renderers do - a tightly-packed texture atlas of glyphs, trimmed to minimal rectangles.
- The DOM is NOT slow for static text - it is slow when thrashing (layout/paint churn). For mostly-static idle screens the DOM wins decisively: native text selection, accessibility, CSS glow, and clickable elements all come free, and the browser only repaints what changes. The performance cliff is updating thousands of nodes per frame, which idle UI never does. Multiple sources confirm keeping static UI in the DOM and out of the render loop is the correct call.
- xterm.js (the reference implementation for browser terminals) offers a DOM renderer, a 2D-canvas renderer, and a WebGL renderer. WebGL uploads a Float32Array of cell data plus a glyph texture atlas to the GPU and scales best to huge viewports; the canvas renderer uses the same atlas concept via drawImage. The DOM renderer exists and is acceptable but is the slowest tier - they built canvas/WebGL specifically because per-character spans do not scale to full-grid updates.
- The CSS ch unit equals the advance width of '0' and is EXACT in a monospace font - a 60ch element is exactly 60 characters wide. Combined with a CSS line-height variable, this gives a perfect character grid. 'The Monospace Web' uses --line-height as a variable, max-width: calc(min(80ch, round(down,100%,1ch))) to keep width a whole number of cells, and font-variant-numeric: tabular-nums lining-nums to prevent proportional digit glyphs from breaking alignment.
- Box-drawing/Unicode characters break cell alignment above certain line-heights in many monospace fonts. 'The Monospace Web' specifically chose JetBrains Mono because it keeps box-drawing glyphs aligned up to 120% line-height where most fonts degrade above ~110%. CB3's map (using │ ═ ╧ ☀ ☾ ◯ ∴ etc.) is exactly the case that exposes this.
- Static text-shadow glow has minimal performance cost; ANIMATED text-shadow forces continuous repaints and tanks low-end devices. The GPU-friendly pattern is to put the glow on a layer (or pseudo-element) and animate opacity/transform only - never the shadow blur/color values. filter: drop-shadow() is GPU-accelerated; canvas shadowBlur is explicitly called out by MDN as something to avoid.
- prefers-reduced-motion must gate all decorative glow pulsing. Best-practice consensus for 2025: do NOT globally kill all animation (can break JS relying on animationend); instead remove or simplify decorative motion (pulsing glow qualifies as decorative) while leaving the static glow color intact.
- For long vertical scrolling, transform: translateY runs on the GPU/compositor and is smoother than animating scrollTop, which can show empty frames because the browser scrolls before content renders. For a very long map, render only the visible strata window (virtualization) and position with translateY; CSS containment (contain: content) and content-visibility: auto let the browser skip layout/paint for offscreen strata entirely.
- Mapping clicks to ASCII cells is pure integer math when the grid metrics are known: col = floor((clientX - gridLeft) / cellWidthPx), row = floor((clientY - gridTop) / cellHeightPx), where cellWidthPx is measured once from 1ch and cellHeightPx from the line-height. No per-character DOM nodes are needed for hit-testing.
- Candy Box 2 itself is TypeScript compiled to a single bundle with ASCII art and text in separate asset directories, rendered via jQuery DOM manipulation (divs/spans and preformatted text), not canvas. This is the proven pattern for the idle/menu layer but predates the real-time arena demands CB3's drift combat adds.

### Patterns to steal
- Glyph atlas / offscreen-canvas glyph cache (from xterm.js and Mirko Sertic): rasterize each (char,color) ONCE, then drawImage-blit every frame. ~10x faster than per-frame fillText. This is the single most important pattern for the arena renderer.
- ch-based grid + CSS line-height variable + tabular-nums (from 'The Monospace Web') for pixel-perfect, browser-consistent character cells without measuring per glyph.
- round(down, 100%, 1ch) responsive width so the play area is always a whole number of cells - no half-character clipping at any viewport size.
- Glow-on-a-layer, animate-opacity-only pattern for GPU-friendly pulsing (moonpops/sun), instead of animating text-shadow values.
- Dirty-cell diffing: keep prev and next immutable cell buffers, blit/patch only cells that changed (redraw regions). Pairs perfectly with the project's immutability rule.
- content-visibility: auto + contain on offscreen map strata so a very long vertical map costs nothing to keep mounted.
- Lazy render on idle screens (render only on state change, no rAF) + rAF loop only while a quest is mounted - near-zero idle CPU for a multi-hour idle game.
- Delegated single-listener hit-testing with floor(localX/cellW),floor(localY/cellH) and a sparse hotspot map - one pattern for both DOM and canvas surfaces.
- Swappable Renderer interface so DOM vs canvas is an implementation detail behind one contract sharing one model.

### Pitfalls
- Per-frame fillText for every cell - the #1 performance trap; ~50% CPU and crosses the JS/native bridge each call. Always go through a glyph atlas.
- Animating text-shadow blur/color directly - forces continuous repaints, kills low-end devices. Animate opacity on a pre-glowing layer instead.
- canvas shadowBlur - MDN explicitly flags it as slow; bake glow into atlas glyphs instead.
- Rebuilding a giant <pre>.textContent every frame for an arena - full reparse/relayout/repaint, won't hold 60fps, and loses per-char color.
- Thousands of span mutations per frame (DOM thrashing) - the DOM is only fast when NOT thrashing; this is the boundary where you must switch to canvas.
- Box-drawing/Unicode glyphs drifting out of alignment at higher line-heights in the wrong monospace font - validate the chosen font (JetBrains Mono) against the actual map glyphs at the actual line-height.
- FOUT/fallback-font frame misaligning the grid - render after document.fonts.load resolves rather than relying on font-display: swap.
- Proportional digit glyphs making the candy counter reflow/jitter - fix with font-variant-numeric: tabular-nums.
- Animating scrollTop for the map - can render empty frames; use transform: translateY (compositor) instead.
- Calling getBoundingClientRect/getComputedStyle on content-visibility:auto offscreen strata - forces early render and erases the perf win.
- Globally disabling all animation under prefers-reduced-motion - can break JS that listens for animationend; simplify decorative motion instead.
- Sub-pixel canvas coordinates - cause extra anti-aliasing; use Math.floor for integer coords and handle devicePixelRatio explicitly.
- Spinning requestAnimationFrame on idle screens for 18-20 hours - wasted CPU/battery; render idle UI lazily on state change only.

### Recommendations
- Adopt a TWO-RENDERER hybrid keyed off game mode. (A) DOM renderer for idle UI, shop/forge/menus, and the vertical map. (B) A single <canvas> 'arena renderer' with a glyph atlas, mounted only during real-time quests (on-foot side-scroller, vertical beanstalk climb, drift combat). Both share one TS model of the grid (a typed Cell buffer); the renderer is a swappable strategy behind a Renderer interface. This matches the idle-vs-arena split the design doc already implies and lets each surface use its best-fit tech.
- Build the canvas arena renderer around a prerendered glyph atlas, not live fillText. On init, rasterize every glyph x every color variant you use into an offscreen canvas keyed by (char, colorClass). Each frame, diff the new cell buffer against the previous one and drawImage only changed cells (redraw regions / dirty cells). Use ctx.getContext('2d',{alpha:false}) for the opaque arena, integer pixel coords (Math.floor), and handle devicePixelRatio by sizing the backing store to rect*dpr and ctx.scale(dpr,dpr). This is the documented 10x path and trivially holds 60fps for a CB-sized grid even on full-frame updates.
- Do the cell grid with CSS ch + a --cell-h line-height variable. Set on :root: --cell-w via measuring 1ch in JS once after font load, --line-height: 1.2rem (or px), font-variant-numeric: tabular-nums lining-nums, and white-space: pre. Use ch for any width math and the line-height variable for vertical math so DOM and canvas share identical cell metrics. Keep the candy counter in tabular-nums so it never reflows as digits change.
- Self-host JetBrains Mono (variable) and load it via the CSS Font Loading API before first render: await document.fonts.load('1rem "JetBrains Mono"') then render. Use font-display: optional or block briefly to avoid a fallback-font frame that would misalign box-drawing glyphs. JetBrains Mono is specifically validated for box-drawing alignment up to 120% line-height, which CB3's map glyphs (│ ═ ╧ ∴ ◯ ☾ ☀) need. Provide a metric-matched fallback in the font stack to minimize layout shift if the font is slow.
- Implement glow as static text-shadow by default, with an optional pulsing layer animating opacity ONLY, all gated behind @media (prefers-reduced-motion: no-preference). Apply the glow via a class per glowing entity (moonpop, rock candy, the sun) so it is data-driven from flavor properties. Wrap animated-glow regions in contain: paint (or content-visibility) so a pulsing sun on the map cannot trigger document-wide repaints. Avoid canvas shadowBlur entirely in the arena - if a quest needs a glow, prerender a glowing glyph variant into the atlas.
- Render the vertical map as virtualized strata positioned with transform: translateY, not by animating scrollTop. Keep each stratum as a contained block (contain: content; content-visibility: auto with a contain-intrinsic-size hint) so offscreen strata cost nothing. As the player progresses, append new strata to the bottom of the model and let the page grow; animate the viewport offset with translateY for buttery scroll. Because the map is mostly static text, keep it in the DOM (not canvas) to preserve selection, hotspots, and CSS glow.
- Handle input with one delegated listener on the grid container, converting pixel coords to (col,row) via floor(localX/cellW), floor(localY/cellH). Maintain a sparse hotspot map keyed by 'col,row' (or rectangular regions) pointing to handlers. This works identically for DOM and canvas surfaces and avoids per-character event listeners. For DOM idle screens you can ALSO just use real <button>/<a> elements where a control is a single clickable token (CB2's approach) - cheaper to reason about and free accessibility.
- Establish a fixed-timestep tick loop (model update) decoupled from a requestAnimationFrame render loop. Idle screens can render lazily (only on state change - no rAF spinning), while the arena renderer runs rAF at 60fps only while a quest is active, then tears down. This keeps idle CPU near zero (important for an 18-20 hour idle game left open in a tab) and reserves the frame budget for quests.
- Keep the model immutable and the renderer dumb. Per the project's coding-style rule, produce a NEW cell buffer each tick rather than mutating; the renderer diffs old vs new buffers. This makes the dirty-cell canvas diff and the DOM patch both trivial and correct, and makes save/replay deterministic.
- Switch strategies on these boundaries: use DOM for Act 0 counter/shop/forge/observatory, the village, and the whole vertical map at all times; switch to the canvas arena ONLY when entering a quest with real-time motion (beanstalk climb, storm front, moon worm, drift combat, ship combat, the sun descent). On-foot quests that are slow/turn-based could stay DOM, but anything with per-frame projectile/asteroid motion (drift combat especially - the Asteroids homage) should be canvas.

---

# Rendering ASCII Text-Art for Candy Box 3 — Architecture Brief

CB3 is pure ASCII, vanilla TS + Vite, single-page, no backend, ~18-20h of play including long idle stretches and real-time quest arenas (side-scroller, vertical climb, zero-G drift combat that is literally an Asteroids homage). The rendering needs are genuinely bimodal, so the recommendation is a **hybrid two-renderer architecture** rather than one technology everywhere.

## 1. Rendering approaches and their trade-offs

**The core tension:** the design doc has two opposite workloads.
- *Idle/menu/map:* huge amount of text, almost none of it changing per frame (the candy counter ticks, a glow pulses), needs text selection, clickable tokens, CSS glow, accessibility.
- *Quest arena:* a bounded grid that fully redraws every frame (a moving avatar, projectiles, splitting asteroids, HP bars), needs 60fps, needs nothing else.

**DOM `<pre>` with `textContent`** — Rebuild the whole grid as one string and assign to `.textContent` each frame. Cheap to write, no per-node overhead, but a full-grid reparse+relayout+repaint every frame does not hold 60fps for an animated arena and kills per-character color/glow (you only get one color for the whole block). Good for *static* art blocks, bad for real-time.

**Spans-per-char** (one `<span>` per cell, CB2-style for colored text) — Gives per-character color and CSS glow and clickability for free, and the DOM only repaints changed spans. This is excellent for the idle UI and the map. It does **not** scale to full-grid updates every frame — thousands of span mutations per frame is exactly the DOM-thrashing case everyone warns about. xterm.js ships a DOM renderer but it is their slowest tier and exists for compatibility, not speed.

**CSS grid of chars** — A grid container with one cell each. Same per-cell-color/click benefits as spans but adds layout cost; rarely worth it over `ch`-based `<pre>`/spans for fixed-width art. Skip.

**`<canvas>` 2D `fillText`** — The right tool for arenas, *but only with a glyph atlas*. Naive per-cell `fillText` every frame is the documented disaster: a canvas data grid spends ~50% CPU in `fillText` because each call crosses the JS/native bridge and re-rasterizes the glyph. Mirko Sertic's well-known result: caching glyphs to an offscreen canvas and blitting with `drawImage` took a Firefox/Linux frame from **10ms to 1ms** and `fillText` CPU from **41% to <1%**. MDN's canvas-optimization guide reinforces this: prerender to offscreen canvas, integer coords, `{alpha:false}`, layered canvases, redraw only differences, and explicitly **avoid `shadowBlur`** and minimize text rendering.

**WebGL / term libraries (xterm.js)** — xterm.js's WebGL renderer uploads a `Float32Array` of cell data plus a glyph **texture atlas** to the GPU; it scales best to very large viewports and high refresh rates. For a CB-sized arena (say 80x40 cells) this is overkill — the 2D-canvas-with-atlas approach is far simpler and already comfortably 60fps. Recommendation: **do not pull in xterm.js or WebGL.** Borrow xterm.js's *idea* (glyph atlas) in ~150 lines of your own canvas code. Reserve WebGL as a future escape hatch only if a finale set-piece needs thousands of simultaneously animating cells.

**Verdict:** DOM (spans + `<pre>`) for everything static; one hand-rolled canvas+atlas renderer for real-time arenas.

## 2. Per-character color and `text-shadow` glow

CB3's glow targets are moonpops, rock candy, and the sun — data-driven from the "flavor is physics" rule, so model a glow as a property of an entity and render it as a CSS class.

- **DOM surfaces:** per-char color via a class on the span; glow via stacked `text-shadow` in that class. **Static `text-shadow` is cheap.** *Animated* `text-shadow` (pulsing the blur/color) forces continuous repaints and is the thing that tanks low-end devices.
- **The GPU-safe pulse:** put the glow on a layer or `::after` pseudo-element that already carries the shadow, then animate **`opacity`** (or `transform`) on that layer — never the shadow values. `filter: drop-shadow()` is GPU-accelerated and an alternative to `text-shadow`.
- **Containment:** wrap any animated-glow region in `contain: paint` (or `content-visibility`) so a pulsing sun cannot trigger document-wide repaints. CSS containment isolates a subtree's layout/paint so changes inside don't reflow/repaint the rest of the page.
- **Accessibility (required):** gate all pulsing behind `@media (prefers-reduced-motion: no-preference)`. 2025 best practice is to *simplify/remove decorative motion* (a pulsing glow is decorative) while keeping the static glow color — do **not** blanket-disable all animation (it can break JS relying on `animationend`).
- **Canvas surfaces:** do **not** use `shadowBlur` (MDN flags it as slow). If a quest needs a glowing glyph, **prerender a glowing variant into the atlas** (rasterize the char with the shadow baked in once) and blit it.

## 3. The long vertical-scrolling map

The map is a vertical cross-section that grows upward as you progress (`│ the beanstalk … ═══╧═══ … ▽ the sugar mines`). It is mostly static text, so keep it in the **DOM**, not canvas — you keep selection, clickable hotspots, and CSS glow.

- **Scroll with `transform: translateY`, not `scrollTop` animation.** translateY runs on the compositor/GPU and is smooth; animating `scrollTop` can show empty frames because the browser scrolls before content renders.
- **Virtualize the strata.** Render only the visible window of strata (+ a small buffer) and offset with translateY. For the long full map, wrap each stratum in `contain: content` and `content-visibility: auto` with a `contain-intrinsic-size` hint so the browser **skips layout/paint for offscreen strata entirely**. Caveat: querying layout (`getBoundingClientRect`/`getComputedStyle`) on a skipped subtree forces it to render early — avoid measuring offscreen strata.
- **Growth model:** append new strata to the model as acts unlock; the page literally extends, matching the design intent of the map "extending the page."

## 4. Monospace font and consistent cell metrics

This is where ASCII games most often look broken across browsers (box-drawing glyphs drifting out of alignment).

- **Unit: `ch`.** In a monospace font `1ch` is the exact advance width of `0`; `60ch` is exactly 60 chars wide. Pair it with a CSS line-height variable for vertical cells. "The Monospace Web" uses `--line-height` as a variable and `max-width: calc(min(80ch, round(down,100%,1ch)))` to keep width a whole number of cells.
- **Stop digit drift:** `font-variant-numeric: tabular-nums lining-nums;` so the candy counter doesn't reflow as numbers change width. `white-space: pre` to preserve runs of spaces in art.
- **Font choice: JetBrains Mono (self-hosted, variable).** "The Monospace Web" chose it specifically because its **box-drawing glyphs stay aligned up to 120% line-height** where most monospace fonts degrade above ~110%. CB3's map uses exactly these characters (`│ ═ ╧ ∴ ◯ ☾ ☀ ▽`), so this matters concretely.
- **Loading:** load via the CSS Font Loading API and render after it resolves: `await document.fonts.load('1rem "JetBrains Mono"')` then first render. This avoids a fallback-font frame that would misalign box-drawing glyphs. Provide a metric-similar fallback in the stack to minimize layout shift. `font-display: swap` causes a FOUT; for an ASCII game where alignment is load-bearing, prefer rendering after the font promise resolves (with a short timeout fallback).
- **Derive cell pixel metrics once** after font load (measure a known string / `1ch`), store as CSS vars and JS constants so **DOM and canvas share identical cell metrics** — critical for click-to-cell math.

## 5. Input and clickable hotspots

- **Pixel-to-cell is integer math** once metrics are known: `col = floor((clientX - gridLeft) / cellW); row = floor((clientY - gridTop) / cellH)`. Works identically for DOM and canvas surfaces; no per-character DOM nodes needed for hit-testing.
- **One delegated listener** on the grid container + a sparse hotspot map keyed by `"col,row"` (or rectangular regions) to handlers. This avoids thousands of listeners.
- **For idle UI specifically**, where a control is a single clickable token, just use real `<button>`/`<a>` elements (CB2's approach) — free accessibility/focus/keyboard, easy to style with the glow classes.

## 6. Recommended ONE architecture for CB3

```
model (immutable Cell buffers, fixed-timestep tick)
        │
        ├── interface Renderer { mount(); render(prev, next); unmount(); }
        │
        ├── DomRenderer      ← idle UI, shop/forge/menus, the vertical map (ALWAYS)
        │     spans+<pre>, ch grid, CSS glow classes, real buttons, translateY virtualized map
        │
        └── CanvasArenaRenderer ← real-time quests ONLY (mounted on quest enter, torn down on exit)
              glyph atlas (offscreen canvas, keyed by char+color), drawImage blits,
              dirty-cell diff, {alpha:false}, integer coords, dpr scaling, no shadowBlur
```

- **Two loops:** a fixed-timestep model tick decoupled from rendering. Idle screens render **lazily on state change** (no rAF spinning — important for an 18-20h game left open in a tab). The canvas arena runs `requestAnimationFrame` at 60fps **only while a quest is active**, then unmounts.
- **Immutable model (per the project's coding-style rule):** each tick produces a *new* cell buffer; both the DOM patcher and the canvas dirty-diff compare old vs new. This makes diffing trivial and keeps save/replay deterministic.
- **Glyph atlas detail:** on arena mount, rasterize each `(char, colorClass)` used by that quest into one offscreen canvas grid; render = `drawImage(atlas, srcX, srcY, cellW, cellH, dstX, dstY, cellW, cellH)` for each changed cell. Glowing glyphs (sun-adjacent quests) are baked variants in the atlas.

## 7. When to switch strategies

| Surface | Renderer | Why |
|---|---|---|
| Act 0 counter, shop, forge, observatory, village | DOM | static text, clickable tokens, glow, selection |
| The vertical map (all acts) | DOM, virtualized, translateY | mostly static, needs hotspots + glow |
| On-foot quests (slow/turn-y) | DOM acceptable | low update rate |
| Beanstalk/vertical climb, storm front | Canvas arena | per-frame motion |
| **Drift combat (Asteroids homage)** | **Canvas arena (mandatory)** | many moving/splitting entities per frame |
| Ship combat, the sun descent | Canvas arena | timed/animated set-pieces |

The switch boundary is simply: **does the grid change every frame? Canvas. Otherwise DOM.**

## Sources
- [Tuning HTML5 Canvas fillText — Mirko Sertic](https://www.mirkosertic.de/blog/2015/03/tuning-html5-canvas-filltext/)
- [Optimizing canvas — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Optimizing_canvas)
- [Improving HTML5 Canvas performance — web.dev](https://web.dev/articles/canvas-performance)
- [I wrote an HTML canvas data grid — ITNEXT](https://itnext.io/i-wrote-an-html-canvas-data-grid-so-you-dont-have-to-d945aa4780b4)
- [Experimental WebGL terminal renderer — microsoft/vscode PR #84440](https://github.com/microsoft/vscode/pull/84440) and [xterm.js WebGL renderer PR #1790](https://github.com/xtermjs/xterm.js/pull/1790)
- [xterm.js overview — DeepWiki](https://deepwiki.com/xtermjs/xterm.js/1-overview)
- [How I Built "The Monospace Web" — Oskar Wickström](https://wickstrom.tech/2024-09-26-how-i-built-the-monospace-web.html)
- [What is the CSS 'ch' Unit? — Eric Meyer](https://meyerweb.com/eric/thoughts/2018/06/28/what-is-the-css-ch-unit/)
- [prefers-reduced-motion — MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)
- [Design accessible animation and movement — Pope Tech](https://blog.pope.tech/2025/12/08/design-accessible-animation-and-movement/)
- [What Is CSS Containment — CSS Wizardry](https://csswizardry.com/2026/04/what-is-css-containment-and-how-can-i-use-it/)
- [content-visibility — web.dev](https://web.dev/articles/content-visibility)
- [Smooth scrolling with VirtualScroll — everyday3d](https://everyday3d.com/smooth-scrolling-with-virtualscroll)
- [5 Reasons to Use DOM Instead of Canvas for UI — Pocket City](https://blog.pocketcitygame.com/5-reasons-to-use-dom-instead-of-canvas-for-ui-in-html5-games/)
- [Candy Box 2 source code](https://github.com/candybox2/candybox2.github.io)