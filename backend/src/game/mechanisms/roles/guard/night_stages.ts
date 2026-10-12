/**
 * Executes Guard target selection with captured ability and original-life checks. Inputs are
 * night context and validated protection tools; outputs are state history, use accounting and
 * sourced Guard contributions. Only the original contribution owner retains effect validity,
 * without assigning it to a replacement mark component. Guard actor enumeration
 * consumes the bound qualification port before any captured protection request.
 */
import {
  isScholarMentorBoard,
  recordScholarMentorNativeTarget,
} from "../scholar_mentor/night_frame";
import { isTimeConsortBoard, resolveTimeConsortTarget } from "../time_wolf_consort/night_frame";
import { commitTimeConsortEffect } from "../time_wolf_consort/effects";
import { isEvilKnightBoard, assertEvilKnightNativeActor } from "../evil_knight/night_frame";
/** 文件说明：守卫夜间阶段处理。 */
import { demonHunterActorId } from "../demon_hunter/authority";
import { COMPONENT } from "../../../../core/domain/components/names";
import { RoleComponent } from "../../../../core/domain/components/role";
import { Phase, Role, StatusMark } from "../../../../core/domain/model";
import { safeRecordLogicOp } from "../../../../recording/session_recorder";
import { NightStageHandler } from "../../stages/night/contracts";
import { getGuardState, recordGuardTarget } from "./state";
import { activeNightAbility, recordNightAbilityUse } from "../abilities";
import { captureNightAbilityScope } from "../ability_scope";
import { captureNightLife, livingNightLife } from "../../../../core/domain/night_effects";
import { recordOwnNightAction, luckyTargetAllowed } from "../night_action_history";

const guardActionStage: NightStageHandler = {
  id: "guard_action",
  priority: 300,
  async execute(ctx): Promise<void> {
    if (demonHunterActorId(ctx.world) !== null) {
      const { executeDemonNativeNight } = await import("../demon_hunter/native_night_controller");
      await executeDemonNativeNight(ctx, "guard");
      return;
    }
    for (const { actorId: guardId, ability } of ctx.nightActors.actors("guard", ctx.currentDay())) {
      if (ability.activation === "lucky" || ability.activation === "black_market") continue;
      assertEvilKnightNativeActor(ctx.world, guardId, Role.Guard);
      const day = ctx.currentDay(),
        scope = captureNightAbilityScope(
          ctx.world,
          guardId,
          ability,
          day,
          () => ctx.isCurrent() && ctx.currentDay() === day,
        );
      if (!scope?.isEligible()) continue;
      const targets = new Map(
        ctx.world.getAliveEntityIds().map((id) => [id, captureNightLife(ctx.world, id)]),
      );
      if (
        !ctx.world.getAliveEntityIds().includes(guardId) ||
        activeNightAbility(
          ctx.world.getComponent(guardId, COMPONENT.Role),
          "guard",
          ctx.currentDay(),
          ability.id,
        ) !== ability
      )
        continue;
      const req = ctx.makeRequest(guardId, ["guard"], { stage: "guard", ability_id: ability.id });
      if (!scope.isEligible()) {
        if (isScholarMentorBoard(ctx.world)) throw new Error("scholar_mentor_guard_scope_stale");
        if (isTimeConsortBoard(ctx.world)) throw new Error("time_consort_guard_scope_stale");
        continue;
      }
      const action = await ctx.actionProvider.getAction(req);
      if (!ctx.isCurrent()) return;
      if (!scope.isEligible()) {
        if (isScholarMentorBoard(ctx.world)) throw new Error("scholar_mentor_guard_scope_stale");
        if (isTimeConsortBoard(ctx.world)) throw new Error("time_consort_guard_scope_stale");
        continue;
      }
      if (action?.name !== "guard") {
        if (isScholarMentorBoard(ctx.world)) throw new Error("scholar_mentor_guard_action_missing");
        if (isTimeConsortBoard(ctx.world)) throw new Error("time_consort_guard_action_missing");
        if (isEvilKnightBoard(ctx.world)) throw new Error("evil_knight_guard_action_missing");
        continue;
      }

      const result = ctx.toolGateway.validateAndSanitize(ctx.world, guardId, action, {
        phase: Phase.Night,
        day: ctx.currentDay(),
        abilityId: ability.id,
      });
      if (!ctx.isCurrent()) return;
      if (!scope.isEligible()) {
        if (isScholarMentorBoard(ctx.world)) throw new Error("scholar_mentor_guard_scope_stale");
        if (isTimeConsortBoard(ctx.world)) throw new Error("time_consort_guard_scope_stale");
        continue;
      }
      if (!result.ok || !result.sanitizedCall) {
        if (isScholarMentorBoard(ctx.world)) throw new Error("scholar_mentor_guard_action_invalid");
        if (isTimeConsortBoard(ctx.world)) throw new Error("time_consort_guard_action_invalid");
        if (isEvilKnightBoard(ctx.world)) throw new Error("evil_knight_guard_action_invalid");
        safeRecordLogicOp({
          scope: "phase_pipeline",
          op: "guard_action_rejected",
          actorId: guardId,
          phase: Phase.Night,
          status: "rejected",
        });
        continue;
      }
      const currentRole = ctx.world.getComponent(guardId, COMPONENT.Role);
      if (!activeNightAbility(currentRole, "guard", ctx.currentDay(), ability.id)) continue;
      const abstain = result.sanitizedCall.args.abstain === true;
      const targetId = abstain ? null : result.sanitizedCall.args.target_id;
      const target = targetId === null ? null : targets.get(targetId);
      if (targetId !== null && (!target || !livingNightLife(ctx.world, target))) continue;
      if (
        !abstain &&
        targetId !== null &&
        !luckyTargetAllowed(ctx.world, guardId, ability, day, "guard", targetId)
      )
        continue;
      if (!abstain && targetId !== null) {
        const receipt = isTimeConsortBoard(ctx.world)
          ? resolveTimeConsortTarget(ctx.world, day, guardId, targetId, "guard")
          : null;
        if (receipt && (ability.source.kind !== "native" || ability.source.role !== Role.Guard))
          throw new Error("time_consort_guard_source_invalid");
        commitTimeConsortEffect(ctx, receipt, day, guardId, "guard");
        const marks = ctx.ensureMarks(receipt?.effectiveId ?? targetId);
        marks.add(StatusMark.GuardMark);
        (ctx.state.guardClaims ??= []).push({ target: receipt?.scope ?? target!, marks });
      }
      ctx.events.push({
        timestamp: Date.now(),
        type: "guard_applied",
        payload: {
          actorId: guardId,
          ...(ability.source.kind === "native" ? {} : { abilityId: ability.id }),
          abstain,
          targetId,
        },
      });
      safeRecordLogicOp({
        scope: "phase_pipeline",
        op: "guard_applied",
        actorId: guardId,
        phase: Phase.Night,
        status: "ok",
        output: { abstain, target_id: targetId },
      });

      const role = ctx.world.getComponent(guardId, COMPONENT.Role);
      const guardState = role ? getGuardState(role, ability.id) : undefined;
      if (guardState) {
        recordGuardTarget(guardState, targetId);
      }
      recordNightAbilityUse(ability, ctx.currentDay(), !abstain);
      if (isScholarMentorBoard(ctx.world))
        recordScholarMentorNativeTarget(ctx.world, day, guardId, "guard", targetId);
      if (!abstain && targetId !== null)
        recordOwnNightAction(ctx.world, guardId, day, "guard", targetId, false);
    }
  },
};

/** 守卫夜间阶段列表。 */
export const GUARD_NIGHT_STAGES: NightStageHandler[] = [guardActionStage];
