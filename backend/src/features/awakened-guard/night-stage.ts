/**
 * 负责觉醒守卫实际开夜单位及狼刀前选择。输入为可信原夜state，输出本周期原历史和私有选择事实。
 * 时点固定priority300，与原普通守卫位次一致；scope只绑定实际state身份，不凭day标签增发资源。
 * 夜窗关闭不结束已付全天盾，真实日终归具名日计划；失败不补正常unused，也不回滚已付前缀。
 */
import { Phase, type Role } from "@ai-werewolf-arena/game-contract";
import {
  AWAKENED_GUARD_POLICY,
  AWAKENED_GUARD_ROLE_ID,
} from "@ai-werewolf-arena/game-contract/facts/awakened-guard";
import type { TrustedNightStageHandler } from "../../engine/night/trusted-runtime";
import { beginGuardCycle, openGuardBoundary } from "./authority";
import { runGuardBoundary } from "./window";
export const AWAKENED_GUARD_PREPARE_STAGE: TrustedNightStageHandler = {
  id: "awakened_guard_prepare",
  priority: 50,
  async execute(ctx) {
    const actors = ctx.getAliveByRole(AWAKENED_GUARD_ROLE_ID as Role);
    if (!actors.length) return;
    if (actors.length !== 1) throw new Error("awakened_guard_actor_count_invalid");
    const actorId = actors[0]!,
      day = ctx.currentDay(),
      current = () => ctx.isCurrent() && ctx.currentDay() === day;
    beginGuardCycle(ctx.world, actorId, day, ctx.state, current);
    ctx.events.push({
      timestamp: Date.now(),
      type: "awakened_guard_cycle_started",
      payload: { policy: AWAKENED_GUARD_POLICY, actorId, day },
      audience: Object.freeze([actorId]),
    });
  },
};
export const AWAKENED_GUARD_NIGHT_STAGE: TrustedNightStageHandler = {
  id: "awakened_protection",
  priority: 300,
  async execute(ctx) {
    const actors = ctx.getAliveByRole(AWAKENED_GUARD_ROLE_ID as Role);
    if (!actors.length) return;
    if (actors.length !== 1) throw new Error("awakened_guard_actor_count_invalid");
    const day = ctx.currentDay(),
      current = () => ctx.isCurrent() && ctx.currentDay() === day;
    const boundary = openGuardBoundary(ctx.world, day, ctx.state, "night");
    if (!boundary) throw new Error("awakened_guard_night_boundary_missing");
    await runGuardBoundary(
      {
        world: ctx.world,
        events: ctx.events,
        requests: new ctx.requestFactory(ctx.world, ctx.events, day),
        provider: ctx.actionProvider,
        gateway: ctx.toolGateway,
        phase: Phase.Night,
        current,
      },
      boundary,
    );
  },
};
export const OWNED_NIGHT_STAGE_PROGRAMS = [
  [AWAKENED_GUARD_PREPARE_STAGE, AWAKENED_GUARD_PREPARE_STAGE.execute],
  [AWAKENED_GUARD_NIGHT_STAGE, AWAKENED_GUARD_NIGHT_STAGE.execute],
] as const;
