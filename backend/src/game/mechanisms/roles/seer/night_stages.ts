/**
 * Executes ordinary Seer requests against captured ability and target authority.
 * Inputs are the night-stage context and validated check actions; outputs retain
 * original inspection, resource and event effects. State writes use the captured
 * Seer slot after Time Consort and before Fox effects, without rollback or a new
 * eligibility check; actor enumeration consumes the bound night query, while
 * Demon Hunter's sealed native controller remains separate.
 */
/** 文件说明：预言家夜间查验阶段处理。 */
import { seerTargetAllowed } from "./ports";
import { COMPONENT } from "../../../../core/domain/components/names";
import { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, Phase, Role } from "../../../../core/domain/model";
import { NightStageHandler } from "../../stages/night/contracts";
import { getSeerState, recordSeerInspection } from "./state";
import { resolveInspection } from "../inspection";
import { activeNightAbility, recordNightAbilityUse } from "../abilities";
import { captureNightAbilityScope } from "../ability_scope";
import { captureNightLife, livingNightLife } from "../../../../core/domain/night_effects";
import { recordOwnNightAction, luckyTargetAllowed } from "../night_action_history";

import { captureInspectionIdentity, commitFoxInspection } from "../cursed_fox/inspection_effect";

const seerCheckStage: NightStageHandler = {
  id: "seer_check",
  priority: 600,
  async execute(ctx): Promise<void> {
    if (ctx.nativeNightFailure.usesDemonController()) {
      const { executeDemonNativeNight } = await ctx.nativeNightEffects.loadSealedNightController();
      await executeDemonNativeNight(ctx, "seer_check");
      return;
    }
    for (const { actorId: seerId, ability } of ctx.nightActors.actors(
      "seer_check",
      ctx.currentDay(),
    )) {
      if (ability.activation === "lucky" || ability.activation === "black_market") continue;
      ctx.nativeNightFailure.assertSeerSource(ability);
      ctx.nativeNightFailure.assertNativeActor(seerId, Role.Seer);
      const day = ctx.currentDay(),
        scope = captureNightAbilityScope(
          ctx.world,
          seerId,
          ability,
          day,
          () => ctx.isCurrent() && ctx.currentDay() === day,
        );
      if (!scope?.isEligible()) continue;
      const targets = new Map(
        ctx.world.getAliveEntityIds().map((id) => [id, captureNightLife(ctx.world, id)]),
      );
      const identities = new Map(
        [...targets].flatMap(([id, life]) =>
          life ? [[id, captureInspectionIdentity(ctx.world, life)] as const] : [],
        ),
      );
      if (
        !ctx.world.getAliveEntityIds().includes(seerId) ||
        activeNightAbility(
          ctx.world.getComponent(seerId, COMPONENT.Role),
          "seer_check",
          ctx.currentDay(),
          ability.id,
        ) !== ability
      )
        continue;
      const legalTargets = ctx.world
        .getAliveEntityIds()
        .filter(
          (id) =>
            seerTargetAllowed(ability.state, seerId, id) &&
            luckyTargetAllowed(ctx.world, seerId, ability, day, "check", id),
        );
      if (!legalTargets.length) continue;
      const req = ctx.makeRequest(seerId, ["check_identity"], {
        stage: "seer",
        ability_id: ability.id,
        requiresAction: ability.state.actionPolicy !== "awa_optional_v1",
      });
      if (!scope.isEligible()) {
        ctx.nativeNightFailure.scopeStale("seer");
        continue;
      }
      const action = await ctx.actionProvider.getAction(req);
      if (!ctx.isCurrent()) return;
      if (!scope.isEligible()) {
        ctx.nativeNightFailure.scopeStale("seer");
        continue;
      }
      if (action?.name !== "check_identity") {
        ctx.nativeNightFailure.actionMissing("seer");
        continue;
      }

      const result = ctx.toolGateway.validateAndSanitize(ctx.world, seerId, action, {
        phase: Phase.Night,
        day: ctx.currentDay(),
        abilityId: ability.id,
      });
      if (!ctx.isCurrent()) return;
      if (!scope.isEligible()) {
        ctx.nativeNightFailure.scopeStale("seer");
        continue;
      }
      if (!result.ok || !result.sanitizedCall) {
        ctx.nativeNightFailure.actionInvalid("seer");
        continue;
      }

      const targetId = result.sanitizedCall.args.target_id;
      const target = targets.get(targetId);
      if (!target || !livingNightLife(ctx.world, target) || !identities.get(targetId)?.isCurrent())
        continue;
      const mapping = ctx.nativeNightTargets.mappedTarget(
        () => day,
        () => targetId,
      );
      const receipt = ctx.nativeNightTargets.reflectedTarget(
        () => day,
        () => seerId,
        () => targetId,
        "check",
      );
      if (receipt && (ability.source.kind !== "native" || ability.source.role !== Role.Seer))
        throw new Error("time_consort_seer_source_invalid");
      const effectiveId = receipt?.effectiveId ?? mapping?.effectiveId ?? targetId;
      const effectiveIdentity = identities.get(effectiveId);
      if (mapping && (!mapping.isCurrent() || !effectiveIdentity?.isCurrent()))
        throw new Error("magician_inspection_target_stale");
      const inspection = resolveInspection(ctx.world, effectiveId, "camp", ctx.roleCatalog);
      if (!ctx.isCurrent()) return;
      if (
        !scope.isEligible() ||
        !identities.get(targetId)?.isCurrent() ||
        !livingNightLife(ctx.world, target) ||
        !seerTargetAllowed(ability.state, seerId, targetId) ||
        !luckyTargetAllowed(ctx.world, seerId, ability, day, "check", targetId)
      )
        continue;
      if (mapping && (!mapping.isCurrent() || !effectiveIdentity?.isCurrent()))
        throw new Error("magician_inspection_target_stale");
      if (!inspection) continue;
      const isWerewolf = inspection.camp === Camp.Wolf;
      const seerRole = ctx.world.getComponent(seerId, COMPONENT.Role);
      if (!activeNightAbility(seerRole, "seer_check", ctx.currentDay(), ability.id)) continue;
      const seerState = seerRole ? getSeerState(seerRole, ability.id) : undefined;
      if (receipt && (!receipt.isCurrent() || !effectiveIdentity?.isCurrent()))
        throw new Error("time_consort_inspection_target_stale");
      ctx.nativeNightEffects.commitReflectedTarget(receipt, day, seerId, "check");
      if (seerState) {
        recordSeerInspection(seerState, targetId, isWerewolf, inspection);
      }

      commitFoxInspection(ctx.world, ctx.state, target, day, () => scope.isOwnerCurrent(true));
      ctx.state.seerChecks.push({ seerId, targetId, isWerewolf, result: { ...inspection } });
      recordNightAbilityUse(ability, ctx.currentDay(), true);
      ctx.nativeNightEffects.recordModifierTarget(day, seerId, "check", () => targetId);
      ctx.nativeNightEffects.commitNativeReflection(
        "seer_check",
        ability,
        targetId,
        () => scope.life,
        () => scope.isOwnerCurrent() && !ability.disabled && !ability.deathExpired,
      );
      recordOwnNightAction(ctx.world, seerId, day, "check", targetId, false);
      ctx.events.push({
        timestamp: Date.now(),
        type: "seer_checked",
        payload: {
          actorId: seerId,
          ...(ability.source.kind === "native" ? {} : { abilityId: ability.id }),
          targetId,
          isWerewolf,
          result: { ...inspection },
        },
      });
    }
  },
};

/** 预言家夜间阶段列表。 */
export const SEER_NIGHT_STAGES: NightStageHandler[] = [seerCheckStage];
