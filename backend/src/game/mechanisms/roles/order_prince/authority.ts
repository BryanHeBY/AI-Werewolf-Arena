import { types } from "node:util";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { aliveLifeDescriptor, aliveLifeVersion } from "../../../../core/domain/components/alive";
import type { World } from "../../../../core/domain/world";
import {
  captureNightLife,
  livingNightLife,
  type NightLifeScope,
} from "../../../../core/domain/night_effects";
import {
  getOrderPrinceState,
  projectOrderPrinceState,
  nextOrderPrinceChoice,
  ORDER_PRINCE_ROLE,
  type OrderPrinceState,
} from "./state";

interface Authority {
  actorId: number;
  role: RoleComponent;
  privateState: RoleComponent["privateState"];
  state: OrderPrinceState;
  expected: string;
  identity: unknown;
  identityValue: string;
  life: NightLifeScope;
  pendingDay: number | null;
}
const bindings = new WeakMap<World, Authority>();
function own(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d ? d.value : undefined;
}
function identityValue(value: unknown): string {
  const values = ["id", "seat", "name", "sessionId"].map((key) => own(value, key));
  if (
    !Number.isSafeInteger(values[0]) ||
    !Number.isSafeInteger(values[1]) ||
    typeof values[2] !== "string" ||
    typeof values[3] !== "string"
  )
    throw new Error("order_prince_identity_invalid");
  return JSON.stringify(values);
}
function requireAuthority(world: World): Authority {
  const b = bindings.get(world);
  if (!b) throw new Error("order_prince_board_missing");
  if (
    world.getComponent(b.actorId, COMPONENT.Role) !== b.role ||
    own(b.role, "privateState") !== b.privateState ||
    getOrderPrinceState(b.role) !== b.state ||
    JSON.stringify(projectOrderPrinceState(b.role)) !== b.expected ||
    world.getComponent(b.actorId, COMPONENT.Identity) !== b.identity ||
    identityValue(b.identity) !== b.identityValue
  )
    throw new Error("order_prince_original_state_revoked");
  const life = b.life.life;
  const expected = aliveLifeDescriptor(life);
  const current = Object.getOwnPropertyDescriptor(life, "alive");
  if (
    world.getComponent(b.actorId, COMPONENT.Alive) !== life ||
    !expected ||
    !current ||
    current.get !== expected.get ||
    current.set !== expected.set ||
    current.enumerable !== expected.enumerable ||
    current.configurable !== expected.configurable ||
    aliveLifeVersion(life) !== b.life.version + (life.alive ? 0 : 1)
  )
    throw new Error("order_prince_original_life_revoked");
  return b;
}
export function installOrderPrinceBoard(world: World): void {
  if (bindings.has(world)) throw new Error("order_prince_board_already_installed");
  const actors = world
    .entityIds()
    .filter((id) => own(world.getComponent(id, COMPONENT.Role), "role") === ORDER_PRINCE_ROLE);
  if (actors.length !== 1) throw new Error("order_prince_original_roster_invalid");
  const actorId = actors[0]!;
  const role = world.getComponent<RoleComponent>(actorId, COMPONENT.Role)!;
  const state = getOrderPrinceState(role);
  const life = captureNightLife(world, actorId);
  const identity = world.getComponent(actorId, COMPONENT.Identity);
  if (!state || state.history.length || !life || own(identity, "id") !== actorId)
    throw new Error("order_prince_original_roster_invalid");
  bindings.set(world, {
    actorId,
    role,
    privateState: role.privateState,
    state,
    expected: JSON.stringify(projectOrderPrinceState(role)),
    identity,
    identityValue: identityValue(identity),
    life,
    pendingDay: null,
  });
}
export function openOrderPrinceChoice(world: World, day: number): number | null {
  const b = requireAuthority(world);
  if (b.pendingDay !== null) throw new Error("order_prince_choice_reentrant");
  if (!livingNightLife(world, b.life)) return null;
  if (!nextOrderPrinceChoice(b.role, day, false)) return null;
  b.pendingDay = day;
  return b.actorId;
}
export function orderPrinceChoicePending(world: World, actorId: number, day: number): boolean {
  const b = requireAuthority(world);
  return (
    b.actorId === actorId &&
    b.pendingDay === day &&
    livingNightLife(world, b.life) &&
    !!nextOrderPrinceChoice(b.role, day, false)
  );
}
export function assertOrderPrinceCurrent(world: World, actorId: number): void {
  const b = requireAuthority(world);
  if (b.actorId !== actorId || !livingNightLife(world, b.life))
    throw new Error("order_prince_actor_stale");
}
export function commitOrderPrinceChoice(
  world: World,
  actorId: number,
  day: number,
  activate: boolean,
): void {
  if (!orderPrinceChoicePending(world, actorId, day)) throw new Error("order_prince_choice_stale");
  const b = requireAuthority(world);
  const next = nextOrderPrinceChoice(b.role, day, activate);
  if (!next) throw new Error("order_prince_choice_invalid");
  b.privateState.orderPrince = next;
  b.state = next;
  b.expected = JSON.stringify(next);
  b.pendingDay = null;
}
export function closeOrderPrinceChoice(world: World): void {
  const b = bindings.get(world);
  if (b) b.pendingDay = null;
}

export function assertOrderPrinceOriginalCurrent(world: World): void {
  const b = requireAuthority(world);
  assertOrderPrinceCurrent(world, b.actorId);
}
