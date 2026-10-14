/**
 * 负责恶夜骑士唯一 live 状态槽的创建、原字段校验、同引用读取及玩家字段副本。
 * 输入是原角色容器或明确枪政策；输出为原状态引用／新状态／纯数据副本，不提供生命或行动许可。
 * 安装与反射余量写入只收本族实际数据步骤；原体、夜窗口与付款资格仍由 frame／反射命令复核。
 * 方法表冻结不冻结状态或副本；仍接受原字段宽度，Proxy／访问器拒绝不等于严格档案 decoder。
 */
import type { EvilKnightShotPolicy, EvilKnightState, EvilKnightReadState } from "@ai-werewolf-arena/game-contract";
import { types } from "node:util";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp } from "../../../../core/domain/identity";

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

/** 先求原左值容器，再调用原 creator 与读取／解析枪政策；任一 getter 或 setter 失败保原前缀。 */
function installEvilKnightState(
  privateState: () => Record<string, unknown>,
  shotPolicy: () => EvilKnightShotPolicy,
): void {
  privateState().evilKnight = freshEvilKnightState(shotPolicy());
}

/** 唯一反射余量写入点；调用方已完成原资格复核。写失败不构造效果，写成功后的失败不退款。 */
function consumeEvilKnightReflection(state: () => EvilKnightReadState): void {
  (state() as Pick<EvilKnightState, "reflectionRemaining">).reflectionRemaining = 0;
}

/** 原状态与引用只保存在角色容器；本表不另存库存、checkpoint、生命绑定或夜 Map。 */
export const EVIL_KNIGHT_STATE_SLOT = Object.freeze({
  create: freshEvilKnightState,
  schema: getEvilKnightState,
  get: getEvilKnightState,
  project: projectEvilKnightState,
  install: installEvilKnightState,
  allowedWrites: Object.freeze({ consumeReflection: consumeEvilKnightReflection }),
});
