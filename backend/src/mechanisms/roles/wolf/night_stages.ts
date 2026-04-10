/** 文件说明：狼人夜聊与刀人投票阶段处理。 */
import { EntityId, Phase, Role, StatusMark } from "../../../domain/model";
import { safeRecordLogicOp } from "../../../session_recording";
import { NightStageHandler } from "../../stages/night/contracts";

const WOLF_DISCUSSION_MAX_ROUNDS = 3;

const wolfDiscussionStage: NightStageHandler = {
  id: "wolf_discussion",
  priority: 200,
  async execute(ctx): Promise<void> {
    const wolfIds = ctx.shuffleWolves(ctx.getAliveByRole(Role.Wolf));
    ctx.state.wolfIds = wolfIds;
    ctx.state.endedWolves = new Set<EntityId>();

    if (wolfIds.length > 0) {
      ctx.events.push({
        timestamp: Date.now(),
        type: "wolf_tactical_order",
        payload: { order: [...wolfIds] },
      });
    }

    // 轮转夜聊：每只狼最多发言 WOLF_DISCUSSION_MAX_ROUNDS 次，end_chat 后跳过后续轮次。
    for (let round = 1; round <= WOLF_DISCUSSION_MAX_ROUNDS; round++) {
      for (const wolfId of wolfIds) {
        if (ctx.state.endedWolves.has(wolfId)) {
          continue;
        }
        const req = ctx.makeRequest(wolfId, ["speak_to_wolves"], {
          phase: "wolf_discussion",
          day: ctx.currentDay(),
          round,
          max_rounds: WOLF_DISCUSSION_MAX_ROUNDS,
        });
        const action = await ctx.actionProvider.getAction(req);
        if (action?.name !== "speak_to_wolves") {
          continue;
        }

        const result = ctx.toolGateway.validateAndSanitize(ctx.world, wolfId, action, {
          phase: req.phase,
        });
        if (!result.ok || !result.sanitizedCall) {
          continue;
        }
        if (result.sanitizedCall.args.end_chat) {
          ctx.state.endedWolves.add(wolfId);
          ctx.events.push({
            timestamp: Date.now(),
            type: "wolf_discussion_ended",
            payload: {
              actorId: wolfId,
              reason: result.sanitizedCall.args.text,
              round,
            },
          });
        } else {
          ctx.events.push({
            timestamp: Date.now(),
            type: "wolf_discussion",
            payload: {
              actorId: wolfId,
              text: result.sanitizedCall.args.text,
              endChat: false,
              round,
            },
          });
        }
      }
      if (ctx.state.endedWolves.size === wolfIds.length) {
        break;
      }
    }
  },
};

const wolfKillVoteStage: NightStageHandler = {
  id: "wolf_kill_vote",
  priority: 400,
  async execute(ctx): Promise<void> {
    ctx.state.wolfVotes = {};
    // 顺序收集狼刀票，统一在阶段末做多数决结算，避免中途状态污染。
    for (const wolfId of ctx.state.wolfIds) {
      const req = ctx.makeRequest(wolfId, ["kill_vote"], { phase: "wolf_vote" });
      const action = await ctx.actionProvider.getAction(req);
      if (action?.name !== "kill_vote") {
        continue;
      }

      const result = ctx.toolGateway.validateAndSanitize(ctx.world, wolfId, action, {
        phase: Phase.Night,
      });
      if (!result.ok || !result.sanitizedCall) {
        safeRecordLogicOp({
          scope: "phase_pipeline",
          op: "wolf_kill_vote_rejected",
          actorId: wolfId,
          phase: Phase.Night,
          status: "rejected",
        });
        continue;
      }

      const abstain = result.sanitizedCall.args.abstain === true;
      const targetId = result.sanitizedCall.args.target_id;
      if (!abstain && targetId !== null) {
        ctx.state.wolfVotes[targetId] = (ctx.state.wolfVotes[targetId] ?? 0) + 1;
      }
      ctx.events.push({
        timestamp: Date.now(),
        type: "wolf_kill_vote_cast",
        payload: { actorId: wolfId, abstain, targetId },
      });
      safeRecordLogicOp({
        scope: "phase_pipeline",
        op: "wolf_kill_vote_cast",
        actorId: wolfId,
        phase: Phase.Night,
        status: "ok",
        output: { abstain, target_id: targetId },
      });
    }

    const wolfTarget = ctx.pickMajorityTarget(ctx.state.wolfVotes);
    ctx.state.wolfTarget = wolfTarget;
    safeRecordLogicOp({
      scope: "phase_pipeline",
      op: "wolf_kill_vote_resolved",
      phase: Phase.Night,
      status: "ok",
      output: { tally: ctx.state.wolfVotes, wolf_target: wolfTarget },
    });
    if (wolfTarget !== null) {
      ctx.ensureMarks(wolfTarget).add(StatusMark.WolfKillMark);
    }
  },
};

/** 狼人夜间阶段列表。 */
export const WOLF_NIGHT_STAGES: NightStageHandler[] = [
  wolfDiscussionStage,
  wolfKillVoteStage,
];
