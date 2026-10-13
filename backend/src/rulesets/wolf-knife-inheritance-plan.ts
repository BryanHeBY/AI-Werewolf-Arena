/**
 * 负责在原初始装配或已提交追加死亡波检查点，按固定顺序装配四类狼人刀权继承贡献。
 * 输入是原 World、事件与日期的延迟读取端口，输出为各机制的原继承事实和事件前缀。
 * 隐狼、石像鬼、机械狼、觉醒隐狼分别判断真实名单与自身资源；本组合不预先收齐名单、
 * 合并政策、缓存演员或拥有状态。首个错误原样传播并停止后续检查，不回滚已写继承，
 * 不增加 await、阶段变化、判胜、RNG、lease 或通用事件／清理框架。
 */
import { Role, type GameEvent } from "@ai-werewolf-arena/game-contract";
import type { World } from "../core/domain/world";
import { refreshHiddenWolfInheritance } from "../game/mechanisms/roles/hidden_wolf/ports";
import { refreshGargoyleInheritance } from "../game/mechanisms/roles/gargoyle/ports";
import { refreshMechanicalInheritance } from "../game/mechanisms/roles/mechanical_wolf/ports";
import { refreshAwakenedInheritance } from "../game/mechanisms/roles/awakened_hidden_wolf/ports";

/** 只有检查点调用方提供现场读取；贡献对象本身不保存 World、演员或生命版本。 */
export interface WolfKnifeInheritanceRuntime {
  world(): World;
  events(): GameEvent[];
  day(): number;
}

interface WolfKnifeInheritanceContribution {
  readonly role: Role;
  check(runtime: WolfKnifeInheritanceRuntime): void;
}

// 原调用参数顺序有两种，不能统一成一次预读或重排：前两项 W/E/D，后两项 W/D/E。
const contributions: readonly WolfKnifeInheritanceContribution[] = Object.freeze([
  Object.freeze({
    role: Role.HiddenWolf,
    check: (runtime: WolfKnifeInheritanceRuntime) =>
      refreshHiddenWolfInheritance(runtime.world(), runtime.events(), runtime.day()),
  }),
  Object.freeze({
    role: Role.Gargoyle,
    check: (runtime: WolfKnifeInheritanceRuntime) =>
      refreshGargoyleInheritance(runtime.world(), runtime.events(), runtime.day()),
  }),
  Object.freeze({
    role: Role.MechanicalWolf,
    check: (runtime: WolfKnifeInheritanceRuntime) => {
      refreshMechanicalInheritance(runtime.world(), runtime.day(), runtime.events());
    },
  }),
  Object.freeze({
    role: Role.AwakenedHiddenWolf,
    check: (runtime: WolfKnifeInheritanceRuntime) =>
      refreshAwakenedInheritance(runtime.world(), runtime.day(), runtime.events()),
  }),
]);

/** 实际初始／死亡检查点共用同一有序贡献，逐项完成后才读取下一项的现场参数。 */
export function refreshWolfKnifeInheritanceAtCheckpoint(
  runtime: WolfKnifeInheritanceRuntime,
): void {
  for (const contribution of contributions) contribution.check(runtime);
}
