import type { Entity } from '@/engine/quest/Entity'

// The combat pass (ADR §6.2). The Scene base loop calls this once per step, AFTER movement and
// BEFORE culling/win/death: every armed entity whose cooldown is up and that has a hostile within
// its weapon's reach lands a flat hit; the attacker's cooldown is re-armed. Damage is computed
// against the PRE-combat snapshot and applied together, so simultaneous attacks are order-free
// (two foes can trade blows in one step). Pure & immutable — returns new Entity instances.
//
// Hostility is team-based: 'player' and 'enemy' are mutually hostile; 'neutral' (scenery, resource
// veins) neither attacks nor is auto-targeted here. When a 'player'-team entity takes a lethal
// blow, the killer's source tag is reported so the Scene can pick the right death message.

/** Whether `a` and `b` are on opposing combat teams. */
export function areHostile(a: Entity, b: Entity): boolean {
  return (
    (a.team === 'player' && b.team === 'enemy') || (a.team === 'enemy' && b.team === 'player')
  )
}

/** Centre-to-centre distance between two entities, in cells. */
export function centreDistance(a: Entity, b: Entity): number {
  const ax = a.pos.x + a.width / 2
  const ay = a.pos.y + a.height / 2
  const bx = b.pos.x + b.width / 2
  const by = b.pos.y + b.height / 2
  return Math.hypot(ax - bx, ay - by)
}

/** The nearest living hostile within `range` of `attacker`, or null. */
export function nearestHostile(
  attacker: Entity,
  entities: readonly Entity[],
  range: number,
): Entity | null {
  let best: Entity | null = null
  let bestDist = Infinity
  for (const e of entities) {
    if (e === attacker || e.isDead || !areHostile(attacker, e)) continue
    const dist = centreDistance(attacker, e)
    if (dist <= range && dist < bestDist) {
      bestDist = dist
      best = e
    }
  }
  return best
}

/** The distance to the nearest living hostile of `attacker`, or Infinity if none exist. */
export function nearestHostileDistance(attacker: Entity, entities: readonly Entity[]): number {
  let best = Infinity
  for (const e of entities) {
    if (e === attacker || e.isDead || !areHostile(attacker, e)) continue
    best = Math.min(best, centreDistance(attacker, e))
  }
  return best
}

/** The damage-source key for an entity (its first tag, else its id) — keys death messages. */
function sourceOf(entity: Entity): string {
  return entity.tags[0] ?? entity.id
}

export interface CombatResult {
  /** The entities after this step's attacks (new instances where anything changed). */
  readonly entities: readonly Entity[]
  /** The source tag of the foe that dealt a lethal blow to a player-team entity, if any. */
  readonly deathSource?: string
}

/**
 * Resolve one step of combat at scene-time `elapsedMs`. Every entity with a ready weapon and a
 * hostile in reach lands its strongest in-range weapon's damage on the nearest such hostile and
 * re-arms that weapon's cooldown. Returns new entities; same array contents (new instances only
 * where something changed). Reports a death source when a player-team entity is brought to 0.
 */
export function resolveCombat(entities: readonly Entity[], elapsedMs: number): CombatResult {
  const damageBy = new Map<Entity, number>() // target -> total damage this step
  const cooldownBy = new Map<Entity, number>() // attacker -> new attackReadyAt
  // killer attributed to each player-team target that takes damage (first contributor wins).
  const killerOf = new Map<Entity, string>()

  for (const attacker of entities) {
    if (attacker.isDead || attacker.weapons.length === 0) continue
    if (elapsedMs < attacker.attackReadyAt) continue

    // Pick the in-range weapon with the highest damage that has a target.
    let chosenDamage = 0
    let chosenCooldown = 0
    let chosenTarget: Entity | null = null
    for (const weapon of attacker.weapons) {
      const target = nearestHostile(attacker, entities, weapon.range)
      if (target && weapon.damage > chosenDamage) {
        chosenDamage = weapon.damage
        chosenCooldown = weapon.cooldownMs
        chosenTarget = target
      }
    }
    if (!chosenTarget) continue

    damageBy.set(chosenTarget, (damageBy.get(chosenTarget) ?? 0) + chosenDamage)
    cooldownBy.set(attacker, elapsedMs + chosenCooldown)
    if (chosenTarget.team === 'player' && !killerOf.has(chosenTarget)) {
      killerOf.set(chosenTarget, sourceOf(attacker))
    }
  }

  if (damageBy.size === 0 && cooldownBy.size === 0) return { entities }

  let deathSource: string | undefined
  const next = entities.map((e) => {
    let out = e
    const dmg = damageBy.get(e)
    if (dmg !== undefined && dmg > 0) {
      out = out.damaged(dmg)
      if (e.team === 'player' && out.isDead) deathSource = killerOf.get(e)
    }
    const cd = cooldownBy.get(e)
    if (cd !== undefined) out = out.withAttackReadyAt(cd)
    return out
  })

  return deathSource !== undefined ? { entities: next, deathSource } : { entities: next }
}
