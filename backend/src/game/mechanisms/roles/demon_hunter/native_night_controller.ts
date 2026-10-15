/**
 * 负责有限猎魔人板原生守卫／预言家的严格交付；输入原夜上下文、frame及惰性构造依赖，输出原库存提交与事实。
 * 原体、目标与付款仍由 frame／请求 owner 校验；成功先交付再发事实，提交失败沿原 finally 结算 false。
 * 工厂构造和绑定原在 try 之前，构造抛错不会进入该 finally；不新增清理或替换捕获的原库存／操作。
 */
import {
  Camp,
  Phase,
  StatusMark,
  settleRequestDelivery,
  COMPONENT,
  type StatusMarksComponent,
} from "../../../../domain";
import { StatusMarksComponent as Marks } from "../../../../domain/components/status-marks";
import { captureNightLife } from "../../../../domain/night-effects";
import { safeRecordLogicOp } from "../../../../recording/session_recorder";
import type { ActionRequestFactoryConstructorPort } from "../../../../domain/actions";
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
/** 仅此有限板的原生预言家／守卫进入该路径；赠予、复制及其他板仍沿各自原机制。 */
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
  // callee 先于 ctx.events 读取；原构造／绑定处于 try 外，保留失败边界而不补清理。
  const request = new ctx.requestFactory(world, ctx.events, day).create({
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
      const marks = targetId === null ? null : world.getComponent(targetId, COMPONENT.StatusMarks);
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
