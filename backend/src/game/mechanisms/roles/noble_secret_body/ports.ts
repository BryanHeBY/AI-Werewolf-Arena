/**
 * 负责贵族公开的普通狼刀查询，并提供具体夜间交接和死亡契约关闭入口。
 * 输入是绑定原 World 的目标序号或实际边界的原运行参数；输出保留原允许结果、状态和事实。
 * 查询时的条件第二次 Role 读取与字段失败维持原顺序；死亡写权限和失败、关闭窗口仍属于具体权威所有者。
 * 本入口不复制组件、不授予新生命或库存权限，也不提前提交贵族与侍从契约。
 * 玩家投影与请求 scope 沿原查询时点执行；已告知契约与当前许可不互相替代。
 */
import { Role, type EntityId } from "../../../../domain/identity";
import { COMPONENT } from "../../../../domain/components/names";
import type { World } from "../../../../domain/world";
import { readNobleState } from "./state";

export interface NobleKnifeTargetQuery {
  allows(targetId: EntityId): boolean;
}

export function bindNobleKnifeTargetQuery(world: World): NobleKnifeTargetQuery {
  return Object.freeze({
    allows: (targetId: EntityId) =>
      world.getComponent(targetId, COMPONENT.Role)?.role !== Role.NightNoble ||
      readNobleState(
        (
          world.getComponent(targetId, COMPONENT.Role) as
            { readonly privateState: { readonly noble?: unknown } } | undefined
        )?.privateState.noble,
      )?.wolfActionPolicy === "standard",
  });
}

export {
  NobleNightUnit,
  createNobleNightAbortReceiver,
  attachNobleNightReceiver,
  nobleNightReceiver,
} from "./night-lifecycle";
export type {
  NobleNightAbortReceiver,
  NobleNightReceiver,
  NobleNightRuntime,
  NobleOpeningFact,
} from "./night-lifecycle";
export {
  checkpointNobleBodyAuthority,
  assertNobleBodyRosterCurrent,
  isNobleBodyBoard,
  expireServantAtNightEnd,
  resolveSecretBodyDamage,
} from "./authority";
export { appendNobleContractClosure } from "./facts";

export { closeServantForDeath } from "./authority";

export { expireNobleNight } from "./night-lifecycle";

export { nobleBodyRequestScope } from "./requests";

export { publishNobleNightDamage } from "./night-damage-publication";
