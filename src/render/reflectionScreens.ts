import type { GameSession } from '@/engine/session/gameSession'
import {
  createReflectionFight,
  resolveReflectionExchange,
  reflectionOutcome,
  cutFor,
  mirrorCutDamage,
  reflectionDefeated,
  grantReflectionReward,
  hasMirrorPotion,
  drinkMirrorPotion,
  type ReflectionState,
  type ReflectionAction,
} from '@/engine/content/reflectionFight'
import { MAX_TURNS } from '@/content/potion/reflectionFight'
import { deathEpitaph } from '@/render/deathEpitaph'

// Your reflection (Phase 5 — hidden boss 2, the X-potion homage, DESIGN §17/§18). A wiring sub-module of the DOM
// bootstrap, sibling to krakenScreens/skyScreens: it owns NO game logic. The symmetric guard/lunge duel
// (createReflectionFight / resolveReflectionExchange / reflectionOutcome) that reads your equipped hand weapon +
// gummy army for BOTH sides lives in the tested engine (engine/content/reflectionFight) over content config
// (content/potion/reflectionFight); this only draws the mirror + HP bars, routes the guard/lunge clicks, and
// commits the paradox pin ONCE. Coverage-excluded, Playwright-verified. Routed back to the cauldron you drank at.
//
// The fight is TRANSIENT (an abandoned or lost duel is forfeit — it never persists). Drinking the potion is what
// summons the reflection; the draught is consumed on the drink (a lost fight costs the potion, not the pin). Only
// the cleared flag (reflectionDefeated) + the one-off drop (the paradox pin) persist, granted exactly once and
// gated by the flag — farm-proof, like the kraken's crown.

/** A pure-ASCII HP bar, e.g. [#####] / [##---]. */
function hpBar(cur: number, max: number, width = 12): string {
  const filled = Math.max(0, Math.min(width, Math.round((cur / max) * width)))
  return `[${'#'.repeat(filled)}${'-'.repeat(width - filled)}]`
}

export interface ReflectionContext {
  readonly doc: Document
  readonly screen: HTMLElement
  readonly session: GameSession
  clearScreen(): void
  button(label: string, testid: string, onClick: () => void, accelIndex?: number): HTMLButtonElement
  notify(text: string): void
  logText(text: string): void
  /** Back to the cauldron (you drank the potion there). */
  showCauldron(): void
}

export interface ReflectionScreens {
  showReflection(): void
}

/** Wire your-reflection's fight screen over a bootstrap host. */
export function createReflectionScreens(ctx: ReflectionContext): ReflectionScreens {
  const { doc, screen, session } = ctx

  function heading(text: string, testid: string): void {
    const h = doc.createElement('h2')
    h.textContent = text
    h.setAttribute('data-testid', testid)
    screen.appendChild(h)
  }

  function paragraph(text: string, className: string, testid?: string): void {
    const p = doc.createElement('p')
    p.className = className
    if (testid) p.setAttribute('data-testid', testid)
    p.textContent = text
    screen.appendChild(p)
  }

  /** You and the mirror, face to face — the reflection's stance drawn by the LINE it tells (high or low). */
  function sceneText(tell: string): string {
    const you = ['   O', '  /|\\', '  / \\']
    const it =
      tell === 'high'
        ? ['O   ', '\\|\\  its blade rides HIGH', '/ \\ ']
        : ['O   ', '/|/  its blade dips LOW', '/ \\ ']
    return you.map((l, i) => `${l}    |    ${it[i]}`).join('\n')
  }

  function showReflection(): void {
    // The fight is transient to this drink; a win commits the paradox pin exactly once. Drinking the potion (once,
    // on entry) is what summons the reflection — it is consumed, so a lost fight costs the draught, not the pin.
    let fight: ReflectionState | null = null
    let committed = false
    let drank = false
    // True only on the FIRST win (the pin was actually granted). A rematch win (defeated already, potion re-brewed)
    // grants nothing, so the victory blurb must not promise a pin cooling on the table that is already yours.
    let looted = false

    function render(): void {
      ctx.clearScreen()
      const s = session.getState()
      heading('your reflection', 'reflection-screen')

      // The calm empty room only when you have already won AND are not here to face yourself again. If you drank a
      // fresh potion after your first win (the promised "company" — see the cold pot's rematch line), fall through
      // to the fight: the reflection returns, loot-less (grantReflectionReward is flag-gated, so no re-loot).
      if (reflectionDefeated(s) && !hasMirrorPotion(s) && !fight) {
        renderCalm()
      } else if (!hasMirrorPotion(s) && !fight) {
        // No potion in hand and no fight underway — nothing to face. (Shouldn't be reachable, but harmless.)
        renderNoPotion()
      } else {
        if (!fight) {
          // Drink the potion (consume it) and summon the reflection — exactly once, on first entry.
          if (!drank) {
            drank = true
            session.dispatch((st) => drinkMirrorPotion(st))
          }
          fight = createReflectionFight(s)
        }
        renderFight(fight)
      }

      screen.appendChild(ctx.button('back to the cauldron', 'reflection-to-cauldron', () => ctx.showCauldron(), 0))
    }

    function renderNoPotion(): void {
      paragraph(
        'The pot is still. There is no potion in your hand, and so there is no one else in the room. Brew the mirror potion first.',
        'blurb',
        'reflection-no-potion',
      )
    }

    function renderCalm(): void {
      paragraph(
        'The room holds only you again. On the table where the other one stood there is a small pin of two facing mirrors, each full of the other and going nowhere. You take it. It weighs nothing at all. You may wear two hats now, if you like — nobody left is going to argue.',
        'blurb',
        'reflection-calm',
      )
    }

    function renderFight(f: ReflectionState): void {
      const outcome = reflectionOutcome(f)

      if (outcome === 'won') {
        if (!committed) commitVictory()
        paragraph(
          looted
            ? 'You read the last feint for what it was, and step inside it, and the thing that was you comes apart like breath on glass. Where it stood, a small pin lies cooling on the table. You beat yourself, which is either a great victory or no victory at all. You decide not to think about it too hard.'
            : 'You read the last feint for what it was, and step inside it, and the thing that was you comes apart like breath on glass. It leaves nothing behind this time — you already took the pin, the first time you did this. You beat yourself again. The company, it turns out, was the point.',
          'blurb',
          'reflection-won',
        )
        return
      }
      if (outcome === 'lost') {
        paragraph(deathEpitaph('reflection'), 'blurb', 'reflection-epitaph')
        paragraph(
          'It fought exactly the way you fight — it just never once flinched. Trading blows with yourself is a losing game; you cannot out-hit a thing that hits as hard as you. Read its blade instead: guard the line it truly cuts (block clean, riposte), and spend your lunges only on the little feints. Brew another potion when you are ready to face yourself again.',
          'blurb',
          'reflection-lost',
        )
        return
      }

      // --- the fight in progress ---
      paragraph(
        'It stands across the table wearing your face and holding your blade, and it hits exactly as hard as you do. You cannot win by hitting harder — there is no harder. GUARD the line it truly cuts (block it clean and riposte for chip) or LUNGE (big damage, but its cut always lands, and in a dead-even trade it wins). But it lies with its body, the way you would: the line it SHOWS is not always the line it cuts. Read the feint. Guard the heavy cuts; lunge only into the light ones.',
        'blurb',
        'reflection-blurb',
      )

      paragraph(`you        ${hpBar(f.yourHp, f.yourMaxHp)}  ${Math.max(0, Math.ceil(f.yourHp))}/${f.yourMaxHp}`, 'blurb', 'reflection-your-hp')
      paragraph(`the mirror ${hpBar(f.foeHp, f.foeMaxHp)}  ${Math.max(0, Math.ceil(f.foeHp))}/${f.foeMaxHp}`, 'blurb', 'reflection-foe-hp')

      const cut = cutFor(f.turn)
      const pre = doc.createElement('pre')
      pre.className = 'arena'
      pre.setAttribute('data-testid', 'reflection-scene')
      // machine-readable hints for the e2e (the player reads the stance by eye): the line it SHOWS (the tell the
      // screen draws) and the line it ACTUALLY cuts (a feint when they differ). The screen draws only the tell.
      pre.setAttribute('data-tell', cut.tell)
      pre.setAttribute('data-line', cut.line)
      pre.setAttribute('data-turn', String(f.turn))
      pre.textContent = sceneText(cut.tell)
      screen.appendChild(pre)

      screen.appendChild(ctx.button('guard high (block a high cut, riposte)', 'reflection-guard-high', () => doAction('guard-high')))
      screen.appendChild(ctx.button('guard low (block a low cut, riposte)', 'reflection-guard-low', () => doAction('guard-low')))
      screen.appendChild(ctx.button('lunge (commit — its cut lands)', 'reflection-lunge', () => doAction('lunge')))

      const w = f.weapon
      paragraph(
        `your hand (and its hand): damage ${w.damage}${w.strikes > 1 ? ` x${w.strikes}` : ''}   next cut deals ${mirrorCutDamage(cut, w)} if it lands   (turn ${f.turn + 1} of ${MAX_TURNS} — it wears you out after)`,
        'blurb',
        'reflection-weapon',
      )
    }

    function doAction(action: ReflectionAction): void {
      if (!fight) return
      fight = resolveReflectionExchange(fight, action)
      render()
    }

    function commitVictory(): void {
      committed = true
      // First win only grants (and logs) the pin; a rematch (already defeated) is loot-less, and `looted` gates
      // both the victory blurb and the log line so neither promises a pin that is already in your pocket.
      looted = !reflectionDefeated(session.getState())
      session.dispatch((s) => {
        if (reflectionDefeated(s)) return s // already looted — never twice
        return grantReflectionReward(s)
      })
      ctx.logText(
        looted
          ? 'You bested your reflection, and the paradox pin is yours. While you wear it you may keep two hats on at once — a small loophole in the rules of the world, won off yourself.'
          : 'You bested your reflection again. It brought no pin this time — only the strange company of yourself. You go back up the stairs a little less alone.',
      )
    }

    render()
  }

  return { showReflection }
}
