// All currencies are conceptually whole candies. Internally a resource's
// `current` may carry a fractional part (smooth sub-second idle accrual); every
// display path floors it. This single module is the escape hatch: if a future
// act ever pushes a tracked value past ~1e15, swap the impl here and nowhere else.
// (Per ADR-001 D2: native `number` — peak ~1e12 is far below MAX_SAFE_INTEGER.)

export type Currency = number

const FULL = new Intl.NumberFormat('en-US')

/** Comma-grouped whole number, e.g. 1000000000 -> "1,000,000,000". */
export function formatCount(n: number): string {
  return FULL.format(Math.trunc(n))
}

const TIERS: ReadonlyArray<{ readonly value: number; readonly suffix: string }> = [
  { value: 1e12, suffix: 'T' },
  { value: 1e9, suffix: 'B' },
  { value: 1e6, suffix: 'M' },
  { value: 1e3, suffix: 'K' },
]

/** Compact form for dense UI, e.g. 3_400_000_000 -> "3.4B". */
export function formatCompact(n: number, decimals = 1): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  for (const tier of TIERS) {
    if (abs >= tier.value) {
      const scaled = (abs / tier.value).toFixed(decimals).replace(/\.0+$/, '')
      return `${sign}${scaled}${tier.suffix}`
    }
  }
  return `${sign}${Math.trunc(abs)}`
}

/** Full number when it fits in `maxChars`, otherwise compact. */
export function formatAdaptive(n: number, maxChars: number): string {
  const full = formatCount(n)
  return full.length <= maxChars ? full : formatCompact(n)
}

/** Group whole thousands with thin spaces, CB2-style: 1000000 -> "1 000 000". */
export function groupWithSpaces(n: number): string {
  const s = Math.trunc(Math.abs(n)).toString()
  const grouped = s.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return n < 0 ? `-${grouped}` : grouped
}

/**
 * CB2's adaptive candy line (Candies.getCurrentAsString homage): "You have 1 candy" in the
 * singular, "You have N candies" with space-grouped thousands otherwise, plus two of the
 * original's deadpan easter eggs (1337 -> "leet", 42 -> a little "\o/"). No trailing period —
 * the field counter is a steady readout, not a sentence. Values are floored to whole candies.
 */
export function candyCountSentence(n: number): string {
  const whole = Math.floor(n)
  if (whole < 0) return 'What, negative candies?!'
  if (whole === 1) return 'You have 1 candy'
  const base = whole === 1337 ? 'leet' : groupWithSpaces(whole)
  const comment = whole === 42 ? ' \\o/' : ''
  return `You have ${base} candies${comment}`
}
