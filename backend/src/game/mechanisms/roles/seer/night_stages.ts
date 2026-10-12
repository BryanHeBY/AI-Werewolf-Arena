/**
 * Executes ordinary Seer requests against captured ability and target authority.
 * Inputs are the night-stage context and validated check actions; outputs retain
 * original inspection, resource and event effects. State writes use the captured
 * Seer slot after Time Consort and before Fox effects, without rollback or a new
 * eligibility check; Demon Hunter's sealed native controller remains separate.
 */
import { isRadiantEclipseBoard } from "../radiant_eclipse/night_frame";
import {
  isScholarMentorBoard,
  recordScholarMentorNativeTarget,
} from "../scholar_mentor/night_frame";
import { isTimeConsortBoard, resolveTimeConsortTarget } from "../time_wolf_consort/night_frame";
import { commitTimeConsortEffect } from "../time_wolf_consort/effects";
import { isMagicianBoard, resolveMagicianNightTarget } from "../magician/night_frame";
import { isNightmareBoard } from "../nightmare_shadow/night_frame";
import { commitEvilKnightReflection } from "../evil_knight/state";
import { isEvilKnightBoard, assertEvilKnightNativeActor } from "../evil_knight/night_frame";
/** 文件说明：预言家夜间查验阶段处理。 */
import { demonHunterActorId } from "../demon_hunter/authority";
import { seerTargetAllowed } from "./target_policy";
import { COMPONENT } from "../../../../core/domain/components/names";
import { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, Phase, Role } from "../../../../core/domain/model";
import { NightStageHandler } from "../../stages/night/contracts";
import { getSeerState, recordSeerInspection } from "./state";
import { resolveInspection } from "../inspection";
import { activeNightAbility, nightAbilityActors, recordNightAbilityUse } from "../abilities";
import { captureNightAbilityScope } from "../ability_scope";
import { captureNightLife, livingNightLife } from "../../../../core/domain/night_effects";
import { recordOwnNightAction, luckyTargetAllowed } from "../night_action_history";

import { captureInspectionIdentity, commitFoxInspection } from "../cursed_fox/inspection_effect";

const seerCheckStage: NightStageHandler = {
  id: "seer_check",
  priority: 600,
  async execute(ctx): Promise<void> {
    if (demonHunterActorId(ctx.world) !== null) {
      const { executeDemonNativeNight } = await import("../demon_hunter/native_night_controller");
      await executeDemonNativeNight(ctx, "seer_check");
      return;
    }
    for (const { actorId: seerId, ability } of nightAbilityActors(
      ctx.world,
      "seer_check",
      ctx.currentDay(),
    )) {
      if (ability.activation === "lucky" || ability.activation === "black_market") continue;
      if (
        isEvilKnightBoard(ctx.world) &&
        (ability.source.kind !== "native" || ability.source.role !== Role.Seer)
      )
        throw new Error("evil_knight_seer_source_invalid");
      assertEvilKnightNativeActor(ctx.world, seerId, Role.Seer);
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
          ctx.world.getComponent<RoleComponent>(seerId, COMPONENT.Role),
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
        if (isRadiantEclipseBoard(ctx.world)) throw new Error("radiant_eclipse_seer_scope_stale");
        if (isScholarMentorBoard(ctx.world)) throw new Error("scholar_mentor_seer_scope_stale");
        if (isTimeConsortBoard(ctx.world)) throw new Error("time_consort_seer_scope_stale");
        continue;
      }
      const action = await ctx.actionProvider.getAction(req);
      if (!ctx.isCurrent()) return;
      if (!scope.isEligible()) {
        if (isRadiantEclipseBoard(ctx.world)) throw new Error("radiant_eclipse_seer_scope_stale");
        if (isScholarMentorBoard(ctx.world)) throw new Error("scholar_mentor_seer_scope_stale");
        if (isTimeConsortBoard(ctx.world)) throw new Error("time_consort_seer_scope_stale");
        continue;
      }
      if (action?.name !== "check_identity") {
        if (isRadiantEclipseBoard(ctx.world))
          throw new Error("radiant_eclipse_seer_action_missing");
        if (isScholarMentorBoard(ctx.world)) throw new Error("scholar_mentor_seer_action_missing");
        if (isTimeConsortBoard(ctx.world)) throw new Error("time_consort_seer_action_missing");
        if (isMagicianBoard(ctx.world)) throw new Error("magician_seer_action_missing");
        if (isEvilKnightBoard(ctx.world) || isNightmareBoard(ctx.world))
          throw new Error(
            isNightmareBoard(ctx.world)
              ? "nightmare_seer_action_missing"
              : "evil_knight_seer_action_missing",
          );
        continue;
      }

      const result = ctx.toolGateway.validateAndSanitize(ctx.world, seerId, action, {
        phase: Phase.Night,
        day: ctx.currentDay(),
        abilityId: ability.id,
      });
      if (!ctx.isCurrent()) return;
      if (!scope.isEligible()) {
        if (isRadiantEclipseBoard(ctx.world)) throw new Error("radiant_eclipse_seer_scope_stale");
        if (isScholarMentorBoard(ctx.world)) throw new Error("scholar_mentor_seer_scope_stale");
        if (isTimeConsortBoard(ctx.world)) throw new Error("time_consort_seer_scope_stale");
        continue;
      }
      if (!result.ok || !result.sanitizedCall) {
        if (isRadiantEclipseBoard(ctx.world))
          throw new Error("radiant_eclipse_seer_action_invalid");
        if (isScholarMentorBoard(ctx.world)) throw new Error("scholar_mentor_seer_action_invalid");
        if (isTimeConsortBoard(ctx.world)) throw new Error("time_consort_seer_action_invalid");
        if (isMagicianBoard(ctx.world)) throw new Error("magician_seer_action_invalid");
        if (isEvilKnightBoard(ctx.world) || isNightmareBoard(ctx.world))
          throw new Error(
            isNightmareBoard(ctx.world)
              ? "nightmare_seer_action_invalid"
              : "evil_knight_seer_action_invalid",
          );
        continue;
      }

      const targetId = result.sanitizedCall.args.target_id;
      const target = targets.get(targetId);
      if (!target || !livingNightLife(ctx.world, target) || !identities.get(targetId)?.isCurrent())
        continue;
      const mapping = isMagicianBoard(ctx.world)
        ? resolveMagicianNightTarget(ctx.world, day, targetId)
        : null;
      const receipt = isTimeConsortBoard(ctx.world)
        ? resolveTimeConsortTarget(ctx.world, day, seerId, targetId, "check")
        : null;
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
      const seerRole = ctx.world.getComponent<RoleComponent>(seerId, COMPONENT.Role);
      if (!activeNightAbility(seerRole, "seer_check", ctx.currentDay(), ability.id)) continue;
      const seerState = seerRole ? getSeerState(seerRole, ability.id) : undefined;
      if (receipt && (!receipt.isCurrent() || !effectiveIdentity?.isCurrent()))
        throw new Error("time_consort_inspection_target_stale");
      commitTimeConsortEffect(ctx, receipt, day, seerId, "check");
      if (seerState) {
        recordSeerInspection(seerState, targetId, isWerewolf, inspection);
      }

      commitFoxInspection(ctx.world, ctx.state, target, day, () => scope.isOwnerCurrent(true));
      ctx.state.seerChecks.push({ seerId, targetId, isWerewolf, result: { ...inspection } });
      recordNightAbilityUse(ability, ctx.currentDay(), true);
      if (isScholarMentorBoard(ctx.world))
        recordScholarMentorNativeTarget(ctx.world, day, seerId, "check", targetId);
      if (isEvilKnightBoard(ctx.world)) {
        if (ability.source.kind !== "native" || ability.source.role !== Role.Seer)
          throw new Error("evil_knight_seer_source_invalid");
        const reflection = commitEvilKnightReflection(
          ctx.world,
          ctx.state.evilKnightBindings?.get(targetId) ?? null,
          scope.life,
          "seer_check",
          () => scope.isOwnerCurrent() && !ability.disabled && !ability.deathExpired,
        );
        if (reflection) (ctx.state.retaliationAttacks ??= []).push(reflection);
      }
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
