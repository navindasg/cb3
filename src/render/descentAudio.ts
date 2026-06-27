import {
  DESCENT_MOTIF,
  DESCENT_LOOP_SECONDS,
  DESCENT_ENVELOPE,
  DESCENT_MASTER_GAIN,
  type MotifVoice,
} from '@/content/sun/descentAudio'

// The descent cue's SOUND (Act 4 — quest 11, DESIGN §194). This is the game's ONLY audio, and the only
// browser-glue render module that touches Web Audio. It is THIN: it owns no game logic and makes no
// decision about whether/when to play — that is the pure engine predicate shouldPlayDescentCue, read by
// the caller, which dispatches markDescentCuePlayed in the same path so the cue fires EXACTLY once. This
// file only synthesizes the motif data (content/sun/descentAudio) through OscillatorNodes + a GainNode
// ADSR. Coverage-excluded (appended to vite.config.ts exclude), Playwright-/ear-verified, never unit-run.
//
// TEST-SAFE by construction (the ADR §3 browser-glue contract):
//  - feature-detected: typeof window !== 'undefined' && an AudioContext constructor exists;
//  - NOTHING is constructed at module load — the AudioContext is lazy-built ONLY inside playDescentCue,
//    which the bootstrap calls from the descent-button CLICK handler (the user gesture — autoplay-safe);
//  - ALL construction is wrapped in try/catch and no-ops in jsdom/vitest/SSR, so it can never crash the
//    unit suite or the build; the asset-free synth means there is no binary to load either.

/** The Web Audio constructor, feature-detected (standard or the legacy webkit-prefixed form). */
type AudioContextCtor = typeof AudioContext

function resolveAudioContextCtor(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window &
    typeof globalThis & { webkitAudioContext?: AudioContextCtor }
  return w.AudioContext ?? w.webkitAudioContext ?? null
}

/** The descent-audio handle the bootstrap holds — one method, performing the cue. */
export interface DescentAudio {
  /** Play the descent cue once (a short looping chiptune motif). No-op where Web Audio is unavailable. */
  playDescentCue(): void
}

/**
 * Schedule one voice's notes against the context clock, each shaped by the shared ADSR so there are no
 * clicks. Every node is created fresh and stopped after its note, so nothing leaks. Pure synthesis — no
 * binary asset, keeping the build asset-free.
 */
function scheduleVoice(
  ctx: AudioContext,
  master: GainNode,
  voice: MotifVoice,
  loopStart: number,
): void {
  const { attack, decay, sustain, release } = DESCENT_ENVELOPE
  for (const note of voice.notes) {
    const t0 = loopStart + note.at
    const osc = ctx.createOscillator()
    osc.type = voice.wave
    osc.frequency.setValueAtTime(note.freq, t0)

    const env = ctx.createGain()
    const peak = note.gain
    // ADSR: ramp up to peak (attack), down to the sustain level (decay), hold, then release to silence.
    env.gain.setValueAtTime(0, t0)
    env.gain.linearRampToValueAtTime(peak, t0 + attack)
    env.gain.linearRampToValueAtTime(peak * sustain, t0 + attack + decay)
    const releaseStart = Math.max(t0 + attack + decay, t0 + note.dur - release)
    env.gain.setValueAtTime(peak * sustain, releaseStart)
    env.gain.linearRampToValueAtTime(0, releaseStart + release)

    osc.connect(env)
    env.connect(master)
    osc.start(t0)
    osc.stop(t0 + note.dur + release)
  }
}

/**
 * Build the descent-audio glue. Constructs NOTHING at call time — only feature-detects and returns the
 * handle; the AudioContext is built lazily on the first playDescentCue (the user-gesture click), so this is
 * safe to call at bootstrap in any environment. In jsdom/vitest/SSR (no AudioContext) playDescentCue is a
 * silent no-op.
 */
export function createDescentAudio(): DescentAudio {
  const Ctor = resolveAudioContextCtor()
  // Held across plays so the looping motif keeps scheduling on the same clock once started.
  let ctx: AudioContext | null = null
  let loopTimer: ReturnType<typeof setInterval> | null = null

  function playDescentCue(): void {
    if (!Ctor) return // no Web Audio (jsdom/vitest/SSR) — silent no-op.
    if (loopTimer !== null) return // already playing the loop.
    try {
      ctx = ctx ?? new Ctor()
      // Autoplay policy: a context may start suspended; resume() inside the user gesture is allowed.
      void ctx.resume?.()

      const master = ctx.createGain()
      master.gain.setValueAtTime(DESCENT_MASTER_GAIN, ctx.currentTime)
      master.connect(ctx.destination)

      const scheduleLoop = (): void => {
        if (!ctx) return
        const start = ctx.currentTime + 0.05
        for (const voice of DESCENT_MOTIF) scheduleVoice(ctx, master, voice, start)
      }

      // Schedule the first loop now, then re-schedule each loop length so the motif repeats.
      scheduleLoop()
      loopTimer = setInterval(() => {
        try {
          scheduleLoop()
        } catch {
          // A failed re-schedule must never throw into the timer; drop the cue silently.
        }
      }, DESCENT_LOOP_SECONDS * 1000)
    } catch {
      // Any synthesis failure is non-fatal: the cue is flavor, never a crash. Stay silent.
    }
  }

  return { playDescentCue }
}
