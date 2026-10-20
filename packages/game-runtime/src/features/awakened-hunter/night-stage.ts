/**
 * 负责在真实N1冻结觉醒猎人原生命与实际座位环。输入可信夜上下文，输出同一owner绑定而无Agent请求；
 * 此时所有本板玩家尚未实际死亡，后续死亡不能通过临时新body重新捕获资格。
 * 只在首夜发生，当前性失败原样终止；不付款、不发布角色信息、不改变生命或阶段。
 */
import { Role } from "@ai-werewolf-arena/game-contract";
import type { TrustedNightStageHandler } from "../../engine/night/trusted-runtime";
import { bindAwakenedPatrol } from "./authority";
export const AWAKENED_PATROL_BIND_STAGE: TrustedNightStageHandler = {
  id: "awakened_patrol_bind",
  priority: 60,
  async execute(ctx) {
    if (ctx.currentDay() !== 1) return;
    const actors = ctx.getAliveByRole(Role.AwakenedHunter);
    if (actors.length > 1) throw new Error("awakened_patrol_actor_count_invalid");
    if (!actors.length) return;
    if (!ctx.isCurrent()) throw new Error("awakened_patrol_bind_revoked");
    bindAwakenedPatrol(ctx.world, actors[0]!);
    if (!ctx.isCurrent() || ctx.currentDay() !== 1) throw new Error("awakened_patrol_bind_revoked");
  },
};
export const OWNED_NIGHT_STAGE_PROGRAMS = Object.freeze([
  [AWAKENED_PATROL_BIND_STAGE, AWAKENED_PATROL_BIND_STAGE.execute] as const,
]);
