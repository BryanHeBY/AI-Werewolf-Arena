/**
 * 负责普通伤害结算之前猎魔夜的完整来源交付：原救／毒 token、狼刀来源闭包与守护封存。
 * 输入是同一夜状态、原 World／日次及本次归属的延迟查询；输出为原运行 token 和保护视图。
 * 先封存已付用药，再复制原投票者与捕获刀口，逐条封存原守护贡献，最后创建原五字段保护。
 * 库存、proof、原体及付款仍由具体权威持有；本组合不新增当前性、回合、schema、清理或提交许可。
 * guardCurrent 在普通伤害清除 marks 之后现场查询；原生撤权不能抹掉独立／未知守护。
 * 这些闭包、token、原组件和贡献只供运行时后续折叠，不是玩家知识或可编码的 JSON 数据。
 */
import {
  sealNativeGuardContribution,
  lateUnknownGuardContribution,
} from "../game/mechanisms/roles/demon_hunter/guard_contribution";
import {
  demonOriginalWolfSourceCurrent,
  demonOriginalWolfTargetCurrent,
  type DemonKnifeProtection,
} from "../game/mechanisms/roles/demon_hunter/ports";
import { sealDeliveredDemonWitchSources } from "../game/mechanisms/roles/demon_hunter/native_potion_controller";
import { COMPONENT } from "../domain/components/names";
import { StatusMark } from "../domain/model";
import { statusMarkSnapshot } from "../domain/components/status-marks";
import { livingNightLife } from "../domain/night-effects";
import type { World } from "../domain/world";
import type { NightStageState } from "../game/mechanisms/stages/night/contracts";

/** 同一阶段状态的窄类型视图；数组、刀口和原生命引用不复制成另一个授权 store。 */
type NightSourceClaims = Pick<NightStageState, "wolfTargetVoters" | "wolfTargetScope" | "guardClaims">;

/** 查询在原表达式位置执行；world／day 仍由返回的来源闭包晚读，不在入口批量缓存。 */
export interface NightSourceDeliveryRuntime {
  ownsDemon(): boolean;
  world(): World;
  day(): number;
  claims(): NightSourceClaims;
}

/** 原三项交付是运行句柄；五字段保护复用本族唯一声明，不公开原库存、proof 或可写 Map。 */
export interface NightSourceDelivery {
  demonSources: object | undefined;
  demonWolfSourceCurrent: ((targetId: number) => boolean) | undefined;
  demonKnifeProtection: DemonKnifeProtection | undefined;
}

/** 同步保持原封存前缀；后续 claim／snapshot 失败不撤销已经成功封存的原 token 或贡献。 */
export function prepareNightSourceDelivery(runtime: NightSourceDeliveryRuntime): NightSourceDelivery {
  const demonSources = runtime.ownsDemon() ? sealDeliveredDemonWitchSources(runtime.world(), runtime.day()) : undefined;
  const demonWolfActors = [...(runtime.claims().wolfTargetVoters ?? [])];
  const knifeScope = runtime.claims().wolfTargetScope;
  const demonWolfTarget = knifeScope?.targetId;
  const demonWolfSourceCurrent = runtime.ownsDemon()
    ? (targetId: number) =>
        targetId === demonWolfTarget &&
        demonOriginalWolfSourceCurrent(runtime.world(), runtime.day(), demonWolfActors) &&
        demonOriginalWolfTargetCurrent(runtime.world(), runtime.day(), targetId)
    : undefined;
  // 守护贡献逐条先封存，普通伤害尚未清印记；后条失败保留前条和用药 token 已封存的前缀。
  const demonGuardSources = runtime.ownsDemon()
    ? (runtime.claims().guardClaims ?? []).flatMap((claim) =>
        claim.contribution
          ? [{ claim, sealed: sealNativeGuardContribution(claim.contribution) }]
          : [],
      )
    : [];
  // 即使不归属猎魔夜，也保持原刀口印记读取；独立守护知识不能被原生资格撤销抹掉。
  const demonUnknownGuard =
    knifeScope && statusMarkSnapshot(knifeScope.marks, StatusMark.GuardMark)?.present === true;
  const demonKnifeProtection =
    runtime.ownsDemon() && knifeScope
      ? Object.freeze({
          targetId: knifeScope.targetId,
          wolf: statusMarkSnapshot(knifeScope.marks, StatusMark.WolfKillMark)?.present === true,
          guard:
            statusMarkSnapshot(knifeScope.marks, StatusMark.GuardMark)?.present === true &&
            (!(runtime.claims().guardClaims ?? []).some(
              (claim) => claim.target.id === knifeScope.targetId,
            ) ||
              (runtime.claims().guardClaims ?? []).some(
                (claim) =>
                  claim.target.id === knifeScope.targetId &&
                  claim.marks === knifeScope.marks &&
                  livingNightLife(runtime.world(), claim.target),
              )),
          guardCurrent: () => {
            const sources = demonGuardSources.filter(
              ({ claim }) => claim.target.id === knifeScope.targetId,
            );
            if (!sources.length)
              return (
                !!demonUnknownGuard ||
                statusMarkSnapshot(
                  runtime.world().getComponent(knifeScope.targetId, COMPONENT.StatusMarks),
                  StatusMark.GuardMark,
                )?.present === true
              );
            // 独立／迟到 unknown 先短路；只有原生贡献分支才晚复验原回调与目标生命。
            return sources.some(
              ({ claim, sealed }) =>
                sealed.unknown ||
                lateUnknownGuardContribution(claim.contribution!) ||
                (sealed.native &&
                  claim.isCurrent?.() === true &&
                  livingNightLife(runtime.world(), claim.target)),
            );
          },
          heal: statusMarkSnapshot(knifeScope.marks, StatusMark.HealMark)?.present === true,
        })
      : undefined;
  return { demonSources, demonWolfSourceCurrent, demonKnifeProtection };
}
