/**
 * Opens Eclipse suppression over the exact original ability slots. Inputs are captured
 * source/target components and suppression kind; outputs are current suppression leases with read-only marker/ability references and
 * owned state changes. It never reauthorizes a changed slot or policy by restoring an unrelated
 * component.
 */
import type { EclipseSuppression } from "@ai-werewolf-arena/game-contract";

import { types } from "node:util";
import { COMPONENT } from "../../../../core/domain/components/names";

import {
  aliveLifeDescriptor,
  type AliveComponent,
  aliveLifeVersion,
} from "../../../../core/domain/components/alive";
import { captureNightLife } from "../../../../core/domain/night_effects";
import type { World } from "../../../../core/domain/world";
import type { NightAbilityReadView } from "../abilities";
import { RADIANT_ECLIPSE_POLICY } from "./state";

export type SuppressibleAbility = NightAbilityReadView;
const invalid = Symbol("invalid_eclipse_binding");
function own(value: unknown, key: PropertyKey): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return invalid;
  const field = Object.getOwnPropertyDescriptor(value, key);
  return field && "value" in field ? field.value : field ? invalid : undefined;
}

function plain(value: unknown): value is object {
  if (!value || typeof value !== "object" || types.isProxy(value) || Array.isArray(value))
    return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
function factoryLife(value: AliveComponent | undefined): value is AliveComponent {
  if (!plain(value)) return false;
  const original = aliveLifeDescriptor(value as AliveComponent),
    actual = Object.getOwnPropertyDescriptor(value, "alive");
  return (
    !!original &&
    !!actual &&
    original.get === actual.get &&
    original.set === actual.set &&
    original.enumerable === actual.enumerable &&
    original.configurable === actual.configurable
  );
}
function canonicalSlot(value: object, key: string, expected: unknown): boolean {
  const field = Object.getOwnPropertyDescriptor(value, key);
  return (
    !!field &&
    "value" in field &&
    field.value === expected &&
    field.enumerable === true &&
    field.configurable === true &&
    field.writable === true
  );
}

/** One native instance's temporary blocker; persistent disabled belongs to its existing owner. */
export function openEclipseSuppression(
  world: World,
  actorId: number,
  ability: SuppressibleAbility,
  day: number,
) {
  const role = world.getComponent(actorId, COMPONENT.Role);
  const originalLife = world.getComponent(actorId, COMPONENT.Alive);
  if (!factoryLife(originalLife)) throw new Error("eclipse_native_suppression_invalid");
  const life = captureNightLife(world, actorId);
  const privateState = own(role, "privateState"),
    container = own(privateState, "abilities");
  const id = own(ability, "id"),
    kind = own(ability, "kind"),
    state = own(ability, "state"),
    source = own(ability, "source");
  const roleKind = own(role, "role"),
    camp = own(role, "camp");
  const identity = world.getComponent(actorId, COMPONENT.Identity);
  const identityFields = ["id", "seat", "name", "sessionId"] as const;
  const identityValues = identityFields.map((key) => own(identity, key));
  const disabled = own(ability, "disabled");
  if (
    !role ||
    !plain(ability) ||
    !plain(privateState) ||
    !plain(container) ||
    !plain(state) ||
    !plain(source) ||
    !life ||
    !Number.isSafeInteger(day) ||
    day < 2 ||
    typeof id !== "string" ||
    !id.startsWith("native:") ||
    own(container, id) !== ability ||
    own(source, "kind") !== "native" ||
    own(source, "role") !== roleKind ||
    own(ability, "nightSuppression") !== undefined ||
    typeof disabled !== "boolean" ||
    [privateState, container, kind, state, source, roleKind, camp, ...identityValues].includes(
      invalid,
    ) ||
    !identity
  )
    throw new Error("eclipse_native_suppression_invalid");
  const marker: EclipseSuppression = { policy: RADIANT_ECLIPSE_POLICY, day };
  Object.defineProperty(ability, "nightSuppression", {
    value: marker,
    writable: true,
    enumerable: true,
    configurable: true,
  });
  let closed = false;
  const sameResource = (allowFirstDeath = false) => {
    if (
      world.getComponent(actorId, COMPONENT.Role) !== role ||
      own(role, "privateState") !== privateState ||
      own(privateState, "abilities") !== container ||
      own(container, id) !== ability ||
      world.getComponent(actorId, COMPONENT.Alive) !== life.life
    )
      return false;
    const original = aliveLifeDescriptor(life.life),
      current = Object.getOwnPropertyDescriptor(life.life, "alive");
    if (
      !original ||
      !current ||
      current.get !== original.get ||
      current.set !== original.set ||
      current.configurable !== original.configurable ||
      current.enumerable !== original.enumerable
    )
      return false;
    const version = aliveLifeVersion(life.life);
    return (
      (version === life.version && life.life.alive) ||
      (allowFirstDeath && version === life.version + 1 && !life.life.alive)
    );
  };
  const sameInstance = () =>
    sameResource() &&
    plain(ability) &&
    plain(privateState) &&
    plain(container) &&
    plain(state) &&
    plain(source) &&
    own(role, "role") === roleKind &&
    own(role, "camp") === camp &&
    own(ability, "id") === id &&
    own(ability, "kind") === kind &&
    own(ability, "state") === state &&
    own(ability, "source") === source &&
    own(source, "kind") === "native" &&
    own(source, "role") === roleKind &&
    world.getComponent(actorId, COMPONENT.Identity) === identity &&
    identityFields.every((key, index) => own(identity, key) === identityValues[index]);
  return {
    actorId,
    day,
    ability,
    marker: marker as Readonly<EclipseSuppression>,
    isCurrent: () =>
      !closed &&
      sameInstance() &&
      own(ability, "disabled") === disabled &&
      canonicalSlot(ability, "nightSuppression", marker) &&
      Object.getPrototypeOf(marker) === Object.prototype &&
      Reflect.ownKeys(marker).length === 2 &&
      canonicalSlot(marker, "policy", RADIANT_ECLIPSE_POLICY) &&
      canonicalSlot(marker, "day", day),
    close(): boolean {
      if (closed) return false;
      closed = true;
      if (!sameResource(true) || own(ability, "nightSuppression") !== marker) return false;
      delete (ability as { nightSuppression?: Readonly<EclipseSuppression> }).nightSuppression;
      return true;
    },
  };
}
