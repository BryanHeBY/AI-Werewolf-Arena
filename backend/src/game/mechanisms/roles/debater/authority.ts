import {
  COMPONENT,
  type World,
  type RoleComponent,
  type DebatePenaltyComponent,
} from "../../../../core/domain";
import {
  captureNightLife,
  livingNightLife,
  type NightLifeScope,
} from "../../../../core/domain/night_effects";

export interface DebateParticipant {
  life: NightLifeScope;
  role: RoleComponent;
  roleId: RoleComponent["role"];
  camp: RoleComponent["camp"];
  state: RoleComponent["privateState"];
}
export interface DebateAuthority {
  id: string;
  day: number;
  actorId: number;
  targetId: number;
  stage: "challenge" | "speech" | "ballot";
  participants: ReadonlyMap<number, DebateParticipant>;
}
const active = new WeakMap<World, DebateAuthority>();
export function hasActiveDebate(world: World): boolean {
  return active.has(world);
}
const sequences = new WeakMap<World, number>();
export function nextDebateId(world: World, day: number, actorId: number, targetId: number): string {
  if (active.has(world)) throw new Error("debate_window_reentry");
  const sequence = (sequences.get(world) ?? 0) + 1;
  sequences.set(world, sequence);
  return `debate:${day}:${actorId}:${targetId}:${sequence}`;
}
const commits = new WeakMap<World, Set<number>>();
const penalties = new WeakMap<
  World,
  Map<number, { record: DebatePenaltyComponent; life: NightLifeScope }>
>();
export function captureDebateParticipant(world: World, id: number): DebateParticipant | null {
  const life = captureNightLife(world, id),
    role = world.getComponent<RoleComponent>(id, COMPONENT.Role);
  return life && role
    ? { life, role, roleId: role.role, camp: role.camp, state: role.privateState }
    : null;
}
export function sameDebateParticipant(world: World, snapshot: DebateParticipant): boolean {
  return (
    livingNightLife(world, snapshot.life) &&
    world.getComponent(snapshot.life.id, COMPONENT.Role) === snapshot.role &&
    snapshot.role.role === snapshot.roleId &&
    snapshot.role.camp === snapshot.camp &&
    snapshot.role.privateState === snapshot.state
  );
}
export function openDebate(world: World, authority: DebateAuthority): void {
  if (active.has(world)) throw new Error("debate_window_reentry");
  active.set(world, authority);
}
export function closeDebate(world: World, authority: DebateAuthority): void {
  if (active.get(world) === authority) active.delete(world);
}
export function debateAuthority(world: World, token: string | undefined): DebateAuthority | null {
  const a = active.get(world);
  return a && a.id === token ? a : null;
}
export function hasDebateCommit(world: World, id: number): boolean {
  return commits.get(world)?.has(id) === true;
}
export function commitDebate(world: World, id: number): void {
  if (hasDebateCommit(world, id)) throw new Error("debate_already_committed");
  let ids = commits.get(world);
  if (!ids) {
    ids = new Set();
    commits.set(world, ids);
  }
  ids.add(id);
}
export function blockDebateVote(world: World, id: number, sourceId: number, day: number): void {
  const life = captureNightLife(world, id);
  if (!life) return;
  const record: DebatePenaltyComponent = { day, sourceId, lifeVersion: life.version };
  let entries = penalties.get(world);
  if (!entries) {
    entries = new Map();
    penalties.set(world, entries);
  }
  entries.set(id, { record, life });
  world.addComponent(id, COMPONENT.DebatePenalty, record);
}
export function debateVoteBlocked(world: World, id: number, day: number | undefined): boolean {
  const b = penalties.get(world)?.get(id);
  return (
    !!b &&
    (day === undefined || b.record.day === day) &&
    world.getComponent(id, COMPONENT.DebatePenalty) === b.record &&
    livingNightLife(world, b.life)
  );
}
