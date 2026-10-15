/**
 * 负责夜之贵族／觉醒愚者两段夜间选择流程。输入为当前上下文、原候选及必需工具回复；
 * 输出为领域回执、本人事实和安全录制。await 后及 gateway 后复验请求 scope，提交先于事实和录制；
 * finally 关闭请求，晚发布失败保留已付前缀。不接管契约、秘密之身或资源算法，这些写权仍由本族 authority 持有。
 */
import type {
  TrustedNightStageHandler as NightStageHandler,
  TrustedNightStageRuntime as NightStageContext,
} from "../../engine/night/trusted-runtime";
import { Phase } from "../../domain/identity";
import { safeRecordLogicOp } from "../../recording/session/recorder";
import { nobleBodyChoiceActor, nobleBodyChoiceTargets } from "./authority";
import {
  openNobleBodyRequest,
  nobleBodyRequestScope,
  readNobleBodyTool,
  commitNobleBodyChoice,
  closeNobleBodyRequest,
} from "./requests";
import { NOBLE_SECRET_BODY_POLICY } from "./state";
async function execute(ctx: NightStageContext, kind: "body" | "noble") {
  const day = ctx.currentDay(),
    actorId = nobleBodyChoiceActor(ctx.world, day, kind);
  if (actorId === null) return;
  const name = kind === "body" ? "protect_secret_body" : "choose_servant",
    candidates = nobleBodyChoiceTargets(ctx.world, day, kind),
    request = ctx.makeRequest(actorId, [name], {
      stage: kind === "body" ? "secret_body" : "night_noble",
      requiresAction: true,
      allow_fallback: false,
      action_failure_policy: "error",
      ...(kind === "body"
        ? { secret_body_candidates: candidates }
        : { servant_candidates: candidates }),
    }),
    scope = openNobleBodyRequest(ctx.world, day, kind, request);
  try {
    const raw = await ctx.actionProvider.getAction(request);
    if (nobleBodyRequestScope(ctx.world, request) !== scope)
      throw Error("noble_body_request_unavailable");
    const call = readNobleBodyTool(raw);
    if (!call || call.name !== name) throw Error("noble_body_required_action_invalid");
    const valid = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, call, {
      phase: Phase.Night,
      day,
      scope: scope,
      deferOperation: true,
    });
    if (!valid.ok || !valid.sanitizedCall || nobleBodyRequestScope(ctx.world, request) !== scope)
      throw Error("noble_body_required_action_invalid");
    // 领域commit返回后才发布事实／录制；finally沿原路径关请求，晚发布不退款或重选。
    const receipt = commitNobleBodyChoice(ctx.world, scope, valid.sanitizedCall);
    ctx.events.push(
      kind === "body"
        ? {
            timestamp: Date.now(),
            type: "secret_body_chosen",
            payload: { policy: NOBLE_SECRET_BODY_POLICY, actorId, day, targetId: receipt.targetId },
            audience: Object.freeze([actorId]),
          }
        : {
            timestamp: Date.now(),
            type: "noble_servant_chosen",
            payload: {
              policy: NOBLE_SECRET_BODY_POLICY,
              actorId,
              day,
              targetId: receipt.targetId,
              contractId: receipt.targetId === null ? null : `servant:night:${day}`,
            },
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
      op: kind === "body" ? "secret_body_choice_committed" : "noble_servant_choice_committed",
      actorId,
      phase: Phase.Night,
      status: "ok",
      output: { ...receipt, policy: NOBLE_SECRET_BODY_POLICY },
    });
  } finally {
    closeNobleBodyRequest(scope);
  }
}
export const SECRET_BODY_STAGE: NightStageHandler = {
  id: "secret_body_action",
  priority: 150,
  execute: (ctx) => execute(ctx, "body"),
};
export const NOBLE_CHOICE_STAGE: NightStageHandler = {
  id: "night_noble_action",
  priority: 450,
  execute: (ctx) => execute(ctx, "noble"),
};

/** 模块定义完成时固定完整原程序引用；后来替换 execute 不能借原 handler 对象取得私有输入。这里不持有运行 World。 */
export const OWNED_NIGHT_STAGE_PROGRAMS = Object.freeze(
  [SECRET_BODY_STAGE, NOBLE_CHOICE_STAGE].map((handler) =>
    Object.freeze([handler, handler.execute] as const),
  ),
);
