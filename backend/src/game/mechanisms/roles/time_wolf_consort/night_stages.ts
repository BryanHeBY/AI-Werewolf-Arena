/**
 * 负责在受影响原生动作之前执行蚀时狼妃锁定阶段。输入为原夜 frame、请求及校验后的选择，
 * 输出为原私有锁定／跳过事实；反射付款仍在之后具体原生效果回执的提交时点。
 * 等待及网关前后保原名单／当前日复验，提交历史先于事件发布；失败不回滚已付前缀。
 */
import type { AliveComponent } from "../../../../domain/components/alive";
import { COMPONENT } from "../../../../domain/components/names";
import type { RoleComponent } from "../../../../domain/components/role";
import { Phase } from "../../../../domain/identity";
import type { NightStageHandler } from "../../stages/night/contracts";
import { getTimeConsortState } from "./state-slot";
import {
  timeConsortActorId,
  assertTimeConsortRosterCurrent,
  beginTimeConsortNight,
  commitTimeConsortChoice,
  timeConsortChoiceTargets,
} from "./night_frame";
/** 按配置角色集收集并执行此阶段，蚀时狼妃死亡后仍执行原跳过分支。 */
export const TIME_CONSORT_LOCK_STAGE: NightStageHandler = {
  id: "time_consort_lock",
  priority: 50,
  async execute(ctx) {
    const day = ctx.currentDay(),
      actorId = beginTimeConsortNight(ctx.world, day);
    if (actorId === null) {
      const id = timeConsortActorId(ctx.world);
      if (id === null) throw new Error("time_consort_actor_missing");
      const reason = ctx.world.getComponent(id, COMPONENT.Alive)!.alive ? "exhausted" : "dead";
      ctx.events.push({
        timestamp: Date.now(),
        type: "time_consort_lock_skipped",
        payload: { actorId: id, day, reason },
        audience: Object.freeze([id]),
      });
      return;
    }
    const role = ctx.world.getComponent(actorId, COMPONENT.Role);
    if (!getTimeConsortState(role, () => ctx.world.getComponent(actorId, COMPONENT.Camp))) throw new Error("time_consort_actor_invalid");
    const request = ctx.makeRequest(actorId, ["lock_time"], {
      stage: "time_consort_lock",
      requiresAction: true,
      action_failure_policy: "error",
      allow_fallback: false,
      consort_candidates: timeConsortChoiceTargets(ctx.world, day),
    });
    assertTimeConsortRosterCurrent(ctx.world);
    const action = await ctx.actionProvider.getAction(request);
    assertTimeConsortRosterCurrent(ctx.world);
    if (!ctx.isCurrent() || ctx.currentDay() !== day) throw new Error("time_consort_lock_stale");
    if (action?.name !== "lock_time") throw new Error("time_consort_lock_action_missing");
    const validated = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
      phase: Phase.Night,
      day,
    });
    assertTimeConsortRosterCurrent(ctx.world);
    if (!ctx.isCurrent() || ctx.currentDay() !== day) throw new Error("time_consort_lock_stale");
    if (!validated.ok || validated.sanitizedCall?.name !== "lock_time")
      throw new Error("time_consort_lock_action_invalid");
    const args = validated.sanitizedCall.args;
    const targetId = args.abstain ? null : args.target_id!;
    commitTimeConsortChoice(ctx.world, actorId, day, targetId);
    ctx.events.push({
      timestamp: Date.now(),
      type: "time_consort_lock_committed",
      payload: {
        actorId,
        day,
        targetId,
      },
      audience: Object.freeze([actorId]),
    });
  },
};
