/**
 * 负责原生能力实例在本夜的蚀日抑制；输入原 World／能力／日次，输出同一 marker 与原体复验／关闭方法。
 * 阵营按原值点晚读实际 Camp 的 own-data，同值组件替换不新增引用撤权；关闭仍归原资源。
 * marker 只写原实例所属槽，持有运行引用不等于玩家数据或新的行动许可；永久 disabled 仍归原能力所有者。
 * 角色、生命、能力与政策被替换后不重新授权；close 先消费 closed，再核原资源与 marker，失败不恢复无关组件。
 * 允许第一次实际死亡的关闭仍只删除同一 marker，不退款、清空库存或改写原永久禁用字段。
 */
import type { EclipseSuppression } from "@ai-werewolf-arena/game-contract";

import { types } from "node:util";
import { COMPONENT } from "../../domain/components/names";

import {
  aliveLifeDescriptor,
  type AliveComponent,
  aliveLifeVersion,
} from "../../domain/components/alive";
import { captureNightLife } from "../../domain/night-effects";
import type { World } from "../../domain/world";
import type { NightAbilityReadView } from "../night-abilities/abilities";
import { RADIANT_ECLIPSE_POLICY } from "./state-data";

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

/** 一个原生实例的临时抑制；永久 disabled 继续由现有能力所有者管理，不在这里改写。 */
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
    camp = own(world.getComponent(actorId, COMPONENT.Camp), "camp");
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
    own(world.getComponent(actorId, COMPONENT.Camp), "camp") === camp &&
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
