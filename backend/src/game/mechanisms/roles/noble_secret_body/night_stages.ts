import type { NightStageHandler, NightStageContext } from "../../stages/night/contracts";
import { Phase } from "../../../../core/domain/identity";
import { safeRecordLogicOp } from "../../../../recording/session_recorder";
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
      nobleBodyScope: scope,
      deferOperation: true,
    });
    if (!valid.ok || !valid.sanitizedCall || nobleBodyRequestScope(ctx.world, request) !== scope)
      throw Error("noble_body_required_action_invalid");
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
