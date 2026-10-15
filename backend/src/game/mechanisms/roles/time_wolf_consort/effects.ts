/**
 * 负责在原时点提交蚀时狼妃反射回执并发表实际反射事实。输入为当前夜上下文、可空回执、来源和效果种类；
 * 输出为 receipt.commit 的原写入及 God 事实。无回执即返回；有回执先核阶段和演员，再 commit，反射时才发布。
 * 事实失败不撤回已提交回执，本模块不重算映射、重选目标或授予库存。
 */
import type { NightStageContext } from "../../stages/night/contracts";
import type { TimeConsortReceipt } from "./night_frame";
import { timeConsortActorId } from "./night_frame";
export function commitTimeConsortEffect(
  ctx: NightStageContext,
  receipt: TimeConsortReceipt | null,
  day: number,
  sourceId: number,
  kind: "check" | "guard" | "poison",
): void {
  if (!receipt) return;
  if (!ctx.isCurrent() || ctx.currentDay() !== day) throw new Error("time_consort_effect_stale");
  const actorId = timeConsortActorId(ctx.world);
  if (actorId === null) throw new Error("time_consort_actor_missing");
  // 先提交真实回执，后判断是否发表反射事实；事件push抛错不能伪造未付款。
  receipt.commit();
  if (receipt.reflected)
    ctx.events.push({
      timestamp: Date.now(),
      type: "time_consort_reflected",
      payload: {
        actorId,
        day,
        sourceId,
        requestedId: receipt.requestedId,
        effectiveId: receipt.effectiveId,
        kind,
      },
      audience: Object.freeze([]),
    });
}
