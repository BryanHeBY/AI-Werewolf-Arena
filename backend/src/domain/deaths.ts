/**
 * 负责运行时死亡枪选择与死因资格政策。输入为原生命句柄、死因、政策和来源阶段；
 * 输出为选择类型及原 permitsDeathShot／permitsHunterShot 结果，保持原拒绝顺序。
 * 序列化死因来自公共契约，回调、组件引用与行动权限仅留在领域内部。
 * 混合死因必须全部合格，不能用其中一项狼刀／放逐掩盖毒或关系牵连的抑制。
 */
import { Phase } from "./identity";
import type { DeathActionPolicy } from "./board";
import type { NightLifeScope } from "./night-effects";
import { DeathCause } from "@ai-werewolf-arena/game-contract";
import type { RequestLeaseTurn } from "./request-lease";
export { DeathCause } from "@ai-werewolf-arena/game-contract";
export type { DeathSources } from "@ai-werewolf-arena/game-contract";

/** shot／pass 带原行动窗口 ID；invalid 未授权，不能被当作已付款的弃枪。 */
export type DeathShotSelection =
  | {
      kind: "shot";
      targetId: number;
      deathActionId: number;
      targetScope?: NightLifeScope;
      mappedMiss?: true;
      mappingCurrent?: () => boolean;
      /** 仅可信新资源路径持内存交付句柄；公开 hook 与玩家事件不会获得它。 */
      requestDelivery?: RequestLeaseTurn;
    }
  | { kind: "pass"; deathActionId: number; requestDelivery?: RequestLeaseTurn }
  | { kind: "invalid" };

export function permitsDeathShot(
  sources: readonly DeathCause[],
  policy: DeathActionPolicy = "awa_qualified_sources_v1",
  deathPhase?: Phase,
): boolean {
  // day 政策先限制死亡来源为白天／放逐；knife-or-exile 不接受枪击和白狼爆炸。
  if (policy === "awa_day_deaths_v1" && deathPhase !== Phase.Day && deathPhase !== Phase.Voting)
    return false;
  if (
    policy !== "awa_qualified_sources_v1" &&
    policy !== "awa_knife_or_exile_v1" &&
    policy !== "awa_day_deaths_v1"
  )
    return false;
  // 先拒绝未知政策，再逐项校验；混合来源不以“存在一项合格”放宽枪权。
  return (
    sources.length > 0 &&
    sources.every(
      (source) =>
        source === DeathCause.WolfKill ||
        source === DeathCause.MechanicalKnife ||
        source === DeathCause.AwakenedHiddenKnife ||
        source === DeathCause.Exile ||
        (policy !== "awa_knife_or_exile_v1" &&
          (source === DeathCause.Shot || source === DeathCause.WhiteWolfBlast)),
    )
  );
}
/** 猎人兼容入口直接复用同一资格政策，不能维护第二套死因规则。 */
export const permitsHunterShot = permitsDeathShot;
