/**
 * Executes Gargoyle, Psychic and Mirror inspection stages through their existing role-specific
 * policies. Inputs are active instances and validated target checks; outputs preserve inspection
 * records, use counts and optional-completion behavior. It does not unify their distinct failure
 * or target semantics.
 */
import { isMagicianBoard, resolveMagicianNightTarget } from "../magician/night_frame";
import { AliveComponent, aliveLifeVersion } from "../../../../core/domain/components/alive";
import { COMPONENT } from "../../../../core/domain/components/names";
import { Phase, Role } from "../../../../core/domain/model";
import type { NightStageContext, NightStageHandler } from "../../stages/night/contracts";
import {
  nightAbilityActors,
  recordNightAbilityUse,
  roleInspectionPolicy,
  type RoleInspectionPolicy,
  type NightAbility,
} from "../abilities";
import { getGargoyleState } from "../private_state";
import { resolveInspection } from "../inspection";
import {
  beginRoleInspectionNight,
  recordRoleInspectionCompletion,
  recordRoleInspectionNightCommit,
} from "./night_scope";
import { inspectionRequired } from "./policies";
import { roleInspectionTargets } from "./rules";
import { captureNightAbilityScope } from "../ability_scope";
import { captureAwakenedMirrorScope } from "../awakened_hidden_wolf/night_scope";

function finishOptionalInspection(
  ctx: NightStageContext,
  actorId: number,
  ability: NightAbility<"role_check">,
  day: number,
  reason: "passed" | "no_targets",
): void {
  recordNightAbilityUse(ability, day, false);
  ctx.events.push({
    timestamp: Date.now(),
    type: "role_inspection_skipped",
    payload: {
      actorId,
      ...(ability.source.kind === "native" ? {} : { abilityId: ability.id }),
      day,
      reason,
    },
  });
  recordRoleInspectionNightCommit(ctx.world, day, ctx.isCurrent);
}
async function executeInspections(
  ctx: NightStageContext,
  policy: RoleInspectionPolicy,
): Promise<void> {
  const day = ctx.currentDay();
  if (policy === "gargoyle") beginRoleInspectionNight(ctx.world, day);
  for (const { actorId, ability } of nightAbilityActors(ctx.world, "role_check", day)) {
    if (!ctx.isCurrent()) return;
    if (roleInspectionPolicy(ability.state) !== policy) continue;
    const scope = captureNightAbilityScope(
      ctx.world,
      actorId,
      ability,
      day,
      () => ctx.isCurrent() && ctx.currentDay() === day,
    );
    if (!scope) continue;
    const role = scope.role,
      gargoyleState = getGargoyleState(role),
      state = ability.state,
      abilityId = ability.id;
    const source = ability.source,
      sourceKind = source.kind;
    const sourceOwner = source.kind === "native" ? source.role : source.actorId;
    const sourceAbilityId =
      source.kind === "copy" || source.kind === "transfer" ? source.abilityId : undefined;
    const awakenedCurrent =
      source.kind === "native" && source.role === Role.AwakenedHiddenWolf
        ? captureAwakenedMirrorScope(
            ctx.world,
            actorId,
            ability,
            day,
            () => ctx.isCurrent() && ctx.currentDay() === day,
          )
        : () => true;
    const current = () =>
      awakenedCurrent?.() === true &&
      scope.isEligible() &&
      getGargoyleState(role) === gargoyleState &&
      roleInspectionPolicy(state) === policy &&
      ability.source === source &&
      source.kind === sourceKind &&
      (source.kind === "native" ? source.role : source.actorId) === sourceOwner &&
      (source.kind === "copy" || source.kind === "transfer" ? source.abilityId : undefined) ===
        sourceAbilityId;
    const exhausted = () =>
      policy === "gargoyle"
        ? recordRoleInspectionCompletion(ctx.world, actorId, day, ability, ctx.isCurrent)
        : finishOptionalInspection(ctx, actorId, ability, day, "no_targets");
    if (!current()) continue;
    if (!roleInspectionTargets(ctx.world, actorId, state).length) {
      exhausted();
      continue;
    }
    let completed = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (!current()) break;
      const targets = new Map(
        roleInspectionTargets(ctx.world, actorId, state).map((id) => {
          const target = ctx.world.getComponent(id, COMPONENT.Alive)!;
          return [id, { target, version: aliveLifeVersion(target) }] as const;
        }),
      );
      if (!targets.size) {
        exhausted();
        completed = true;
        break;
      }
      const request = ctx.makeRequest(actorId, ["inspect_role"], {
        stage:
          policy === "gargoyle"
            ? "role_inspection"
            : policy === "mirror"
              ? "mirror_girl"
              : "psychic",
        requiresAction: inspectionRequired(state),
        ability_id: abilityId,
        ...(sourceKind === "native" && sourceOwner === Role.AwakenedHiddenWolf
          ? { action_failure_policy: "error" as const, allow_fallback: false }
          : {}),
        ...(attempt ? { retry_attempt: attempt, retry_max: 2 } : {}),
      });
      if (!current()) break;
      const action = await ctx.actionProvider.getAction(request);
      if (!current()) break;
      if (action === null && !inspectionRequired(state)) {
        finishOptionalInspection(ctx, actorId, ability, day, "passed");
        if (policy === "gargoyle")
          recordRoleInspectionCompletion(ctx.world, actorId, day, ability, ctx.isCurrent);
        completed = true;
        break;
      }
      if (action?.name !== "inspect_role") continue;
      const validated = ctx.toolGateway.validateAndSanitize(ctx.world, actorId, action, {
        phase: Phase.Night,
        day,
        abilityId,
      });
      if (!current() || !validated.ok || validated.sanitizedCall?.name !== "inspect_role") continue;
      const targetId = validated.sanitizedCall.args.target_id,
        target = targets.get(targetId);
      const targetCurrent = () =>
        !!target &&
        ctx.world.getComponent(targetId, COMPONENT.Alive) === target.target &&
        target.target.alive &&
        target.version !== undefined &&
        aliveLifeVersion(target.target) === target.version;
      if (!targetCurrent() || !roleInspectionTargets(ctx.world, actorId, state).includes(targetId))
        continue;
      const mapping = isMagicianBoard(ctx.world)
        ? resolveMagicianNightTarget(ctx.world, day, targetId)
        : null;
      const result = resolveInspection(
        ctx.world,
        mapping?.effectiveId ?? targetId,
        "role",
        ctx.roleCatalog,
      );
      if (
        !current() ||
        !targetCurrent() ||
        !result ||
        (mapping !== null && !mapping.isCurrent()) ||
        !roleInspectionTargets(ctx.world, actorId, state).includes(targetId)
      )
        continue;
      state.lastTarget = targetId;
      state.lastDay = day;
      state.history.push({ day, targetId, result: { ...result } });
      recordNightAbilityUse(ability, day, true);
      ctx.events.push({
        timestamp: Date.now(),
        type: "role_inspected",
        payload: {
          actorId,
          ...(ability.source.kind === "native" ? {} : { abilityId: ability.id }),
          targetId,
          day,
          result: { ...result },
        },
      });
      if (policy === "gargoyle")
        recordRoleInspectionCompletion(ctx.world, actorId, day, ability, ctx.isCurrent);
      else recordRoleInspectionNightCommit(ctx.world, day, ctx.isCurrent);
      completed = true;
      break;
    }
    if (!completed && current()) {
      if (roleInspectionTargets(ctx.world, actorId, state).length)
        throw new Error(
          policy === "gargoyle"
            ? "role_inspection_required_action_missing"
            : "role_inspection_valid_action_missing",
        );
      exhausted();
    }
  }
}
export const ROLE_INSPECTION_STAGE: NightStageHandler = {
  id: "role_inspection",
  priority: 180,
  execute: (ctx) => executeInspections(ctx, "gargoyle"),
};
export const PSYCHIC_INSPECTION_STAGE: NightStageHandler = {
  id: "psychic_inspection",
  priority: 600,
  execute: (ctx) => executeInspections(ctx, "psychic"),
};

export const MIRROR_INSPECTION_STAGE: NightStageHandler = {
  id: "mirror_inspection",
  priority: 600,
  execute: (ctx) => executeInspections(ctx, "mirror"),
};
