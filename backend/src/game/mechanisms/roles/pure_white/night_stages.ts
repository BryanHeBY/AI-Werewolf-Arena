/**
 * Runs Pure White Girl and Wolf Witch inspection stages with their distinct native policies.
 * Inputs are current actors, legal targets and validated checks; outputs are inspection history
 * and the configured attack effects. It does not collapse camp inspection into role inspection
 * or alter night-stage order. Shared role-check actor enumeration uses the bound
 * query before this feature checks its native Pure White/Wolf Witch policy.
 */
import { COMPONENT } from "../../../../core/domain/components/names";
import type { RoleComponent } from "../../../../core/domain/components/role";
import { Camp, Phase, Role } from "../../../../core/domain/model";
import { DeathCause } from "../../../../core/domain/deaths";
import { captureNightLife, livingNightLife } from "../../../../core/domain/night_effects";
import type { NightStageContext, NightStageHandler } from "../../stages/night/contracts";
import { recordNightAbilityUse, roleInspectionPolicy } from "../abilities";
import { captureNightAbilityScope } from "../ability_scope";
import { resolveInspection } from "../inspection";
import { recordRoleInspectionNightCommit } from "../role_inspection/night_scope";
import { pureWhiteInspectionTargets } from "./rules";

async function execute(ctx: NightStageContext, policy: "pure_white" | "wolf_witch"): Promise<void> {
  const day = ctx.currentDay();
  const expectedRole = policy === "pure_white" ? Role.PureWhiteGirl : Role.WolfWitch;
  for (const { actorId, ability } of ctx.nightActors.actors("role_check", day)) {
    if (!ctx.isCurrent()) return;
    if (roleInspectionPolicy(ability.state) !== policy) continue;
    if (ability.source.kind !== "native" || ability.source.role !== expectedRole) continue;
    const scope = captureNightAbilityScope(
      ctx.world,
      actorId,
      ability,
      day,
      () => ctx.isCurrent() && ctx.currentDay() === day,
    );
    if (!scope || scope.role.role !== expectedRole) continue;
    const current = () => scope.isEligible() && roleInspectionPolicy(ability.state) === policy;
    const close = (reason: "passed" | "no_targets") => {
      if (!current()) return;
      recordNightAbilityUse(ability, day, false);
      ctx.events.push({
        timestamp: Date.now(),
        type: "role_inspection_skipped",
        payload: { actorId, day, reason },
      });
      recordRoleInspectionNightCommit(ctx.world, day, ctx.isCurrent);
    };
    const targets = new Map(
      pureWhiteInspectionTargets(ctx.world, actorId, policy).map((id) => {
        const life = captureNightLife(ctx.world, id);
        const role = ctx.world.getComponent(id, COMPONENT.Role);
        return [id, { life, role, identity: role?.role, camp: role?.camp }] as const;
      }),
    );
    if (!current()) continue;
    if (!targets.size) {
      close("no_targets");
      continue;
    }
    const request = ctx.makeRequest(actorId, ["inspect_night_identity"], {
      stage: policy === "pure_white" ? "pure_white_girl" : "wolf_witch",
      requiresAction: true,
      ability_id: ability.id,
      action_failure_policy: "error",
      allow_fallback: false,
    });
    const action = await ctx.actionProvider.getAction(request);
    if (!current()) continue;
    if (action?.name !== "inspect_night_identity")
      throw new Error("pure_white_inspection_action_missing");
    const validated = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
      phase: Phase.Night,
      day,
      abilityId: ability.id,
    });
    if (!current()) continue;
    if (!validated.ok || validated.sanitizedCall?.name !== "inspect_night_identity")
      throw new Error("pure_white_inspection_action_invalid");
    const args = validated.sanitizedCall.args;
    if (args.abstain && args.target_id === null) {
      close("passed");
      continue;
    }
    const targetId = args.target_id;
    if (targetId === null) throw new Error("pure_white_inspection_target_invalid");
    const target = targets.get(targetId);
    const targetCurrent = () =>
      !!target?.life &&
      !!target.role &&
      livingNightLife(ctx.world, target.life) &&
      ctx.world.getComponent(targetId, COMPONENT.Role) === target.role &&
      target.role.role === target.identity &&
      target.role.camp === target.camp &&
      pureWhiteInspectionTargets(ctx.world, actorId, policy).includes(targetId);
    if (!targetCurrent()) throw new Error("pure_white_inspection_target_stale");
    const result = resolveInspection(ctx.world, targetId, "role", ctx.roleCatalog);
    if (!current()) continue;
    if (!result || !targetCurrent()) throw new Error("pure_white_inspection_target_stale");
    ability.state.lastTarget = targetId;
    ability.state.lastDay = day;
    ability.state.history.push({ day, targetId, result: { ...result } });
    recordNightAbilityUse(ability, day, true);
    ctx.events.push({
      timestamp: Date.now(),
      type: "role_inspected",
      payload: { actorId, targetId, day, result: { ...result } },
    });
    recordRoleInspectionNightCommit(ctx.world, day, ctx.isCurrent);
    if (
      day >= 2 &&
      (policy === "pure_white"
        ? target!.camp === Camp.Wolf
        : target!.identity === Role.PureWhiteGirl)
    ) {
      (ctx.state.inspectionAttacks ??= []).push({
        actorId,
        target: target!.life!,
        cause:
          policy === "pure_white" ? DeathCause.PureWhiteInspection : DeathCause.WolfWitchInspection,
        isCurrent: () =>
          scope.isOwnerCurrent() &&
          !ability.disabled &&
          !ability.deathExpired &&
          targetCurrent() &&
          roleInspectionPolicy(ability.state) === policy,
      });
    }
  }
}
export const PURE_WHITE_INSPECTION_STAGE: NightStageHandler = {
  id: "pure_white_inspection",
  priority: 610,
  execute: (ctx) => execute(ctx, "pure_white"),
};
export const WOLF_WITCH_INSPECTION_STAGE: NightStageHandler = {
  id: "wolf_witch_inspection",
  priority: 620,
  execute: (ctx) => execute(ctx, "wolf_witch"),
};
