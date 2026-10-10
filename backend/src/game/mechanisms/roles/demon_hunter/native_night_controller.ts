import {
  Camp,
  Phase,
  StatusMark,
  settleRequestDelivery,
  COMPONENT,
  type StatusMarksComponent,
} from "../../../../core";
import { StatusMarksComponent as Marks } from "../../../../core/domain/components/status_marks";
import { captureNightLife } from "../../../../core/domain/night_effects";
import { safeRecordLogicOp } from "../../../../recording/session_recorder";
import { GameActionRequestFactory } from "../../../engine/action_request_factory";
import type { NightStageContext } from "../../stages/night/contracts";
import { resolveInspection } from "../inspection";
import { recordOwnNightAction } from "../night_action_history";
import { demonNativeNightActor, openDemonNativeNightFrame } from "./authority";
import {
  bindDemonNativeNightRequest,
  demonWitchRequestCurrent,
  demonWitchRequestTargetCurrent,
  readDemonNativeNightTool,
} from "./native_potion_requests";
import { openNativeGuardContribution, commitNativeGuardContribution } from "./guard_contribution";
const nativeAdd = Marks.prototype.add;
/** Only the finite Demon board's original native Seer and Guard take this strict delivery path. */
export async function executeDemonNativeNight(
  ctx: NightStageContext,
  kind: "seer_check" | "guard",
): Promise<void> {
  const { world } = ctx,
    day = ctx.currentDay(),
    actor = demonNativeNightActor(world, kind);
  if (!actor) return;
  const frame = openDemonNativeNightFrame(world, actor.actorId, actor.ability, kind, day);
  if (!frame) throw new Error("demon_hunter_native_night_unavailable");
  const guard = kind === "guard",
    name = guard ? "guard" : "check_identity",
    scope = Object.freeze({});
  let closed = false,
    committed = false;
  const request = new GameActionRequestFactory(world, ctx.events, day).create({
    phase: Phase.Night,
    actorId: actor.actorId,
    allowedTools: [name],
    stage: guard ? "guard" : "seer",
    requiresAction: true,
    summary: { key: "request.summary.night_action" },
    context: {
      ability_id: `native:${kind}`,
      allow_fallback: false,
      action_failure_policy: "error",
    },
  });
  bindDemonNativeNightRequest(
    world,
    request,
    scope,
    () => !closed && frame.isCurrent(),
    frame.targetCurrent,
    kind,
  );
  const authorized = () => demonWitchRequestCurrent(world, request);
  try {
    if (!authorized()) throw new Error("demon_hunter_native_night_revoked");
    const raw = await ctx.actionProvider.getAction(request);
    if (!authorized()) throw new Error("demon_hunter_native_night_revoked");
    const call = readDemonNativeNightTool(raw);
    if (
      !call ||
      call.name !== name ||
      (call.args.target_id !== null &&
        !demonWitchRequestTargetCurrent(world, request, call.args.target_id))
    )
      throw new Error("demon_hunter_native_night_invalid");
    const valid = ctx.toolGateway.validateAndSanitize(world, actor.actorId, call, {
      phase: Phase.Night,
      day,
      abilityId: `native:${kind}`,
      deferOperation: true,
    });
    if (
      !authorized() ||
      !valid.ok ||
      !valid.sanitizedCall ||
      (call.args.target_id !== null &&
        !demonWitchRequestTargetCurrent(world, request, call.args.target_id))
    )
      throw new Error("demon_hunter_native_night_invalid");
    const targetId = call.args.target_id;
    if (guard) {
      const target = targetId === null ? null : captureNightLife(world, targetId);
      const marks =
        targetId === null
          ? null
          : world.getComponent<StatusMarksComponent>(targetId, COMPONENT.StatusMarks);
      if (targetId !== null && (!target || !marks))
        throw new Error("demon_hunter_native_guard_target_invalid");
      const contribution =
        targetId !== null && marks ? openNativeGuardContribution(world, targetId, marks) : null;
      if (!authorized() || !frame.commitGuard(targetId))
        throw new Error("demon_hunter_native_guard_commit_revoked");
      if (targetId !== null && target && marks && contribution) {
        nativeAdd.call(marks, StatusMark.GuardMark);
        commitNativeGuardContribution(contribution);
        (ctx.state.guardClaims ??= []).push({
          target: Object.freeze(target),
          marks,
          isCurrent: frame.sourceCurrent,
          contribution,
        });
      }
      committed = true;
      settleRequestDelivery(scope, true);
      ctx.events.push({
        timestamp: Date.now(),
        type: "guard_applied",
        payload: { actorId: actor.actorId, abstain: targetId === null, targetId },
      });
      safeRecordLogicOp({
        scope: "phase_pipeline",
        op: "guard_applied",
        actorId: actor.actorId,
        phase: Phase.Night,
        status: "ok",
        output: { abstain: targetId === null, target_id: targetId },
      });
      if (targetId !== null)
        recordOwnNightAction(world, actor.actorId, day, "guard", targetId, false);
    } else {
      if (targetId === null) throw new Error("demon_hunter_native_seer_target_invalid");
      const result = resolveInspection(world, targetId, "camp", ctx.roleCatalog);
      if (!result || !authorized() || !frame.commitSeer(targetId, result))
        throw new Error("demon_hunter_native_seer_commit_revoked");
      committed = true;
      settleRequestDelivery(scope, true);
      const isWerewolf = result.camp === Camp.Wolf;
      ctx.state.seerChecks.push({
        seerId: actor.actorId,
        targetId,
        isWerewolf,
        result: { ...result },
      });
      recordOwnNightAction(world, actor.actorId, day, "check", targetId, false);
      ctx.events.push({
        timestamp: Date.now(),
        type: "seer_checked",
        payload: { actorId: actor.actorId, targetId, isWerewolf, result: { ...result } },
      });
    }
    safeRecordLogicOp({
      scope: "gateway",
      op: "validate_tool_call",
      actorId: actor.actorId,
      phase: Phase.Night,
      status: "ok",
      input: { tool: call.name, args: call.args },
    });
  } finally {
    closed = true;
    if (!committed) settleRequestDelivery(scope, false);
  }
}
