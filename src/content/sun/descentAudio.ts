// The descent cue's MOTIF DATA (Act 4 — quest 11, DESIGN §194). Pure flavor data: the note frequencies,
// durations, loop length, and wave types of the game's ONLY sound. The render glue (render/descentAudio,
// coverage-excluded) reads this and synthesizes it through Web Audio OscillatorNodes + a GainNode ADSR —
// so the build stays ASSET-FREE (no binary). No logic here; the engine decides WHEN (the photosphere
// predicate), this is the WHAT, and the render glue is the HOW.
//
// The motif is short, chiptune, and looping: a low square-wave drone under a slow descending triangle-wave
// arpeggio — the bathysphere sinking into white fire. After ~18 silent hours, sound itself is the event, so
// it is deliberately small and grave, not a fanfare. All §22-open tuning.

/** A single scheduled note in the motif: when (s, from loop start), how long (s), its pitch (Hz), and how
 * loud (0..1 peak before the ADSR). The render glue schedules each against the AudioContext clock. */
export interface MotifNote {
  /** Start offset within one loop, in seconds. */
  readonly at: number
  /** Note duration in seconds (the ADSR is shaped within this). */
  readonly dur: number
  /** Pitch in Hz. */
  readonly freq: number
  /** Peak gain (0..1) before the envelope multiplies it down. */
  readonly gain: number
}

/** A voice in the motif — an oscillator of one wave type playing a sequence of notes. */
export interface MotifVoice {
  /** The oscillator wave type (chiptune: square for the drone bite, triangle for the soft arpeggio). */
  readonly wave: OscillatorType
  /** This voice's notes, scheduled within one loop. */
  readonly notes: readonly MotifNote[]
}

/** How long one loop of the motif lasts (seconds) before it repeats. Short and looping by design. */
export const DESCENT_LOOP_SECONDS = 6

/** The ADSR envelope (seconds for A/D/R, level 0..1 for sustain) shaping every note — keeps it soft, no clicks. */
export const DESCENT_ENVELOPE = {
  attack: 0.04,
  decay: 0.1,
  sustain: 0.5,
  release: 0.3,
} as const

/** The master gain the whole cue plays through — kept low so the one sound in the game is grave, not loud. */
export const DESCENT_MASTER_GAIN = 0.18

// The motif notes. A low square drone holds the floor; a triangle arpeggio descends over it, a minor figure
// (A minor) that resolves nowhere — the sinking. Frequencies are plain Hz so the data is self-contained.

const A2 = 110.0
const A3 = 220.0
const C4 = 261.63
const E4 = 329.63
const A4 = 440.0
const G4 = 392.0
const E3 = 164.81

/** The drone voice — a low square wave holding under everything, the bathysphere's hull groan. */
const DRONE: MotifVoice = {
  wave: 'square',
  notes: [
    { at: 0, dur: 3, freq: A2, gain: 0.5 },
    { at: 3, dur: 3, freq: E3, gain: 0.5 },
  ],
}

/** The arpeggio voice — a soft triangle figure descending across the loop, resolving nowhere. */
const ARPEGGIO: MotifVoice = {
  wave: 'triangle',
  notes: [
    { at: 0.0, dur: 0.7, freq: A4, gain: 0.45 },
    { at: 0.75, dur: 0.7, freq: G4, gain: 0.45 },
    { at: 1.5, dur: 0.7, freq: E4, gain: 0.45 },
    { at: 2.25, dur: 0.9, freq: C4, gain: 0.45 },
    { at: 3.25, dur: 0.7, freq: A3, gain: 0.45 },
    { at: 4.0, dur: 0.7, freq: C4, gain: 0.45 },
    { at: 4.75, dur: 0.7, freq: E4, gain: 0.45 },
    { at: 5.5, dur: 0.5, freq: A3, gain: 0.45 },
  ],
}

/** The full motif — two voices (square drone + triangle arpeggio), looped every DESCENT_LOOP_SECONDS. */
export const DESCENT_MOTIF: readonly MotifVoice[] = [DRONE, ARPEGGIO] as const
