// Pure quest TYPES shared across the engine, render and content layers. Types only — no
// runtime values — so content (which imports types exclusively from engine/types) can name
// them without pulling any engine logic in (ADR §3 layering: content ──imports types only──►
// engine/types). The Entity runtime class re-exports Team from here for its own use.

/** Which side a quest entity fights for. 'neutral' entities never collide-damage. */
export type Team = 'player' | 'enemy' | 'neutral'
