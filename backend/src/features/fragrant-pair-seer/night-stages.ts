/**
 * 负责寻香绑定与双人查验的两段真实夜间请求流程。输入为当前上下文、原候选与工具回复；
 * 输出为领域回执、本人可见事实和安全录制。await 后及 gateway 后复验本地 scope，
 * 领域提交先于事件和录制；finally 关闭请求，晚发布失败不撤销已写选择，不接管关系／查验算法。
 */
import type { NightStageContext, NightStageHandler } from "../../engine/night/contracts";
import { Phase } from "../../domain/identity";
import { safeRecordLogicOp } from "../../recording/session/recorder";
import { fragrantChoiceActor, fragrantChoiceCandidates } from "./authority";
import {
  openFragrantPairRequest,
  fragrantPairRequestScope,
  readFragrantPairTool,
  commitFragrantPairChoice,
  closeFragrantPairRequest,
} from "./requests";
import { FRAGRANT_PAIR_POLICY } from "./state";
async function execute(ctx: NightStageContext, kind: "bind" | "pair") {
  const day = ctx.currentDay(),
    actorId = fragrantChoiceActor(ctx.world, day, kind);
  if (actorId === null) return;
  const name = kind === "bind" ? "bind_fragrant_pair" : "check_pair",
    candidates = fragrantChoiceCandidates(ctx.world, day),
    request = ctx.makeRequest(actorId, [name], {
      stage: kind === "bind" ? "fragrant_bind" : "pair_inspection",
      requiresAction: true,
      allow_fallback: false,
      action_failure_policy: "error",
      ...(kind === "bind"
        ? { fragrant_pair_candidates: candidates }
        : { pair_check_candidates: candidates, ability_id: "native:pair_check" }),
    }),
    scope = openFragrantPairRequest(ctx.world, day, kind, request);
  try {
    const raw = await ctx.actionProvider.getAction(request);
    if (fragrantPairRequestScope(ctx.world, request) !== scope)
      throw Error("fragrant_request_unavailable");
    const call = readFragrantPairTool(raw);
    if (!call || call.name !== name) throw Error("fragrant_required_action_invalid");
    const valid = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, call, {
      phase: Phase.Night,
      day,
      fragrantPairScope: scope,
      deferOperation: true,
    });
    if (!valid.ok || !valid.sanitizedCall || fragrantPairRequestScope(ctx.world, request) !== scope)
      throw Error("fragrant_required_action_invalid");
    // 先由领域 choice 完整提交（含空选），再发布本人事实；finally 的关闭保原 JS 异常优先，不做补偿。
    const receipt = commitFragrantPairChoice(ctx.world, scope, valid.sanitizedCall);
    ctx.events.push(
      "pairIds" in receipt
        ? {
            timestamp: Date.now(),
            type: "fragrant_pair_chosen",
            payload: { policy: FRAGRANT_PAIR_POLICY, ...receipt },
            audience: Object.freeze([actorId]),
          }
        : {
            timestamp: Date.now(),
            type: "fragrant_pair_inspected",
            payload: { policy: FRAGRANT_PAIR_POLICY, ...receipt },
            audience: Object.freeze([actorId]),
          },
    );
    safeRecordLogicOp({
      scope: "gateway",
      op: "validate_tool_call",
      actorId,
      phase: Phase.Night,
      status: "ok",
      input: { tool: call.name, args: call.args },
    });
    safeRecordLogicOp({
      scope: "phase_pipeline",
      op: kind === "bind" ? "fragrant_pair_chosen" : "fragrant_pair_inspected",
      actorId,
      phase: Phase.Night,
      status: "ok",
      output: { policy: FRAGRANT_PAIR_POLICY, ...receipt },
    });
  } finally {
    closeFragrantPairRequest(scope);
  }
}
export const FRAGRANT_BIND_STAGE: NightStageHandler = {
  id: "fragrant_bind",
  priority: 150,
  execute: (ctx) => execute(ctx, "bind"),
};
export const PAIR_INSPECTION_STAGE: NightStageHandler = {
  id: "pair_inspection",
  priority: 600,
  execute: (ctx) => execute(ctx, "pair"),
};
