/**
 * 负责守墓人的放逐标签捕获与下一夜反馈交付。输入是原 World／目标／放逐日和原阶段上下文；
 * 输出是按当时查验政策形成的反馈副本，或写入原历史后发布的报告事件。
 * 普通板在标死前捕获已接受目标，动物板在死亡／关单位／事实后按生命门控捕获；真实放逐判定与时点仍归规则组合和经理。
 * 本阶段只交付前一日反馈，按原存活名单和接收日去重；不把查验标签等同于真实阵营，不改变死亡、付款或行动许可。
 * 历史成功写入后才发布事件，后续失败不回滚报告；本模块不替代期限、窗口或原体复验。
 */
import { recordExileFeedback } from "./state";
import { COMPONENT } from "../../../../core/domain/components/names";
import type { World } from "../../../../core/domain/world";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Role, type EntityId, type ExileFeedback } from "../../../../core/domain/model";
import { RoleCatalog } from "../catalog";
import { getDefaultRoleCatalog } from "../role-catalog-assembly";
import { resolveInspection } from "../inspection";
import { getGravekeeperState } from "./state";
import type { NightStageHandler } from "../../stages/night/contracts";

/** 仅捕获此刻的 camp 查验标签，不自行核死亡／放逐资格；普通与动物路径各在原门控点调用。
 * 省略 catalog 时仍在原参数位置取得默认实例，结果再浅复制；下一夜交付沿用原反馈结果，不重新调用查验。 */
export function captureExileFeedback(
  world: World,
  targetId: EntityId,
  exileDay: number,
  catalog: RoleCatalog = getDefaultRoleCatalog(),
): ExileFeedback | null {
  const result = resolveInspection(world, targetId, "camp", catalog);
  return result ? { exileDay, targetId, result: { ...result } } : null;
}

export const GRAVEKEEPER_FEEDBACK_STAGE: NightStageHandler = {
  id: "gravekeeper_feedback",
  priority: 550,
  async execute(ctx) {
    const fact = ctx.previousExile,
      receivedDay = ctx.currentDay();
    // 先读取原反馈与日期，再按当前性／前一日短路；过期或无反馈不读取演员名单。
    if (!ctx.isCurrent() || !fact || fact.exileDay !== receivedDay - 1) return;
    for (const actorId of ctx.getAliveByRole(Role.Gravekeeper)) {
      if (!ctx.isCurrent()) return;
      const role = ctx.world.getComponent(actorId, COMPONENT.Role);
      const state = role?.role === Role.Gravekeeper ? getGravekeeperState(role) : undefined;
      // 每名演员仍先复验当前性与实际角色；原去重只看 receivedDay，不另加目标／放逐日规则。
      if (!state || state.history.some((report) => report.receivedDay === receivedDay)) continue;
      // 原历史提交先于 Date.now／事件复制与 push；发布失败保留已写报告，不能补交或退回历史。
      recordExileFeedback(state, fact, receivedDay);
      ctx.events.push({
        timestamp: Date.now(),
        type: "gravekeeper_reported",
        payload: { ...fact, actorId, receivedDay, result: { ...fact.result } },
      });
    }
  },
};
