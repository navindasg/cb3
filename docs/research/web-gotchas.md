---
title: "CB3 Browser GOTCHAS Checklist: Long-Session Incremental RPG (2026 Browser Behavior)"
slug: web-gotchas
type: web
---

> A 15-20 hour browser incremental game lives or dies on how it handles time when the tab is backgrounded — and 2026 browsers are far more aggressive about throttling, freezing, and discarding hidden tabs than they were when CB1/CB2 shipped. The single biggest mandate: CB3 must drive ALL resource accumulation, timers, and the comet's "soft real-time floor" from a persisted monotonic-aware timestamp delta computed on focus/load, NEVER from the raw firing of setInterval/rAF. CB2's reference loop (a bare setInterval(fn,1000) that adds a flat amount per tick, with zero offline catch-up) is exactly the anti-pattern to avoid — it silently pauses progress whenever the tab is hidden and freezes entirely on iOS. Web Workers help only with mild desktop throttling and are NOT a substitute for delta catch-up because the whole page (workers included) is frozen/suspended when a tab enters the FROZEN lifecycle state or on iOS Safari. localStorage's ~5MB synchronous quota is fine for CB3's flat key/value save but must be wrapped in QuotaExceededError handling and complemented by saving on the `visibilitychange`->hidden event (the last reliable moment before freeze/discard). Save imports must be schema-validated and clamped (never crash on a hand-edited share string) while preserving the series tradition of editable saves, and the whole real-time engine must be testable via injected ticks + Vitest fake timers + Playwright's Clock API.

### Key findings
- BACKGROUND THROTTLING (2026): All three engines throttle hidden-tab timers. Chrome 88+ has three tiers: minimal (visible or noise in last 30s), regular (1-second checks) when chain count <5 OR hidden <5 min OR WebRTC active, and INTENSIVE (1-MINUTE checks) once a tab is hidden >5 min AND chain count >=5 AND silent >=30s AND no WebRTC. A self-rescheduling setInterval game loop hits the chain-count threshold and gets clamped to once-per-minute. (developer.chrome.com/blog/timer-throttling-in-chrome-88)
- setTimeout minimum-clamp floors differ by browser (Nolan Lawson, Aug 2025): Chrome 139 ~4.2ms, Firefox 142 ~4.72ms, Safari 18.4 ~26.7ms. Safari is materially more throttled. scheduler.postTask() is the lowest-overhead scheduler but is NOT implemented in Safari; MessageChannel.postMessage is the cross-browser fast fallback.
- requestAnimationFrame is PAUSED entirely in background/hidden tabs across Chrome, Firefox, and Safari (no callbacks fire at all) — by design, since nothing is painted. rAF must only drive rendering/animation, never game-state time accounting.
- FROZEN / DISCARDED lifecycle (Page Lifecycle API): When the browser freezes a hidden tab, 'JavaScript timers and fetch callbacks don't run' — and this freezes the WHOLE page including its Web Workers. On iOS Safari the entire tab is suspended in the background. Therefore Web Workers are NOT a reliable background-timing substitute; they only survive the lighter desktop 'hidden-but-alive' throttling, not freeze/discard/iOS-suspend.
- RELIABLE PERSISTENCE MOMENT: unload/beforeunload are unreliable (especially mobile). The 'hidden' state (visibilitychange) is the last guaranteed moment to persist state before freeze/discard/termination. document.wasDiscarded tells you on reload whether the prior page was discarded.
- localStorage: ~5MB per origin (10MB total split with sessionStorage), SYNCHRONOUS (blocks main thread), throws QuotaExceededError. Adequate for CB3's flat key/value save but writes must be try/caught. IndexedDB (async, GB-scale) is warranted only if save grows large (e.g. many save slots, replay logs, big gummy-army rosters) — not needed for a CB2-shaped save.
- EVICTION: Default best-effort storage can be evicted under disk pressure (LRU, all-or-nothing per origin). Safari's ITP deletes script-writable storage (incl. localStorage) for origins with no user interaction in 7 days — a real risk for a game players leave for days. navigator.storage.persist() opts into non-evictable persistent storage.
- DETERMINISM/CLOCK: performance.now() is monotonic (never goes backward, immune to clock changes) but resets to 0 each page load, so it CANNOT measure offline elapsed time. Date.now() (wall clock) is the only way to measure across reloads but is user-manipulable (clock-cheat to fast-forward idle gains). Need both: Date.now() deltas clamped to sane bounds for offline catch-up; reject negative/absurd deltas.
- CB2 REFERENCE LOOP (the anti-pattern): Game.ts uses window.setInterval(oneSecondMethod, 1000) that adds a flat per-tick amount with NO timestamp delta and NO offline catch-up. It silently pauses all production when the tab is hidden and freezes on iOS. Quest loop is a self-rescheduling setTimeout(questMethod, 100) — also throttled when hidden.
- CB2 SAVE MODEL (worth stealing): flat typed registries (bools/numbers/strings maps), every key pre-registered; loading an UNKNOWN key just logs and skips rather than crashing (Saving.ts loadNumber/loadBool/loadString). File-import parses via regex over a 'type name = value' grammar and silently ignores anything unmatched — naturally crash-resistant against edited saves. numberToString/stringToNumber uses parseFloat to survive scientific notation.
- AUDIO AUTOPLAY: An AudioContext created before a user gesture starts 'suspended'; you must call resume() inside a user-gesture handler. The single Act 4 sun-descent track will NOT play if triggered purely programmatically after 18 silent hours — the descent must be initiated by a click/tap that also resumes the AudioContext. iOS is strictest.
- ACCESSIBILITY: Raw ASCII art is read by screen readers as a 'painful reading of lots of punctuation' (W3C H86). Decorative ASCII should be aria-hidden; meaningful ASCII art needs role=img + aria-label describing it. prefers-reduced-motion: reduce must disable glow/animation (text-shadow pulses, comet motion). Never set user-scalable=no/maximum-scale=1 (WCAG violation; iOS ignores it anyway since iOS 10).
- TESTING: Vitest fake timers (vi.useFakeTimers + vi.advanceTimersByTime, backed by @sinonjs/fake-timers) can mock setInterval/setTimeout/rAF/performance/Date for deterministic tick tests. Playwright Clock API (clock.install/setFixedTime/fastForward) controls Date.now()/timers in e2e and must be installed BEFORE navigation. Design the engine so a tick takes an injected dt and clock, so logic is pure and testable without real time.

### Patterns to steal
- CB2's flat typed save registry (bools/numbers/strings maps with pre-registered keys) — loading an unknown/missing key logs-and-skips instead of throwing. This is inherently robust against truncated or hand-edited saves and gives forward/backward save compatibility almost for free.
- CB2's import grammar tolerance: parse the share string by extracting only recognized 'type key = value' entries and ignore everything else, so garbage/extra fields in an edited save never crash the load.
- Using parseFloat for numeric save fields to survive scientific notation (1e21) — relevant because CB3's Act 3 candy counts reach 10^12+.
- CB2's clearAllIntervals() before reloading from a file — always tear down the running loop before swapping in a fresh game state to avoid double-ticking.
- Separate one-second logic loop from the higher-frequency quest/animation loop — but in CB3 decouple BOTH from wall-clock firing by feeding them a computed dt.

### Pitfalls
- DO NOT replicate CB2's setInterval(fn,1000) flat-increment loop. In 2026 it throttles to 1/min after 5 min hidden (Chrome), pauses rAF entirely, and freezes completely on iOS/when tab is frozen — meaning a player who tabs away for an hour loses ~an hour of expected production unless you catch up from a timestamp.
- DO NOT trust Web Workers as a background-timing guarantee. They escape only the mild desktop main-thread throttle; they are frozen with the page in the FROZEN lifecycle state and suspended on iOS background. Treat them as a nice-to-have for smoother foreground/background-desktop ticking, with timestamp-delta catch-up as the real source of truth.
- DO NOT use performance.now() for offline/elapsed time — it resets to 0 per page load. Use Date.now() deltas for cross-reload time, but CLAMP them (reject negatives from clock rollback; cap absurd positives) so a clock-cheat or NTP jump can't mint infinite candies.
- DO NOT hard-gate the comet on wall-clock time (design doc forbids it). The scripted first pass (~5 min after telescope) must be driven by accumulated in-game time that survives reload/backgrounding via timestamp delta, and later passes by event/candy counts with a soft real-time floor — never by waiting on literal new Date().
- DO NOT rely on unload/beforeunload to save — unreliable on mobile and increasingly ignored. Persist on visibilitychange->hidden and also on a periodic autosave.
- DO NOT let a large offline catch-up (e.g. player gone 10 hours) run thousands of synchronous 1-second tick iterations on load — it will freeze the UI. Compute catch-up analytically (closed-form: rate * dt) or in capped chunks, and cap maximum offline time so production curves stay tuned to the §5 wealth targets.
- DO NOT assume localStorage is always writable: it throws in Safari private mode and on quota exhaustion. Wrap every setItem in try/catch and surface a non-fatal 'could not save' state rather than crashing the loop.
- DO NOT ignore Safari ITP 7-day storage eviction — a 15-20h game is exactly the kind players abandon for a week. Call navigator.storage.persist() and strongly encourage manual export of the share string as the durable backstop.
- DO NOT auto-play the Act 4 track programmatically — AudioContext will be suspended. Gate the descent (and the AudioContext.resume()) behind the user's click/tap that begins the bathysphere descent.
- DO NOT dump raw ASCII art to screen readers, and DO NOT disable pinch-zoom. Both are WCAG failures; aria-hide decorative art, label meaningful art, honor prefers-reduced-motion for all glow/animation.
- DO NOT store the save as one giant JSON.parse of untrusted input without schema validation — risk of prototype-pollution and crash on malformed share strings. Validate, clamp ranges, and strip __proto__/constructor keys.

### Recommendations
- P0 — Build the engine around a deterministic tick(dt, now) function that is PURE w.r.t. time: all production = rate * dt. Drive it from a scheduler that, on every wake (focus, visibilitychange->visible, load), computes dt = clamp(Date.now() - lastTickWallClock) and applies catch-up analytically. The setInterval/rAF only decides WHEN to call tick; the amount always comes from the measured delta. This single decision neutralizes background throttling, freeze, discard, and iOS suspension at once.
- P0 — Persist {lastTickWallClock, accumulatedGameTimeMs, all resource counts} on a 10-30s autosave AND on the visibilitychange->hidden event (the last reliable moment). On load, read document.wasDiscarded and always run offline catch-up from the stored wall-clock timestamp.
- P0 — Implement offline catch-up as closed-form math (rate * elapsed), not by looping thousands of ticks, with a configurable MAX_OFFLINE_MS cap (e.g. tune against the §5 curve) and clamp dt to >=0 (reject clock rollback). Show a 'while you were away you earned X' summary on return.
- P0 — Drive the comet's scripted-first-pass and soft real-time floor off accumulatedGameTimeMs (which survives reload/background via the same delta machinery), plus event/candy counters — never raw wall-clock comparisons. This satisfies the design doc's 'NEVER hard wall-clock gated' rule by construction.
- P1 — Keep the save as a flat typed key/value registry (steal CB2's pattern) serialized to localStorage with try/catch around setItem for QuotaExceededError; degrade gracefully (mark 'unsaved', keep playing). Reserve IndexedDB only if save size or slot count grows beyond a few hundred KB.
- P1 — Validate every imported/loaded save with a Zod schema: known keys only, numeric ranges clamped, NaN/Infinity rejected, __proto__/constructor stripped. On any unknown/missing key, fall back to the registered default (CB2's log-and-skip behavior) so hand-edited shareable saves never crash — preserving series tradition without over-engineering anti-cheat.
- P1 — Call navigator.storage.persist() on first interaction to opt out of best-effort eviction, and make the exportable share string prominent so players have a durable backup against Safari's 7-day ITP wipe and storage-pressure eviction.
- P1 — Gate the single Act 4 audio track behind the user gesture that starts the descent; create the AudioContext lazily and call resume() inside that handler. Verify on iOS Safari specifically.
- P2 — Optional: run a Web Worker heartbeat to keep foreground/desktop-background ticking smooth, but treat it strictly as an optimization layered on top of timestamp catch-up, not a correctness dependency (it freezes with the page).
- P2 — Accessibility pass: aria-hidden on decorative ASCII, role=img + aria-label on meaningful ASCII scenes/maps, a @media (prefers-reduced-motion: reduce) block that sets animation:none on all glow/comet/sun effects, viewport = 'width=device-width, initial-scale=1' (never user-scalable=no), and ensure rem/em font sizing so OS font-scaling works. Provide a horizontal-scroll container for wide ASCII on narrow mobile.
- P2 — Testing strategy for 80%+ coverage: (a) Unit-test the pure tick(dt, now) and catch-up math with plain numbers — no fake timers needed. (b) Integration-test the scheduler + save round-trip with Vitest fakeTimers (mock setInterval/setTimeout/Date/performance) and assert offline catch-up after advancing virtual time. (c) Playwright e2e for critical flows (Act 0 -> seed -> beanstalk; save export/import; comet first pass; Act 4 audio gesture) using clock.install() before navigation to fast-forward hours deterministically. (d) Add an explicit test that backgrounding (visibilitychange) then advancing wall-clock yields correct catch-up, and that clock-rollback yields zero gain.

---

## CB3 GOTCHAS CHECKLIST — Long-Session Incremental RPG (verified against 2026 browser behavior)

Design doc reviewed at `/Users/navindasgupta/workspace/cb3/docs/DESIGN.md`. Reference architecture studied at `/Users/navindasgupta/workspace/cb3/reference/candybox2/code/main/` (notably `Game.ts`, `Saving.ts`, `LocalSaving.ts`, `main.ts`).

---

### 1. BACKGROUND-TAB THROTTLING — the defining problem (P0)

A 15-20h game is played in a tab the user constantly leaves. 2026 browsers are aggressive:

- **Chrome 88+ (still current model in 2026)** has three throttle tiers for `setTimeout`/`setInterval` in hidden tabs:
  - *Minimal*: page visible OR made noise in last 30s — effectively unthrottled (sub-4ms timers clamped to 4ms when chain count >=5).
  - *Regular (1-second checks)*: when none of the minimal conditions hold AND any of (chain count <5, hidden <5 min, WebRTC active).
  - *Intensive (1-MINUTE checks)*: ALL of (hidden >5 min) AND (chain count >=5) AND (silent >=30s) AND (no WebRTC). A self-rescheduling game loop trivially reaches chain count >=5, so a CB2-style loop is clamped to **once per minute** after 5 minutes hidden.
- **Minimum setTimeout clamps differ** (Nolan Lawson, Aug 2025): Chrome ~4.2ms, Firefox ~4.72ms, Safari ~26.7ms. `scheduler.postTask()` is the cheapest scheduler but is **not in Safari**; `MessageChannel.postMessage` is the fast cross-browser fallback.
- **requestAnimationFrame is fully PAUSED** in hidden tabs in all three engines (no callbacks at all).
- **FROZEN / DISCARDED state (Page Lifecycle API)**: when frozen, "JavaScript timers and fetch callbacks don't run" — and this includes Web Workers (the whole page is frozen). **iOS Safari fully suspends background tabs.**

**Consequence for the reference loop**: `Game.ts` lines 166-168 do `window.setInterval(this.oneSecondMethod.bind(this), 1000)` and `setTimeout(questMethod, 100)`. `oneSecondMethod` (lines 795-805) adds a flat per-tick amount and autosaves — **no timestamp delta, no offline catch-up**. In 2026 this means production silently throttles/pauses while hidden and freezes on iOS. **CB3 must not copy this.**

**Mitigation (the core architectural mandate):** Make the engine a pure `tick(dt, now)` where all production = `rate * dt`. The interval/rAF only decides *when* to call; the *amount* is always derived from a measured wall-clock delta. On every wake — `load`, `focus`, `visibilitychange -> visible`, and each interval fire — compute `dt = clamp(Date.now() - lastTickWallClock)`, apply catch-up, then store the new `lastTickWallClock`. This neutralizes throttling, freezing, discarding, and iOS suspension in one stroke. A Web Worker heartbeat is optional smoothing only — never the correctness source.

### 2. STORAGE — localStorage limits, quota, eviction (P1)

- **localStorage**: ~5MB per origin (10MB shared with sessionStorage), **synchronous** (blocks main thread), throws `QuotaExceededError`. Fine for CB3's flat key/value save (CB2's entire save is a few KB of typed scalars). Wrap every `setItem` in try/catch; degrade to an 'unsaved' indicator rather than crashing. CB2 already does this (`LocalSaving.ts` lines 38-69) but checks the deprecated `DOMException.QUOTA_EXCEEDED_ERR` constant — in CB3 check `e.name === 'QuotaExceededError'`.
- **IndexedDB** (async, GB-scale, structured) is warranted ONLY if the save outgrows localStorage: many save slots, replay/event logs, large gummy-army rosters, or storing the share string history. A CB2-shaped save does not need it.
- **EVICTION**: default best-effort storage is evicted under disk pressure (LRU, all-or-nothing per origin). **Safari ITP deletes script-writable storage (incl. localStorage) after 7 days with no user interaction** — a real hazard for a game players abandon for a week. Call `navigator.storage.persist()` and make the exportable share string prominent as the durable backstop.

### 3. DETERMINISM & TIME (P0)

- `performance.now()` is **monotonic** (never backward, immune to clock changes) but **resets to 0 each load** — useless for offline elapsed time. Use it only for intra-session frame timing/animation.
- `Date.now()` (wall clock) is the only cross-reload measure but is **user-manipulable**. Idle games that rely on it are clock-cheatable. Clamp: reject `dt < 0` (clock rollback / NTP), cap `dt` at `MAX_OFFLINE_MS` tuned to the §5 wealth curve.
- **Comet (design doc §8/§22)**: implement against `accumulatedGameTimeMs` (which survives reload/background through the same delta machinery) plus event/candy counters, with a soft real-time floor. The scripted ~5-min-after-telescope first pass is "5 minutes of accumulated game time," NOT `new Date()` arithmetic — satisfying "NEVER hard wall-clock gated" by construction. Later passes: event/candy-count driven, floor only.
- **Surviving reload & backgrounding**: persist `{lastTickWallClock, accumulatedGameTimeMs, resources, comet/timer state}` on a 10-30s autosave AND on `visibilitychange -> hidden` (the last reliable moment; `unload`/`beforeunload` are unreliable on mobile). On load, check `document.wasDiscarded` and always run offline catch-up.
- **Catch-up must be analytical**, not a loop of thousands of 1s ticks (that freezes the UI for long absences). Use closed-form `rate * elapsed` (or capped chunks for nonlinear systems), show a 'while you were away' summary.

### 4. MOBILE, TOUCH, ASCII ACCESSIBILITY, AUDIO (P2)

- **Screen readers**: raw ASCII art reads as "a painful reading of lots of punctuation" (W3C H86). `aria-hidden="true"` on decorative ASCII (glows, borders); `role="img"` + descriptive `aria-label` on meaningful art (the vertical map, boss scenes). The scrolling vertical map needs a text description of where the player is.
- **prefers-reduced-motion**: `@media (prefers-reduced-motion: reduce) { animation: none; }` to kill glow pulses (moonpops, rock candy, the sun), comet motion, and the Act 4 descent animation. The text-shadow glow can stay static; only the *animation* must stop.
- **Viewport / zoom**: `<meta name="viewport" content="width=device-width, initial-scale=1">`. NEVER `user-scalable=no` / `maximum-scale=1` (WCAG violation; iOS ignores it since iOS 10). Use `rem`/`em` font sizes so OS font-scaling works. Provide a horizontal-scroll container for wide monospace ASCII on narrow screens (don't let it reflow/wrap and shatter the art).
- **Touch**: tap targets >=44px; the CB1-style "throw candies on the ground," shop buttons, and the typed-secret text box all need touch-friendly equivalents (a visible focusable input for the hidden text-box secrets, since mobile has no physical keyboard until focused).
- **Audio (the single Act 4 track, §2a/§8)**: an `AudioContext` created before a user gesture is **suspended**; it will not play if triggered purely programmatically after 18 silent hours. Gate both the descent AND `audioContext.resume()` behind the user's click/tap that begins the bathysphere descent. Test on iOS Safari (strictest). Create the context lazily on that gesture.

### 5. SAVE SECURITY vs EDITABLE SAVES (P1)

Series tradition = shareable, editable saves (design doc §20). Do NOT over-engineer anti-cheat; DO prevent crashes:

- **Steal CB2's robustness** (`Saving.ts`): flat typed registries (bools/numbers/strings), every key pre-registered, and loading an unknown/missing key just logs-and-skips (lines 228-256) rather than throwing. The file-import path (`Saving.ts` lines 140-168) regex-extracts only recognized `type key = value` entries and ignores the rest — naturally crash-resistant against edited share strings. It uses `parseFloat` (line 212) to survive scientific notation, which matters because Act 3 reaches 10^12+.
- **Add for CB3**: validate imports with a Zod schema — known keys only, numeric ranges clamped, reject `NaN`/`Infinity`, strip `__proto__`/`constructor` to block prototype pollution (a documented 2025 risk with untrusted JSON). On any invalid field, fall back to the registered default. Clamp clock-derived offline gains as in §3. That is sufficient: crash-proof, mildly cheat-resistant, still fully editable.

### 6. TESTING A REAL-TIME GAME (P1; target 80%+)

- **Design for testability**: the pure `tick(dt, now)` and `computeOfflineCatchup(elapsed, rate, cap)` take time as arguments — unit-testable with plain numbers, no timers.
- **Vitest fake timers** (`vi.useFakeTimers()` + `vi.advanceTimersByTime()`, backed by `@sinonjs/fake-timers`) can mock `setInterval`/`setTimeout`/`requestAnimationFrame`/`performance`/`Date` for the scheduler + save round-trip integration tests. Assert that advancing virtual time, or simulating `visibilitychange` then jumping `Date.now()`, produces the correct catch-up — and that clock-rollback yields zero gain.
- **Playwright Clock API** (`clock.install()`, `setFixedTime`, `fastForward`) for e2e — install BEFORE `page.goto`. Critical flows: Act 0 -> falling-star seed -> beanstalk reveal; save export/import (incl. a deliberately corrupted share string that must not crash); comet first pass at +5 min game time; the Act 4 audio gesture; an offline-catch-up scenario (background, fast-forward hours, return).
- Keep RNG seedable (CB2 has `Random.ts`) so combat/drift/quest tests are deterministic.

---

## Prioritized summary
- **P0 (architecture, do first):** delta-driven pure tick + offline catch-up from persisted `Date.now()`; persist on `visibilitychange->hidden`; comet on accumulated-game-time not wall clock; clamp deltas.
- **P1:** robust flat save registry + Zod-validated imports; QuotaExceededError handling; `navigator.storage.persist()` + prominent export; full test pyramid to 80%+.
- **P2:** ASCII a11y (aria-hidden/role=img), prefers-reduced-motion, correct viewport (no zoom-disable), touch targets, gesture-gated Act 4 audio.

Sources: developer.chrome.com/blog/timer-throttling-in-chrome-88; developer.chrome.com/docs/web-platform/page-lifecycle-api; nolanlawson.com/2025/08/31/why-do-browsers-throttle-javascript-timers; developer.mozilla.org Storage_API/Storage_quotas_and_eviction_criteria and Page_Visibility_API; w3.org/WAI/WCAG21/Techniques/html/H86; developer.mozilla.org prefers-reduced-motion; chromium.org autoplay-policy; vitest.dev/config/faketimers; playwright.dev/docs/clock; geekextreme.com idle-games-offline-progression-math; bugs.webkit.org/show_bug.cgi?id=150515 (iOS suspension); plus CB2 source at reference/candybox2/code/main/{Game,Saving,LocalSaving,main}.ts.