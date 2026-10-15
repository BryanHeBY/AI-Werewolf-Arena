/**
 * 负责守卫基于捕获能力及原生命的目标选择。
 * 输入为夜上下文、资格查询和已验证守护工具；输出保留 lastTarget、use metadata 及原守护贡献。
 * 原贡献 owner 保留已付效果有效性，不能把它转移给替换的印记组件。
 * 查询、请求、资格、状态命令与事实发布仍按原位置执行，不增加重复目标重检或退款。
 */
import { GUARD_STATE_SLOT } from "./ports";
/** 文件说明：守卫夜间阶段处理。 */
import { COMPONENT } from "../../domain/components/names";
import { RoleComponent } from "../../domain/components/role";
import { Phase, Role, StatusMark } from "../../domain/model";
import { safeRecordLogicOp } from "../../recording/session/recorder";
import { NightStageHandler } from "../../engine/night/contracts";
import { getGuardState } from "./ports";
import { activeNightAbility } from "../night-abilities/abilities";
import { recordNightAbilityUse } from "../night-abilities/abilities";
import { captureNightAbilityScope } from "../night-abilities/ability-scope";
import { captureNightLife, livingNightLife } from "../../domain/night-effects";
import { recordOwnNightAction, luckyTargetAllowed } from "../night-abilities/night-action-history";

const guardActionStage: NightStageHandler = {
  id: "guard_action",
  priority: 300,
  async execute(ctx): Promise<void> {
    if (ctx.nativeNightFailure.usesDemonController()) {
      const { executeDemonNativeNight } = await ctx.nativeNightEffects.loadSealedNightController();
      await executeDemonNativeNight(ctx, "guard");
      return;
    }
    for (const { actorId: guardId, ability } of ctx.nightActors.actors("guard", ctx.currentDay())) {
      if (ability.activation === "lucky" || ability.activation === "black_market") continue;
      ctx.nativeNightFailure.assertNativeActor(guardId, Role.Guard);
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
        ctx.nativeNightFailure.scopeStale("guard");
        continue;
      }
      const action = await ctx.actionProvider.getAction(req);
      if (!ctx.isCurrent()) return;
      if (!scope.isEligible()) {
        ctx.nativeNightFailure.scopeStale("guard");
        continue;
      }
      if (action?.name !== "guard") {
        ctx.nativeNightFailure.actionMissing("guard");
        continue;
      }

      const result = ctx.toolGateway.validateAndSanitize(ctx.world, guardId, action, {
        phase: Phase.Night,
        day: ctx.currentDay(),
        abilityId: ability.id,
      });
      if (!ctx.isCurrent()) return;
      if (!scope.isEligible()) {
        ctx.nativeNightFailure.scopeStale("guard");
        continue;
      }
      if (!result.ok || !result.sanitizedCall) {
        ctx.nativeNightFailure.actionInvalid("guard");
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
        const receipt = ctx.nativeNightTargets.reflectedTarget(
          () => day,
          () => guardId,
          () => targetId,
          "guard",
        );
        if (receipt && (ability.source.kind !== "native" || ability.source.role !== Role.Guard))
          throw new Error("time_consort_guard_source_invalid");
        ctx.nativeNightEffects.commitReflectedTarget(receipt, day, guardId, "guard");
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
        GUARD_STATE_SLOT.allowedWrites.recordGuardTarget(guardState, targetId);
      }
      recordNightAbilityUse(ability, ctx.currentDay(), !abstain);
      ctx.nativeNightEffects.recordModifierTarget(day, guardId, "guard", () => targetId);
      if (!abstain && targetId !== null)
        recordOwnNightAction(ctx.world, guardId, day, "guard", targetId, false);
    }
  },
};

/** 守卫夜间阶段列表。 */
export const GUARD_NIGHT_STAGES: NightStageHandler[] = [guardActionStage];
