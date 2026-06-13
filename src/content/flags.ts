// Content-owned save-flag string constants. Save flags name CONTENT state (zones unlocked,
// quests completed), so the flag *strings* are content, not engine, values. Content modules
// import these instead of reaching into engine runtime (ADR §3 layering: content imports only
// TYPES from engine, never engine values). The engine readers that consult these flags compare
// against the SAME string literal — kept in lock-step here as the single source of truth.

/** Set on beanstalk-climb victory; enables the elevator fast-travel forever after. */
export const BEANSTALK_ELEVATOR_FLAG = 'beanstalkElevator'
