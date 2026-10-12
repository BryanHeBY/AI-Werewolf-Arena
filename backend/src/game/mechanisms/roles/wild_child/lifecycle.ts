/**
 * Owns Wild Child model selection, participant snapshots and conversion lifetime. Receives
 * original World components and first-night requests; writes choice bindings and later
 * model-death conversion only through current local windows. Replacement or closed choice
 * invalidates local authority; deadline aliases preserve its checks.
 */
import { registerRequestAliasPropagation } from "../../../../core/domain/request_delivery";
import { copyEventData } from "@ai-werewolf-arena/game-text";
import {
  COMPONENT,
  Camp,
  Role,
  Phase,
  createCampComponent,
  createVictoryComponent,
  type World,
  type BoardConfig,
  type ActionRequest,
  type RoleComponent,
  type CampComponent,
  type VictoryComponent,
  type GameEvent,
  type DeathSources,
} from "../../../../core/domain";
import { aliveLifeVersion } from "../../../../core/domain/components/alive";
import {
  captureNightLife,
  livingNightLife,
  type NightLifeScope,
} from "../../../../core/domain/night_effects";
import { captureDebateParticipant, type DebateParticipant } from "../debater/authority";
import { freshWildChildState, getWildChildState, type WildChildState } from "./state";
export interface WildChildBinding {
  world: World;
  actorId: number;
  actor: DebateParticipant;
  state: WildChildState;
  config: BoardConfig;
  configJson: string;
  camp: CampComponent;
  victory: VictoryComponent;
  expectedState: string;
  victoryJson: string;
  model: NightLifeScope | null;
  setup: "pending" | "active" | "complete" | "failed" | "cancelled";
  actorDeath: boolean;
  modelDeath: boolean;
  modelCommitted: boolean;
}
const bindings = new WeakMap<World, WildChildBinding>();
const nights = new WeakMap<World, Set<number>>();
const activeNights = new WeakSet<World>();
const requests = new WeakMap<
  ActionRequest,
  { binding: WildChildBinding; context: ActionRequest["context"] }
>();
const windows = new WeakMap<
  World,
  { isCurrent: () => boolean; targets: Map<number, DebateParticipant> }
>();
function safeJson(value: unknown): string {
  try {
    return JSON.stringify(copyEventData(value));
  } catch {
    return "invalid";
  }
}
export function installWildChild(world: World, config: BoardConfig): void {
  if (bindings.has(world)) throw new Error("wild_child_already_installed");
  const actorId = world
    .entityIds()
    .find((id) => world.getComponent(id, COMPONENT.Role)?.role === Role.WildChild);
  if (actorId === undefined) return;
  const actor = captureDebateParticipant(world, actorId)!;
  const state = getWildChildState(actor.role)!;
  const camp = world.getComponent(actorId, COMPONENT.Camp)!;
  const victory = world.getComponent(actorId, COMPONENT.Victory)!;
  bindings.set(world, {
    world,
    actorId,
    actor,
    state,
    config,
    configJson: safeJson(config),
    camp,
    victory,
    expectedState: safeJson(state),
    victoryJson: safeJson(victory),
    model: null,
    setup: "pending",
    actorDeath: false,
    modelDeath: false,
    modelCommitted: false,
  });
}
export function wildChildBinding(world: World): WildChildBinding | undefined {
  return bindings.get(world);
}
function ownData(value: object, key: string): unknown {
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && Object.hasOwn(d, "value") ? d.value : undefined;
}
function captureChoiceTarget(world: World, id: number): DebateParticipant | null {
  const life = captureNightLife(world, id),
    role = world.getComponent(id, COMPONENT.Role);
  if (!life || !role) return null;
  const roleId = ownData(role, "role"),
    camp = ownData(role, "camp"),
    state = ownData(role, "privateState");
  if (typeof roleId !== "string" || typeof camp !== "string" || !state || typeof state !== "object")
    return null;
  return {
    life,
    role,
    roleId: roleId as RoleComponent["role"],
    camp: camp as RoleComponent["camp"],
    state: state as RoleComponent["privateState"],
  };
}
function sameChoiceTarget(world: World, snapshot: DebateParticipant): boolean {
  return (
    livingNightLife(world, snapshot.life) &&
    world.getComponent(snapshot.life.id, COMPONENT.Role) === snapshot.role &&
    ownData(snapshot.role, "role") === snapshot.roleId &&
    ownData(snapshot.role, "camp") === snapshot.camp &&
    ownData(snapshot.role, "privateState") === snapshot.state
  );
}
function validWildChildIdentity(b: WildChildBinding): boolean {
  return (
    bindings.get(b.world) === b &&
    b.world.getComponent(b.actorId, COMPONENT.Role) === b.actor.role &&
    ownData(b.actor.role, "role") === Role.WildChild &&
    ownData(b.actor.role, "camp") === b.actor.camp &&
    ownData(b.actor.role, "privateState") === b.actor.state &&
    ownData(b.actor.state, "wildChild") === b.state &&
    safeJson(b.state) !== "invalid" &&
    safeJson(b.state) === b.expectedState &&
    b.world.getComponent(b.actorId, COMPONENT.Camp) === b.camp &&
    ownData(b.camp, "camp") === b.actor.camp &&
    b.world.getComponent(b.actorId, COMPONENT.Victory) === b.victory &&
    safeJson(b.victory) !== "invalid" &&
    safeJson(b.victory) === b.victoryJson &&
    safeJson(b.config) !== "invalid" &&
    safeJson(b.config) === b.configJson
  );
}
export function validWildChildOwner(b: WildChildBinding): boolean {
  return validWildChildIdentity(b) && livingNightLife(b.world, b.actor.life);
}
export function projectWildChild(world: World, role: RoleComponent): WildChildState | undefined {
  const b = bindings.get(world);
  if (!b || b.actor.role !== role) return undefined;
  if (!validWildChildOwner(b)) return { ...freshWildChildState(), remaining: 0, status: "closed" };
  return structuredClone(b.state);
}
export function wildChildReady(world: World): boolean {
  const b = bindings.get(world);
  return !b || b.setup === "complete";
}
export function hasActiveWildChild(world: World): boolean {
  return bindings.get(world)?.setup === "active" || activeNights.has(world);
}
export function hasWildChildNightCommit(world: World, day: number): boolean {
  return nights.get(world)?.has(day) ?? false;
}
export function openWildChildChoice(b: WildChildBinding, isCurrent: () => boolean): void {
  if (b.setup !== "pending" || !validWildChildOwner(b))
    throw new Error("wild_child_setup_unavailable");
  b.setup = "active";
  windows.set(b.world, {
    isCurrent,
    targets: new Map(
      b.world
        .getAliveEntityIds()
        .filter((id) => id !== b.actorId)
        .map((id) => [id, captureChoiceTarget(b.world, id)!]),
    ),
  });
}
export function validWildChildChoice(b: WildChildBinding): boolean {
  const w = windows.get(b.world);
  return (
    !!w &&
    w.isCurrent() &&
    b.setup === "active" &&
    validWildChildOwner(b) &&
    b.state.status === "pending" &&
    b.state.remaining === 1 &&
    b.state.choice === null &&
    [...w.targets.values()].every((p) => !!p && sameChoiceTarget(b.world, p))
  );
}
export function authorizedWildChild(
  world: World,
  actorId: number,
  day: number | undefined,
  phase: Phase,
  scope: object | undefined,
): boolean {
  const b = bindings.get(world);
  return (
    !!b &&
    b === scope &&
    actorId === b.actorId &&
    day === 1 &&
    phase === Phase.Night &&
    validWildChildChoice(b)
  );
}
export function bindWildChildRequest(world: World, request: ActionRequest): void {
  const b = bindings.get(world);
  if (
    b &&
    request.context.stage === "wild_child" &&
    request.phase === Phase.Night &&
    request.context.day === 1 &&
    request.actorId === b.actorId &&
    validWildChildChoice(b)
  ) {
    requests.set(request, { binding: b, context: request.context });
    registerRequestAliasPropagation(request, 30, inheritWildChildDeadlineRequest);
  }
}
export function wildChildRequestScope(
  world: World,
  request: ActionRequest,
): WildChildBinding | undefined {
  const a = requests.get(request);
  return a &&
    a.binding.world === world &&
    request.actorId === a.binding.actorId &&
    request.context === a.context &&
    request.context.stage === "wild_child" &&
    request.context.day === 1 &&
    request.phase === Phase.Night &&
    validWildChildChoice(a.binding)
    ? a.binding
    : undefined;
}
export function inheritWildChildDeadlineRequest(
  source: ActionRequest,
  target: ActionRequest,
): void {
  const b = requests.get(source);
  if (!b || !wildChildRequestScope(b.binding.world, source)) return;
  const keys = Object.keys(source).filter((k) => k !== "deadlineAtMs"),
    other = Object.keys(target).filter((k) => k !== "deadlineAtMs");
  if (
    keys.length === other.length &&
    keys.every((k) => other.includes(k) && Reflect.get(source, k) === Reflect.get(target, k))
  ) {
    requests.set(target, b);
    registerRequestAliasPropagation(target, 30, inheritWildChildDeadlineRequest);
  }
}
export function commitWildChildChoice(b: WildChildBinding, targetId: number): boolean {
  const target = windows.get(b.world)?.targets.get(targetId);
  if (!validWildChildChoice(b) || !target || !sameChoiceTarget(b.world, target)) return false;
  const choice = { day: 1 as const, targetId };
  if (
    !["remaining", "status", "choice"].every(
      (k) => Object.getOwnPropertyDescriptor(b.state, k)?.writable,
    )
  )
    return false;
  b.state.remaining = 0;
  b.state.status = "chosen";
  b.state.choice = choice;
  b.model = target.life;
  b.expectedState = safeJson(b.state);
  b.setup = "complete";
  windows.delete(b.world);
  return true;
}
export function closeWildChildChoice(b: WildChildBinding, status: "failed" | "cancelled"): void {
  if (b.setup === "complete") return;
  b.setup = status;
  windows.delete(b.world);
  if (["remaining", "status"].every((k) => Object.getOwnPropertyDescriptor(b.state, k)?.writable)) {
    b.state.remaining = 0;
    b.state.status = "closed";
    b.expectedState = safeJson(b.state);
  }
}
/** Called immediately before an actual engine-owned Alive commit, never by queries or raw proposals. */
export function recordWildChildDeathCommit(world: World, id: number): void {
  const b = bindings.get(world);
  if (!b || !validWildChildIdentity(b)) return;
  if (id === b.actorId && livingNightLife(world, b.actor.life)) b.actorDeath = true;
  if (
    b.setup === "complete" &&
    !b.modelCommitted &&
    b.state.status === "chosen" &&
    b.model?.id === id &&
    livingNightLife(world, b.model)
  )
    b.modelDeath = true;
}
/** Full pending wave is marked before this call; later shot waves have separate commits. */
export function resolveWildChildDeathWave(
  world: World,
  ids: readonly number[],
  sources: DeathSources,
  day: number,
  phase: Phase,
  events: GameEvent[],
): void {
  const b = bindings.get(world),
    model = b?.model;
  if (
    !b ||
    !model ||
    !b.modelDeath ||
    b.modelCommitted ||
    !ids.includes(model.id) ||
    world.getComponent(model.id, COMPONENT.Alive) !== model.life ||
    model.life.alive ||
    aliveLifeVersion(model.life) !== model.version + 1
  )
    return;
  b.modelCommitted = true;
  const deathCommit = `wild-model:${b.actorId}:${model.id}:${day}`;
  events.push({
    timestamp: Date.now(),
    type: "wild_child_model_eliminated",
    payload: {
      actorId: b.actorId,
      targetId: model.id,
      day,
      phase,
      deathCommit,
      sources: [...(sources[model.id] ?? [])],
      deadIds: [...ids],
    },
  });
  if (
    !validWildChildOwner(b) ||
    b.state.status !== "chosen" ||
    b.actor.camp !== Camp.Good ||
    !["status", "eligibleNight"].every(
      (k) => Object.getOwnPropertyDescriptor(b.state, k)?.writable,
    ) ||
    !Object.getOwnPropertyDescriptor(b.actor.role, "camp")?.writable
  )
    return;
  const camp = createCampComponent(Camp.Wolf, world.locale),
    victory = createVictoryComponent([{ kind: "faction", faction: Camp.Wolf }]);
  b.actor.role.camp = Camp.Wolf;
  world.addComponent(b.actorId, COMPONENT.Camp, camp);
  world.addComponent(b.actorId, COMPONENT.Victory, victory);
  b.actor.camp = Camp.Wolf;
  b.camp = camp;
  b.victory = victory;
  b.victoryJson = safeJson(victory);
  b.state.status = "transformed";
  b.state.eligibleNight = day + 1;
  b.expectedState = safeJson(b.state);
  events.push({
    timestamp: Date.now(),
    type: "wild_child_transformed",
    payload: { actorId: b.actorId, day, eligibleNight: day + 1, camp: Camp.Wolf, deathCommit },
  });
}
export function wildChildPackKnown(role: RoleComponent, world?: World): boolean {
  const b = world && bindings.get(world);
  if (
    !b ||
    b.actor.role !== role ||
    !validWildChildIdentity(b) ||
    b.setup !== "complete" ||
    b.state.status !== "active"
  )
    return false;
  return (
    livingNightLife(b.world, b.actor.life) ||
    (b.actorDeath &&
      b.world.getComponent(b.actorId, COMPONENT.Alive) === b.actor.life.life &&
      !b.actor.life.life.alive &&
      aliveLifeVersion(b.actor.life.life) === b.actor.life.version + 1)
  );
}
export function wildChildPackActive(role: RoleComponent, world?: World): boolean {
  const b = world && bindings.get(world);
  return !!b && wildChildPackKnown(role, world) && validWildChildOwner(b);
}
export function openWildChildNight(world: World, day: number, events: GameEvent[]): () => void {
  const b = bindings.get(world);
  if (!b) return () => {};
  if (hasActiveWildChild(world) || hasWildChildNightCommit(world, day) || !wildChildReady(world))
    throw new Error("wild_child_night_unavailable");
  const days = nights.get(world) ?? new Set<number>();
  days.add(day);
  nights.set(world, days);
  activeNights.add(world);
  try {
    if (
      validWildChildOwner(b) &&
      b.state.status === "transformed" &&
      b.state.eligibleNight !== null &&
      day >= b.state.eligibleNight &&
      ["status", "activeFromNight"].every(
        (k) => Object.getOwnPropertyDescriptor(b.state, k)?.writable,
      )
    ) {
      b.state.status = "active";
      b.state.activeFromNight = day;
      b.expectedState = safeJson(b.state);
      events.push({
        timestamp: Date.now(),
        type: "wild_child_pack_activated",
        payload: { actorId: b.actorId, day, eligibleNight: b.state.eligibleNight },
      });
    }
  } catch (error) {
    activeNights.delete(world);
    throw error;
  }
  return () => {
    activeNights.delete(world);
  };
}
