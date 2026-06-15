# CANDY BOX 3 — Design Document
### *working title: "candy box 3" — in-game, it never says its own name. The first screen says "You have 1 candy."*

An honorary sequel to aniwey's Candy Box (2013) and Candy Box 2 (2013). Browser-based ASCII incremental-RPG. Target scope: comparable to CB2 (~14 zones, ~13 quests, ~30 secrets, ~15-20 hours to ending). Premise: the medieval candy kingdom goes to space without ever modernizing.

---

## 1. Design Pillars

1. **The game pretends to be nothing.** Opens as a bare candy counter. Every system is a reveal. The genre-shift moment (the beanstalk) must land like CB1's map reveal did.
2. **Medieval ascension, never modernization.** No NASA, no chrome, no screens. Wizards are the physicists. The launch facility is a trebuchet. Knights wear fishbowl helms over bucket helms.
3. **Flavor is physics.** A candy's flavor properties ARE its physical properties. This one rule generates the entire tech tree (see §4).
4. **Secrets are a first-class system.** Hidden inputs, riddles, absurd interactions, meta-content. Budget: ~30 secrets, 4 hidden bosses.
5. **Finite, authored, poignant ending** — with a choice, in series tradition. Number-go-up serves the story; it is not the story.
6. **Death is cheap and funny.** No punishment beyond walking back. Every death message is a joke.

---

## 2. Tone & Writing Style Guide

- Second person, present tense, deadpan. "You have 3 candies."
- Names are lowercase and matter-of-fact, aniwey-style: *the squirrel, the astronomer, the toll giant, the jawbreaker moon.* Proper nouns are rare and earned (Captain Sourbeard gets a name; the blacksmith doesn't).
- The game never explains itself. No tutorials. Buttons appear; players press them.
- Jokes land driest at scale: *"You have 1,000,000,000 candies. The number has stopped meaning anything to you."*
- NPCs are sincere, slightly weary, occasionally wrong with great confidence (see: the scholar, §15).
- French flavor in item names where it's funny (series tradition: *pains au chocolat*).

### 2a. Art & Audio Direction (locked)

- **Pure ASCII. No pixel art, ever.** The constraint is the aesthetic; pixel art would break the illusion that this lives in a text terminal. All visual flair comes from CSS — `text-shadow` glows (moonpops, rock candy, the sun), color, and clever typographic/whitespace layout. The map is a 2D ASCII landscape the page pans across, extending upward as acts unlock.
- **99% silent**, like both predecessors — silence makes the text feel louder. **Exactly one** chiptune/8-bit track exists in the entire game, and it triggers only at the moment of the Act 4 descent into the sun. After ~18 hours of silence, sound itself becomes the event. Nothing else in the game makes noise.

---

## 3. World Structure — A Cross-Section That Grows Upward

The map is a cross-section, not a top-down view, and it extends upward as you progress. The macro structure below is the north star: field at the bottom, the sun at the top, the kingdom climbing the page across the acts.

> **Implementation note (Act 0 rework, 2026-06):** the realized map is a **2D flag-revealed `OverworldDef`** (`src/content/overworld.ts` — regions placed at world-cell `(x,y)`, each gated by a reveal flag, panned in 2D), **not** a pure bottom-to-top vertical scroll. Act 0's ground spreads **horizontally** (your field → the forest → the village → the sugar mines) while the world still extends **upward** via the beanstalk (garden → climb → the sky → space), so the genre-reveal still lands. The earlier `Stratum` registry (ADR-001 D10) was retired in favour of `OverworldDef`; **horizontal is canonical**.

```
                  ☀  the sun                          [Act 4 — finale]
              ⊙ ⊙ the dyson scaffold ⊙ ⊙              [Act 3]
          · ✦ ·  the star sea (comet path) · ✦ ·
     ◯ the mint planet        ◯ the sour planet       [Act 2]
          ∴ ∵ ∴  the rock candy reef  ∴ ∵ ∴           [Act 2]
                  ☾  the jawbreaker moon              [Act 1–2]
              ~ ~ ~  the storm front  ~ ~ ~           [Act 1]
             ☁  cumulus commons (cloud village)       [Act 1]
                  │
                  │  the beanstalk
   ═══════════════╧═══════════════════════════════
    your field · the village · the observatory        [Act 0]
                  ▽  the sugar mines                  [Act 0]
```

**Traversal ladder** (each is a progression gate):
beanstalk (clouds) → cotton candy balloon (moon) → the candied galleon (belt + planets) → comet-surfing (fast travel between strata) → the peppermint bathysphere (into the sun).

---

## 4. Flavor Is Physics — The Rulebook

Every material's behavior follows its flavor. Apply this rule when inventing anything new.

| Flavor/Material | Physical property | Used for |
|---|---|---|
| Pop rocks | Explosive | Propellant, bombs, double-jump boots |
| Cotton candy | Lighter than air | Balloons, sails, void-suit lining |
| Licorice | Tensile, strong | Rope, cables, beanstalk genetics, whips |
| Mint / peppermint | Cooling | Heat shielding (sun descent), coolant potions |
| Caramel | Sticky, slow, molten when hot | Adhesive, slow-zones, gravity wells, the sun's core |
| Sour | Corrosive | Acid hazards, etching, armor degradation |
| Jawbreaker | Extremely hard, layered | The moon, hull plating, tool-tier gating |
| Rock candy | Crystalline | Magic focus, "crystallized starlight" in raw form |
| Gummy | Elastic, moldable, alive (?) | Creatures, army units, crew |
| Nougat | Dense, load-bearing | Heavy ammunition, construction |
| Sugar glass | Transparent, brittle | Windows, shields, lenses |

---

## 5. Resources & Economy

| Resource | Tier | Source | Primary sinks | First appears |
|---|---|---|---|---|
| Candies | 1 | Passive gen, quests, farms | Everything; feeding the beanstalk; the sphere | 0:00 |
| Lollipops | 2 | Planted/farmed (classic) | Magic regen, recipes, secrets | Act 0 |
| Chocolate | 3 | Rare drops, squirrel rewards, quests | Enchanting items | Act 0 (rare) |
| Caramel | 3 | Boil 100 candies → 1 caramel | Automation gizmos, ship hull, adhesives | Act 0 (late) |
| Rock candy | 4 | Sugar mines, asteroids | Spell foci, weapons, sphere struts | Act 0 |
| Cotton candy | 4 | Shearing cloud sheep (idle: ~1/sheep/10 min) | Balloon, sails, void suit | Act 1 |
| Pop rocks | 5 | Moon vents, the comet | Cannon ammo, propellant, boots | Act 1–2 |
| Licorice | 5 | Beanstalk cuttings, moon worm drops | Cables, whip, sphere tethers | Act 1 |
| Peppermint | 6 | The mint planet | Heat plating (hard gate for the sun) | Act 2 |
| Stardust | 7 | Comet, star sea, sphere collectors | Endgame craft, the fossil (secret) | Act 3 |
| Gummies | — | Molded: 50 candies + 1 flavor essence | Army units, ship crew | Act 1–2 |

**Wealth curve targets** (tune in playtesting; each act ≈ ×100 scale):
- Act 0 ends ~10⁵ total candies earned
- Act 1 ends ~10⁷
- Act 2 ends ~10⁹
- Act 3 (sphere construction) ends ~10¹²
- Candy/sec: 1/s base → ~100/s (Act 1) → ~10k/s (Act 2) → ~1M+/s (Act 3, solar collectors online)

---

## 6. Production & Idle Systems

1. **Candy generation** — starts at 1/s. Upgrades: grandma's recipes (bought), field expansions, later automated by gummy farmhands.
2. **The lollipop farm** — classic. Plant lollipops, they multiply over time. Mid-game: moon soil grows *moonpops* (cosmetic glow + small magic bonus).
3. **The caramel cauldron** — boil candies into caramel. Tier 2 (requires oven mitts) unlocks *automation gizmos*: sticky conveyor, self-stirring spoon, etc. This is the industry step.
4. **Gummy molds** — see §12.
5. **Cloud sheep paddock** — passive cotton candy. Sheep wander; shearing is a click, auto-shears purchasable.
6. **The moon mine** — strata-based (see jawbreaker moon, §8).
7. **The dyson scaffold** — the endgame megaproject sink. Five stages, each a colossal multi-resource cost, each visibly drawn onto the sun's ASCII art as it completes. Stage 1 unlocks *solar candy collectors* — the biggest passive income jump in the game, which is what funds stages 2–5. (See Act 3.)

---

## 7. Combat Systems

**A. On-foot quests** — CB2-style ASCII side-scroller: walk right, auto-attack on contact, HP bar, potions/spells castable. The engine CB2's repo demonstrates; reuse the pattern.

**B. Vertical quests** — same engine rotated 90°. Introduced by the beanstalk climb. Gravity pulls down; gusts push; some zones reverse it.

**C. Drift combat (zero-G)** — the new signature. In belt/EVA quests there is no gravity and no walking. The **gumball cannon** is both weapon and engine: firing propels you backward (Newton's third law as a resource decision). Ammo = gumballs (cheap, crafted from candies). Asteroids are destructible and split into smaller asteroids (yes, that's an Asteroids homage in ASCII). Running out of ammo mid-drift: *"You drift forever. A gummy alien waves politely."* → respawn at ship.

**D. Ship combat** — the candied galleon. Broadside exchanges (timing-based), boarding actions (drops into on-foot combat mid-quest). Ship stats from hull/sails/cannons/figurehead/crew (§13).

**Death**: respawn at last safe zone, lose nothing. Every death has a bespoke message (§19).

---

## 8. Progression Spine — Act by Act

### ACT 0 — The Ground (target: 20–25 min). *Plays it completely straight.*

The first five-to-eight minutes mirror CB1 beat-for-beat as a deliberate fakeout: counter, eat candies, throw candies on the ground, a shop appears. **Compressed deliberately**: 2026 attention spans won't tolerate 45 minutes of a bare screen before the magic, and the genre-whiplash lands just as hard at half the length. The sugar mine sequence is accelerated (faster veins, quicker descent) to hit the pivot inside ~20–25 min while still feeling earned.

**Zones:** your field & house · the village · the sugar mines · the observatory.

- **Your field**: candy counter, eat/throw buttons, grandma. Grandma gives the wooden spoon ("it was your grandfather's"). Her mantle has an old sword on it that you cannot take. Yet. (§17, §18.)
- **The village**: the shop (items, escalating absurdity), the forge (the blacksmith; weapon upgrades), the tavern (rumors = the hint system; one free rumor per real-time hour), three houses (one has the gummy-worm cellar quest — the CB2 rat-cellar homage; one has a locked attic; one has the mailbox — letters arrive at milestones from "the first climber," see §15), the well.
- **The sugar mines** (quest 1): below the village. Candy bats, sugar golems. Rock candy veins. At the bottom: **the fossil** — a dragon skeleton embedded in candy stone. It cannot be interacted with meaningfully yet. If fed exactly 1 candy, it twitches. (Foreshadowing: §15, §17.)
- **The observatory**: the astronomer (wizard-physicist; sells the beginner's grimoire, the telescope, and disapproval). The telescope, once bought, reveals the ambient counter in the corner of the screen: **"stars in the sky: 8,128."** It is already, very slowly, ticking down. The game never mentions this. Players will.
- **The cauldron** is in the observatory basement — "my sister's old lab." A portrait of the CB2 sorceress hangs on the wall.

> **Act 0 rework — implementation divergences (2026-06).** The shipped Act 0 differs from the prose above in a few deliberate, recorded ways:
> - **The overworld is a 2D, panned landscape, horizontal-first** (your field → the forest → the village → the sugar mines), still extending upward via the beanstalk — see §3.
> - **A gated access fight guards the sugar mines.** A rock-candy *sentinel* out-reaches grandma's spoon (range 2.8 vs 2), so the mines require a forge upgrade — the candy-cane *bow* (range 5) clears it from outside its swing. The mines themselves are a loot-run; the gate is the fight. (One-life: a death sends you back to gear up.)
> - **The forge is a varied arsenal, not a sword ladder** — wooden sword, candy-cane bow (ranged; foreshadows space tech), licorice whip, iron sword, jawbreaker mace; the last two need rock candy from the mines.
> - **Baseline field income is 0.5/s** (the field always trickles) and **grandma's spoon is now a WEAPON** (with a small passive trickle too), not the sole income source — this fixes the dead start.
> - **Eating heals:** each candy eaten restores 1 HP (clamped to the lifetime-derived max). CB2's eating did not heal.
> - **Mana is deferred:** it is NOT in the Act-0 progressive-GUI ladder (status bar → health bar → map); it arrives with the grimoire.
> - **The map is gated behind the "request a feature" ladder** (it is the capstone unlock), not always-on.
> - **Secrets are interaction-based, not typed.** The typed secret-input box was removed (reverses ADR-001 §7.6): the fossil (feed exactly 1 candy), the well (throw a candy in), and the great leaf (hold exactly 1 lollipop) are discovered through interaction.

**Act gate / THE PIVOT:** after ~20–25 min of play (trigger: telescope owned + ~50k total candies earned), a falling star lands in your field. The counter ticks: 8,127. In the crater: **a seed.** The astronomer has theories, all wrong. Planting it opens the beanstalk garden — feed it candies and it grows. At 1,000 candies fed it reaches the clouds, and the map *extends upward*. This is the genre reveal. It must feel like CB1's map appearing.

### ACT 1 — The Sky (target: hours 1–4)

**Zones:** the beanstalk · cumulus commons · the storm front · the jawbreaker moon.

- **The beanstalk climb** (quest 2): first vertical quest. Gusts, gummy aphids, cloud rats. Reaching the top permanently turns the beanstalk into an elevator (fast travel home). Further feeding (10k / 100k / 1M candies) thickens it: faster elevator, licorice cuttings harvestable.
- **Cumulus commons** — the cloud village. Cloud sheep paddock (cotton candy income). The balloon workshop (craft the cotton candy balloon: 500 cotton candy + 50 licorice → reach the moon). **The toll giant** sits on the only bridge upward: pay 100,000 candies or fight him (the troll-bridge homage; fighting him is intentionally brutal this early; paying is fine; he's polite either way).
- **The storm front** (quest 3): lightning hazards, corrosive sour rain (introduces armor degradation), updrafts requiring the *fizzy lifting soda*. Boss: **the thunderhead djinn** — drops the **bottled tempest** (item: summon a storm once per fight) and storm-silk (sail tier 2).
- **The jawbreaker moon**: the big Act 1 destination, by balloon. Everyone in the village assumed it was cheese; it is a jawbreaker. **Strata mining**: each colored layer is harder and *breaks your current pick* (tool-tier gating: candy pick → iron pick → rock candy drill → the moonbreaker).
  - **The lunar lighthouse**: kept by a cyclops ("my grandfather kept one by the sea" — CB2 homage). Teaches celestial navigation → prerequisite for the galleon.
  - **Quest 4 — the moon worm**: a colossal gummy worm eating the strata from inside. Fight it in the tunnels it leaves. Drops industrial-grade licorice + a mold (worm).
  - **Quest 5 — the hollow core**: dig to the exact center. Echo puzzle. The core chamber is empty, spherical, and warm. Something hatched here long ago. (Lore: §15. The game says nothing.)

**Act gate:** lighthouse navigation learned + first vacuum gear: the blacksmith proudly hammers a **fishbowl helm** onto a gorget. It has a goldfish in it if you found the Konami code (§18).

### ACT 2 — The Void (target: hours 4–10)

**Zones:** the sky port · the rock candy reef (asteroid belt) · the comet · the sour planet · the mint planet.

- **The sky port** — built on the moon's far side. The shipwright takes your commission: **the candied galleon** (major sink: ~5M candies, 10k caramel, 5k licorice, 1k jawbreaker plate, 2k cotton candy sails). Player names the ship. (Naming it "Candy Box" has a consequence: §18.)
- **The rock candy reef** (quests 6–7): drift combat introduction, then escalation. Destructible asteroids → rock candy. **The space squirrel** floats here in an acorn-shaped capsule, no explanation given, mild disappointment expressed that it took you this long. Five riddles + one meta-riddle about the first two games. Rewards ladder → **the acorn of knowledge** (reveals secret hints on the map).
- **Pirates** (quest 8): **Captain Sourbeard** and the *Black Lollipop*. Ship combat → boarding. Beating him three times across the act has a consequence (§17). His parrot can be pickpocketed (gummy parrot: crew morale +1).
- **The comet** — **hybrid timing, not a strict clock.** The first arrival is scripted to occur ~5 minutes after the player buys the telescope, guaranteeing they witness the mechanic. Subsequent passes are driven by in-game event counts / candies generated (with a soft real-time floor so it feels celestial), never a hard real-world wall-clock gate — pop rock progression must never be blocked waiting on the literal clock. Land on it to harvest pop rocks + stardust and to *ride it* between strata (fast travel). Miss a pass and the next one comes around on schedule.
- **The sour planet** (quest 9): floating platforms in corrosive gas; armor degrades without mint coating. Inhabited — **the gummy folk**, first alien contact, entirely friendly, mildly baffled by you. They teach **flavor fusion** (two-flavor gummies, §12) and trade molds. Deep in the gas: **the sour kraken** (the kraken homage; optional but drops the kraken crown, §10).
- **The mint planet** (quest 10): ice labyrinth. The **frost wyrm** boss — a dragon that froze instead of igniting (players who've been reading the lore will feel the chill of recognition; §15). Source of **peppermint** — the hard gate for Act 4. Mining it is the act's tail-end grind.

**Act gate:** galleon fully upgraded (hull tier 3) + 10,000 peppermint banked.

### ACT 3 — The Scaffold (target: hours 10–18). *The idle wall, with dread.*

- **The dyson scaffold**: five construction stages around the sun. Each stage is drawn onto the sun's ASCII art as it completes. Costs escalate ~×10 per stage (stage 1: ~10⁹ candies + materials; stage 5: ~10¹²). Stage 1 unlocks **solar candy collectors** — passive income jumps ~×100, which is what makes stages 2–5 reachable. Stages 2–4 unlock: gummy work-crews (automation), the star sea (new harvesting zone), and *the observation deck* (see below). Stage 5: **the descent port** and the peppermint bathysphere.
- **The star counter accelerates.** Through Act 3 the tick-down becomes noticeable, then alarming. From the observation deck, players can *watch* a star go out in real time. The astronomer, who has been comic relief, stops being funny: *"They are not burning out. They are being eaten."* First sight of **the star-eater**: a silhouette against a dying star, through the telescope. It is very far away. It is getting closer.
- This act is deliberately the cleanup window: hidden bosses, secrets, the squirrel's last riddle, maxing the gummy army — the game quietly assembles the player's full strength because the finale uses all of it.

### ACT 4 — The Sun (target: hours 18–20). *Finale.*

**Quest 11 — the photosphere**: descend in the bathysphere. **This is where the game's only audio track triggers** (§2a) — the first and only sound after ~18 silent hours. Heat gauntlet; mint coolant + peppermint plating both required. Caramel flares, sugar-glass storms.

**Quest 12 — the caramel core**: everything is molten caramel. At the center: not a furnace. An egg. And curled inside the last shell-layer, **the solar dragon** — a child, half-hatched, scared. It has been keeping the light on because that is what the egg does. CB1's dragon, CB2's dragon, the fossil, the frost wyrm — all of it locks into place: **dragons are larval stars** (§15).

**Quest 13 — the star-eater arrives.** It has been coming the whole game; the sun is the last bright thing in this region. Final battle in three phases: galleon phase (with your fleet/army deployed), on-foot phase on the creature itself, and the core phase defending the egg. The player uses everything the game gave them. Mid-fight reveal: the star-eater's "HUD" flickers into view — *it has a candy counter.* It says: **"You have 8,101 stars."** It eats stars the way you eat candies. It is you, at scale, never having stopped.

**THE CHOICE** (after victory — series tradition):

1. **Let it hatch.** The dragon breaks the shell. The sun goes dark — and the dragon ascends, burning, and begins *relighting the eaten stars one by one.* The counter ticks UP for the first time in the entire game. Your kingdom lives by candlelight and lollipop-glow, and the night sky slowly refills. The poignant ending.
2. **Feed the sun.** Sacrifice your entire candy hoard — the literal number on your save — to the egg. The dragon sleeps, sated; the sun stays lit; the star-eater, transformed by defeat and offering, becomes its guardian. Status quo, warm, slightly melancholy. The counter stops ticking. It never goes back up.
3. **Eat it.** (Available only if the player's lifetime candies-eaten exceeds a threshold.) You eat the sun. Black screen. The night sky. *"You have 8,100 stars."* The counter begins ticking down. **This is the NG+ hook**: a new run begins on a darker save where you are the thing in the telescope.

---

## 9. Quest List (13 + hidden)

1. The sugar mines · 2. The beanstalk climb · 3. The storm front · 4. The moon worm · 5. The hollow core · 6–7. The rock candy reef I & II · 8. Sourbeard & the Black Lollipop · 9. The sour planet (+ kraken, optional) · 10. The mint labyrinth · 11. The photosphere · 12. The caramel core · 13. The star-eater.
Plus: the gummy-worm cellar (intro mini-quest), the toll giant (fight or pay), and four hidden boss encounters (§17).

---

## 10. Items & Equipment

**Weapons** (forge upgrades + drops):

| Weapon | Source | Gimmick |
|---|---|---|
| wooden spoon | grandma | it's a spoon |
| candy cane shiv | shop | fast |
| iron sword | forge | honest |
| caramel-dipped blade | forge + caramel | hits apply slow |
| rock candy claymore | forge + mine | heavy, +crystal dmg |
| the gumball cannon | sky port | ranged; IS the drift engine |
| licorice whip | moon worm drop | reach; pulls items/enemies; traversal |
| pop rock pike | forge + pop rocks | explosive crits (costs pop rocks) |
| the moonbreaker | deepest moon stratum | weapon + final mining tier |
| stardust rapier "twinkle" | star sea craft | crit scales as your HP drops |
| **"wrapper," grandma's sword** | SECRET (§18) | scales with lifetime candies eaten |

**Armor track:** apron → leather jerkin → knight plate → **fishbowl helm** (vacuum gate) → cotton-lined void suit → **peppermint plating** (sun gate). Chocolate enchants any piece (CB2 tradition).

**Hats** (separate slot, because hats): pointed wizard hat (astronomer's gift, +magic) · Sourbeard's tricorn (+crew morale) · **the kraken crown** (sour kraken drop; octopus-king-crown homage; enchantable two ways) · the squirrel's spare acorn cap (+luck, very small, very good).

**Misc:** magnet boots (walk on hulls/asteroids) · pop rock boots (double jump, costs pop rocks) · oven mitts (caramel tier 2 + sun tier 1) · **heart gummy** (revive once; heart-plug homage) · the pogo stick (grandma's attic; "it still works") · the bottled tempest · fortune gobstopper (one cryptic true hint, then refills weekly) · **the candy box itself** (heirloom artifact: candies accumulate 2× while the box is *closed* — i.e., while you're off doing quests. Schrödinger's candy. The game does not explain this).

---

## 11. Magic & Potions

**Mana**: bar + regen; lollipop infusions raise the cap (lollipops stay relevant forever).

**Grimoires:**
- *Beginner's grimoire* (observatory, bought): sugar bolt · glass shield · sticky ground (caramel slow-zone).
- *The astronomer's grimoire* (gift after the storm front): starlight beam · gravity well · summon comet shard.
- *The black licorice grimoire* (SECRET — found inside the void whale, §17): eclipse (pauses the star counter for 1 real hour, +20% damage; the astronomer will not look at you) · void step (blink/dodge) · MELT (turns a non-boss enemy into collectible caramel).

**Cauldron potions:** syrup of health · fizzy lifting soda (float; required twice) · mint coolant draught (heat tier 1) · anti-gravity cola (homage; drift quests get weird) · pepper berserk · turtle taffy (slow but tanky) · cloning fizz (duplicates the next gummy molded) · **the mirror potion** (secret recipe: 1 chocolate + 1 sugar-glass shard + *exactly* 1 candy → §17).

---

## 12. The Gummy Army (molds × flavors)

The cauldron/pet successor system. Units are grown: **mold** (shape = role) × **flavor essence** (= stats). 50 candies + 1 essence per unit.

- **Molds** (found/bought/dropped): bear (frontline) · worm (burrower, mining boost) · shark (boarding actions) · knight (escort) · kraken-mini (ship defense) · dragon (rare; late; you will feel weird about it given §15, and the game knows).
- **Flavors:** sour = attack · mint = regen/defense · cherry = HP · cola = speed · licorice = tank · grape = magic.
- **Fusion** (taught by the gummy folk): two-flavor units (sour-cola = glass cannon, etc.).
- Used in: escort quests, ship crew slots, mining automation, and *en masse* in the finale.
- Secret unit: **the gummy you** (requires mirror potion residue, §17).

---

## 13. The Candied Galleon

- **Hull:** hardtack → ironbark → jawbreaker-plated.
- **Sails:** cotton candy → storm-silk → solar sails (stage-3 scaffold reward).
- **Cannons:** gumball broadside → pop rock guns → the nougat bombard.
- **Figurehead:** carved choice, one stat each (the mermaid: dodge · the dragon: damage · the squirrel: luck · secret fourth, §18).
- **Crew:** gummy sailors; flavor matters (sour gunners reload faster, mint navigators dodge storms, the parrot just vibes).

---

## 14. NPC Roster

grandma (quest-giver, heirloom secret) · the blacksmith (forge, fishbowl helm scene) · the tavern keeper (hint system) · the astronomer (grimoires, telescope, the game's emotional barometer) · the toll giant · the thunderhead djinn · the lighthouse cyclops · the shipwright · Captain Sourbeard (recurring rival) · **the squirrel** (in space; unexplained; unimpressed) · the gummy folk elder · the hermit (inside the void whale; sells the best gloves in the game; has been there a while; is fine) · the solar dragon (speaks in single small words) · the star-eater (speaks in UI).

---

## 15. Lore Bible (the spine — never dumped on the player, only discovered)

1. **Candy is crystallized starlight.** Canonized via a pompous in-game scholar citing the etymology — candy *looks* like Latin *candere*, "to glow" (incandescent) — who is wrong (it's from Persian *qand*, sugar) but wrong *for the right reasons*. The tavern sells his pamphlet. The astronomer despises him. He is never seen, only cited.
2. **Dragons are larval stars.** The fossil (a star that never hatched) → the frost wyrm (froze instead of igniting) → the hollow moon core (something hatched and left) → the solar dragon (hatching now). Retroactively unifies CB1's and CB2's dragons. Revealed by environment, never by text, until the core.
3. **The star-eater** is what happens when something that eats never stops. It has a candy counter. The player has a candy counter. The game makes the comparison exactly once, at the end, in the eater's HUD.
4. **The counter: stars in the sky: 8,128.** A perfect number (nerds will notice). Ticks down all game on a schedule + scripted moments (one falls when the seed arrives; one dies on the observation deck in front of you). In ending 1, it ticks up for the first time. In NG+ (ending 3), getting it back UP to 8,128 is the secret completion condition.
5. **Grandma was the hero of the first game.** Her sword "wrapper" hangs on the mantle. The mailbox letters from "the first climber" are hers. Asking about the old days three times unlocks the attic (§18).

---

## 16. Endings

| # | Name | Condition | Result |
|---|---|---|---|
| 1 | Let it hatch | default choice | Sun goes dark; dragon relights the sky; counter ticks UP |
| 2 | Feed the sun | sacrifice entire candy balance | Status quo preserved; counter frozen forever |
| 3 | Eat it | lifetime candies eaten > threshold | You become the star-eater; NG+ dark save |
| 4 | *(secret epilogue, any ending)* | awaken the fossil post-game (§17) | +1 star; the mines bookend |

---

## 17. Hidden Bosses (4)

1. **Your reflection** — drink the mirror potion. Fights your *exact current build*, mirrored, including your gummies. Reward: **the paradox pin** (wear two hats). The X-potion homage.
2. **The void whale** — telescope coordinates from a squirrel riddle + sailing to deliberately empty space. It swallows the galleon; the fight is inside it. Contains: the hermit, his glove shop, and the black licorice grimoire. (You can leave without fighting. The hermit prefers it.)
3. **The cloud wolf** — shear the same cloud sheep 7 times. It was never a sheep. Drops the wolf-wool cloak (+storm immunity).
4. **The hallucination** — inside the secret meta-zone (§18, "the context window"): a boss that fights with *fake UI* — counterfeit buttons, false damage numbers, lies about its own HP bar. Reward: **the fourth-wall fragment** (one real secret revealed per day).
5. **(Superboss/epilogue) the fossil star** — post-game: bring 1,000 stardust to the fossil in the sugar mines. It ignites. Fight a newborn star in a cave, or simply step back and let it go — it burns up through the beanstalk into the sky. The counter ticks +1. The game's last image is the first dungeon's ceiling, glowing.

---

## 18. Secrets Master List (~30 — CB2 density)

**Typed inputs** (a hidden text box, CB2 tradition — focus the page and type):
1. "starlight" → the scholar's pamphlet appears in inventory (lore)
2. Konami code → goldfish appears in the fishbowl helm (morale +1)
3. "candy box" → the original game's first line appears as a toast: "You have 1 candy."
4. "aniwey" → a small heart in the corner for the rest of the session
5. "eclipse" before owning the black grimoire → the astronomer asks where you heard that

**Interaction secrets:**
6. Feed the fossil exactly 1 candy → it twitches
7. Feed the beanstalk a single lollipop → grows a giant leaf with a hammock (rest buff)
8. Poke the sun on the map ×10 → "please stop poking the sun." (status: sun poker)
9. Shear one sheep 7× → cloud wolf (§17)
10. Pickpocket Sourbeard's parrot
11. Throw candies on the ground at the village well → a gummy hand returns them, +1 interest
12. Close the candy box during quests → 2× accumulation (the Schrödinger mechanic; discoverable, never stated)
13. Name the galleon "Candy Box" → secret figurehead: a tiny wooden aniwey-style smiley
14. Ask grandma about the old days ×3 → attic unlocks: pogo stick, old map fragment, and eventually "wrapper"
15. Plant a lollipop on the moon → moonpops
16. Drink anti-gravity cola during a drift quest → controls invert, hidden asteroid reachable
17. Lose to the toll giant on purpose → he feels bad, lowers the toll 10%
18. Stand in sour rain with no armor for 60s → achievement-style status: "well-marinated" (+1 sour resist, permanently)

**Telescope coordinate secrets** (riddle-gated): 19. the comet's early arrival · 20. the void whale's patch of nothing · 21. the star-eater silhouette (early, chilling, missable) · 22. a constellation connect-the-dots that draws a candy → cosmetic sky + tiny luck buff

**Squirrel riddles:** 23–27. five riddles + the meta-riddle ("In my first life, I asked you about a body of water…") → the acorn of knowledge

**Hidden zones:**
28. **The context window** — a maintenance hatch on the moon labeled "do not open (it's fine)". Inside: a terminal scrolling *this game's own design notes and "system prompt,"* the developer's-computer homage updated for how this game was actually made. Houses the hallucination (§17).
29. The hermit's glove shop (inside the whale)
30. Mailbox milestone letters (6 total; the last one is signed with grandma's real name)

---

## 19. Death Messages (sample set — write ~40 total, every death source gets one)

- "You drift forever. A gummy alien waves politely."
- "You are now part of the storm. The storm says thanks."
- "The sun politely declines your visit."
- "The moon worm finds you chewy. This is a compliment, from a worm."
- "You fell. The clouds remembered they are made of vapor at the worst possible time."
- "Sourbeard apologizes for the cannonball. He does not mean it."
- "The labyrinth keeps you. It was lonely."
- "You have been politely dissolved."
- "The void whale didn't even notice. Somehow that's worse."
- "Grandma would have ducked."

---

## 20. Save / Meta / NG+

- Save: localStorage + exportable save string (CB2 tradition — players share saves).
- Track *lifetime candies eaten* separately from balance (gates ending 3 and scales "wrapper").
- NG+ ("the dark sky save", from ending 3): you are the silhouette in someone's telescope. Star counter persists downward; secret win = restoring it to 8,128. Light remix, not a second full game: new dialog, inverted opening ("You have 8,100 stars"), same world.

## 21. Build Phasing (for Claude Code)

Reference architecture: CB2's public TypeScript repo (aniwey/candybox2) — tick loop, save serialization, quests as small state machines, zones as components. Single-page, no backend.

- **Phase 1 — vertical slice:** core tick/save/shop/forge engine + all of Act 0 + the seed event + the beanstalk climb (proves the vertical-rotation quest engine). *This is the moment the game becomes itself; ship this first.*
- **Phase 2:** clouds, storm front, moon + strata mining, balloon, cauldron, grimoire 1, gummy molds v1.
- **Phase 3:** galleon + ship combat, the belt + drift combat, pirates, the squirrel, the comet timer.
- **Phase 4:** both planets, gummy fusion, the scaffold economy, Acts 3–4, all endings.
- **Phase 5:** secrets pass, hidden bosses, the context window, death-message coverage, balance tuning against the §5 wealth curve.

## 22. Resolved Design Decisions

These were open; they're now locked. Recorded here so the rationale travels with the spec.

1. **Act 0 length → 20–25 min** (was 45). 2026 attention spans won't survive 45 minutes of bare screen before the genre reveal; the whiplash lands just as hard compressed. Sugar mine sequence accelerated to compensate. (See §8 Act 0.)
2. **Comet → hybrid timing, not a strict clock.** First pass scripted ~5 min after the telescope purchase so the player is guaranteed to see it; later passes are event/candy-count driven with a soft real-time floor. Pop rock progression is never hard-gated on the wall clock. (See §8 Act 2.)
3. **Gravity stays pointed up.** No large underground stratum — it would dilute the central ascent metaphor of the kingdom climbing a vertical browser page. The fossil remains a single poignant basement, intentionally isolated. (See §8 Act 0, §17.)
4. **99% silent, one track.** Silence is core to the Candy Box identity. Exactly one chiptune track exists and fires only at the Act 4 sun descent, so sound itself becomes the emotional event. (See §2a, §8 Act 4.)
5. **Pure ASCII, no pixel art.** The limitation is the medium's beauty; pixel art breaks the terminal illusion. Visual flair via CSS glow/text-shadow, color, and typography only. (See §2a.)

### Still genuinely open (tune in playtest)

- Ending 3's "lifetime candies eaten" threshold — needs a number that feels earned but discoverable. Can only be set against real wealth-curve data from Phase 1–4 builds.
- Exact act-gate candy costs across §5's curve — placeholders until the tick rate is real.
