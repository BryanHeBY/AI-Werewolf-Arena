/**
 * 负责鬼魂新娘伴侣聊天及婚约狼刀请求。输入为绑定婚约夜、原参与者和已验证选择；输出为聊天结算、刀口与事实。
 * 婚约权威拥有原付款、投票和关闭；本阶段保 await 后真实复验，不令旧 pending 请求重新有效。
 * priority=150／400 的原顺序保持，过期普通／婚约狼刀清理归规则组合，历史票不重建或退款。
 */
import { StatusMark, COMPONENT } from "../../../../core/domain";
import { aliveLifeVersion, type AliveComponent } from "../../../../core/domain/components/alive";
import type { NightStageHandler } from "../../stages/night/contracts";
import { executeWeddingTurn } from "./setup";
import {
  weddingPair,
  weddingNightCapture,
  resolveWeddingKnife,
  weddingKnifeCurrent,
} from "./authority";
export const WEDDING_CHAT_STAGE: NightStageHandler = {
  id: "ghost_bride_chat",
  priority: 150,
  async execute(ctx) {
    const day = ctx.currentDay(),
      pair = weddingPair(ctx.world);
    if (
      day === 1 ||
      !pair ||
      ![pair.brideId, pair.groomId].every(
        (id) => ctx.world.getComponent(id, COMPONENT.Alive)?.alive === true,
      )
    )
      return;
    for (const actorId of [pair.brideId, pair.groomId])
      await executeWeddingTurn({
        world: ctx.world,
        gateway: ctx.toolGateway,
        events: ctx.events,
        provider: ctx.actionProvider,
        day,
        actorId,
        kind: "chat",
        tool: "speak_to_partner",
        stage: "ghost_bride_chat",
        isCurrent: ctx.isCurrent,
      });
  },
};
export const WEDDING_KNIFE_STAGE: NightStageHandler = {
  id: "ghost_bride_knife",
  priority: 400,
  async execute(ctx) {
    const day = ctx.currentDay(),
      capture = weddingNightCapture(ctx.world, day);
    if (!capture) throw new Error("ghost_bride_capture_missing");
    for (const actorId of capture.actorIds) {
      const tool = capture.owner === "ordinary_pack" ? "kill_vote" : "wedding_kill_vote";
      await executeWeddingTurn({
        world: ctx.world,
        gateway: ctx.toolGateway,
        events: ctx.events,
        provider: ctx.actionProvider,
        day,
        actorId,
        kind: "knife",
        tool,
        stage: capture.owner === "ordinary_pack" ? "wolf_vote" : "ghost_bride_knife",
        isCurrent: ctx.isCurrent,
      });
      // 原投票仍由婚约权威保存，本阶段不从事实或目标重建票表。
    }
    const targetId = resolveWeddingKnife(ctx.world, day);
    ctx.events.push({
      timestamp: Date.now(),
      type: "ghost_bride_knife_resolved",
      payload: { ...capture, actorIds: [...capture.actorIds], targetId },
      audience: Object.freeze(
        capture.owner === "ordinary_pack" ? [] : [...capture.actorIds].sort((a, b) => a - b),
      ),
    });
    ctx.state.wolfTarget = targetId;
    if (targetId !== null && weddingKnifeCurrent(ctx.world, day, targetId)) {
      const marks = ctx.ensureMarks(targetId),
        life = ctx.world.getComponent(targetId, COMPONENT.Alive)!;
      marks.add(StatusMark.WolfKillMark);
      ctx.state.wolfTargetScope = { targetId, life, version: aliveLifeVersion(life)!, marks };
    }
  },
};
