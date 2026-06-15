// The single fixed-timestep cadence for the render layer: the loop driver's sim step AND the
// per-frame quest interval both tick at this rate, so they must agree. Kept in one place so
// bootstrap.ts (the sim loop) and questScreens.ts (the quest loop) can never silently diverge.
export const STEP_MS = 100
