/**
 * 负责觉醒骑士真实夜前原体绑定。输入完整内建夜state与角色名单，输出同World唯一执行frame，不请求玩家行动。
 * 时点priority50早于任何狼夜聊／技能Provider；即使N1无决斗，也不让首白天前同号换体继承尝试资格。
 * 原体或私库失效永久拒新请求，只有authority持原actor proof；不写Alive、库存或阶段。
 */
import { Role } from "@ai-werewolf-arena/game-contract";
import type { TrustedNightStageHandler } from "../../engine/night/trusted-runtime";
import { prepareAwakenedKnight } from "./authority";
export const AWAKENED_KNIGHT_PREPARE_STAGE: TrustedNightStageHandler = {
  id: "awakened_knight_prepare",
  priority: 50,
  async execute(ctx) {
    const actors = ctx.getAliveByRole(Role.AwakenedKnight),
      day = ctx.currentDay();
    if (!actors.length) return;
    if (actors.length !== 1) throw new Error("awakened_knight_actor_count_invalid");
    prepareAwakenedKnight(ctx.world, actors[0]!, () => ctx.isCurrent() && ctx.currentDay() === day);
  },
};
export const OWNED_NIGHT_STAGE_PROGRAMS = [
  [AWAKENED_KNIGHT_PREPARE_STAGE, AWAKENED_KNIGHT_PREPARE_STAGE.execute],
] as const;
