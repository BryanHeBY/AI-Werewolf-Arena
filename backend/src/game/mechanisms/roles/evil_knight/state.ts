/**
 * 负责恶灵骑士私有状态、查验反射权利及玩家字段投影；输入是原角色与查验上下文。
 * 保留免疫检查、反射付款与原体绑定；运行状态引用不是玩家 DTO，替换状态不能复用旧权利。
 * 玩家投影只复制政策、枪政策与反射余量，不交出 isCurrent 或写句柄。
 */
import type {
  EvilKnightShotPolicy,
  EvilKnightState,
  EvilKnightReadState,
} from "@ai-werewolf-arena/game-contract";
import { types } from "node:util";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, Role, type EntityId } from "../../../../core/domain/identity";
import {
  captureNightLife,
  livingNightLife,
  type NightLifeScope,
  type NightRetaliationAttack,
} from "../../../../core/domain/night_effects";
import type { World } from "../../../../core/domain/world";

export const EVIL_KNIGHT_ROLE = "evil_knight" as const;
export const EVIL_KNIGHT_POLICY = "awa_evil_knight_v1" as const;
function data(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d ? d.value : undefined;
}
export function freshEvilKnightState(
  shotPolicy: EvilKnightShotPolicy = "night_shot_immune",
): EvilKnightState {
  return { policy: EVIL_KNIGHT_POLICY, shotPolicy, reflectionRemaining: 1 };
}
export function getEvilKnightState(
  role: RoleComponent | undefined,
): EvilKnightReadState | undefined {
  if (data(role, "role") !== EVIL_KNIGHT_ROLE || data(role, "camp") !== Camp.Wolf) return undefined;
  const state = data(data(role, "privateState"), "evilKnight");
  const shot = data(state, "shotPolicy"),
    remaining = data(state, "reflectionRemaining");
  return data(state, "policy") === EVIL_KNIGHT_POLICY &&
    (shot === "night_shot_immune" || shot === "hunter_shot_bypasses") &&
    (remaining === 0 || remaining === 1)
    ? (state as EvilKnightReadState)
    : undefined;
}
/** 在等待其他玩家提交前绑定原体；每次提交仍校验生命、组件、私有容器与政策未被替换。 */
export function captureEvilKnight(world: World, target: NightLifeScope) {
  const role = world.getComponent(target.id, COMPONENT.Role);
  const state = getEvilKnightState(role);
  if (!role || !state || !livingNightLife(world, target)) return null;
  const privateState = role.privateState,
    shotPolicy = state.shotPolicy;
  const isCurrent = () =>
    livingNightLife(world, target) &&
    world.getComponent(target.id, COMPONENT.Role) === role &&
    role.privateState === privateState &&
    getEvilKnightState(role) === state &&
    state.shotPolicy === shotPolicy;
  return { target, state, isCurrent };
}
export function evilKnightNightShotImmune(world: World, targetId: EntityId): boolean {
  const life = captureNightLife(world, targetId);
  const binding = life && captureEvilKnight(world, life);
  return !!binding && binding.state.shotPolicy === "night_shot_immune" && binding.isCurrent();
}
/** 仅在原生预言家查验或女巫毒药已被接受并付款后调用；反射本身不重复消耗原行动。 */
export function commitEvilKnightReflection(
  world: World,
  binding: ReturnType<typeof captureEvilKnight>,
  caster: NightLifeScope,
  trigger: "seer_check" | "poison",
  casterCurrent: () => boolean,
): NightRetaliationAttack | null {
  const casterRole = world.getComponent(caster.id, COMPONENT.Role);
  const expected = trigger === "seer_check" ? Role.Seer : Role.Witch;
  if (
    !binding ||
    !binding.isCurrent() ||
    binding.state.reflectionRemaining !== 1 ||
    !livingNightLife(world, caster) ||
    !casterCurrent() ||
    casterRole?.role !== expected ||
    casterRole.camp !== Camp.Good
  )
    return null;
  const privateState = casterRole.privateState;
  (binding.state as Pick<EvilKnightState, "reflectionRemaining">).reflectionRemaining = 0;
  return {
    actorId: binding.target.id,
    target: caster,
    isCurrent: () =>
      binding.isCurrent() &&
      binding.state.reflectionRemaining === 0 &&
      livingNightLife(world, caster) &&
      casterCurrent() &&
      world.getComponent(caster.id, COMPONENT.Role) === casterRole &&
      casterRole.role === expected &&
      casterRole.camp === Camp.Good &&
      casterRole.privateState === privateState,
  };
}

/** 字段裁剪由机制拥有；只返回纯数据副本，不把反射运行绑定带进玩家观察。 */
export function projectEvilKnightState(
  role: RoleComponent | undefined,
): EvilKnightState | undefined {
  const evilKnight = getEvilKnightState(role);
  if (evilKnight)
    return {
      policy: evilKnight.policy,
      shotPolicy: evilKnight.shotPolicy,
      reflectionRemaining: evilKnight.reflectionRemaining,
    };
}
