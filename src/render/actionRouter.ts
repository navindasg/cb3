// Map/zone hotspots carry a `data-action` string in the shape `kind:target`
// (e.g. 'enter:shop', 'quest:beanstalkClimb', 'travel:beanstalkElevator') or a bare verb
// (e.g. 'eat'). The bootstrap routes these to session methods; this pure splitter is the one
// piece of that routing worth testing in isolation. No DOM, no engine logic.

export interface ParsedAction {
  /** The verb before the first colon (the whole string when there is no colon). */
  readonly kind: string
  /** Everything after the first colon ('' for a bare verb). */
  readonly target: string
}

/** Split a `kind:target` action; only the FIRST colon splits, so targets may contain colons. */
export function parseAction(action: string): ParsedAction {
  const trimmed = action.trim()
  const colon = trimmed.indexOf(':')
  if (colon < 0) return { kind: trimmed, target: '' }
  return { kind: trimmed.slice(0, colon), target: trimmed.slice(colon + 1) }
}
